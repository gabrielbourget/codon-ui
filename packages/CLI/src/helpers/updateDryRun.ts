import crypto from "crypto"
import { promises as fs } from "fs"
import path from "path"

import { z } from "zod"

import { consumerTargetRoleSchema } from "./consumerContract"
import {
  createRegistryInstallPlan,
  createStrictInstalledFileContent,
  INSTALL_PLAN_DEPENDENCY_STATUSES,
  INSTALL_PLAN_DEPENDENCY_STATUS__SATISFIED,
  INSTALL_PLAN_FINDING__SUPPORT_TARGET_REUSED,
  INSTALL_PLAN_FINDING__TARGET_FILE_EXISTS,
  INSTALL_PLAN_FINDING_SEVERITY__ERROR,
  INSTALL_PLAN_FINDING_SEVERITIES,
  INSTALL_PLAN_SOURCE_STATUS__AVAILABLE,
  installPlanDependencySchema,
  readConsumerConfigForStrictAdd,
  readConsumerLockfileForStrictAdd,
  readLocalRegistrySource,
  type TInstallPlanFile,
  type TInstallPlanFinding,
  type TRegistryInstallPlan,
} from "./installPlan"
import {
  CLI_DRY_RUN_WRITE_STATUSES,
  CLI_PROJECT_RESOURCE_STATUSES,
  CLI_REGISTRY_SOURCE_STATUS__LOADED,
  CLI_REGISTRY_SOURCE_STATUSES,
  CLI_WRITE_STATUS__BLOCKED,
  CLI_WRITE_STATUS__NOT_WRITTEN,
  CLI_WRITE_STATUS__WOULD_WRITE,
} from "./reportConstants"
import { createUpdateAdvisoryReport, type TUpdateAdvisoryReport } from "./updateAdvisory"

const UPDATE_DRY_RUN_SCHEMA_VERSION = 1

const UPDATE_DRY_RUN_ITEM_STATE__UP_TO_DATE = "up-to-date"
const UPDATE_DRY_RUN_ITEM_STATE__WOULD_UPDATE = "would-update"
const UPDATE_DRY_RUN_ITEM_STATE__BLOCKED = "blocked"
const UPDATE_DRY_RUN_ITEM_STATE__UNAVAILABLE = "unavailable"

const UPDATE_DRY_RUN_FILE_ACTION__NONE = "none"
const UPDATE_DRY_RUN_FILE_ACTION__WOULD_WRITE = "would-write"
const UPDATE_DRY_RUN_FILE_ACTION__WOULD_UPDATE_LOCKFILE = "would-update-lockfile"
const UPDATE_DRY_RUN_FILE_ACTION__WOULD_SKIP = "would-skip"
const UPDATE_DRY_RUN_FILE_ACTION__BLOCKED = "blocked"

const UPDATE_DRY_RUN_BLOCKER_KIND__DEPENDENCY = "dependency"
const UPDATE_DRY_RUN_BLOCKER_KIND__FILE = "file"
const UPDATE_DRY_RUN_BLOCKER_KIND__ITEM = "item"
const UPDATE_DRY_RUN_BLOCKER_KIND__PROJECT = "project"
const UPDATE_DRY_RUN_BLOCKER_KIND__SOURCE = "source"

const UPDATE_DRY_RUN_ITEM_STATES = [
  UPDATE_DRY_RUN_ITEM_STATE__UP_TO_DATE,
  UPDATE_DRY_RUN_ITEM_STATE__WOULD_UPDATE,
  UPDATE_DRY_RUN_ITEM_STATE__BLOCKED,
  UPDATE_DRY_RUN_ITEM_STATE__UNAVAILABLE,
] as const

const UPDATE_DRY_RUN_FILE_ACTIONS = [
  UPDATE_DRY_RUN_FILE_ACTION__NONE,
  UPDATE_DRY_RUN_FILE_ACTION__WOULD_WRITE,
  UPDATE_DRY_RUN_FILE_ACTION__WOULD_UPDATE_LOCKFILE,
  UPDATE_DRY_RUN_FILE_ACTION__WOULD_SKIP,
  UPDATE_DRY_RUN_FILE_ACTION__BLOCKED,
] as const

