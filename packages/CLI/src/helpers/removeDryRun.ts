import { z } from "zod"

import { consumerLockfileDependencySchema, consumerTargetRoleSchema } from "./consumerContract"
import { INSTALL_PLAN_FINDING_SEVERITY__ERROR, INSTALL_PLAN_FINDING_SEVERITIES } from "./installPlan"
import {
  createRemoveAdvisoryReport,
  removeAdvisoryDependencyCleanupSchema,
  type TRemoveAdvisoryFile,
  type TRemoveAdvisoryReport,
} from "./removeAdvisory"
import { REMOVE_TARGETS } from "./removeConstants"
import {
  CLI_DRY_RUN_WRITE_STATUSES,
  CLI_PROJECT_RESOURCE_STATUSES,
  CLI_REGISTRY_SOURCE_STATUSES,
  CLI_WRITE_STATUS__BLOCKED,
  CLI_WRITE_STATUS__NOT_WRITTEN,
  CLI_WRITE_STATUS__WOULD_WRITE,
} from "./reportConstants"

const REMOVE_DRY_RUN_SCHEMA_VERSION = 1

const REMOVE_DRY_RUN_ITEM_STATE__WOULD_REMOVE = "would-remove"
const REMOVE_DRY_RUN_ITEM_STATE__BLOCKED = "blocked"
const REMOVE_DRY_RUN_ITEM_STATE__UNAVAILABLE = "unavailable"

const REMOVE_DRY_RUN_ACTION__WOULD_REMOVE_FILE_AND_LOCKFILE = "would-remove-file-and-lockfile"
const REMOVE_DRY_RUN_ACTION__WOULD_REMOVE_LOCKFILE_RECORD = "would-remove-lockfile-record"
const REMOVE_DRY_RUN_ACTION__SKIP_REVIEW_REQUIRED = "skip-review-required"
const REMOVE_DRY_RUN_ACTION__SKIP_PRESERVED_LOCAL_CHANGE = "skip-preserved-local-change"
const REMOVE_DRY_RUN_ACTION__SKIP_CONSUMER_OWNED_SUPPORT = "skip-consumer-owned-support"
const REMOVE_DRY_RUN_ACTION__SKIP_UNKNOWN = "skip-unknown"
const REMOVE_DRY_RUN_ACTION__SKIP_EJECTED = "skip-ejected"
const REMOVE_DRY_RUN_ACTION__BLOCKED = "blocked"

const REMOVE_DRY_RUN_BLOCKER_KIND__FILE = "file"
const REMOVE_DRY_RUN_BLOCKER_KIND__ITEM = "item"

const REMOVE_DRY_RUN_ITEM_STATES = [
  REMOVE_DRY_RUN_ITEM_STATE__WOULD_REMOVE,
  REMOVE_DRY_RUN_ITEM_STATE__BLOCKED,
  REMOVE_DRY_RUN_ITEM_STATE__UNAVAILABLE,
] as const

const REMOVE_DRY_RUN_ACTIONS = [
  REMOVE_DRY_RUN_ACTION__WOULD_REMOVE_FILE_AND_LOCKFILE,
  REMOVE_DRY_RUN_ACTION__WOULD_REMOVE_LOCKFILE_RECORD,
  REMOVE_DRY_RUN_ACTION__SKIP_REVIEW_REQUIRED,
  REMOVE_DRY_RUN_ACTION__SKIP_PRESERVED_LOCAL_CHANGE,
  REMOVE_DRY_RUN_ACTION__SKIP_CONSUMER_OWNED_SUPPORT,
  REMOVE_DRY_RUN_ACTION__SKIP_UNKNOWN,
  REMOVE_DRY_RUN_ACTION__SKIP_EJECTED,
  REMOVE_DRY_RUN_ACTION__BLOCKED,
] as const

const REMOVE_DRY_RUN_BLOCKER_KINDS = [REMOVE_DRY_RUN_BLOCKER_KIND__FILE, REMOVE_DRY_RUN_BLOCKER_KIND__ITEM] as const

const removeDryRunFindingSchema = z
  .object({
    code: z.string().min(1),
    itemName: z.string().min(1).optional(),
    message: z.string().min(1),
    severity: z.enum(INSTALL_PLAN_FINDING_SEVERITIES),
    sourcePath: z.string().min(1).optional(),
    targetPath: z.string().min(1).optional(),
  })
  .strict()

