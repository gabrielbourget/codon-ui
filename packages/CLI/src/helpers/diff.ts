import { existsSync, promises as fs } from "fs"
import path from "path"

import { diffLines } from "diff"
import { z } from "zod"

import { consumerLockfileDependencySchema, consumerTargetRoleSchema } from "./consumerContract"
import { createStatusReport, type TStatusFinding, type TStatusReport } from "./status"

const DIFF_SCHEMA_VERSION = 1

const DIFF_FILE_STATE__REGISTRY_OWNED = "registry-owned"
const DIFF_FILE_STATE__LOCALLY_MODIFIED = "locally-modified"
const DIFF_FILE_STATE__MISSING = "missing"
const DIFF_FILE_STATE__UNKNOWN = "unknown"
const DIFF_FILE_STATE__CONSUMER_OWNED_SUPPORT = "consumer-owned-support"
const DIFF_FILE_STATE__EJECTED = "ejected"

const DIFF_SOURCE_STATE__UP_TO_DATE = "up-to-date"
const DIFF_SOURCE_STATE__SOURCE_CHANGED = "source-changed"
const DIFF_SOURCE_STATE__UNKNOWN = "unknown"

const DIFF_COMPARISON__NO_CHANGE = "no-change"
const DIFF_COMPARISON__SOURCE_CHANGED = "source-changed"
const DIFF_COMPARISON__LOCAL_MODIFICATION = "local-modification"
const DIFF_COMPARISON__LOCAL_AND_SOURCE_CHANGED = "local-and-source-changed"
const DIFF_COMPARISON__MISSING_LOCAL_FILE = "missing-local-file"
const DIFF_COMPARISON__UNKNOWN_OWNERSHIP = "unknown-ownership"
const DIFF_COMPARISON__CONSUMER_OWNED_SUPPORT = "consumer-owned-support"
const DIFF_COMPARISON__CONSUMER_OWNED_SUPPORT_SOURCE_CHANGED = "consumer-owned-support-source-changed"
const DIFF_COMPARISON__EJECTED = "ejected"
const DIFF_COMPARISON__SOURCE_UNAVAILABLE = "source-unavailable"

const DIFF_RECOMMENDATION__NONE = "none"
const DIFF_RECOMMENDATION__REVIEW_SOURCE_CHANGE = "review-source-change"
const DIFF_RECOMMENDATION__REVIEW_LOCAL_AND_SOURCE_CHANGE = "review-local-and-source-change"
const DIFF_RECOMMENDATION__PRESERVE_LOCAL_CHANGE = "preserve-local-change"
const DIFF_RECOMMENDATION__PRESERVE_MISSING_FILE = "preserve-missing-file"
const DIFF_RECOMMENDATION__PRESERVE_UNKNOWN = "preserve-unknown"
const DIFF_RECOMMENDATION__PRESERVE_CONSUMER_OWNED_SUPPORT = "preserve-consumer-owned-support"
const DIFF_RECOMMENDATION__PRESERVE_EJECTED = "preserve-ejected"
const DIFF_RECOMMENDATION__INSPECT_SOURCE = "inspect-source"

const DIFF_SEGMENT_KIND__CONTEXT = "context"
const DIFF_SEGMENT_KIND__REGISTRY_SOURCE = "registry-source"
const DIFF_SEGMENT_KIND__CONSUMER_LOCAL = "consumer-local"

const DIFF_FILE_STATES = [
  DIFF_FILE_STATE__REGISTRY_OWNED,
  DIFF_FILE_STATE__LOCALLY_MODIFIED,
  DIFF_FILE_STATE__MISSING,
  DIFF_FILE_STATE__UNKNOWN,
  DIFF_FILE_STATE__CONSUMER_OWNED_SUPPORT,
  DIFF_FILE_STATE__EJECTED,
] as const

const DIFF_SOURCE_STATES = [
  DIFF_SOURCE_STATE__UP_TO_DATE,
  DIFF_SOURCE_STATE__SOURCE_CHANGED,
  DIFF_SOURCE_STATE__UNKNOWN,
] as const

