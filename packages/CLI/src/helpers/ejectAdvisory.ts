import { existsSync, promises as fs } from "fs"
import path from "path"

import { z } from "zod"

import {
  CODON_UI_LOCK_FILE_NAME,
  consumerLockfileDependencySchema,
  consumerLockfileSchema,
  consumerTargetRoleSchema,
} from "./consumerContract"
import { EJECT_TARGET__LOCKFILE_OWNERSHIP, EJECT_TARGET__NONE, EJECT_TARGETS } from "./ejectConstants"
import { INSTALL_PLAN_FINDING_SEVERITIES } from "./installPlan"
import { CLI_PROJECT_RESOURCE_STATUSES, CLI_REGISTRY_SOURCE_STATUSES } from "./reportConstants"
import { createStatusReport, type TStatusReport } from "./status"

const EJECT_ADVISORY_SCHEMA_VERSION = 1

const EJECT_ADVISORY_ITEM_STATE__EJECT_CANDIDATE = "eject-candidate"
const EJECT_ADVISORY_ITEM_STATE__ALREADY_EJECTED = "already-ejected"
const EJECT_ADVISORY_ITEM_STATE__REVIEW_REQUIRED = "review-required"
const EJECT_ADVISORY_ITEM_STATE__UNAVAILABLE = "unavailable"

const EJECT_ADVISORY_ACTION__EJECT_CANDIDATE = "eject-candidate"
const EJECT_ADVISORY_ACTION__REVIEW_MISSING_FILE = "review-missing-file"
const EJECT_ADVISORY_ACTION__REVIEW_SUPPORT_FILE = "review-support-file"
const EJECT_ADVISORY_ACTION__REVIEW_SHARED_FILE = "review-shared-file"
const EJECT_ADVISORY_ACTION__PRESERVE_LOCAL_CHANGE = "preserve-local-change"
const EJECT_ADVISORY_ACTION__PRESERVE_CONSUMER_OWNED_SUPPORT = "preserve-consumer-owned-support"
const EJECT_ADVISORY_ACTION__PRESERVE_UNKNOWN = "preserve-unknown"
const EJECT_ADVISORY_ACTION__ALREADY_EJECTED = "already-ejected"

const EJECT_ADVISORY_ITEM_STATES = [
  EJECT_ADVISORY_ITEM_STATE__EJECT_CANDIDATE,
  EJECT_ADVISORY_ITEM_STATE__ALREADY_EJECTED,
  EJECT_ADVISORY_ITEM_STATE__REVIEW_REQUIRED,
  EJECT_ADVISORY_ITEM_STATE__UNAVAILABLE,
] as const

const EJECT_ADVISORY_ACTIONS = [
  EJECT_ADVISORY_ACTION__EJECT_CANDIDATE,
  EJECT_ADVISORY_ACTION__REVIEW_MISSING_FILE,
  EJECT_ADVISORY_ACTION__REVIEW_SUPPORT_FILE,
  EJECT_ADVISORY_ACTION__REVIEW_SHARED_FILE,
  EJECT_ADVISORY_ACTION__PRESERVE_LOCAL_CHANGE,
  EJECT_ADVISORY_ACTION__PRESERVE_CONSUMER_OWNED_SUPPORT,
  EJECT_ADVISORY_ACTION__PRESERVE_UNKNOWN,
  EJECT_ADVISORY_ACTION__ALREADY_EJECTED,
] as const

const ejectAdvisoryFindingSchema = z
  .object({
    code: z.string().min(1),
    itemName: z.string().min(1).optional(),
    message: z.string().min(1),
    severity: z.enum(INSTALL_PLAN_FINDING_SEVERITIES),
    sourcePath: z.string().min(1).optional(),
    targetPath: z.string().min(1).optional(),
  })
  .strict()

const ejectAdvisoryFileSchema = z
  .object({
    action: z.enum(EJECT_ADVISORY_ACTIONS),
    blocksAutomaticEject: z.boolean(),
    currentHash: z.string().min(1).optional(),
    currentSourceHash: z.string().min(1).optional(),
    ejectionTarget: z.enum(EJECT_TARGETS),
    installedHash: z.string().min(1),
    itemName: z.string().min(1),
    path: z.string().min(1),
    preservationRequired: z.boolean(),
    reviewRequired: z.boolean(),
    sharedReferenceCount: z.number().int().nonnegative(),
    sourceHash: z.string().min(1),
    sourcePath: z.string().min(1).optional(),
    sourceState: z.string().min(1),
    state: z.string().min(1),
    targetRole: consumerTargetRoleSchema,
  })
  .strict()