const removeDryRunBlockerSchema = removeDryRunFindingSchema
  .extend({
    kind: z.enum(REMOVE_DRY_RUN_BLOCKER_KINDS),
    path: z.string().min(1).optional(),
  })
  .strict()

const removeDryRunFileSchema = z
  .object({
    advisoryAction: z.string().min(1),
    blockerCodes: z.array(z.string().min(1)).default([]),
    blocksStrictRemove: z.boolean(),
    currentHash: z.string().min(1).optional(),
    currentSourceHash: z.string().min(1).optional(),
    dryRunAction: z.enum(REMOVE_DRY_RUN_ACTIONS),
    installedHash: z.string().min(1),
    itemName: z.string().min(1),
    path: z.string().min(1),
    preservationRequired: z.boolean(),
    removalTarget: z.enum(REMOVE_TARGETS),
    reviewRequired: z.boolean(),
    sharedReferenceCount: z.number().int().nonnegative(),
    sourceHash: z.string().min(1),
    sourcePath: z.string().min(1).optional(),
    sourceState: z.string().min(1),
    state: z.string().min(1),
    targetRole: consumerTargetRoleSchema,
    wouldRemoveFile: z.boolean(),
    wouldRemoveLockfileRecord: z.boolean(),
  })
  .strict()

const removeDryRunOrphanItemSchema = z
  .object({
    dependencyDepth: z.number().int().positive(),
    dependedOnBy: z.array(z.string().min(1)).default([]),
    files: z.array(removeDryRunFileSchema).default([]),
    itemRemoveState: z.enum(REMOVE_DRY_RUN_ITEM_STATES),
    name: z.string().min(1),
    registryDependencies: z.array(z.string().min(1)).default([]),
  })
  .strict()

const removeDryRunOrphanCleanupSchema = z
  .object({
    blockedFileCount: z.number().int().nonnegative(),
    blockedItemCount: z.number().int().nonnegative(),
    enabled: z.boolean(),
    itemCount: z.number().int().nonnegative(),
    items: z.array(removeDryRunOrphanItemSchema).default([]),
    skippedFileCount: z.number().int().nonnegative(),
    wouldRemoveFileCount: z.number().int().nonnegative(),
    wouldRemoveItemCount: z.number().int().nonnegative(),
    wouldRemoveLockfileRecordCount: z.number().int().nonnegative(),
  })
  .strict()