const UPDATE_DRY_RUN_BLOCKER_KINDS = [
  UPDATE_DRY_RUN_BLOCKER_KIND__DEPENDENCY,
  UPDATE_DRY_RUN_BLOCKER_KIND__FILE,
  UPDATE_DRY_RUN_BLOCKER_KIND__ITEM,
  UPDATE_DRY_RUN_BLOCKER_KIND__PROJECT,
  UPDATE_DRY_RUN_BLOCKER_KIND__SOURCE,
] as const

const updateDryRunFindingSchema = z
  .object({
    code: z.string().min(1),
    itemName: z.string().min(1).optional(),
    message: z.string().min(1),
    severity: z.enum(INSTALL_PLAN_FINDING_SEVERITIES),
    sourcePath: z.string().min(1).optional(),
    targetPath: z.string().min(1).optional(),
  })
  .strict()

const updateDryRunBlockerSchema = updateDryRunFindingSchema
  .extend({
    kind: z.enum(UPDATE_DRY_RUN_BLOCKER_KINDS),
    path: z.string().min(1).optional(),
  })
  .strict()

const updateDryRunFileSchema = z
  .object({
    advisoryAction: z.string().min(1),
    blocksStrictUpdate: z.boolean(),
    blockerCodes: z.array(z.string().min(1)).default([]),
    comparison: z.string().min(1),
    currentHash: z.string().min(1).optional(),
    currentSourceHash: z.string().min(1).optional(),
    dryRunAction: z.enum(UPDATE_DRY_RUN_FILE_ACTIONS),
    installedHash: z.string().min(1),
    itemName: z.string().min(1),
    nextInstalledHash: z.string().min(1).optional(),
    nextSourceHash: z.string().min(1).optional(),
    path: z.string().min(1),
    preservationRequired: z.boolean(),
    sourceHash: z.string().min(1),
    sourcePath: z.string().min(1).optional(),
    targetRole: consumerTargetRoleSchema,
    wouldWriteFile: z.boolean(),
    wouldWriteLockfile: z.boolean(),
  })
  .strict()

export const updateDryRunReportSchema = z
  .object({
    cwd: z.string().min(1),
    dependencies: z.array(installPlanDependencySchema).default([]),
    dryRun: z.literal(true),
    effects: z
      .object({
        installsDependencies: z.literal(false),
        writesConfig: z.literal(false),
        writesFiles: z.literal(false),
        writesLockfile: z.literal(false),
      })
      .strict(),
    files: z.array(updateDryRunFileSchema).default([]),
    findings: z.array(updateDryRunFindingSchema).default([]),
    itemName: z.string().min(1),
    itemUpdateState: z.enum(UPDATE_DRY_RUN_ITEM_STATES),
    registrySource: z
      .object({
        path: z.string().min(1).optional(),
        sourceIdentity: z.string().min(1).optional(),
        status: z.enum(CLI_REGISTRY_SOURCE_STATUSES),
      })
      .strict(),
    schemaVersion: z.literal(UPDATE_DRY_RUN_SCHEMA_VERSION).default(UPDATE_DRY_RUN_SCHEMA_VERSION),
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
        candidateFileCount: z.number().int().nonnegative(),
        dependencyBlockerCount: z.number().int().nonnegative(),
        dependencyStates: z.record(z.enum(INSTALL_PLAN_DEPENDENCY_STATUSES), z.number().int().nonnegative()),
        fileActions: z.record(z.enum(UPDATE_DRY_RUN_FILE_ACTIONS), z.number().int().nonnegative()),
        fileCount: z.number().int().nonnegative(),
        preservationBlockerCount: z.number().int().nonnegative(),
        skippedFileCount: z.number().int().nonnegative(),
        sourceBlockerCount: z.number().int().nonnegative(),
        wouldUpdateLockfileFileCount: z.number().int().nonnegative(),
        wouldWriteFileCount: z.number().int().nonnegative(),
      })
      .strict(),
    wouldEffects: z
      .object({
        dependencies: z
          .object({
            blockerCount: z.number().int().nonnegative(),
            incompatibleCount: z.number().int().nonnegative(),
            missingCount: z.number().int().nonnegative(),
            satisfiedCount: z.number().int().nonnegative(),
            unresolvedCount: z.number().int().nonnegative(),
          })
          .strict(),
        files: z
          .object({
            blockedCount: z.number().int().nonnegative(),
            candidateCount: z.number().int().nonnegative(),
            skippedCount: z.number().int().nonnegative(),
            wouldUpdateLockfileCount: z.number().int().nonnegative(),
            wouldWriteCount: z.number().int().nonnegative(),
          })
          .strict(),
        lockfile: z
          .object({
            plannedFileCount: z.number().int().nonnegative(),
            plannedItem: z.string().min(1).optional(),
            status: z.enum(CLI_DRY_RUN_WRITE_STATUSES),
            wouldWriteFileCount: z.number().int().nonnegative(),
          })
          .strict(),
      })
      .strict(),
    blockers: z.array(updateDryRunBlockerSchema).default([]),
  })
  .strict()