const DIFF_COMPARISONS = [
  DIFF_COMPARISON__NO_CHANGE,
  DIFF_COMPARISON__SOURCE_CHANGED,
  DIFF_COMPARISON__LOCAL_MODIFICATION,
  DIFF_COMPARISON__LOCAL_AND_SOURCE_CHANGED,
  DIFF_COMPARISON__MISSING_LOCAL_FILE,
  DIFF_COMPARISON__UNKNOWN_OWNERSHIP,
  DIFF_COMPARISON__CONSUMER_OWNED_SUPPORT,
  DIFF_COMPARISON__CONSUMER_OWNED_SUPPORT_SOURCE_CHANGED,
  DIFF_COMPARISON__EJECTED,
  DIFF_COMPARISON__SOURCE_UNAVAILABLE,
] as const

const DIFF_RECOMMENDATIONS = [
  DIFF_RECOMMENDATION__NONE,
  DIFF_RECOMMENDATION__REVIEW_SOURCE_CHANGE,
  DIFF_RECOMMENDATION__REVIEW_LOCAL_AND_SOURCE_CHANGE,
  DIFF_RECOMMENDATION__PRESERVE_LOCAL_CHANGE,
  DIFF_RECOMMENDATION__PRESERVE_MISSING_FILE,
  DIFF_RECOMMENDATION__PRESERVE_UNKNOWN,
  DIFF_RECOMMENDATION__PRESERVE_CONSUMER_OWNED_SUPPORT,
  DIFF_RECOMMENDATION__PRESERVE_EJECTED,
  DIFF_RECOMMENDATION__INSPECT_SOURCE,
] as const

const DIFF_SEGMENT_KINDS = [
  DIFF_SEGMENT_KIND__CONTEXT,
  DIFF_SEGMENT_KIND__REGISTRY_SOURCE,
  DIFF_SEGMENT_KIND__CONSUMER_LOCAL,
] as const

const diffFindingSchema = z
  .object({
    code: z.string().min(1),
    itemName: z.string().min(1).optional(),
    message: z.string().min(1),
    severity: z.string().min(1),
    sourcePath: z.string().min(1).optional(),
    targetPath: z.string().min(1).optional(),
  })
  .strict()

const diffSegmentSchema = z
  .object({
    kind: z.enum(DIFF_SEGMENT_KINDS),
    value: z.string(),
  })
  .strict()

const diffFileSchema = z
  .object({
    comparison: z.enum(DIFF_COMPARISONS),
    currentHash: z.string().min(1).optional(),
    currentSourceHash: z.string().min(1).optional(),
    installedHash: z.string().min(1),
    itemName: z.string().min(1),
    path: z.string().min(1),
    recommendation: z.enum(DIFF_RECOMMENDATIONS),
    reviewRequired: z.boolean(),
    sourceHash: z.string().min(1),
    sourcePath: z.string().min(1).optional(),
    sourceState: z.enum(DIFF_SOURCE_STATES),
    sourceToLocalDiff: z.array(diffSegmentSchema).default([]),
    state: z.enum(DIFF_FILE_STATES),
    targetRole: consumerTargetRoleSchema,
  })
  .strict()

