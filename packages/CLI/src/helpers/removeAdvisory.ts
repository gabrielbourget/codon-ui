import { existsSync, promises as fs } from "fs"
import path from "path"

import { z } from "zod"

import {
  AMINO_UI_LOCK_FILE_NAME,
  consumerLockfileDependencySchema,
  consumerLockfileSchema,
  consumerTargetRoleSchema,
} from "./consumerContract"
import { INSTALL_PLAN_FINDING_SEVERITIES } from "./installPlan"
import { createStatusReport, type TStatusReport } from "./status"

const REMOVE_ADVISORY_SCHEMA_VERSION = 1

const REMOVE_ADVISORY_ITEM_STATE__REMOVE_CANDIDATE = "remove-candidate"
const REMOVE_ADVISORY_ITEM_STATE__LOCKFILE_CLEANUP_CANDIDATE = "lockfile-cleanup-candidate"
const REMOVE_ADVISORY_ITEM_STATE__REVIEW_REQUIRED = "review-required"
const REMOVE_ADVISORY_ITEM_STATE__UNAVAILABLE = "unavailable"

const REMOVE_ADVISORY_ACTION__REMOVE_CANDIDATE = "remove-candidate"
const REMOVE_ADVISORY_ACTION__LOCKFILE_CLEANUP_CANDIDATE = "lockfile-cleanup-candidate"
const REMOVE_ADVISORY_ACTION__REVIEW_SUPPORT_FILE = "review-support-file"
const REMOVE_ADVISORY_ACTION__REVIEW_SHARED_FILE = "review-shared-file"
const REMOVE_ADVISORY_ACTION__PRESERVE_LOCAL_CHANGE = "preserve-local-change"
const REMOVE_ADVISORY_ACTION__PRESERVE_CONSUMER_OWNED_SUPPORT = "preserve-consumer-owned-support"
const REMOVE_ADVISORY_ACTION__PRESERVE_UNKNOWN = "preserve-unknown"
const REMOVE_ADVISORY_ACTION__PRESERVE_EJECTED = "preserve-ejected"

const REMOVE_ADVISORY_ITEM_STATES = [
  REMOVE_ADVISORY_ITEM_STATE__REMOVE_CANDIDATE,
  REMOVE_ADVISORY_ITEM_STATE__LOCKFILE_CLEANUP_CANDIDATE,
  REMOVE_ADVISORY_ITEM_STATE__REVIEW_REQUIRED,
  REMOVE_ADVISORY_ITEM_STATE__UNAVAILABLE,
] as const

const REMOVE_ADVISORY_ACTIONS = [
  REMOVE_ADVISORY_ACTION__REMOVE_CANDIDATE,
  REMOVE_ADVISORY_ACTION__LOCKFILE_CLEANUP_CANDIDATE,
  REMOVE_ADVISORY_ACTION__REVIEW_SUPPORT_FILE,
  REMOVE_ADVISORY_ACTION__REVIEW_SHARED_FILE,
  REMOVE_ADVISORY_ACTION__PRESERVE_LOCAL_CHANGE,
  REMOVE_ADVISORY_ACTION__PRESERVE_CONSUMER_OWNED_SUPPORT,
  REMOVE_ADVISORY_ACTION__PRESERVE_UNKNOWN,
  REMOVE_ADVISORY_ACTION__PRESERVE_EJECTED,
] as const

const removeAdvisoryFindingSchema = z
  .object({
    code: z.string().min(1),
    itemName: z.string().min(1).optional(),
    message: z.string().min(1),
    severity: z.enum(INSTALL_PLAN_FINDING_SEVERITIES),
    sourcePath: z.string().min(1).optional(),
    targetPath: z.string().min(1).optional(),
  })
  .strict()

const removeAdvisoryFileSchema = z
  .object({
    action: z.enum(REMOVE_ADVISORY_ACTIONS),
    blocksAutomaticRemove: z.boolean(),
    currentHash: z.string().min(1).optional(),
    currentSourceHash: z.string().min(1).optional(),
    installedHash: z.string().min(1),
    itemName: z.string().min(1),
    path: z.string().min(1),
    preservationRequired: z.boolean(),
    removalTarget: z.enum(["file-and-lockfile", "lockfile-only", "none"]),
    reviewRequired: z.boolean(),
    sharedReferenceCount: z.number().int().nonnegative(),
    sourceHash: z.string().min(1),
    sourcePath: z.string().min(1).optional(),
    sourceState: z.string().min(1),
    state: z.string().min(1),
    targetRole: consumerTargetRoleSchema,
  })
  .strict()