export type TUpdateDryRunFile = z.infer<typeof updateDryRunFileSchema>
export type TUpdateDryRunReport = z.infer<typeof updateDryRunReportSchema>

export type TCreateUpdateDryRunReportOptions = {
  cwd: string
  itemName: string
  registrySourcePath?: string
}

type TUpdateDryRunPlan = {
  dependencyBlockers: z.infer<typeof updateDryRunBlockerSchema>[]
  dependencies: TRegistryInstallPlan["dependencyPlan"]
  findings: TInstallPlanFinding[]
  installPlan?: TRegistryInstallPlan
  projectBlockers: z.infer<typeof updateDryRunBlockerSchema>[]
  sourceRoot?: string
}

const PLAN_FINDINGS_EXCLUDED_FROM_UPDATE_DRY_RUN = new Set([
  INSTALL_PLAN_FINDING__SUPPORT_TARGET_REUSED,
  INSTALL_PLAN_FINDING__TARGET_FILE_EXISTS,
])

const createContentHash = (content: string | Buffer) =>
  `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`

const createEmptyRecord = <TKey extends string>(keys: readonly TKey[]): Record<TKey, number> =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<TKey, number>

const createUpdateDryRunBlocker = ({
  code,
  itemName,
  kind,
  message,
  path: blockerPath,
  severity = INSTALL_PLAN_FINDING_SEVERITY__ERROR,
  sourcePath,
  targetPath,
}: z.infer<typeof updateDryRunBlockerSchema>) =>
  updateDryRunBlockerSchema.parse({
    code,
    itemName,
    kind,
    message,
    path: blockerPath,
    severity,
    sourcePath,
    targetPath,
  })

const convertFindingToBlocker = (finding: TInstallPlanFinding, kind: (typeof UPDATE_DRY_RUN_BLOCKER_KINDS)[number]) =>
  createUpdateDryRunBlocker({
    ...finding,
    kind,
    path: finding.targetPath,
    severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
  })

const createDependencyBlockers = (
  dependencies: TRegistryInstallPlan["dependencyPlan"],
): z.infer<typeof updateDryRunBlockerSchema>[] =>
  dependencies
    .filter((dependency) => dependency.status !== INSTALL_PLAN_DEPENDENCY_STATUS__SATISFIED)
    .map((dependency) =>
      createUpdateDryRunBlocker({
        code: "update-dry-run-dependency-blocker",
        itemName: undefined,
        kind: UPDATE_DRY_RUN_BLOCKER_KIND__DEPENDENCY,
        message: `Strict update cannot proceed while ${dependency.kind} dependency "${dependency.name}" is "${dependency.status}". Required range is "${dependency.requiredRange}".`,
        severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
      }),
    )

const readUpdateDryRunPlan = async ({
  advisoryReport,
  cwd,
  itemName,
}: {
  advisoryReport: TUpdateAdvisoryReport
  cwd: string
  itemName: string
}): Promise<TUpdateDryRunPlan> => {
  if (
    advisoryReport.registrySource.status !== CLI_REGISTRY_SOURCE_STATUS__LOADED ||
    !advisoryReport.registrySource.path
  ) {
    return {
      dependencyBlockers: [],
      dependencies: [],
      findings: [],
      projectBlockers: [
        createUpdateDryRunBlocker({
          code: "update-dry-run-registry-source-unavailable",
          itemName,
          kind: UPDATE_DRY_RUN_BLOCKER_KIND__SOURCE,
          message: "Update dry-run requires a loaded local registry source before it can preview file writes.",
          severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
        }),
      ],
    }
  }

  const configPlan = await readConsumerConfigForStrictAdd(cwd)
  const lockfilePlan = await readConsumerLockfileForStrictAdd(cwd)
  const { registrySource, sourceRoot } = await readLocalRegistrySource(advisoryReport.registrySource.path)
  const installPlan = createRegistryInstallPlan({
    config: configPlan.config,
    consumerRoot: cwd,
    registrySource,
    requestedItems: [itemName],
    sourceRoot,
  })
  const projectBlockers = [
    ...configPlan.findings.map((finding) => convertFindingToBlocker(finding, UPDATE_DRY_RUN_BLOCKER_KIND__PROJECT)),
    ...lockfilePlan.findings.map((finding) => convertFindingToBlocker(finding, UPDATE_DRY_RUN_BLOCKER_KIND__PROJECT)),
  ]
  const dependencyBlockers = createDependencyBlockers(installPlan.dependencyPlan)

  return {
    dependencyBlockers,
    dependencies: installPlan.dependencyPlan,
    findings: [
      ...configPlan.findings,
      ...lockfilePlan.findings,
      ...installPlan.findings.filter((finding) => !PLAN_FINDINGS_EXCLUDED_FROM_UPDATE_DRY_RUN.has(finding.code)),
    ],
    installPlan,
    projectBlockers,
    sourceRoot,
  }
}