export const diffReportSchema = z
  .object({
    cwd: z.string().min(1),
    dependencies: z.array(consumerLockfileDependencySchema).default([]),
    effects: z
      .object({
        installsDependencies: z.literal(false),
        writesConfig: z.literal(false),
        writesFiles: z.literal(false),
        writesLockfile: z.literal(false),
      })
      .strict(),
    files: z.array(diffFileSchema).default([]),
    findings: z.array(diffFindingSchema).default([]),
    item: z
      .object({
        fileCount: z.number().int().nonnegative(),
        name: z.string().min(1),
        sourceIdentity: z.string().min(1),
        sourceState: z.enum(DIFF_SOURCE_STATES),
        state: z.enum(DIFF_FILE_STATES),
      })
      .strict()
      .optional(),
    itemName: z.string().min(1),
    registrySource: z
      .object({
        path: z.string().min(1).optional(),
        sourceIdentity: z.string().min(1).optional(),
        status: z.enum(["loaded", "unavailable", "not-requested"]),
      })
      .strict(),
    schemaVersion: z.literal(DIFF_SCHEMA_VERSION).default(DIFF_SCHEMA_VERSION),
    status: z
      .object({
        config: z.enum(["present", "missing", "invalid"]),
        lockfile: z.enum(["present", "missing", "invalid"]),
      })
      .strict(),
    summary: z
      .object({
        comparisonStates: z.record(z.enum(DIFF_COMPARISONS), z.number().int().nonnegative()),
        fileCount: z.number().int().nonnegative(),
        localChangeCount: z.number().int().nonnegative(),
        preservationRequiredCount: z.number().int().nonnegative(),
        recommendationStates: z.record(z.enum(DIFF_RECOMMENDATIONS), z.number().int().nonnegative()),
        reviewRequiredCount: z.number().int().nonnegative(),
        sourceChangedCount: z.number().int().nonnegative(),
        sourceUnavailableCount: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()

export type TDiffFile = z.infer<typeof diffFileSchema>
export type TDiffReport = z.infer<typeof diffReportSchema>

export type TCreateDiffReportOptions = {
  cwd: string
  itemName: string
  registrySourcePath?: string
}

const registrySourceRootSchema = z
  .object({
    sourceRoot: z.string().min(1).optional(),
  })
  .passthrough()

const createEmptyRecord = <TKey extends string>(keys: readonly TKey[]): Record<TKey, number> =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<TKey, number>

const readRegistrySourceRoot = async (registrySourcePath?: string) => {
  if (!registrySourcePath) return undefined

  const registrySource = registrySourceRootSchema.parse(JSON.parse(await fs.readFile(registrySourcePath, "utf8")))

  return path.resolve(path.dirname(registrySourcePath), registrySource.sourceRoot ?? ".")
}

const readOptionalTextFile = async (filePath?: string) => {
  if (!filePath || !existsSync(filePath)) return undefined

  return fs.readFile(filePath, "utf8")
}

const createSourceToLocalDiff = ({
  currentContent,
  currentSourceContent,
}: {
  currentContent?: string
  currentSourceContent?: string
}) => {
  if (!currentContent || !currentSourceContent || currentContent === currentSourceContent) return []

  return diffLines(currentSourceContent, currentContent).map((segment) =>
    diffSegmentSchema.parse({
      kind: segment.added
        ? DIFF_SEGMENT_KIND__CONSUMER_LOCAL
        : segment.removed
          ? DIFF_SEGMENT_KIND__REGISTRY_SOURCE
          : DIFF_SEGMENT_KIND__CONTEXT,
      value: segment.value,
    }),
  )
}

const classifyDiffFile = ({
  sourceState,
  state,
}: {
  sourceState: TStatusReport["files"][number]["sourceState"]
  state: TStatusReport["files"][number]["state"]
}) => {
  if (state === DIFF_FILE_STATE__MISSING) {
    return {
      comparison: DIFF_COMPARISON__MISSING_LOCAL_FILE,
      recommendation: DIFF_RECOMMENDATION__PRESERVE_MISSING_FILE,
      reviewRequired: true,
    }
  }

  if (state === DIFF_FILE_STATE__EJECTED) {
    return {
      comparison: DIFF_COMPARISON__EJECTED,
      recommendation: DIFF_RECOMMENDATION__PRESERVE_EJECTED,
      reviewRequired: true,
    }
  }

  if (state === DIFF_FILE_STATE__UNKNOWN) {
    return {
      comparison: DIFF_COMPARISON__UNKNOWN_OWNERSHIP,
      recommendation: DIFF_RECOMMENDATION__PRESERVE_UNKNOWN,
      reviewRequired: true,
    }
  }

  if (state === DIFF_FILE_STATE__CONSUMER_OWNED_SUPPORT) {
    return {
      comparison:
        sourceState === DIFF_SOURCE_STATE__SOURCE_CHANGED
          ? DIFF_COMPARISON__CONSUMER_OWNED_SUPPORT_SOURCE_CHANGED
          : DIFF_COMPARISON__CONSUMER_OWNED_SUPPORT,
      recommendation: DIFF_RECOMMENDATION__PRESERVE_CONSUMER_OWNED_SUPPORT,
      reviewRequired: sourceState !== DIFF_SOURCE_STATE__UP_TO_DATE,
    }
  }

  if (state === DIFF_FILE_STATE__LOCALLY_MODIFIED && sourceState === DIFF_SOURCE_STATE__SOURCE_CHANGED) {
    return {
      comparison: DIFF_COMPARISON__LOCAL_AND_SOURCE_CHANGED,
      recommendation: DIFF_RECOMMENDATION__REVIEW_LOCAL_AND_SOURCE_CHANGE,
      reviewRequired: true,
    }
  }

  if (state === DIFF_FILE_STATE__LOCALLY_MODIFIED) {
    return {
      comparison: DIFF_COMPARISON__LOCAL_MODIFICATION,
      recommendation: DIFF_RECOMMENDATION__PRESERVE_LOCAL_CHANGE,
      reviewRequired: true,
    }
  }

  if (sourceState === DIFF_SOURCE_STATE__UNKNOWN) {
    return {
      comparison: DIFF_COMPARISON__SOURCE_UNAVAILABLE,
      recommendation: DIFF_RECOMMENDATION__INSPECT_SOURCE,
      reviewRequired: true,
    }
  }

  if (sourceState === DIFF_SOURCE_STATE__SOURCE_CHANGED) {
    return {
      comparison: DIFF_COMPARISON__SOURCE_CHANGED,
      recommendation: DIFF_RECOMMENDATION__REVIEW_SOURCE_CHANGE,
      reviewRequired: true,
    }
  }

  return {
    comparison: DIFF_COMPARISON__NO_CHANGE,
    recommendation: DIFF_RECOMMENDATION__NONE,
    reviewRequired: false,
  }
}

const createDiffFile = async ({
  cwd,
  file,
  sourceRoot,
}: {
  cwd: string
  file: TStatusReport["files"][number]
  sourceRoot?: string
}) => {
  const classification = classifyDiffFile({
    sourceState: file.sourceState,
    state: file.state,
  })
  const currentContent = await readOptionalTextFile(path.resolve(cwd, file.path))
  const currentSourceContent = await readOptionalTextFile(
    sourceRoot && file.sourcePath ? path.resolve(sourceRoot, file.sourcePath) : undefined,
  )

  return diffFileSchema.parse({
    ...file,
    ...classification,
    sourceToLocalDiff: createSourceToLocalDiff({
      currentContent,
      currentSourceContent,
    }),
  })
}

export const createDiffReport = async ({
  cwd,
  itemName,
  registrySourcePath,
}: TCreateDiffReportOptions): Promise<TDiffReport> => {
  const statusReport = await createStatusReport({
    cwd,
    itemName,
    registrySourcePath,
  })
  const sourceRoot =
    statusReport.registrySource.status === "loaded"
      ? await readRegistrySourceRoot(statusReport.registrySource.path)
      : undefined
  const files = await Promise.all(
    statusReport.files.map((file) =>
      createDiffFile({
        cwd,
        file,
        sourceRoot,
      }),
    ),
  )
  const comparisonStates = createEmptyRecord(DIFF_COMPARISONS)
  const recommendationStates = createEmptyRecord(DIFF_RECOMMENDATIONS)

  files.forEach((file) => {
    comparisonStates[file.comparison] += 1
    recommendationStates[file.recommendation] += 1
  })

  const findings: TStatusFinding[] = statusReport.findings
  const statusItem = statusReport.items.find((item) => item.name === itemName)
  const item = statusItem
    ? {
        fileCount: statusItem.fileCount,
        name: statusItem.name,
        sourceIdentity: statusItem.sourceIdentity,
        sourceState: statusItem.sourceState,
        state: statusItem.state,
      }
    : undefined

  return diffReportSchema.parse({
    cwd,
    dependencies: statusReport.dependencies,
    effects: {
      installsDependencies: false,
      writesConfig: false,
      writesFiles: false,
      writesLockfile: false,
    },
    files,
    findings,
    item,
    itemName,
    registrySource: statusReport.registrySource,
    status: {
      config: statusReport.config.status,
      lockfile: statusReport.lockfile.status,
    },
    summary: {
      comparisonStates,
      fileCount: files.length,
      localChangeCount:
        comparisonStates[DIFF_COMPARISON__LOCAL_MODIFICATION] +
        comparisonStates[DIFF_COMPARISON__LOCAL_AND_SOURCE_CHANGED],
      preservationRequiredCount: files.filter((file) => file.recommendation.startsWith("preserve-")).length,
      recommendationStates,
      reviewRequiredCount: files.filter((file) => file.reviewRequired).length,
      sourceChangedCount:
        comparisonStates[DIFF_COMPARISON__SOURCE_CHANGED] +
        comparisonStates[DIFF_COMPARISON__LOCAL_AND_SOURCE_CHANGED] +
        comparisonStates[DIFF_COMPARISON__CONSUMER_OWNED_SUPPORT_SOURCE_CHANGED],
      sourceUnavailableCount: comparisonStates[DIFF_COMPARISON__SOURCE_UNAVAILABLE],
    },
  })
}