export const removeAdvisoryReportSchema = z
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
    files: z.array(removeAdvisoryFileSchema).default([]),
    findings: z.array(removeAdvisoryFindingSchema).default([]),
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
    itemName: z.string().min(1),
    itemRemoveState: z.enum(REMOVE_ADVISORY_ITEM_STATES),
    registrySource: z
      .object({
        path: z.string().min(1).optional(),
        sourceIdentity: z.string().min(1).optional(),
        status: z.enum(["loaded", "unavailable", "not-requested"]),
      })
      .strict(),
    schemaVersion: z.literal(REMOVE_ADVISORY_SCHEMA_VERSION).default(REMOVE_ADVISORY_SCHEMA_VERSION),
    status: z
      .object({
        config: z.enum(["present", "missing", "invalid"]),
        lockfile: z.enum(["present", "missing", "invalid"]),
      })
      .strict(),
    summary: z
      .object({
        actionStates: z.record(z.enum(REMOVE_ADVISORY_ACTIONS), z.number().int().nonnegative()),
        automaticBlockerCount: z.number().int().nonnegative(),
        dependencyStates: z.record(z.string().min(1), z.number().int().nonnegative()),
        fileCount: z.number().int().nonnegative(),
        lockfileCleanupCandidateCount: z.number().int().nonnegative(),
        preservationRequiredCount: z.number().int().nonnegative(),
        removableFileCount: z.number().int().nonnegative(),
        reviewRequiredCount: z.number().int().nonnegative(),
        sharedReferenceCount: z.number().int().nonnegative(),
        supportReviewCount: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()

export type TRemoveAdvisoryFile = z.infer<typeof removeAdvisoryFileSchema>
export type TRemoveAdvisoryReport = z.infer<typeof removeAdvisoryReportSchema>

export type TCreateRemoveAdvisoryReportOptions = {
  cwd: string
  itemName: string
  registrySourcePath?: string
}

const createEmptyRecord = <TKey extends string>(keys: readonly TKey[]): Record<TKey, number> =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<TKey, number>

const readLockfilePathReferences = async (cwd: string) => {
  const lockfilePath = path.join(cwd, AMINO_UI_LOCK_FILE_NAME)
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
}): (typeof REMOVE_ADVISORY_ACTIONS)[number] => {
  if (file.state === "locally-modified") return REMOVE_ADVISORY_ACTION__PRESERVE_LOCAL_CHANGE
  if (file.state === "consumer-owned-support") return REMOVE_ADVISORY_ACTION__PRESERVE_CONSUMER_OWNED_SUPPORT
  if (file.state === "unknown") return REMOVE_ADVISORY_ACTION__PRESERVE_UNKNOWN
  if (file.state === "ejected") return REMOVE_ADVISORY_ACTION__PRESERVE_EJECTED
  if (sharedReferenceCount > 0) return REMOVE_ADVISORY_ACTION__REVIEW_SHARED_FILE
  if (file.targetRole !== "components") return REMOVE_ADVISORY_ACTION__REVIEW_SUPPORT_FILE
  if (file.state === "missing") return REMOVE_ADVISORY_ACTION__LOCKFILE_CLEANUP_CANDIDATE

  return REMOVE_ADVISORY_ACTION__REMOVE_CANDIDATE
}

const resolveRemovalTarget = (action: (typeof REMOVE_ADVISORY_ACTIONS)[number]) => {
  if (action === REMOVE_ADVISORY_ACTION__REMOVE_CANDIDATE) return "file-and-lockfile"
  if (action === REMOVE_ADVISORY_ACTION__LOCKFILE_CLEANUP_CANDIDATE) return "lockfile-only"

  return "none"
}

const resolvePreservationRequired = (action: (typeof REMOVE_ADVISORY_ACTIONS)[number]) =>
  action === REMOVE_ADVISORY_ACTION__PRESERVE_LOCAL_CHANGE ||
  action === REMOVE_ADVISORY_ACTION__PRESERVE_CONSUMER_OWNED_SUPPORT ||
  action === REMOVE_ADVISORY_ACTION__PRESERVE_UNKNOWN ||
  action === REMOVE_ADVISORY_ACTION__PRESERVE_EJECTED

const resolveReviewRequired = (action: (typeof REMOVE_ADVISORY_ACTIONS)[number]) =>
  action !== REMOVE_ADVISORY_ACTION__REMOVE_CANDIDATE && action !== REMOVE_ADVISORY_ACTION__LOCKFILE_CLEANUP_CANDIDATE

const createRemoveAdvisoryFile = ({
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

  return removeAdvisoryFileSchema.parse({
    action,
    blocksAutomaticRemove: reviewRequired,
    currentHash: file.currentHash,
    currentSourceHash: file.currentSourceHash,
    installedHash: file.installedHash,
    itemName: file.itemName,
    path: file.path,
    preservationRequired,
    removalTarget: resolveRemovalTarget(action),
    reviewRequired,
    sharedReferenceCount,
    sourceHash: file.sourceHash,
    sourcePath: file.sourcePath,
    sourceState: file.sourceState,
    state: file.state,
    targetRole: file.targetRole,
  })
}

const resolveItemRemoveState = (files: readonly TRemoveAdvisoryFile[]) => {
  if (files.length === 0) return REMOVE_ADVISORY_ITEM_STATE__UNAVAILABLE
  if (files.some((file) => file.blocksAutomaticRemove)) return REMOVE_ADVISORY_ITEM_STATE__REVIEW_REQUIRED
  if (files.some((file) => file.action === REMOVE_ADVISORY_ACTION__REMOVE_CANDIDATE)) {
    return REMOVE_ADVISORY_ITEM_STATE__REMOVE_CANDIDATE
  }
  if (files.some((file) => file.action === REMOVE_ADVISORY_ACTION__LOCKFILE_CLEANUP_CANDIDATE)) {
    return REMOVE_ADVISORY_ITEM_STATE__LOCKFILE_CLEANUP_CANDIDATE
  }

  return REMOVE_ADVISORY_ITEM_STATE__REVIEW_REQUIRED
}

export const createRemoveAdvisoryReport = async ({
  cwd,
  itemName,
  registrySourcePath,
}: TCreateRemoveAdvisoryReportOptions): Promise<TRemoveAdvisoryReport> => {
  const statusReport = await createStatusReport({
    cwd,
    itemName,
    registrySourcePath,
  })
  const pathReferences = await readLockfilePathReferences(cwd)
  const files = statusReport.files.map((file) =>
    createRemoveAdvisoryFile({
      file,
      pathReferences,
    }),
  )
  const actionStates = createEmptyRecord(REMOVE_ADVISORY_ACTIONS)
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

  return removeAdvisoryReportSchema.parse({
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
    itemName,
    itemRemoveState: resolveItemRemoveState(files),
    registrySource: statusReport.registrySource,
    status: {
      config: statusReport.config.status,
      lockfile: statusReport.lockfile.status,
    },
    summary: {
      actionStates,
      automaticBlockerCount: files.filter((file) => file.blocksAutomaticRemove).length,
      dependencyStates,
      fileCount: files.length,
      lockfileCleanupCandidateCount: files.filter(
        (file) => file.action === REMOVE_ADVISORY_ACTION__LOCKFILE_CLEANUP_CANDIDATE,
      ).length,
      preservationRequiredCount: files.filter((file) => file.preservationRequired).length,
      removableFileCount: files.filter((file) => file.action === REMOVE_ADVISORY_ACTION__REMOVE_CANDIDATE).length,
      reviewRequiredCount: files.filter((file) => file.reviewRequired).length,
      sharedReferenceCount: files.filter((file) => file.sharedReferenceCount > 0).length,
      supportReviewCount: files.filter((file) => file.action === REMOVE_ADVISORY_ACTION__REVIEW_SUPPORT_FILE).length,
    },
  })
}