const createInstallPlanFileKey = ({ itemName, path: filePath }: { itemName: string; path: string }) =>
  `${itemName}:${filePath}`

const createInstallPlanFileMap = (installPlan?: TRegistryInstallPlan) => {
  const filesByKey = new Map<string, TInstallPlanFile>()

  installPlan?.files.forEach((file) => {
    filesByKey.set(createInstallPlanFileKey({ itemName: file.itemName, path: file.resolvedPath }), file)
  })

  return filesByKey
}

const createFileSetDriftBlockers = ({
  advisoryReport,
  installPlan,
  itemName,
}: {
  advisoryReport: TUpdateAdvisoryReport
  installPlan?: TRegistryInstallPlan
  itemName: string
}) => {
  if (!installPlan) return []

  const advisoryPaths = new Set(advisoryReport.files.map((file) => file.path))
  const currentItem = installPlan.items.find((item) => item.name === itemName)
  const extraPlanFiles = currentItem?.files.filter((file) => !advisoryPaths.has(file.resolvedPath)) ?? []

  return extraPlanFiles.map((file) =>
    createUpdateDryRunBlocker({
      code: "update-dry-run-file-set-drift",
      itemName,
      kind: UPDATE_DRY_RUN_BLOCKER_KIND__ITEM,
      message: `Current registry item "${itemName}" includes ${file.resolvedPath}, which is not recorded in the installed lockfile item.`,
      path: file.resolvedPath,
      severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
      sourcePath: file.sourcePath,
      targetPath: file.resolvedPath,
    }),
  )
}

const createPlannedHashes = async ({
  file,
  installPlan,
  sourceRoot,
}: {
  file?: TInstallPlanFile
  installPlan?: TRegistryInstallPlan
  sourceRoot?: string
}) => {
  if (!file || !installPlan || !sourceRoot || file.sourceStatus !== INSTALL_PLAN_SOURCE_STATUS__AVAILABLE) {
    return {}
  }

  const sourceContent = await fs.readFile(path.resolve(sourceRoot, file.sourcePath), "utf8")
  const installedContent = createStrictInstalledFileContent({
    content: sourceContent,
    file,
    installPlan,
  })

  return {
    nextInstalledHash: createContentHash(installedContent),
    nextSourceHash: file.contentHash,
  }
}

