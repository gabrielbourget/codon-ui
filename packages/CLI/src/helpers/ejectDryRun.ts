import { z } from "zod"

import { consumerLockfileDependencySchema, consumerTargetRoleSchema } from "./consumerContract"
import { createEjectAdvisoryReport, type TEjectAdvisoryReport } from "./ejectAdvisory"
import { EJECT_TARGETS } from "./ejectConstants"
import { INSTALL_PLAN_FINDING_SEVERITY__ERROR, INSTALL_PLAN_FINDING_SEVERITIES } from "./installPlan"
import {
  CLI_DRY_RUN_WRITE_STATUSES,
  CLI_PROJECT_RESOURCE_STATUSES,
  CLI_REGISTRY_SOURCE_STATUSES,
  CLI_WRITE_STATUS__BLOCKED,
  CLI_WRITE_STATUS__NOT_WRITTEN,
  CLI_WRITE_STATUS__WOULD_WRITE,
} from "./reportConstants"

const EJECT_DRY_RUN_SCHEMA_VERSION = 1

const EJECT_DRY_RUN_ITEM_STATE__WOULD_EJECT = "would-eject"
const EJECT_DRY_RUN_ITEM_STATE__ALREADY_EJECTED = "already-ejected"
const EJECT_DRY_RUN_ITEM_STATE__BLOCKED = "blocked"
const EJECT_DRY_RUN_ITEM_STATE__UNAVAILABLE = "unavailable"

const EJECT_DRY_RUN_ACTION__WOULD_EJECT_LOCKFILE_OWNERSHIP = "would-eject-lockfile-ownership"
const EJECT_DRY_RUN_ACTION__ALREADY_EJECTED = "already-ejected"
const EJECT_DRY_RUN_ACTION__SKIP_REVIEW_REQUIRED = "skip-review-required"
const EJECT_DRY_RUN_ACTION__SKIP_PRESERVED_LOCAL_CHANGE = "skip-preserved-local-change"
const EJECT_DRY_RUN_ACTION__SKIP_CONSUMER_OWNED_SUPPORT = "skip-consumer-owned-support"
const EJECT_DRY_RUN_ACTION__SKIP_UNKNOWN = "skip-unknown"
const EJECT_DRY_RUN_ACTION__BLOCKED = "blocked"

const EJECT_DRY_RUN_BLOCKER_KIND__FILE = "file"
const EJECT_DRY_RUN_BLOCKER_KIND__ITEM = "item"

const EJECT_DRY_RUN_ITEM_STATES = [
  EJECT_DRY_RUN_ITEM_STATE__WOULD_EJECT,
  EJECT_DRY_RUN_ITEM_STATE__ALREADY_EJECTED,
  EJECT_DRY_RUN_ITEM_STATE__BLOCKED,
  EJECT_DRY_RUN_ITEM_STATE__UNAVAILABLE,
] as const

const EJECT_DRY_RUN_ACTIONS = [
  EJECT_DRY_RUN_ACTION__WOULD_EJECT_LOCKFILE_OWNERSHIP,
  EJECT_DRY_RUN_ACTION__ALREADY_EJECTED,
  EJECT_DRY_RUN_ACTION__SKIP_REVIEW_REQUIRED,
  EJECT_DRY_RUN_ACTION__SKIP_PRESERVED_LOCAL_CHANGE,
  EJECT_DRY_RUN_ACTION__SKIP_CONSUMER_OWNED_SUPPORT,
  EJECT_DRY_RUN_ACTION__SKIP_UNKNOWN,
  EJECT_DRY_RUN_ACTION__BLOCKED,
] as const

const EJECT_DRY_RUN_BLOCKER_KINDS = [EJECT_DRY_RUN_BLOCKER_KIND__FILE, EJECT_DRY_RUN_BLOCKER_KIND__ITEM] as const

const ejectDryRunFindingSchema = z
  .object({
    code: z.string().min(1),
    itemName: z.string().min(1).optional(),
    message: z.string().min(1),
    severity: z.enum(INSTALL_PLAN_FINDING_SEVERITIES),
    sourcePath: z.string().min(1).optional(),
    targetPath: z.string().min(1).optional(),
  })
  .strict()

const ejectDryRunBlockerSchema = ejectDryRunFindingSchema
  .extend({
    kind: z.enum(EJECT_DRY_RUN_BLOCKER_KINDS),
    path: z.string().min(1).optional(),
  })
  .strict()

const ejectDryRunFileSchema = z
  .object({
    advisoryAction: z.string().min(1),
    blockerCodes: z.array(z.string().min(1)).default([]),
    blocksStrictEject: z.boolean(),
    currentHash: z.string().min(1).optional(),
    currentSourceHash: z.string().min(1).optional(),
    dryRunAction: z.enum(EJECT_DRY_RUN_ACTIONS),
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
    wouldEjectLockfileOwnership: z.boolean(),
  })
  .strict()