export const ejectAdvisoryReportSchema = z
  .object({
    advisory: z.literal(true),
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
    files: z.array(ejectAdvisoryFileSchema).default([]),
    findings: z.array(ejectAdvisoryFindingSchema).default([]),
    item: z
      .object({
        fileCount: z.number().int().nonnegative(),
        name: z.string().min(1),
        sourceIdentity: z.string().min(1),
        sourceState: z.string().min(1),
        state: z.string().min(1),
      })
      .strict()
      .optional(),
    itemEjectState: z.enum(EJECT_ADVISORY_ITEM_STATES),
    itemName: z.string().min(1),
    registrySource: z
      .object({
        path: z.string().min(1).optional(),
        sourceIdentity: z.string().min(1).optional(),
        status: z.enum(CLI_REGISTRY_SOURCE_STATUSES),
      })
      .strict(),
    schemaVersion: z.literal(EJECT_ADVISORY_SCHEMA_VERSION).default(EJECT_ADVISORY_SCHEMA_VERSION),
    status: z
      .object({
        config: z.enum(CLI_PROJECT_RESOURCE_STATUSES),
        lockfile: z.enum(CLI_PROJECT_RESOURCE_STATUSES),
      })
      .strict(),
    summary: z
      .object({
        actionStates: z.record(z.enum(EJECT_ADVISORY_ACTIONS), z.number().int().nonnegative()),
        alreadyEjectedCount: z.number().int().nonnegative(),
        automaticBlockerCount: z.number().int().nonnegative(),
        dependencyStates: z.record(z.string().min(1), z.number().int().nonnegative()),
        ejectCandidateCount: z.number().int().nonnegative(),
        fileCount: z.number().int().nonnegative(),
        missingFileReviewCount: z.number().int().nonnegative(),
        preservationRequiredCount: z.number().int().nonnegative(),
        reviewRequiredCount: z.number().int().nonnegative(),
        sharedReferenceCount: z.number().int().nonnegative(),
        supportReviewCount: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()

export type TEjectAdvisoryFile = z.infer<typeof ejectAdvisoryFileSchema>
export type TEjectAdvisoryReport = z.infer<typeof ejectAdvisoryReportSchema>

export type TCreateEjectAdvisoryReportOptions = {
  cwd: string
  itemName: string
  registrySourcePath?: string
}

const createEmptyRecord = <TKey extends string>(keys: readonly TKey[]): Record<TKey, number> =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<TKey, number>

const readLockfilePathReferences = async (cwd: string) => {
  const lockfilePath = path.join(cwd, CODON_UI_LOCK_FILE_NAME)
  const pathReferences = new Map<string, Set<string>>()

  if (!existsSync(lockfilePath)) return pathReferences

  try {
    const lockfileData = consumerLockfileSchema.parse(JSON.parse(await fs.readFile(lockfilePath, "utf8")))

    Object.values(lockfileData.items).forEach((item) => {
      item.files.forEach((file) => {
        const itemReferences = pathReferences.get(file.path) ?? new Set<string>()

        itemReferences.add(item.name)
        pathReferences.set(file.path, itemReferences)
      })
    })
  } catch {
    return pathReferences
  }

  return pathReferences
}

const getSharedReferenceCount = ({
  file,
  pathReferences,
}: {
  file: TStatusReport["files"][number]
  pathReferences: ReadonlyMap<string, ReadonlySet<string>>
}) => {
  const itemReferences = pathReferences.get(file.path)

  if (!itemReferences) return 0

  return [...itemReferences].filter((itemName) => itemName !== file.itemName).length
}

const resolveAction = ({
  file,
  sharedReferenceCount,
}: {
  file: TStatusReport["files"][number]
  sharedReferenceCount: number
}): (typeof EJECT_ADVISORY_ACTIONS)[number] => {
  if (file.state === "ejected") return EJECT_ADVISORY_ACTION__ALREADY_EJECTED
  if (file.state === "locally-modified") return EJECT_ADVISORY_ACTION__PRESERVE_LOCAL_CHANGE
  if (file.state === "consumer-owned-support") return EJECT_ADVISORY_ACTION__PRESERVE_CONSUMER_OWNED_SUPPORT
  if (file.state === "unknown") return EJECT_ADVISORY_ACTION__PRESERVE_UNKNOWN
  if (file.state === "missing") return EJECT_ADVISORY_ACTION__REVIEW_MISSING_FILE
  if (sharedReferenceCount > 0) return EJECT_ADVISORY_ACTION__REVIEW_SHARED_FILE
  if (file.targetRole !== "components") return EJECT_ADVISORY_ACTION__REVIEW_SUPPORT_FILE

  return EJECT_ADVISORY_ACTION__EJECT_CANDIDATE
}

const resolveEjectionTarget = (action: (typeof EJECT_ADVISORY_ACTIONS)[number]) => {
  if (action === EJECT_ADVISORY_ACTION__EJECT_CANDIDATE) return EJECT_TARGET__LOCKFILE_OWNERSHIP

  return EJECT_TARGET__NONE
}

const resolvePreservationRequired = (action: (typeof EJECT_ADVISORY_ACTIONS)[number]) =>
  action === EJECT_ADVISORY_ACTION__PRESERVE_LOCAL_CHANGE ||
  action === EJECT_ADVISORY_ACTION__PRESERVE_CONSUMER_OWNED_SUPPORT ||
  action === EJECT_ADVISORY_ACTION__PRESERVE_UNKNOWN ||
  action === EJECT_ADVISORY_ACTION__ALREADY_EJECTED

const resolveReviewRequired = (action: (typeof EJECT_ADVISORY_ACTIONS)[number]) =>
  action !== EJECT_ADVISORY_ACTION__EJECT_CANDIDATE && action !== EJECT_ADVISORY_ACTION__ALREADY_EJECTED

const createEjectAdvisoryFile = ({
  file,
  pathReferences,
}: {
  file: TStatusReport["files"][number]
  pathReferences: ReadonlyMap<string, ReadonlySet<string>>
}) => {
  const sharedReferenceCount = getSharedReferenceCount({ file, pathReferences })
  const action = resolveAction({ file, sharedReferenceCount })
  const reviewRequired = resolveReviewRequired(action)
  const preservationRequired = resolvePreservationRequired(action)

  return ejectAdvisoryFileSchema.parse({
    action,
    blocksAutomaticEject: reviewRequired,
    currentHash: file.currentHash,
    currentSourceHash: file.currentSourceHash,
    ejectionTarget: resolveEjectionTarget(action),
    installedHash: file.installedHash,
    itemName: file.itemName,
    path: file.path,
    preservationRequired,
    reviewRequired,
    sharedReferenceCount,
    sourceHash: file.sourceHash,
    sourcePath: file.sourcePath,
    sourceState: file.sourceState,
    state: file.state,
    targetRole: file.targetRole,
  })
}

const resolveItemEjectState = (files: readonly TEjectAdvisoryFile[]) => {
  if (files.length === 0) return EJECT_ADVISORY_ITEM_STATE__UNAVAILABLE
  if (files.some((file) => file.blocksAutomaticEject)) return EJECT_ADVISORY_ITEM_STATE__REVIEW_REQUIRED
  if (files.every((file) => file.action === EJECT_ADVISORY_ACTION__ALREADY_EJECTED)) {
    return EJECT_ADVISORY_ITEM_STATE__ALREADY_EJECTED
  }
  if (files.some((file) => file.action === EJECT_ADVISORY_ACTION__EJECT_CANDIDATE)) {
    return EJECT_ADVISORY_ITEM_STATE__EJECT_CANDIDATE
  }

  return EJECT_ADVISORY_ITEM_STATE__REVIEW_REQUIRED
}

export const createEjectAdvisoryReport = async ({
  cwd,
  itemName,
  registrySourcePath,
}: TCreateEjectAdvisoryReportOptions): Promise<TEjectAdvisoryReport> => {
  const statusReport = await createStatusReport({
    cwd,
    itemName,
    registrySourcePath,
  })
  const pathReferences = await readLockfilePathReferences(cwd)
  const files = statusReport.files.map((file) =>
    createEjectAdvisoryFile({
      file,
      pathReferences,
    }),
  )
  const actionStates = createEmptyRecord(EJECT_ADVISORY_ACTIONS)
  const dependencyStates: Record<string, number> = {}
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

  files.forEach((file) => {
    actionStates[file.action] += 1
  })
  statusReport.dependencies.forEach((dependency) => {
    dependencyStates[dependency.status] = (dependencyStates[dependency.status] ?? 0) + 1
  })

  return ejectAdvisoryReportSchema.parse({
    advisory: true,
    cwd,
    dependencies: statusReport.dependencies,
    effects: {
      installsDependencies: false,
      writesConfig: false,
      writesFiles: false,
      writesLockfile: false,
    },
    files,
    findings: statusReport.findings,
    item,
    itemEjectState: resolveItemEjectState(files),
    itemName,
    registrySource: statusReport.registrySource,
    status: {
      config: statusReport.config.status,
      lockfile: statusReport.lockfile.status,
    },
    summary: {
      actionStates,
      alreadyEjectedCount: files.filter((file) => file.action === EJECT_ADVISORY_ACTION__ALREADY_EJECTED).length,
      automaticBlockerCount: files.filter((file) => file.blocksAutomaticEject).length,
      dependencyStates,
      ejectCandidateCount: files.filter((file) => file.action === EJECT_ADVISORY_ACTION__EJECT_CANDIDATE).length,
      fileCount: files.length,
      missingFileReviewCount: files.filter((file) => file.action === EJECT_ADVISORY_ACTION__REVIEW_MISSING_FILE).length,
      preservationRequiredCount: files.filter((file) => file.preservationRequired).length,
      reviewRequiredCount: files.filter((file) => file.reviewRequired).length,
      sharedReferenceCount: files.filter((file) => file.sharedReferenceCount > 0).length,
      supportReviewCount: files.filter((file) => file.action === EJECT_ADVISORY_ACTION__REVIEW_SUPPORT_FILE).length,
    },
  })
}