const createFileBlockers = ({
  advisoryFile,
  dependencyBlockerCount,
  installPlanFile,
  itemIsUnavailable,
  projectBlockerCount,
}: {
  advisoryFile: TUpdateAdvisoryReport["files"][number]
  dependencyBlockerCount: number
  installPlanFile?: TInstallPlanFile
  itemIsUnavailable: boolean
  projectBlockerCount: number
}) => {
  const blockers: z.infer<typeof updateDryRunBlockerSchema>[] = []

  if (advisoryFile.blocksAutomaticUpdate) {
    blockers.push(
      createUpdateDryRunBlocker({
        code: "update-dry-run-preservation-blocker",
        itemName: advisoryFile.itemName,
        kind: UPDATE_DRY_RUN_BLOCKER_KIND__FILE,
        message: `Strict update would preserve ${advisoryFile.path} because advisory action is "${advisoryFile.action}".`,
        path: advisoryFile.path,
        severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
        sourcePath: advisoryFile.sourcePath,
        targetPath: advisoryFile.path,
      }),
    )
  }

  if (advisoryFile.action === "update-candidate" && !installPlanFile) {
    blockers.push(
      createUpdateDryRunBlocker({
        code: "update-dry-run-plan-file-missing",
        itemName: advisoryFile.itemName,
        kind: UPDATE_DRY_RUN_BLOCKER_KIND__SOURCE,
        message: `Strict update cannot preview ${advisoryFile.path} because the current registry install plan does not include that target.`,
        path: advisoryFile.path,
        severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
        sourcePath: advisoryFile.sourcePath,
        targetPath: advisoryFile.path,
      }),
    )
  }

  if (
    advisoryFile.action === "update-candidate" &&
    installPlanFile &&
    installPlanFile.sourceStatus !== INSTALL_PLAN_SOURCE_STATUS__AVAILABLE
  ) {
    blockers.push(
      createUpdateDryRunBlocker({
        code: "update-dry-run-source-file-missing",
        itemName: advisoryFile.itemName,
        kind: UPDATE_DRY_RUN_BLOCKER_KIND__SOURCE,
        message: `Strict update cannot preview ${advisoryFile.path} because source file ${installPlanFile.sourcePath} is unavailable.`,
        path: advisoryFile.path,
        severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
        sourcePath: installPlanFile.sourcePath,
        targetPath: advisoryFile.path,
      }),
    )
  }

  if (advisoryFile.action === "update-candidate" && dependencyBlockerCount > 0) {
    blockers.push(
      createUpdateDryRunBlocker({
        code: "update-dry-run-dependency-blocker",
        itemName: advisoryFile.itemName,
        kind: UPDATE_DRY_RUN_BLOCKER_KIND__DEPENDENCY,
        message: `Strict update cannot preview writes for ${advisoryFile.path} until dependency blockers are resolved.`,
        path: advisoryFile.path,
        severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
        sourcePath: advisoryFile.sourcePath,
        targetPath: advisoryFile.path,
      }),
    )
  }

  if (advisoryFile.action === "update-candidate" && projectBlockerCount > 0) {
    blockers.push(
      createUpdateDryRunBlocker({
        code: "update-dry-run-project-state-blocker",
        itemName: advisoryFile.itemName,
        kind: UPDATE_DRY_RUN_BLOCKER_KIND__PROJECT,
        message: `Strict update cannot preview writes for ${advisoryFile.path} until config and lockfile blockers are resolved.`,
        path: advisoryFile.path,
        severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
        sourcePath: advisoryFile.sourcePath,
        targetPath: advisoryFile.path,
      }),
    )
  }

  if (advisoryFile.action === "update-candidate" && itemIsUnavailable) {
    blockers.push(
      createUpdateDryRunBlocker({
        code: "update-dry-run-item-unavailable",
        itemName: advisoryFile.itemName,
        kind: UPDATE_DRY_RUN_BLOCKER_KIND__ITEM,
        message: `Strict update cannot preview writes for ${advisoryFile.path} because item "${advisoryFile.itemName}" is unavailable.`,
        path: advisoryFile.path,
        severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
        sourcePath: advisoryFile.sourcePath,
        targetPath: advisoryFile.path,
      }),
    )
  }

  return blockers
}