export const ejectDryRunReportSchema = z
  .object({
    blockers: z.array(ejectDryRunBlockerSchema).default([]),
    cwd: z.string().min(1),
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
    files: z.array(ejectDryRunFileSchema).default([]),
    findings: z.array(ejectDryRunFindingSchema).default([]),
    itemEjectState: z.enum(EJECT_DRY_RUN_ITEM_STATES),
    itemName: z.string().min(1),
    registrySource: z
      .object({
        path: z.string().min(1).optional(),
        sourceIdentity: z.string().min(1).optional(),
        status: z.enum(CLI_REGISTRY_SOURCE_STATUSES),
      })
      .strict(),
    schemaVersion: z.literal(EJECT_DRY_RUN_SCHEMA_VERSION).default(EJECT_DRY_RUN_SCHEMA_VERSION),
    status: z
      .object({
        config: z.enum(CLI_PROJECT_RESOURCE_STATUSES),
        lockfile: z.enum(CLI_PROJECT_RESOURCE_STATUSES),
      })
      .strict(),
    summary: z
      .object({
        alreadyEjectedCount: z.number().int().nonnegative(),
        blockedFileCount: z.number().int().nonnegative(),
        blockerCount: z.number().int().nonnegative(),
        dependencyStates: z.record(z.string().min(1), z.number().int().nonnegative()),
        ejectCandidateCount: z.number().int().nonnegative(),
        fileActions: z.record(z.enum(EJECT_DRY_RUN_ACTIONS), z.number().int().nonnegative()),
        fileCount: z.number().int().nonnegative(),
        missingFileReviewCount: z.number().int().nonnegative(),
        preservationBlockerCount: z.number().int().nonnegative(),
        reviewBlockerCount: z.number().int().nonnegative(),
        sharedReferenceBlockerCount: z.number().int().nonnegative(),
        skippedFileCount: z.number().int().nonnegative(),
        supportReviewBlockerCount: z.number().int().nonnegative(),
        wouldEjectLockfileRecordCount: z.number().int().nonnegative(),
      })
      .strict(),
    wouldEffects: z
      .object({
        dependencies: z
          .object({
            plannedMutationCount: z.literal(0),
            status: z.literal(CLI_WRITE_STATUS__NOT_WRITTEN),
          })
          .strict(),
        files: z
          .object({
            alreadyEjectedCount: z.number().int().nonnegative(),
            blockedCount: z.number().int().nonnegative(),
            skippedCount: z.number().int().nonnegative(),
            wouldEjectCount: z.number().int().nonnegative(),
          })
          .strict(),
        lockfile: z
          .object({
            plannedFileCount: z.number().int().nonnegative(),
            plannedItem: z.string().min(1).optional(),
            status: z.enum(CLI_DRY_RUN_WRITE_STATUSES),
            wouldEjectFileRecordCount: z.number().int().nonnegative(),
            wouldEjectItem: z.boolean(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict()

export type TEjectDryRunFile = z.infer<typeof ejectDryRunFileSchema>
export type TEjectDryRunReport = z.infer<typeof ejectDryRunReportSchema>

export type TCreateEjectDryRunReportOptions = {
  cwd: string
  itemName: string
  registrySourcePath?: string
}

const createEmptyRecord = <TKey extends string>(keys: readonly TKey[]): Record<TKey, number> =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<TKey, number>

const createEjectDryRunBlocker = ({
  code,
  itemName,
  kind,
  message,
  path,
  severity = INSTALL_PLAN_FINDING_SEVERITY__ERROR,
  sourcePath,
  targetPath,
}: z.infer<typeof ejectDryRunBlockerSchema>) =>
  ejectDryRunBlockerSchema.parse({
    code,
    itemName,
    kind,
    message,
    path,
    severity,
    sourcePath,
    targetPath,
  })

const createAdvisoryFileBlockers = (
  advisoryFile: TEjectAdvisoryReport["files"][number],
): z.infer<typeof ejectDryRunBlockerSchema>[] => {
  if (!advisoryFile.blocksAutomaticEject) return []

  const blockerCode = (() => {
    if (advisoryFile.action === "review-shared-file") return "eject-dry-run-shared-reference-blocker"
    if (advisoryFile.preservationRequired) return "eject-dry-run-preservation-blocker"

    return "eject-dry-run-review-blocker"
  })()

  return [
    createEjectDryRunBlocker({
      code: blockerCode,
      itemName: advisoryFile.itemName,
      kind: EJECT_DRY_RUN_BLOCKER_KIND__FILE,
      message: `Strict eject would preserve ${advisoryFile.path} because advisory action is "${advisoryFile.action}".`,
      path: advisoryFile.path,
      severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
      sourcePath: advisoryFile.sourcePath,
      targetPath: advisoryFile.path,
    }),
  ]
}

const createCandidateItemBlocker = (
  advisoryFile: TEjectAdvisoryReport["files"][number],
): z.infer<typeof ejectDryRunBlockerSchema> =>
  createEjectDryRunBlocker({
    code: "eject-dry-run-item-review-blocker",
    itemName: advisoryFile.itemName,
    kind: EJECT_DRY_RUN_BLOCKER_KIND__ITEM,
    message: `Strict eject cannot preview transferring ${advisoryFile.path} while another file in item "${advisoryFile.itemName}" requires review or preservation.`,
    path: advisoryFile.path,
    severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
    sourcePath: advisoryFile.sourcePath,
    targetPath: advisoryFile.path,
  })

const resolveSkipAction = (advisoryFile: TEjectAdvisoryReport["files"][number]) => {
  if (advisoryFile.action === "preserve-local-change") return EJECT_DRY_RUN_ACTION__SKIP_PRESERVED_LOCAL_CHANGE
  if (advisoryFile.action === "preserve-consumer-owned-support") {
    return EJECT_DRY_RUN_ACTION__SKIP_CONSUMER_OWNED_SUPPORT
  }
  if (advisoryFile.action === "preserve-unknown") return EJECT_DRY_RUN_ACTION__SKIP_UNKNOWN

  return EJECT_DRY_RUN_ACTION__SKIP_REVIEW_REQUIRED
}

const createEjectDryRunFile = ({
  advisoryFile,
  itemBlockerCount,
}: {
  advisoryFile: TEjectAdvisoryReport["files"][number]
  itemBlockerCount: number
}) => {
  const advisoryBlockers = createAdvisoryFileBlockers(advisoryFile)
  const isCandidate = advisoryFile.action === "eject-candidate"
  const itemBlockers = isCandidate && itemBlockerCount > 0 ? [createCandidateItemBlocker(advisoryFile)] : []
  const fileBlockers = [...advisoryBlockers, ...itemBlockers]
  const dryRunAction = (() => {
    if (itemBlockers.length > 0) return EJECT_DRY_RUN_ACTION__BLOCKED
    if (advisoryFile.action === "eject-candidate") return EJECT_DRY_RUN_ACTION__WOULD_EJECT_LOCKFILE_OWNERSHIP
    if (advisoryFile.action === "already-ejected") return EJECT_DRY_RUN_ACTION__ALREADY_EJECTED

    return resolveSkipAction(advisoryFile)
  })()
  const wouldEjectLockfileOwnership = dryRunAction === EJECT_DRY_RUN_ACTION__WOULD_EJECT_LOCKFILE_OWNERSHIP

  return {
    blockers: fileBlockers,
    file: ejectDryRunFileSchema.parse({
      advisoryAction: advisoryFile.action,
      blockerCodes: fileBlockers.map((blocker) => blocker.code),
      blocksStrictEject: fileBlockers.length > 0,
      currentHash: advisoryFile.currentHash,
      currentSourceHash: advisoryFile.currentSourceHash,
      dryRunAction,
      ejectionTarget: advisoryFile.ejectionTarget,
      installedHash: advisoryFile.installedHash,
      itemName: advisoryFile.itemName,
      path: advisoryFile.path,
      preservationRequired: advisoryFile.preservationRequired,
      reviewRequired: advisoryFile.reviewRequired,
      sharedReferenceCount: advisoryFile.sharedReferenceCount,
      sourceHash: advisoryFile.sourceHash,
      sourcePath: advisoryFile.sourcePath,
      sourceState: advisoryFile.sourceState,
      state: advisoryFile.state,
      targetRole: advisoryFile.targetRole,
      wouldEjectLockfileOwnership,
    }),
  }
}

const createDependencyStateCounts = (dependencies: TEjectAdvisoryReport["dependencies"]) => {
  const dependencyStates: Record<string, number> = {}

  dependencies.forEach((dependency) => {
    dependencyStates[dependency.status] = (dependencyStates[dependency.status] ?? 0) + 1
  })

  return dependencyStates
}

const dedupeBlockers = (blockers: readonly z.infer<typeof ejectDryRunBlockerSchema>[]) => {
  const dedupedBlockers = new Map<string, z.infer<typeof ejectDryRunBlockerSchema>>()

  blockers.forEach((blocker) => {
    dedupedBlockers.set(
      [blocker.code, blocker.itemName, blocker.path, blocker.sourcePath, blocker.targetPath].join(":"),
      blocker,
    )
  })

  return [...dedupedBlockers.values()]
}

const resolveItemEjectState = ({
  blockers,
  files,
}: {
  blockers: readonly z.infer<typeof ejectDryRunBlockerSchema>[]
  files: readonly TEjectDryRunFile[]
}) => {
  if (files.length === 0) return EJECT_DRY_RUN_ITEM_STATE__UNAVAILABLE
  if (blockers.length > 0 || files.some((file) => file.blocksStrictEject)) return EJECT_DRY_RUN_ITEM_STATE__BLOCKED
  if (files.every((file) => file.dryRunAction === EJECT_DRY_RUN_ACTION__ALREADY_EJECTED)) {
    return EJECT_DRY_RUN_ITEM_STATE__ALREADY_EJECTED
  }
  if (files.some((file) => file.wouldEjectLockfileOwnership)) return EJECT_DRY_RUN_ITEM_STATE__WOULD_EJECT

  return EJECT_DRY_RUN_ITEM_STATE__BLOCKED
}

export const createEjectDryRunReport = async ({
  cwd,
  itemName,
  registrySourcePath,
}: TCreateEjectDryRunReportOptions): Promise<TEjectDryRunReport> => {
  const advisoryReport = await createEjectAdvisoryReport({
    cwd,
    itemName,
    registrySourcePath,
  })
  const advisoryBlockerCount = advisoryReport.files.filter((file) => file.blocksAutomaticEject).length
  const filesWithBlockers = advisoryReport.files.map((advisoryFile) =>
    createEjectDryRunFile({
      advisoryFile,
      itemBlockerCount: advisoryBlockerCount,
    }),
  )
  const files = filesWithBlockers.map((fileWithBlockers) => fileWithBlockers.file)
  const blockers = dedupeBlockers(filesWithBlockers.flatMap((fileWithBlockers) => fileWithBlockers.blockers))
  const fileActions = createEmptyRecord(EJECT_DRY_RUN_ACTIONS)
  const dependencyStates = createDependencyStateCounts(advisoryReport.dependencies)

  files.forEach((file) => {
    fileActions[file.dryRunAction] += 1
  })

  const alreadyEjectedCount = files.filter((file) => file.dryRunAction === EJECT_DRY_RUN_ACTION__ALREADY_EJECTED).length
  const blockedFileCount = files.filter((file) => file.dryRunAction === EJECT_DRY_RUN_ACTION__BLOCKED).length
  const skippedFileCount = files.filter((file) => file.dryRunAction.startsWith("skip-")).length
  const wouldEjectLockfileRecordCount = files.filter((file) => file.wouldEjectLockfileOwnership).length
  const lockfileStatus =
    blockers.length > 0
      ? CLI_WRITE_STATUS__BLOCKED
      : wouldEjectLockfileRecordCount > 0
        ? CLI_WRITE_STATUS__WOULD_WRITE
        : CLI_WRITE_STATUS__NOT_WRITTEN

  return ejectDryRunReportSchema.parse({
    blockers,
    cwd,
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
    itemEjectState: resolveItemEjectState({ blockers, files }),
    itemName,
    registrySource: advisoryReport.registrySource,
    status: advisoryReport.status,
    summary: {
      alreadyEjectedCount,
      blockedFileCount,
      blockerCount: blockers.length,
      dependencyStates,
      ejectCandidateCount: files.filter((file) => file.advisoryAction === "eject-candidate").length,
      fileActions,
      fileCount: files.length,
      missingFileReviewCount: files.filter((file) => file.advisoryAction === "review-missing-file").length,
      preservationBlockerCount: blockers.filter((blocker) => blocker.code === "eject-dry-run-preservation-blocker")
        .length,
      reviewBlockerCount: blockers.filter((blocker) => blocker.code === "eject-dry-run-review-blocker").length,
      sharedReferenceBlockerCount: blockers.filter(
        (blocker) => blocker.code === "eject-dry-run-shared-reference-blocker",
      ).length,
      skippedFileCount,
      supportReviewBlockerCount: files.filter((file) => file.advisoryAction === "review-support-file").length,
      wouldEjectLockfileRecordCount,
    },
    wouldEffects: {
      dependencies: {
        plannedMutationCount: 0,
        status: CLI_WRITE_STATUS__NOT_WRITTEN,
      },
      files: {
        alreadyEjectedCount,
        blockedCount: blockedFileCount,
        skippedCount: skippedFileCount,
        wouldEjectCount: wouldEjectLockfileRecordCount,
      },
      lockfile: {
        plannedFileCount: files.length,
        plannedItem: files.length > 0 ? itemName : undefined,
        status: lockfileStatus,
        wouldEjectFileRecordCount: wouldEjectLockfileRecordCount,
        wouldEjectItem: lockfileStatus === CLI_WRITE_STATUS__WOULD_WRITE,
      },
    },
  })
}