export const removeDryRunReportSchema = z
  .object({
    blockers: z.array(removeDryRunBlockerSchema).default([]),
    cwd: z.string().min(1),
    dependencyCleanup: removeAdvisoryDependencyCleanupSchema,
    dependencies: z.array(consumerLockfileDependencySchema).default([]),
    dryRun: z.literal(true),
    effects: z
      .object({
        installsDependencies: z.literal(false),
        writesConfig: z.literal(false),
        writesFiles: z.literal(false),
        writesLockfile: z.literal(false),
      })
      .strict(),
    files: z.array(removeDryRunFileSchema).default([]),
    findings: z.array(removeDryRunFindingSchema).default([]),
    itemName: z.string().min(1),
    itemRemoveState: z.enum(REMOVE_DRY_RUN_ITEM_STATES),
    orphanCleanup: removeDryRunOrphanCleanupSchema,
    registrySource: z
      .object({
        path: z.string().min(1).optional(),
        sourceIdentity: z.string().min(1).optional(),
        status: z.enum(CLI_REGISTRY_SOURCE_STATUSES),
      })
      .strict(),
    schemaVersion: z.literal(REMOVE_DRY_RUN_SCHEMA_VERSION).default(REMOVE_DRY_RUN_SCHEMA_VERSION),
    status: z
      .object({
        config: z.enum(CLI_PROJECT_RESOURCE_STATUSES),
        lockfile: z.enum(CLI_PROJECT_RESOURCE_STATUSES),
      })
      .strict(),
    summary: z
      .object({
        blockedFileCount: z.number().int().nonnegative(),
        blockerCount: z.number().int().nonnegative(),
        dependencyStates: z.record(z.string().min(1), z.number().int().nonnegative()),
        fileActions: z.record(z.enum(REMOVE_DRY_RUN_ACTIONS), z.number().int().nonnegative()),
        fileCount: z.number().int().nonnegative(),
        lockfileCleanupCandidateCount: z.number().int().nonnegative(),
        preservationBlockerCount: z.number().int().nonnegative(),
        removeCandidateCount: z.number().int().nonnegative(),
        reviewBlockerCount: z.number().int().nonnegative(),
        sharedReferenceBlockerCount: z.number().int().nonnegative(),
        skippedFileCount: z.number().int().nonnegative(),
        supportReviewBlockerCount: z.number().int().nonnegative(),
        wouldRemoveFileCount: z.number().int().nonnegative(),
        wouldRemoveLockfileRecordCount: z.number().int().nonnegative(),
      })
      .strict(),
    wouldEffects: z
      .object({
        dependencies: z
          .object({
            plannedRemovalCount: z.number().int().nonnegative(),
            status: z.literal(CLI_WRITE_STATUS__NOT_WRITTEN),
          })
          .strict(),
        files: z
          .object({
            blockedCount: z.number().int().nonnegative(),
            skippedCount: z.number().int().nonnegative(),
            wouldRemoveCount: z.number().int().nonnegative(),
          })
          .strict(),
        lockfile: z
          .object({
            plannedFileCount: z.number().int().nonnegative(),
            plannedItem: z.string().min(1).optional(),
            status: z.enum(CLI_DRY_RUN_WRITE_STATUSES),
            wouldRemoveFileRecordCount: z.number().int().nonnegative(),
            wouldRemoveItem: z.boolean(),
          })
          .strict(),
        orphanCleanup: z
          .object({
            enabled: z.boolean(),
            plannedFileCount: z.number().int().nonnegative(),
            plannedItemCount: z.number().int().nonnegative(),
            status: z.enum(CLI_DRY_RUN_WRITE_STATUSES),
            wouldRemoveFileCount: z.number().int().nonnegative(),
            wouldRemoveLockfileRecordCount: z.number().int().nonnegative(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict()

export type TRemoveDryRunFile = z.infer<typeof removeDryRunFileSchema>
export type TRemoveDryRunReport = z.infer<typeof removeDryRunReportSchema>

export type TCreateRemoveDryRunReportOptions = {
  cwd: string
  includeOrphans?: boolean
  itemName: string
  registrySourcePath?: string
}

const createEmptyRecord = <TKey extends string>(keys: readonly TKey[]): Record<TKey, number> =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<TKey, number>

const createRemoveDryRunBlocker = ({
  code,
  itemName,
  kind,
  message,
  path,
  severity = INSTALL_PLAN_FINDING_SEVERITY__ERROR,
  sourcePath,
  targetPath,
}: z.infer<typeof removeDryRunBlockerSchema>) =>
  removeDryRunBlockerSchema.parse({
    code,
    itemName,
    kind,
    message,
    path,
    severity,
    sourcePath,
    targetPath,
  })

const createAdvisoryFileBlockers = (advisoryFile: TRemoveAdvisoryFile): z.infer<typeof removeDryRunBlockerSchema>[] => {
  if (!advisoryFile.blocksAutomaticRemove) return []

  const blockerCode = (() => {
    if (advisoryFile.action === "review-shared-file") return "remove-dry-run-shared-reference-blocker"
    if (advisoryFile.preservationRequired) return "remove-dry-run-preservation-blocker"

    return "remove-dry-run-review-blocker"
  })()

  return [
    createRemoveDryRunBlocker({
      code: blockerCode,
      itemName: advisoryFile.itemName,
      kind: REMOVE_DRY_RUN_BLOCKER_KIND__FILE,
      message: `Strict remove would preserve ${advisoryFile.path} because advisory action is "${advisoryFile.action}".`,
      path: advisoryFile.path,
      severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
      sourcePath: advisoryFile.sourcePath,
      targetPath: advisoryFile.path,
    }),
  ]
}

const createCandidateItemBlocker = (advisoryFile: TRemoveAdvisoryFile): z.infer<typeof removeDryRunBlockerSchema> =>
  createRemoveDryRunBlocker({
    code: "remove-dry-run-item-review-blocker",
    itemName: advisoryFile.itemName,
    kind: REMOVE_DRY_RUN_BLOCKER_KIND__ITEM,
    message: `Strict remove cannot preview removing ${advisoryFile.path} while another file in item "${advisoryFile.itemName}" requires review or preservation.`,
    path: advisoryFile.path,
    severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
    sourcePath: advisoryFile.sourcePath,
    targetPath: advisoryFile.path,
  })

const resolveSkipAction = (advisoryFile: TRemoveAdvisoryFile) => {
  if (advisoryFile.action === "preserve-local-change") return REMOVE_DRY_RUN_ACTION__SKIP_PRESERVED_LOCAL_CHANGE
  if (advisoryFile.action === "preserve-consumer-owned-support") {
    return REMOVE_DRY_RUN_ACTION__SKIP_CONSUMER_OWNED_SUPPORT
  }
  if (advisoryFile.action === "preserve-unknown") return REMOVE_DRY_RUN_ACTION__SKIP_UNKNOWN
  if (advisoryFile.action === "preserve-ejected") return REMOVE_DRY_RUN_ACTION__SKIP_EJECTED

  return REMOVE_DRY_RUN_ACTION__SKIP_REVIEW_REQUIRED
}

const createRemoveDryRunFile = ({
  advisoryFile,
  itemBlockerCount,
}: {
  advisoryFile: TRemoveAdvisoryFile
  itemBlockerCount: number
}) => {
  const advisoryBlockers = createAdvisoryFileBlockers(advisoryFile)
  const isCandidate = advisoryFile.action === "remove-candidate" || advisoryFile.action === "lockfile-cleanup-candidate"
  const itemBlockers = isCandidate && itemBlockerCount > 0 ? [createCandidateItemBlocker(advisoryFile)] : []
  const fileBlockers = [...advisoryBlockers, ...itemBlockers]
  const dryRunAction = (() => {
    if (itemBlockers.length > 0) return REMOVE_DRY_RUN_ACTION__BLOCKED
    if (advisoryFile.action === "remove-candidate") {
      return REMOVE_DRY_RUN_ACTION__WOULD_REMOVE_FILE_AND_LOCKFILE
    }
    if (advisoryFile.action === "lockfile-cleanup-candidate") {
      return REMOVE_DRY_RUN_ACTION__WOULD_REMOVE_LOCKFILE_RECORD
    }

    return resolveSkipAction(advisoryFile)
  })()
  const wouldRemoveFile = dryRunAction === REMOVE_DRY_RUN_ACTION__WOULD_REMOVE_FILE_AND_LOCKFILE
  const wouldRemoveLockfileRecord =
    dryRunAction === REMOVE_DRY_RUN_ACTION__WOULD_REMOVE_FILE_AND_LOCKFILE ||
    dryRunAction === REMOVE_DRY_RUN_ACTION__WOULD_REMOVE_LOCKFILE_RECORD

  return {
    blockers: fileBlockers,
    file: removeDryRunFileSchema.parse({
      advisoryAction: advisoryFile.action,
      blockerCodes: fileBlockers.map((blocker) => blocker.code),
      blocksStrictRemove: fileBlockers.length > 0,
      currentHash: advisoryFile.currentHash,
      currentSourceHash: advisoryFile.currentSourceHash,
      dryRunAction,
      installedHash: advisoryFile.installedHash,
      itemName: advisoryFile.itemName,
      path: advisoryFile.path,
      preservationRequired: advisoryFile.preservationRequired,
      removalTarget: advisoryFile.removalTarget,
      reviewRequired: advisoryFile.reviewRequired,
      sharedReferenceCount: advisoryFile.sharedReferenceCount,
      sourceHash: advisoryFile.sourceHash,
      sourcePath: advisoryFile.sourcePath,
      sourceState: advisoryFile.sourceState,
      state: advisoryFile.state,
      targetRole: advisoryFile.targetRole,
      wouldRemoveFile,
      wouldRemoveLockfileRecord,
    }),
  }
}

const createDependencyStateCounts = (dependencies: TRemoveAdvisoryReport["dependencies"]) => {
  const dependencyStates: Record<string, number> = {}

  dependencies.forEach((dependency) => {
    dependencyStates[dependency.status] = (dependencyStates[dependency.status] ?? 0) + 1
  })

  return dependencyStates
}

const dedupeBlockers = (blockers: readonly z.infer<typeof removeDryRunBlockerSchema>[]) => {
  const dedupedBlockers = new Map<string, z.infer<typeof removeDryRunBlockerSchema>>()

  blockers.forEach((blocker) => {
    dedupedBlockers.set(
      [blocker.code, blocker.itemName, blocker.path, blocker.sourcePath, blocker.targetPath].join(":"),
      blocker,
    )
  })

  return [...dedupedBlockers.values()]
}

const resolveItemRemoveState = ({
  blockers,
  files,
}: {
  blockers: readonly z.infer<typeof removeDryRunBlockerSchema>[]
  files: readonly TRemoveDryRunFile[]
}) => {
  if (files.length === 0) return REMOVE_DRY_RUN_ITEM_STATE__UNAVAILABLE
  if (blockers.length > 0 || files.some((file) => file.blocksStrictRemove)) {
    return REMOVE_DRY_RUN_ITEM_STATE__BLOCKED
  }
  if (files.some((file) => file.wouldRemoveFile || file.wouldRemoveLockfileRecord)) {
    return REMOVE_DRY_RUN_ITEM_STATE__WOULD_REMOVE
  }

  return REMOVE_DRY_RUN_ITEM_STATE__BLOCKED
}

const createDisabledOrphanCleanup = () =>
  removeDryRunOrphanCleanupSchema.parse({
    blockedFileCount: 0,
    blockedItemCount: 0,
    enabled: false,
    itemCount: 0,
    items: [],
    skippedFileCount: 0,
    wouldRemoveFileCount: 0,
    wouldRemoveItemCount: 0,
    wouldRemoveLockfileRecordCount: 0,
  })

const createRemoveDryRunOrphanCleanup = ({
  advisoryReport,
  primaryBlockerCount,
}: {
  advisoryReport: TRemoveAdvisoryReport
  primaryBlockerCount: number
}) => {
  if (!advisoryReport.orphanCleanup.enabled) return createDisabledOrphanCleanup()

  const items = advisoryReport.orphanCleanup.items.map((orphanItem) => {
    const itemBlockerCount = primaryBlockerCount + orphanItem.files.filter((file) => file.blocksAutomaticRemove).length
    const filesWithBlockers = orphanItem.files.map((advisoryFile) =>
      createRemoveDryRunFile({
        advisoryFile,
        itemBlockerCount,
      }),
    )
    const files = filesWithBlockers.map((fileWithBlockers) => fileWithBlockers.file)
    const blockers = dedupeBlockers(filesWithBlockers.flatMap((fileWithBlockers) => fileWithBlockers.blockers))

    return removeDryRunOrphanItemSchema.parse({
      dependencyDepth: orphanItem.dependencyDepth,
      dependedOnBy: orphanItem.dependedOnBy,
      files,
      itemRemoveState: resolveItemRemoveState({
        blockers,
        files,
      }),
      name: orphanItem.name,
      registryDependencies: orphanItem.registryDependencies,
    })
  })
  const files = items.flatMap((item) => item.files)

  return removeDryRunOrphanCleanupSchema.parse({
    blockedFileCount: files.filter((file) => file.dryRunAction === REMOVE_DRY_RUN_ACTION__BLOCKED).length,
    blockedItemCount: items.filter((item) => item.itemRemoveState === REMOVE_DRY_RUN_ITEM_STATE__BLOCKED).length,
    enabled: true,
    itemCount: items.length,
    items,
    skippedFileCount: files.filter((file) => file.dryRunAction.startsWith("skip-")).length,
    wouldRemoveFileCount: files.filter((file) => file.wouldRemoveFile).length,
    wouldRemoveItemCount: items.filter((item) => item.itemRemoveState === REMOVE_DRY_RUN_ITEM_STATE__WOULD_REMOVE)
      .length,
    wouldRemoveLockfileRecordCount: files.filter((file) => file.wouldRemoveLockfileRecord).length,
  })
}

export const createRemoveDryRunReport = async ({
  cwd,
  includeOrphans = false,
  itemName,
  registrySourcePath,
}: TCreateRemoveDryRunReportOptions): Promise<TRemoveDryRunReport> => {
  const advisoryReport = await createRemoveAdvisoryReport({
    cwd,
    includeOrphans,
    itemName,
    registrySourcePath,
  })
  const advisoryBlockerCount = advisoryReport.files.filter((file) => file.blocksAutomaticRemove).length
  const filesWithBlockers = advisoryReport.files.map((advisoryFile) =>
    createRemoveDryRunFile({
      advisoryFile,
      itemBlockerCount: advisoryBlockerCount,
    }),
  )
  const files = filesWithBlockers.map((fileWithBlockers) => fileWithBlockers.file)
  const blockers = dedupeBlockers(filesWithBlockers.flatMap((fileWithBlockers) => fileWithBlockers.blockers))
  const fileActions = createEmptyRecord(REMOVE_DRY_RUN_ACTIONS)
  const dependencyStates = createDependencyStateCounts(advisoryReport.dependencies)

  files.forEach((file) => {
    fileActions[file.dryRunAction] += 1
  })

  const blockedFileCount = files.filter((file) => file.dryRunAction === REMOVE_DRY_RUN_ACTION__BLOCKED).length
  const skippedFileCount = files.filter((file) => file.dryRunAction.startsWith("skip-")).length
  const wouldRemoveFileCount = files.filter((file) => file.wouldRemoveFile).length
  const wouldRemoveLockfileRecordCount = files.filter((file) => file.wouldRemoveLockfileRecord).length
  const itemRemoveState = resolveItemRemoveState({ blockers, files })
  const lockfileStatus =
    blockers.length > 0
      ? CLI_WRITE_STATUS__BLOCKED
      : wouldRemoveLockfileRecordCount > 0
        ? CLI_WRITE_STATUS__WOULD_WRITE
        : CLI_WRITE_STATUS__NOT_WRITTEN
  const orphanCleanup = createRemoveDryRunOrphanCleanup({
    advisoryReport,
    primaryBlockerCount: blockers.length,
  })
  const orphanCleanupStatus =
    !orphanCleanup.enabled || orphanCleanup.itemCount === 0
      ? CLI_WRITE_STATUS__NOT_WRITTEN
      : orphanCleanup.blockedItemCount > 0
        ? CLI_WRITE_STATUS__BLOCKED
        : orphanCleanup.wouldRemoveLockfileRecordCount > 0
          ? CLI_WRITE_STATUS__WOULD_WRITE
          : CLI_WRITE_STATUS__NOT_WRITTEN
  const plannedDependencyRemovalCount =
    advisoryReport.dependencyCleanup.enabled &&
    itemRemoveState === REMOVE_DRY_RUN_ITEM_STATE__WOULD_REMOVE &&
    orphanCleanup.blockedItemCount === 0
      ? advisoryReport.dependencyCleanup.candidateCount
      : 0

  return removeDryRunReportSchema.parse({
    blockers,
    cwd,
    dependencyCleanup: advisoryReport.dependencyCleanup,
    dependencies: advisoryReport.dependencies,
    dryRun: true,
    effects: {
      installsDependencies: false,
      writesConfig: false,
      writesFiles: false,
      writesLockfile: false,
    },
    files,
    findings: advisoryReport.findings,
    itemName,
    itemRemoveState,
    orphanCleanup,
    registrySource: advisoryReport.registrySource,
    status: advisoryReport.status,
    summary: {
      blockedFileCount,
      blockerCount: blockers.length,
      dependencyStates,
      fileActions,
      fileCount: files.length,
      lockfileCleanupCandidateCount: files.filter((file) => file.advisoryAction === "lockfile-cleanup-candidate")
        .length,
      preservationBlockerCount: files.filter((file) => file.preservationRequired).length,
      removeCandidateCount: files.filter((file) => file.advisoryAction === "remove-candidate").length,
      reviewBlockerCount: files.filter((file) => file.reviewRequired).length,
      sharedReferenceBlockerCount: files.filter((file) => file.sharedReferenceCount > 0).length,
      skippedFileCount,
      supportReviewBlockerCount: files.filter((file) => file.advisoryAction === "review-support-file").length,
      wouldRemoveFileCount,
      wouldRemoveLockfileRecordCount,
    },
    wouldEffects: {
      dependencies: {
        plannedRemovalCount: plannedDependencyRemovalCount,
        status: CLI_WRITE_STATUS__NOT_WRITTEN,
      },
      files: {
        blockedCount: blockedFileCount,
        skippedCount: skippedFileCount,
        wouldRemoveCount: wouldRemoveFileCount,
      },
      lockfile: {
        plannedFileCount: files.length,
        plannedItem: files.length > 0 ? itemName : undefined,
        status: lockfileStatus,
        wouldRemoveFileRecordCount: wouldRemoveLockfileRecordCount,
        wouldRemoveItem: lockfileStatus === CLI_WRITE_STATUS__WOULD_WRITE,
      },
      orphanCleanup: {
        enabled: orphanCleanup.enabled,
        plannedFileCount: orphanCleanup.items.reduce((count, item) => count + item.files.length, 0),
        plannedItemCount: orphanCleanup.wouldRemoveItemCount,
        status: orphanCleanupStatus,
        wouldRemoveFileCount: orphanCleanup.wouldRemoveFileCount,
        wouldRemoveLockfileRecordCount: orphanCleanup.wouldRemoveLockfileRecordCount,
      },
    },
  })
}