const createUpdateDryRunFile = async ({
  advisoryFile,
  dependencyBlockerCount,
  installPlanFile,
  itemBlockerCount,
  itemIsUnavailable,
  projectBlockerCount,
  sourceRoot,
  installPlan,
}: {
  advisoryFile: TUpdateAdvisoryReport["files"][number]
  dependencyBlockerCount: number
  installPlan?: TRegistryInstallPlan
  installPlanFile?: TInstallPlanFile
  itemBlockerCount: number
  itemIsUnavailable: boolean
  projectBlockerCount: number
  sourceRoot?: string
}) => {
  const fileBlockers = createFileBlockers({
    advisoryFile,
    dependencyBlockerCount,
    installPlanFile,
    itemIsUnavailable,
    projectBlockerCount,
  })
  const plannedHashes =
    advisoryFile.action === "update-candidate"
      ? await createPlannedHashes({ file: installPlanFile, installPlan, sourceRoot })
      : {}
  const blocksStrictUpdate = fileBlockers.length > 0 || itemBlockerCount > 0
  const canUpdateLockfile =
    advisoryFile.action === "update-candidate" &&
    !blocksStrictUpdate &&
    Boolean(plannedHashes.nextInstalledHash && plannedHashes.nextSourceHash)
  const wouldWriteFile =
    canUpdateLockfile &&
    Boolean(advisoryFile.currentHash && plannedHashes.nextInstalledHash !== advisoryFile.currentHash)
  const wouldWriteLockfile = canUpdateLockfile
  const dryRunAction = (() => {
    if (advisoryFile.action === "none") return UPDATE_DRY_RUN_FILE_ACTION__NONE
    if (advisoryFile.action !== "update-candidate") return UPDATE_DRY_RUN_FILE_ACTION__WOULD_SKIP
    if (blocksStrictUpdate || !plannedHashes.nextInstalledHash || !plannedHashes.nextSourceHash) {
      return UPDATE_DRY_RUN_FILE_ACTION__BLOCKED
    }
    if (wouldWriteFile) return UPDATE_DRY_RUN_FILE_ACTION__WOULD_WRITE

    return UPDATE_DRY_RUN_FILE_ACTION__WOULD_UPDATE_LOCKFILE
  })()

  return {
    blockers: fileBlockers,
    file: updateDryRunFileSchema.parse({
      advisoryAction: advisoryFile.action,
      blockerCodes: fileBlockers.map((blocker) => blocker.code),
      blocksStrictUpdate,
      comparison: advisoryFile.comparison,
      currentHash: advisoryFile.currentHash,
      currentSourceHash: advisoryFile.currentSourceHash,
      dryRunAction,
      installedHash: advisoryFile.installedHash,
      itemName: advisoryFile.itemName,
      nextInstalledHash: plannedHashes.nextInstalledHash,
      nextSourceHash: plannedHashes.nextSourceHash,
      path: advisoryFile.path,
      preservationRequired: advisoryFile.preservationRequired,
      sourceHash: advisoryFile.sourceHash,
      sourcePath: advisoryFile.sourcePath,
      targetRole: advisoryFile.targetRole,
      wouldWriteFile,
      wouldWriteLockfile,
    }),
  }
}

const createDependencyStateCounts = (dependencies: TRegistryInstallPlan["dependencyPlan"]) => {
  const dependencyStates = createEmptyRecord(INSTALL_PLAN_DEPENDENCY_STATUSES)

  dependencies.forEach((dependency) => {
    dependencyStates[dependency.status] += 1
  })

  return dependencyStates
}

const resolveItemUpdateState = ({
  blockers,
  files,
}: {
  blockers: readonly z.infer<typeof updateDryRunBlockerSchema>[]
  files: readonly TUpdateDryRunFile[]
}) => {
  if (files.length === 0) return UPDATE_DRY_RUN_ITEM_STATE__UNAVAILABLE
  if (blockers.length > 0 || files.some((file) => file.blocksStrictUpdate)) return UPDATE_DRY_RUN_ITEM_STATE__BLOCKED
  if (files.some((file) => file.wouldWriteFile || file.wouldWriteLockfile)) {
    return UPDATE_DRY_RUN_ITEM_STATE__WOULD_UPDATE
  }

  return UPDATE_DRY_RUN_ITEM_STATE__UP_TO_DATE
}

const dedupeBlockers = (blockers: readonly z.infer<typeof updateDryRunBlockerSchema>[]) => {
  const dedupedBlockers = new Map<string, z.infer<typeof updateDryRunBlockerSchema>>()

  blockers.forEach((blocker) => {
    dedupedBlockers.set(
      [blocker.code, blocker.itemName, blocker.path, blocker.sourcePath, blocker.targetPath].join(":"),
      blocker,
    )
  })

  return [...dedupedBlockers.values()]
}

export const createUpdateDryRunReport = async ({
  cwd,
  itemName,
  registrySourcePath,
}: TCreateUpdateDryRunReportOptions): Promise<TUpdateDryRunReport> => {
  const advisoryReport = await createUpdateAdvisoryReport({
    cwd,
    itemName,
    registrySourcePath,
  })
  const plan = await readUpdateDryRunPlan({ advisoryReport, cwd, itemName })
  const fileSetDriftBlockers = createFileSetDriftBlockers({
    advisoryReport,
    installPlan: plan.installPlan,
    itemName,
  })
  const itemIsUnavailable = advisoryReport.itemUpdateState === "unavailable"
  const itemBlockers = [...plan.projectBlockers, ...plan.dependencyBlockers, ...fileSetDriftBlockers]
  const preservationBlockerCount = advisoryReport.files.filter((file) => file.blocksAutomaticUpdate).length
  const itemBlockerCount = itemBlockers.length + preservationBlockerCount
  const installPlanFilesByKey = createInstallPlanFileMap(plan.installPlan)
  const filesWithBlockers = await Promise.all(
    advisoryReport.files.map((advisoryFile) =>
      createUpdateDryRunFile({
        advisoryFile,
        dependencyBlockerCount: plan.dependencyBlockers.length,
        installPlan: plan.installPlan,
        installPlanFile: installPlanFilesByKey.get(
          createInstallPlanFileKey({
            itemName: advisoryFile.itemName,
            path: advisoryFile.path,
          }),
        ),
        itemBlockerCount,
        itemIsUnavailable,
        projectBlockerCount: plan.projectBlockers.length,
        sourceRoot: plan.sourceRoot,
      }),
    ),
  )
  const files = filesWithBlockers.map((fileWithBlockers) => fileWithBlockers.file)
  const fileBlockers = filesWithBlockers.flatMap((fileWithBlockers) => fileWithBlockers.blockers)
  const sourceFileBlockers = fileBlockers.filter((blocker) => blocker.kind === UPDATE_DRY_RUN_BLOCKER_KIND__SOURCE)
  const blockers = dedupeBlockers([...itemBlockers, ...fileBlockers])
  const fileActions = createEmptyRecord(UPDATE_DRY_RUN_FILE_ACTIONS)
  const dependencyStates = createDependencyStateCounts(plan.dependencies)

  files.forEach((file) => {
    fileActions[file.dryRunAction] += 1
  })

  const wouldWriteFileCount = files.filter((file) => file.wouldWriteFile).length
  const wouldUpdateLockfileFileCount = files.filter((file) => file.wouldWriteLockfile).length
  const blockedFileCount = files.filter((file) => file.dryRunAction === UPDATE_DRY_RUN_FILE_ACTION__BLOCKED).length
  const skippedFileCount = files.filter((file) => file.dryRunAction === UPDATE_DRY_RUN_FILE_ACTION__WOULD_SKIP).length
  const lockfileStatus =
    blockers.length > 0
      ? CLI_WRITE_STATUS__BLOCKED
      : wouldUpdateLockfileFileCount > 0
        ? CLI_WRITE_STATUS__WOULD_WRITE
        : CLI_WRITE_STATUS__NOT_WRITTEN

  return updateDryRunReportSchema.parse({
    blockers,
    cwd,
    dependencies: plan.dependencies,
    dryRun: true,
    effects: {
      installsDependencies: false,
      writesConfig: false,
      writesFiles: false,
      writesLockfile: false,
    },
    files,
    findings: [...advisoryReport.findings, ...plan.findings],
    itemName,
    itemUpdateState: resolveItemUpdateState({ blockers, files }),
    registrySource: advisoryReport.registrySource,
    status: advisoryReport.status,
    summary: {
      blockedFileCount,
      blockerCount: blockers.length,
      candidateFileCount: files.filter((file) => file.advisoryAction === "update-candidate").length,
      dependencyBlockerCount: plan.dependencyBlockers.length,
      dependencyStates,
      fileActions,
      fileCount: files.length,
      preservationBlockerCount: fileBlockers.filter((blocker) => blocker.code === "update-dry-run-preservation-blocker")
        .length,
      skippedFileCount,
      sourceBlockerCount: sourceFileBlockers.length,
      wouldUpdateLockfileFileCount,
      wouldWriteFileCount,
    },
    wouldEffects: {
      dependencies: {
        blockerCount: plan.dependencyBlockers.length,
        incompatibleCount: dependencyStates.incompatible,
        missingCount: dependencyStates.missing,
        satisfiedCount: dependencyStates.satisfied,
        unresolvedCount: dependencyStates.unresolved,
      },
      files: {
        blockedCount: blockedFileCount,
        candidateCount: files.filter((file) => file.advisoryAction === "update-candidate").length,
        skippedCount: skippedFileCount,
        wouldUpdateLockfileCount: wouldUpdateLockfileFileCount,
        wouldWriteCount: wouldWriteFileCount,
      },
      lockfile: {
        plannedFileCount: files.length,
        plannedItem: files.length > 0 ? itemName : undefined,
        status: lockfileStatus,
        wouldWriteFileCount: wouldUpdateLockfileFileCount,
      },
    },
  })
}
