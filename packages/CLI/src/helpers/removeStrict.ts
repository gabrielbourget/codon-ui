import crypto from "crypto"
import { existsSync, promises as fs } from "fs"
import path from "path"

import { execa } from "execa"
import { z } from "zod"

import {
  AMINO_UI_LOCK_FILE_NAME,
  consumerLockfileDependencySchema,
  consumerLockfileSchema,
  consumerTargetRoleSchema,
  type TConsumerLockfile,
} from "./consumerContract"
import { INSTALL_PLAN_FINDING_SEVERITY__ERROR, INSTALL_PLAN_FINDING_SEVERITIES } from "./installPlan"
import {
  computePackageManagerRemoveCommand,
  createDependencyInstallPlan,
  DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTION__COMPLETED,
  DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTION__FAILED,
  DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTION__NOT_RUN,
  DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTIONS,
  DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCES,
  DEPENDENCY_INSTALL_PACKAGE_MANAGERS,
  DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCES,
  DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGY__BUN_CWD_OPTION,
  DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGY__NPM_WORKSPACE_OPTION,
  DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGY__PNPM_FILTER_OPTION,
  DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGY__YARN_WORKSPACE_SUBCOMMAND,
  DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGIES,
  PACKAGE_MANAGER_BUN,
  PACKAGE_MANAGER_NPM,
  PACKAGE_MANAGER_PNPM,
  PACKAGE_MANAGER_UNKNOWN,
  PACKAGE_MANAGER_YARN,
  type TDependencyInstallPackageManager,
} from "./packageManagerHelpers"
import {
  REMOVE_ADVISORY_DEPENDENCY_CLEANUP_ACTION__CLEANUP_CANDIDATE,
  removeAdvisoryDependencyCleanupSchema,
} from "./removeAdvisory"
import { REMOVE_TARGET__FILE_AND_LOCKFILE, REMOVE_TARGET__LOCKFILE_ONLY, REMOVE_TARGETS } from "./removeConstants"
import { createRemoveDryRunReport, type TRemoveDryRunFile, type TRemoveDryRunReport } from "./removeDryRun"
import {
  CLI_PROJECT_RESOURCE_STATUS__PRESENT,
  CLI_PROJECT_RESOURCE_STATUSES,
  CLI_REGISTRY_SOURCE_STATUSES,
  CLI_STRICT_WRITE_STATUSES,
  CLI_WRITE_STATUS__BLOCKED,
  CLI_WRITE_STATUS__NOT_WRITTEN,
  CLI_WRITE_STATUS__WOULD_WRITE,
  CLI_WRITE_STATUS__WRITTEN,
} from "./reportConstants"

const REMOVE_STRICT_SCHEMA_VERSION = 1

const REMOVE_STRICT_ITEM_STATE__REMOVED = "removed"
const REMOVE_STRICT_ITEM_STATE__BLOCKED = "blocked"
const REMOVE_STRICT_ITEM_STATE__UNAVAILABLE = "unavailable"

const REMOVE_STRICT_FILE_ACTION__REMOVED_FILE_AND_LOCKFILE = "removed-file-and-lockfile"
const REMOVE_STRICT_FILE_ACTION__REMOVED_LOCKFILE_RECORD = "removed-lockfile-record"
const REMOVE_STRICT_FILE_ACTION__BLOCKED = "blocked"
const REMOVE_STRICT_FILE_ACTION__SKIPPED = "skipped"

const REMOVE_STRICT_BLOCKER_KIND__FILE = "file"
const REMOVE_STRICT_BLOCKER_KIND__ITEM = "item"
const REMOVE_STRICT_BLOCKER_KIND__PROJECT = "project"

const REMOVE_STRICT_DEPENDENCY_CLEANUP_APPROVAL_SOURCE__NONE = "none"
const REMOVE_STRICT_DEPENDENCY_CLEANUP_APPROVAL_SOURCE__CLI_OPTION = "cli-option"

const REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_MODE__NOT_REQUESTED = "not-requested"
const REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_MODE__NOT_NEEDED = "not-needed"
const REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_MODE__BLOCKED = "blocked"
const REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_MODE__ELIGIBLE = "eligible"

const REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_BLOCKER__PACKAGE_MANAGER_UNKNOWN =
  "dependency-cleanup-package-manager-unknown"
const REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_BLOCKER__TARGET_MANIFEST_MISSING =
  "dependency-cleanup-target-manifest-missing"

const REMOVE_STRICT_ITEM_STATES = [
  REMOVE_STRICT_ITEM_STATE__REMOVED,
  REMOVE_STRICT_ITEM_STATE__BLOCKED,
  REMOVE_STRICT_ITEM_STATE__UNAVAILABLE,
] as const

const REMOVE_STRICT_FILE_ACTIONS = [
  REMOVE_STRICT_FILE_ACTION__REMOVED_FILE_AND_LOCKFILE,
  REMOVE_STRICT_FILE_ACTION__REMOVED_LOCKFILE_RECORD,
  REMOVE_STRICT_FILE_ACTION__BLOCKED,
  REMOVE_STRICT_FILE_ACTION__SKIPPED,
] as const

const REMOVE_STRICT_BLOCKER_KINDS = [
  REMOVE_STRICT_BLOCKER_KIND__FILE,
  REMOVE_STRICT_BLOCKER_KIND__ITEM,
  REMOVE_STRICT_BLOCKER_KIND__PROJECT,
] as const

const REMOVE_STRICT_DEPENDENCY_CLEANUP_APPROVAL_SOURCES = [
  REMOVE_STRICT_DEPENDENCY_CLEANUP_APPROVAL_SOURCE__NONE,
  REMOVE_STRICT_DEPENDENCY_CLEANUP_APPROVAL_SOURCE__CLI_OPTION,
] as const

const REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_MODES = [
  REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_MODE__NOT_REQUESTED,
  REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_MODE__NOT_NEEDED,
  REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_MODE__BLOCKED,
  REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_MODE__ELIGIBLE,
] as const

const REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_BLOCKERS = [
  REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_BLOCKER__PACKAGE_MANAGER_UNKNOWN,
  REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_BLOCKER__TARGET_MANIFEST_MISSING,
] as const

const REMOVE_STRICT_DEPENDENCY_CLEANUP_DETECTED_PACKAGE_MANAGERS = [
  ...DEPENDENCY_INSTALL_PACKAGE_MANAGERS,
  PACKAGE_MANAGER_UNKNOWN,
] as const

const packageManagerMutationBoundaryFileNames = [
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
] as const

const dependencyCommandOutputMaxLength = 4000

const removeStrictFindingSchema = z
  .object({
    code: z.string().min(1),
    itemName: z.string().min(1).optional(),
    kind: z.enum(REMOVE_STRICT_BLOCKER_KINDS).optional(),
    message: z.string().min(1),
    path: z.string().min(1).optional(),
    severity: z.enum(INSTALL_PLAN_FINDING_SEVERITIES),
    sourcePath: z.string().min(1).optional(),
    targetPath: z.string().min(1).optional(),
  })
  .strict()

const removeStrictBlockerSchema = removeStrictFindingSchema
  .extend({
    kind: z.enum(REMOVE_STRICT_BLOCKER_KINDS),
    path: z.string().min(1).optional(),
  })
  .strict()

const removeStrictFileSchema = z
  .object({
    dryRunAction: z.string().min(1),
    installedHash: z.string().min(1),
    itemName: z.string().min(1),
    path: z.string().min(1),
    removalTarget: z.enum(REMOVE_TARGETS),
    removedFile: z.boolean(),
    removedLockfileRecord: z.boolean(),
    strictAction: z.enum(REMOVE_STRICT_FILE_ACTIONS),
    targetRole: consumerTargetRoleSchema,
  })
  .strict()

const removeStrictOrphanItemSchema = z
  .object({
    dependencyDepth: z.number().int().positive(),
    dependedOnBy: z.array(z.string().min(1)).default([]),
    files: z.array(removeStrictFileSchema).default([]),
    itemRemoveState: z.enum(REMOVE_STRICT_ITEM_STATES),
    name: z.string().min(1),
    registryDependencies: z.array(z.string().min(1)).default([]),
  })
  .strict()

const removeStrictOrphanCleanupSchema = z
  .object({
    blockedItemCount: z.number().int().nonnegative(),
    deletedFileCount: z.number().int().nonnegative(),
    enabled: z.boolean(),
    itemCount: z.number().int().nonnegative(),
    items: z.array(removeStrictOrphanItemSchema).default([]),
    plannedFileCount: z.number().int().nonnegative(),
    plannedItemCount: z.number().int().nonnegative(),
    preservedFileCount: z.number().int().nonnegative(),
    removedItemCount: z.number().int().nonnegative(),
    removedLockfileRecordCount: z.number().int().nonnegative(),
  })
  .strict()

const removeStrictDependencyCleanupCommandDependencySchema = consumerLockfileDependencySchema
  .omit({ action: true })
  .extend({
    action: z.literal(REMOVE_ADVISORY_DEPENDENCY_CLEANUP_ACTION__CLEANUP_CANDIDATE),
    cleanupItemNames: z.array(z.string().min(1)).default([]),
    remainingItemNames: z.array(z.string().min(1)).default([]),
  })
  .strict()

const removeStrictDependencyCleanupWorkspaceCommandSchema = z
  .object({
    args: z.array(z.string().min(1)),
    command: z.string().min(1),
    packageManager: z.enum(DEPENDENCY_INSTALL_PACKAGE_MANAGERS),
    strategy: z.enum(DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGIES),
    targetPackageName: z.string().min(1),
    targetPackagePath: z.string().min(1),
    workingDirectory: z.string().min(1),
    workspaceRootPath: z.string().min(1),
  })
  .strict()

const removeStrictDependencyCleanupCommandSchema = z
  .object({
    args: z.array(z.string().min(1)),
    command: z.string().min(1),
    dependencies: z.array(removeStrictDependencyCleanupCommandDependencySchema).default([]),
    packageManager: z.enum(DEPENDENCY_INSTALL_PACKAGE_MANAGERS),
    targetManifestPath: z.string().min(1).optional(),
    workingDirectory: z.string().min(1).optional(),
    workspaceCommand: removeStrictDependencyCleanupWorkspaceCommandSchema.optional(),
  })
  .strict()

const removeStrictDependencyCleanupCommandFailureSchema = z
  .object({
    args: z.array(z.string().min(1)),
    command: z.string().min(1),
    exitCode: z.number().int().optional(),
    message: z.string().min(1),
    mutatedPaths: z.array(z.string().min(1)).default([]),
    packageManager: z.enum(DEPENDENCY_INSTALL_PACKAGE_MANAGERS),
    packageManagerWrites: z.boolean(),
    signal: z.string().min(1).optional(),
    stderr: z.string().optional(),
    stdout: z.string().optional(),
    workingDirectory: z.string().min(1).optional(),
  })
  .strict()

const removeStrictDependencyCleanupExecutionBlockerSchema = z
  .object({
    code: z.enum(REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_BLOCKERS),
    message: z.string().min(1),
  })
  .strict()

const removeStrictDependencyCleanupPackageManagerSchema = z
  .object({
    lockfilePath: z.string().min(1).optional(),
    name: z.enum(REMOVE_STRICT_DEPENDENCY_CLEANUP_DETECTED_PACKAGE_MANAGERS),
    packageManagerField: z.string().min(1).optional(),
    packageManagerOverride: z.enum(DEPENDENCY_INSTALL_PACKAGE_MANAGERS).optional(),
    packageManifestPath: z.string().min(1).optional(),
    source: z.enum(DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCES),
  })
  .strict()

const removeStrictDependencyCleanupTargetManifestSchema = z
  .object({
    directory: z.string().min(1).optional(),
    exists: z.boolean(),
    packageManagerField: z.string().min(1).optional(),
    packageName: z.string().min(1).optional(),
    path: z.string().min(1).optional(),
    source: z.enum(DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCES),
  })
  .strict()

const removeStrictDependencyCleanupExecutionSchema = z
  .object({
    approvalSource: z.enum(REMOVE_STRICT_DEPENDENCY_CLEANUP_APPROVAL_SOURCES),
    blockers: z.array(removeStrictDependencyCleanupExecutionBlockerSchema).default([]),
    commands: z.array(removeStrictDependencyCleanupCommandSchema).default([]),
    executedCommands: z.array(removeStrictDependencyCleanupCommandSchema).default([]),
    failedCommands: z.array(removeStrictDependencyCleanupCommandFailureSchema).default([]),
    mode: z.enum(REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_MODES),
    packageManager: removeStrictDependencyCleanupPackageManagerSchema,
    packageManagerExecution: z.enum(DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTIONS),
    packageManagerWrites: z.boolean(),
    recommendedCommands: z.array(removeStrictDependencyCleanupCommandSchema).default([]),
    removeDependenciesRequested: z.boolean(),
    requiresExplicitApproval: z.literal(true),
    targetManifest: removeStrictDependencyCleanupTargetManifestSchema,
  })
  .strict()

export const removeStrictReportSchema = z
  .object({
    applied: z.boolean(),
    blockers: z.array(removeStrictBlockerSchema).default([]),
    cwd: z.string().min(1),
    dependencyCleanup: removeAdvisoryDependencyCleanupSchema,
    dependencyCleanupExecution: removeStrictDependencyCleanupExecutionSchema,
    dependencies: z.array(consumerLockfileDependencySchema).default([]),
    effects: z
      .object({
        dependencies: z
          .object({
            packageManagerExecution: z.enum(DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTIONS),
            packageManagerWrites: z.boolean(),
            plannedRemovalCount: z.number().int().nonnegative(),
            removedCount: z.number().int().nonnegative(),
            status: z.enum(CLI_STRICT_WRITE_STATUSES),
          })
          .strict(),
        files: z
          .object({
            deletedCount: z.number().int().nonnegative(),
            plannedDeleteCount: z.number().int().nonnegative(),
            plannedLockfileRecordRemovalCount: z.number().int().nonnegative(),
            preservedCount: z.number().int().nonnegative(),
          })
          .strict(),
        installsDependencies: z.literal(false),
        removesDependencies: z.boolean(),
        lockfile: z
          .object({
            plannedItem: z.string().min(1).optional(),
            removedFileRecordCount: z.number().int().nonnegative(),
            removedItem: z.boolean(),
            status: z.enum(CLI_STRICT_WRITE_STATUSES),
          })
          .strict(),
        orphanCleanup: z
          .object({
            deletedCount: z.number().int().nonnegative(),
            enabled: z.boolean(),
            plannedFileCount: z.number().int().nonnegative(),
            plannedItemCount: z.number().int().nonnegative(),
            removedFileRecordCount: z.number().int().nonnegative(),
            removedItemCount: z.number().int().nonnegative(),
            status: z.enum(CLI_STRICT_WRITE_STATUSES),
          })
          .strict(),
        writesConfig: z.literal(false),
        writesFiles: z.boolean(),
        writesLockfile: z.boolean(),
      })
      .strict(),
    files: z.array(removeStrictFileSchema).default([]),
    findings: z.array(removeStrictFindingSchema).default([]),
    itemName: z.string().min(1),
    itemRemoveState: z.enum(REMOVE_STRICT_ITEM_STATES),
    lockfileData: consumerLockfileSchema,
    orphanCleanup: removeStrictOrphanCleanupSchema,
    registrySource: z
      .object({
        path: z.string().min(1).optional(),
        sourceIdentity: z.string().min(1).optional(),
        status: z.enum(CLI_REGISTRY_SOURCE_STATUSES),
      })
      .strict(),
    schemaVersion: z.literal(REMOVE_STRICT_SCHEMA_VERSION).default(REMOVE_STRICT_SCHEMA_VERSION),
    status: z
      .object({
        config: z.enum(CLI_PROJECT_RESOURCE_STATUSES),
        lockfile: z.enum(CLI_PROJECT_RESOURCE_STATUSES),
      })
      .strict(),
  })
  .strict()

export type TRemoveStrictReport = z.infer<typeof removeStrictReportSchema>

export type TCreateRemoveStrictReportOptions = {
  cwd: string
  includeOrphans?: boolean
  itemName: string
  removeDependencies?: boolean
  registrySourcePath?: string
}

type TRemoveStrictBlocker = z.infer<typeof removeStrictBlockerSchema>
type TRemoveStrictFile = z.infer<typeof removeStrictFileSchema>
type TRemoveStrictOrphanItem = z.infer<typeof removeStrictOrphanItemSchema>
type TRemoveStrictDependencyCleanupCommand = z.infer<typeof removeStrictDependencyCleanupCommandSchema>
type TRemoveStrictDependencyCleanupCommandFailure = z.infer<typeof removeStrictDependencyCleanupCommandFailureSchema>
type TRemoveStrictDependencyCleanupExecution = z.infer<typeof removeStrictDependencyCleanupExecutionSchema>
type TRemoveStrictDependencyCleanupDependency = z.infer<typeof removeStrictDependencyCleanupCommandDependencySchema>
type TCreateRemoveStrictBlockerOptions = Omit<TRemoveStrictBlocker, "severity"> & {
  severity?: TRemoveStrictBlocker["severity"]
}

const createContentHash = (content: string | Buffer) =>
  `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`

const createRemoveStrictBlocker = ({
  code,
  itemName,
  kind,
  message,
  path,
  severity = INSTALL_PLAN_FINDING_SEVERITY__ERROR,
  sourcePath,
  targetPath,
}: TCreateRemoveStrictBlockerOptions) =>
  removeStrictBlockerSchema.parse({
    code,
    itemName,
    kind,
    message,
    path,
    severity,
    sourcePath,
    targetPath,
  })

const createFallbackLockfile = () => consumerLockfileSchema.parse({})

const readConsumerLockfileForStrictRemove = async (
  cwd: string,
): Promise<{
  findings: TRemoveStrictBlocker[]
  lockfileData: TConsumerLockfile
}> => {
  const lockfilePath = path.join(cwd, AMINO_UI_LOCK_FILE_NAME)

  if (!existsSync(lockfilePath)) {
    return {
      findings: [
        createRemoveStrictBlocker({
          code: "strict-remove-lockfile-missing",
          kind: REMOVE_STRICT_BLOCKER_KIND__PROJECT,
          message: `${AMINO_UI_LOCK_FILE_NAME} is missing. Strict remove requires a valid Amino lockfile.`,
          targetPath: AMINO_UI_LOCK_FILE_NAME,
        }),
      ],
      lockfileData: createFallbackLockfile(),
    }
  }

  try {
    return {
      findings: [],
      lockfileData: consumerLockfileSchema.parse(JSON.parse(await fs.readFile(lockfilePath, "utf8"))),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown lockfile parse error."

    return {
      findings: [
        createRemoveStrictBlocker({
          code: "strict-remove-lockfile-invalid",
          kind: REMOVE_STRICT_BLOCKER_KIND__PROJECT,
          message: `${AMINO_UI_LOCK_FILE_NAME} could not be read as an Amino lockfile. ${message}`,
          targetPath: AMINO_UI_LOCK_FILE_NAME,
        }),
      ],
      lockfileData: createFallbackLockfile(),
    }
  }
}

const isInsideDirectory = ({ directoryPath, filePath }: { directoryPath: string; filePath: string }) => {
  const relativePath = path.relative(directoryPath, filePath)

  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
}

const getAbsoluteTargetPath = ({ cwd, targetPath }: { cwd: string; targetPath: string }) =>
  path.resolve(cwd, targetPath)

const readPackageManagerBoundaryFile = async (filePath: string) => {
  try {
    return await fs.readFile(filePath, "utf8")
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return undefined

    throw error
  }
}

const formatPackageManagerBoundaryPath = ({ consumerRoot, filePath }: { consumerRoot: string; filePath: string }) => {
  const relativePath = path.relative(consumerRoot, filePath).replace(/\\/gu, "/")

  if (!relativePath) return "."
  if (relativePath.startsWith("../") || path.isAbsolute(relativePath)) return filePath

  return relativePath
}

const resolvePackageManagerBoundaryDirectories = ({
  consumerRoot,
  targetManifestPath,
  workingDirectory,
}: {
  consumerRoot: string
  targetManifestPath?: string
  workingDirectory: string
}) => {
  const directories = [workingDirectory]

  if (targetManifestPath) {
    directories.push(path.resolve(consumerRoot, path.dirname(targetManifestPath)))
  }

  return [...new Set(directories.map((directory) => path.resolve(directory)))]
}

const snapshotPackageManagerMutationBoundary = async ({
  consumerRoot,
  targetManifestPath,
  workingDirectory,
}: {
  consumerRoot: string
  targetManifestPath?: string
  workingDirectory: string
}) =>
  new Map(
    await Promise.all(
      resolvePackageManagerBoundaryDirectories({
        consumerRoot,
        targetManifestPath,
        workingDirectory,
      }).flatMap((boundaryDirectory) =>
        packageManagerMutationBoundaryFileNames.map(async (fileName) => {
          const filePath = path.join(boundaryDirectory, fileName)

          return [
            formatPackageManagerBoundaryPath({
              consumerRoot,
              filePath,
            }),
            await readPackageManagerBoundaryFile(filePath),
          ] as const
        }),
      ),
    ),
  )

const getMutatedPackageManagerBoundaryPaths = ({
  afterSnapshot,
  beforeSnapshot,
}: {
  afterSnapshot: ReadonlyMap<string, string | undefined>
  beforeSnapshot: ReadonlyMap<string, string | undefined>
}) =>
  [...new Set([...beforeSnapshot.keys(), ...afterSnapshot.keys()])]
    .filter((filePath) => beforeSnapshot.get(filePath) !== afterSnapshot.get(filePath))
    .sort()

const limitDependencyCommandOutput = (value: unknown) => {
  if (typeof value !== "string") return undefined
  if (value.length <= dependencyCommandOutputMaxLength) return value

  return value.slice(0, dependencyCommandOutputMaxLength)
}

type TDependencyCleanupPlan = ReturnType<typeof createDependencyInstallPlan>
type TDependencyCleanupWorkspaceContext = TDependencyCleanupPlan["workspace"]
type TDependencyCleanupTargetManifest = TDependencyCleanupPlan["targetManifest"]

const createDependencyCleanupKey = ({
  kind,
  name,
  requiredRange,
}: Pick<TRemoveStrictDependencyCleanupDependency, "kind" | "name" | "requiredRange">) =>
  [kind, name, requiredRange].join(":")

const getDependencyCleanupCandidates = (dryRunReport: TRemoveDryRunReport) =>
  dryRunReport.dependencyCleanup.dependencies
    .filter((dependency) => dependency.action === REMOVE_ADVISORY_DEPENDENCY_CLEANUP_ACTION__CLEANUP_CANDIDATE)
    .map((dependency) => removeStrictDependencyCleanupCommandDependencySchema.parse(dependency))

const getPackageManagerCleanupDependencies = (dependencies: readonly TRemoveStrictDependencyCleanupDependency[]) =>
  dependencies.filter((dependency) => dependency.declaredIn)

const createDependencyCleanupWorkspaceCommand = ({
  dependencies,
  packageManager,
  removeCommand,
  workspace,
}: {
  dependencies: readonly TRemoveStrictDependencyCleanupDependency[]
  packageManager: TDependencyInstallPackageManager
  removeCommand: string
  workspace: TDependencyCleanupWorkspaceContext
}): TRemoveStrictDependencyCleanupCommand["workspaceCommand"] => {
  const { rootPath, targetPackageName, targetPackagePath } = workspace

  if (!workspace.detected || !rootPath || !targetPackageName || !targetPackagePath || targetPackagePath === ".") {
    return undefined
  }

  const dependencyNames = dependencies.map((dependency) => dependency.name)
  const dependencyArgs = [removeCommand, ...dependencyNames]
  const createCommand = ({
    args,
    strategy,
  }: {
    args: string[]
    strategy: (typeof DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGIES)[number]
  }) =>
    removeStrictDependencyCleanupWorkspaceCommandSchema.parse({
      args,
      command: [packageManager, ...args].join(" "),
      packageManager,
      strategy,
      targetPackageName,
      targetPackagePath,
      workingDirectory: rootPath,
      workspaceRootPath: rootPath,
    })

  switch (packageManager) {
    case PACKAGE_MANAGER_NPM:
      return createCommand({
        args: [...dependencyArgs, "--workspace", targetPackageName],
        strategy: DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGY__NPM_WORKSPACE_OPTION,
      })
    case PACKAGE_MANAGER_PNPM:
      return createCommand({
        args: [...dependencyArgs, "--filter", targetPackageName],
        strategy: DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGY__PNPM_FILTER_OPTION,
      })
    case PACKAGE_MANAGER_YARN:
      return createCommand({
        args: ["workspace", targetPackageName, ...dependencyArgs],
        strategy: DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGY__YARN_WORKSPACE_SUBCOMMAND,
      })
    case PACKAGE_MANAGER_BUN:
      return createCommand({
        args: [...dependencyArgs, "--cwd", targetPackagePath],
        strategy: DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGY__BUN_CWD_OPTION,
      })
  }
}

const createDependencyCleanupCommand = ({
  dependencies,
  packageManager,
  targetManifest,
  workspace,
}: {
  dependencies: readonly TRemoveStrictDependencyCleanupDependency[]
  packageManager: TDependencyInstallPackageManager
  targetManifest: TDependencyCleanupTargetManifest
  workspace: TDependencyCleanupWorkspaceContext
}) => {
  const removeCommand = computePackageManagerRemoveCommand(packageManager)
  const dependencyNames = dependencies.map((dependency) => dependency.name)
  const args = [removeCommand, ...dependencyNames]
  const workspaceCommand = createDependencyCleanupWorkspaceCommand({
    dependencies,
    packageManager,
    removeCommand,
    workspace,
  })

  return removeStrictDependencyCleanupCommandSchema.parse({
    args,
    command: [packageManager, ...args].join(" "),
    dependencies,
    packageManager,
    targetManifestPath: targetManifest.path,
    workingDirectory: targetManifest.directory,
    workspaceCommand,
  })
}

const createDependencyCleanupExecution = ({
  cwd,
  dryRunReport,
  executedCommands = [],
  failedCommands = [],
  packageManagerExecution = DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTION__NOT_RUN,
  packageManagerWrites = false,
  removeDependencies,
}: {
  cwd: string
  dryRunReport: TRemoveDryRunReport
  executedCommands?: TRemoveStrictDependencyCleanupCommand[]
  failedCommands?: TRemoveStrictDependencyCleanupCommandFailure[]
  packageManagerExecution?: (typeof DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTIONS)[number]
  packageManagerWrites?: boolean
  removeDependencies: boolean
}): TRemoveStrictDependencyCleanupExecution => {
  const detectionPlan = createDependencyInstallPlan({
    consumerRoot: cwd,
    dependencyPlan: [],
  })
  const dependencyCleanupCandidates = getDependencyCleanupCandidates(dryRunReport)
  const packageManagerDependencies = getPackageManagerCleanupDependencies(dependencyCleanupCandidates)
  const commands =
    packageManagerDependencies.length === 0
      ? []
      : DEPENDENCY_INSTALL_PACKAGE_MANAGERS.map((packageManager) =>
          createDependencyCleanupCommand({
            dependencies: packageManagerDependencies,
            packageManager,
            targetManifest: detectionPlan.targetManifest,
            workspace: detectionPlan.workspace,
          }),
        )
  const recommendedCommands =
    detectionPlan.packageManager.name === PACKAGE_MANAGER_UNKNOWN
      ? []
      : commands.filter((command) => command.packageManager === detectionPlan.packageManager.name)
  const approvalSource = removeDependencies
    ? REMOVE_STRICT_DEPENDENCY_CLEANUP_APPROVAL_SOURCE__CLI_OPTION
    : REMOVE_STRICT_DEPENDENCY_CLEANUP_APPROVAL_SOURCE__NONE
  const blockers: z.infer<typeof removeStrictDependencyCleanupExecutionBlockerSchema>[] = []

  if (removeDependencies && packageManagerDependencies.length > 0) {
    if (!detectionPlan.targetManifest.exists) {
      blockers.push({
        code: REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_BLOCKER__TARGET_MANIFEST_MISSING,
        message: "Dependency cleanup was requested, but no package.json target manifest could be found.",
      })
    }

    if (detectionPlan.packageManager.name === PACKAGE_MANAGER_UNKNOWN || recommendedCommands.length === 0) {
      blockers.push({
        code: REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_BLOCKER__PACKAGE_MANAGER_UNKNOWN,
        message: "Dependency cleanup was requested, but no known package manager command can be recommended.",
      })
    }
  }

  const mode = !removeDependencies
    ? REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_MODE__NOT_REQUESTED
    : dependencyCleanupCandidates.length === 0
      ? REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_MODE__NOT_NEEDED
      : blockers.length > 0
        ? REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_MODE__BLOCKED
        : REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_MODE__ELIGIBLE

  return removeStrictDependencyCleanupExecutionSchema.parse({
    approvalSource,
    blockers,
    commands,
    executedCommands,
    failedCommands,
    mode,
    packageManager: detectionPlan.packageManager,
    packageManagerExecution,
    packageManagerWrites,
    recommendedCommands,
    removeDependenciesRequested: removeDependencies,
    requiresExplicitApproval: true,
    targetManifest: detectionPlan.targetManifest,
  })
}

const createDependencyCleanupStrictBlockers = ({
  dependencyCleanupExecution,
  itemName,
}: {
  dependencyCleanupExecution: TRemoveStrictDependencyCleanupExecution
  itemName: string
}) =>
  dependencyCleanupExecution.blockers.map((blocker) =>
    createRemoveStrictBlocker({
      code: `strict-remove-${blocker.code}`,
      itemName,
      kind: REMOVE_STRICT_BLOCKER_KIND__PROJECT,
      message: `Strict remove dependency cleanup is blocked: ${blocker.message}`,
    }),
  )

const getDependencyCleanupExecutionCommand = (
  command: TRemoveStrictDependencyCleanupCommand,
): TRemoveStrictDependencyCleanupCommand => {
  if (!command.workspaceCommand) return command

  return {
    ...command,
    args: command.workspaceCommand.args,
    command: command.workspaceCommand.command,
    packageManager: command.workspaceCommand.packageManager,
    workingDirectory: command.workspaceCommand.workingDirectory,
  }
}

const createDryRunBlockers = (dryRunReport: TRemoveDryRunReport) =>
  dryRunReport.blockers.map((blocker) =>
    createRemoveStrictBlocker({
      code: "strict-remove-dry-run-blocker",
      itemName: blocker.itemName,
      kind: blocker.kind,
      message: `Strict remove is blocked by dry-run blocker "${blocker.code}": ${blocker.message}`,
      path: blocker.path,
      sourcePath: blocker.sourcePath,
      targetPath: blocker.targetPath,
    }),
  )

const createProjectStateBlockers = (dryRunReport: TRemoveDryRunReport) => {
  const blockers: TRemoveStrictBlocker[] = []

  if (dryRunReport.status.config !== CLI_PROJECT_RESOURCE_STATUS__PRESENT) {
    blockers.push(
      createRemoveStrictBlocker({
        code: "strict-remove-config-blocker",
        itemName: dryRunReport.itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__PROJECT,
        message: `Strict remove requires a present consumer config. Current config status is "${dryRunReport.status.config}".`,
      }),
    )
  }

  if (dryRunReport.status.lockfile !== CLI_PROJECT_RESOURCE_STATUS__PRESENT) {
    blockers.push(
      createRemoveStrictBlocker({
        code: "strict-remove-lockfile-status-blocker",
        itemName: dryRunReport.itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__PROJECT,
        message: `Strict remove requires a present Amino lockfile. Current lockfile status is "${dryRunReport.status.lockfile}".`,
      }),
    )
  }

  if (dryRunReport.itemRemoveState === "unavailable") {
    blockers.push(
      createRemoveStrictBlocker({
        code: "strict-remove-item-unavailable",
        itemName: dryRunReport.itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict remove cannot continue because item "${dryRunReport.itemName}" is unavailable.`,
      }),
    )
  } else if (dryRunReport.itemRemoveState !== "would-remove") {
    blockers.push(
      createRemoveStrictBlocker({
        code: "strict-remove-item-state-blocker",
        itemName: dryRunReport.itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict remove requires itemRemoveState "would-remove"; received "${dryRunReport.itemRemoveState}".`,
      }),
    )
  }

  if (dryRunReport.wouldEffects.lockfile.status !== CLI_WRITE_STATUS__WOULD_WRITE) {
    blockers.push(
      createRemoveStrictBlocker({
        code: "strict-remove-lockfile-effect-blocker",
        itemName: dryRunReport.itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict remove requires a would-write lockfile dry-run effect; received "${dryRunReport.wouldEffects.lockfile.status}".`,
      }),
    )
  }

  if (
    dryRunReport.orphanCleanup.enabled &&
    dryRunReport.orphanCleanup.itemCount > 0 &&
    dryRunReport.wouldEffects.orphanCleanup.status !== CLI_WRITE_STATUS__WOULD_WRITE
  ) {
    blockers.push(
      createRemoveStrictBlocker({
        code: "strict-remove-orphan-cleanup-effect-blocker",
        itemName: dryRunReport.itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict orphan cleanup requires a would-write orphan cleanup dry-run effect; received "${dryRunReport.wouldEffects.orphanCleanup.status}".`,
      }),
    )
  }

  return blockers
}

const createLockfileBlockers = ({
  dryRunReport,
  lockfileData,
}: {
  dryRunReport: TRemoveDryRunReport
  lockfileData: TConsumerLockfile
}) => {
  if (lockfileData.items[dryRunReport.itemName]) return []

  return [
    createRemoveStrictBlocker({
      code: "strict-remove-lockfile-item-missing",
      itemName: dryRunReport.itemName,
      kind: REMOVE_STRICT_BLOCKER_KIND__ITEM,
      message: `Strict remove cannot continue because "${dryRunReport.itemName}" is missing from ${AMINO_UI_LOCK_FILE_NAME}.`,
    }),
  ]
}

const createOrphanLockfileBlockers = ({
  dryRunReport,
  lockfileData,
}: {
  dryRunReport: TRemoveDryRunReport
  lockfileData: TConsumerLockfile
}) => {
  if (!dryRunReport.orphanCleanup.enabled) return []

  return dryRunReport.orphanCleanup.items
    .filter((item) => !lockfileData.items[item.name])
    .map((item) =>
      createRemoveStrictBlocker({
        code: "strict-remove-orphan-lockfile-item-missing",
        itemName: item.name,
        kind: REMOVE_STRICT_BLOCKER_KIND__ITEM,
        message: `Strict orphan cleanup cannot continue because "${item.name}" is missing from ${AMINO_UI_LOCK_FILE_NAME}.`,
      }),
    )
}

const createFilePreflightBlockers = async ({ cwd, dryRunFile }: { cwd: string; dryRunFile: TRemoveDryRunFile }) => {
  const blockers: TRemoveStrictBlocker[] = []
  const absoluteTargetPath = getAbsoluteTargetPath({ cwd, targetPath: dryRunFile.path })

  if (!isInsideDirectory({ directoryPath: cwd, filePath: absoluteTargetPath })) {
    return [
      createRemoveStrictBlocker({
        code: "strict-remove-path-boundary-blocker",
        itemName: dryRunFile.itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__FILE,
        message: `Strict remove will not remove ${dryRunFile.path} because it resolves outside the consumer root.`,
        path: dryRunFile.path,
        targetPath: dryRunFile.path,
      }),
    ]
  }

  if (!dryRunFile.wouldRemoveFile) {
    if (dryRunFile.wouldRemoveLockfileRecord && existsSync(absoluteTargetPath)) {
      blockers.push(
        createRemoveStrictBlocker({
          code: "strict-remove-lockfile-only-existing-file-blocker",
          itemName: dryRunFile.itemName,
          kind: REMOVE_STRICT_BLOCKER_KIND__FILE,
          message: `Strict remove expected ${dryRunFile.path} to be missing before lockfile-only cleanup, but it exists.`,
          path: dryRunFile.path,
          targetPath: dryRunFile.path,
        }),
      )
    }

    return blockers
  }

  if (!existsSync(absoluteTargetPath)) {
    return [
      createRemoveStrictBlocker({
        code: "strict-remove-file-missing-blocker",
        itemName: dryRunFile.itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__FILE,
        message: `Strict remove expected ${dryRunFile.path} to exist before deletion, but it is missing.`,
        path: dryRunFile.path,
        targetPath: dryRunFile.path,
      }),
    ]
  }

  const fileStats = await fs.lstat(absoluteTargetPath)

  if (!fileStats.isFile() && !fileStats.isSymbolicLink()) {
    blockers.push(
      createRemoveStrictBlocker({
        code: "strict-remove-non-file-blocker",
        itemName: dryRunFile.itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__FILE,
        message: `Strict remove will not remove ${dryRunFile.path} because it is not a file.`,
        path: dryRunFile.path,
        targetPath: dryRunFile.path,
      }),
    )
  }

  if (dryRunFile.currentHash) {
    const currentHash = createContentHash(await fs.readFile(absoluteTargetPath))

    if (currentHash !== dryRunFile.currentHash) {
      blockers.push(
        createRemoveStrictBlocker({
          code: "strict-remove-file-hash-blocker",
          itemName: dryRunFile.itemName,
          kind: REMOVE_STRICT_BLOCKER_KIND__FILE,
          message: `Strict remove will not remove ${dryRunFile.path} because its content changed after dry-run classification.`,
          path: dryRunFile.path,
          targetPath: dryRunFile.path,
        }),
      )
    }
  }

  return blockers
}

const createFileBlockersForFiles = async ({
  cwd,
  dryRunFiles,
}: {
  cwd: string
  dryRunFiles: readonly TRemoveDryRunFile[]
}) => {
  const blockerLists = await Promise.all(
    dryRunFiles.map(async (dryRunFile) => {
      if (dryRunFile.removalTarget === REMOVE_TARGET__FILE_AND_LOCKFILE) {
        return createFilePreflightBlockers({ cwd, dryRunFile })
      }
      if (dryRunFile.removalTarget === REMOVE_TARGET__LOCKFILE_ONLY) {
        return createFilePreflightBlockers({ cwd, dryRunFile })
      }

      return [
        createRemoveStrictBlocker({
          code: "strict-remove-file-action-blocker",
          itemName: dryRunFile.itemName,
          kind: REMOVE_STRICT_BLOCKER_KIND__FILE,
          message: `Strict remove cannot apply file ${dryRunFile.path} because dry-run action is "${dryRunFile.dryRunAction}".`,
          path: dryRunFile.path,
          targetPath: dryRunFile.path,
        }),
      ]
    }),
  )

  return blockerLists.flat()
}

const createFileBlockers = async ({ cwd, dryRunReport }: { cwd: string; dryRunReport: TRemoveDryRunReport }) =>
  createFileBlockersForFiles({
    cwd,
    dryRunFiles: dryRunReport.files,
  })

const createOrphanFileBlockers = async ({ cwd, dryRunReport }: { cwd: string; dryRunReport: TRemoveDryRunReport }) =>
  createFileBlockersForFiles({
    cwd,
    dryRunFiles: dryRunReport.orphanCleanup.items.flatMap((item) => item.files),
  })

const dedupeBlockers = (blockers: readonly TRemoveStrictBlocker[]) => {
  const dedupedBlockers = new Map<string, TRemoveStrictBlocker>()

  blockers.forEach((blocker) => {
    dedupedBlockers.set(
      [blocker.code, blocker.itemName, blocker.path, blocker.sourcePath, blocker.targetPath].join(":"),
      blocker,
    )
  })

  return [...dedupedBlockers.values()]
}

const resolveBlockedFiles = (files: readonly TRemoveDryRunFile[]) =>
  files.map((file) =>
    removeStrictFileSchema.parse({
      dryRunAction: file.dryRunAction,
      installedHash: file.installedHash,
      itemName: file.itemName,
      path: file.path,
      removalTarget: file.removalTarget,
      removedFile: false,
      removedLockfileRecord: false,
      strictAction:
        file.dryRunAction === "blocked" ? REMOVE_STRICT_FILE_ACTION__BLOCKED : REMOVE_STRICT_FILE_ACTION__SKIPPED,
      targetRole: file.targetRole,
    }),
  )

const resolveStrictOrphanItemState = ({
  applied,
  itemRemoveState,
}: {
  applied: boolean
  itemRemoveState: TRemoveDryRunReport["orphanCleanup"]["items"][number]["itemRemoveState"]
}) => {
  if (applied) return REMOVE_STRICT_ITEM_STATE__REMOVED
  if (itemRemoveState === "unavailable") return REMOVE_STRICT_ITEM_STATE__UNAVAILABLE

  return REMOVE_STRICT_ITEM_STATE__BLOCKED
}

const resolveBlockedOrphanItems = (dryRunReport: TRemoveDryRunReport) =>
  dryRunReport.orphanCleanup.items.map((item) =>
    removeStrictOrphanItemSchema.parse({
      dependencyDepth: item.dependencyDepth,
      dependedOnBy: item.dependedOnBy,
      files: resolveBlockedFiles(item.files),
      itemRemoveState: resolveStrictOrphanItemState({
        applied: false,
        itemRemoveState: item.itemRemoveState,
      }),
      name: item.name,
      registryDependencies: item.registryDependencies,
    }),
  )

const createDisabledOrphanCleanup = () =>
  removeStrictOrphanCleanupSchema.parse({
    blockedItemCount: 0,
    deletedFileCount: 0,
    enabled: false,
    itemCount: 0,
    items: [],
    plannedFileCount: 0,
    plannedItemCount: 0,
    preservedFileCount: 0,
    removedItemCount: 0,
    removedLockfileRecordCount: 0,
  })

const createStrictOrphanCleanup = ({
  dryRunReport,
  items,
}: {
  dryRunReport: TRemoveDryRunReport
  items: readonly TRemoveStrictOrphanItem[]
}) => {
  if (!dryRunReport.orphanCleanup.enabled) return createDisabledOrphanCleanup()

  const files = items.flatMap((item) => item.files)

  return removeStrictOrphanCleanupSchema.parse({
    blockedItemCount: items.filter((item) => item.itemRemoveState === REMOVE_STRICT_ITEM_STATE__BLOCKED).length,
    deletedFileCount: files.filter((file) => file.removedFile).length,
    enabled: true,
    itemCount: items.length,
    items,
    plannedFileCount: dryRunReport.orphanCleanup.items.reduce((count, item) => count + item.files.length, 0),
    plannedItemCount: dryRunReport.orphanCleanup.itemCount,
    preservedFileCount: files.filter((file) => !file.removedLockfileRecord).length,
    removedItemCount: items.filter((item) => item.itemRemoveState === REMOVE_STRICT_ITEM_STATE__REMOVED).length,
    removedLockfileRecordCount: files.filter((file) => file.removedLockfileRecord).length,
  })
}

const writeStrictFiles = async ({ cwd, dryRunFiles }: { cwd: string; dryRunFiles: readonly TRemoveDryRunFile[] }) => {
  const files: TRemoveStrictFile[] = []

  for (const file of dryRunFiles) {
    if (file.wouldRemoveFile) {
      await fs.rm(getAbsoluteTargetPath({ cwd, targetPath: file.path }))
      files.push(
        removeStrictFileSchema.parse({
          dryRunAction: file.dryRunAction,
          installedHash: file.installedHash,
          itemName: file.itemName,
          path: file.path,
          removalTarget: file.removalTarget,
          removedFile: true,
          removedLockfileRecord: true,
          strictAction: REMOVE_STRICT_FILE_ACTION__REMOVED_FILE_AND_LOCKFILE,
          targetRole: file.targetRole,
        }),
      )
      continue
    }

    files.push(
      removeStrictFileSchema.parse({
        dryRunAction: file.dryRunAction,
        installedHash: file.installedHash,
        itemName: file.itemName,
        path: file.path,
        removalTarget: file.removalTarget,
        removedFile: false,
        removedLockfileRecord: true,
        strictAction: REMOVE_STRICT_FILE_ACTION__REMOVED_LOCKFILE_RECORD,
        targetRole: file.targetRole,
      }),
    )
  }

  return files
}

const writeStrictRemove = async ({
  cwd,
  dryRunReport,
  lockfileData,
  removedDependencies = [],
}: {
  cwd: string
  dryRunReport: TRemoveDryRunReport
  lockfileData: TConsumerLockfile
  removedDependencies?: readonly TRemoveStrictDependencyCleanupDependency[]
}) => {
  const files = await writeStrictFiles({
    cwd,
    dryRunFiles: dryRunReport.files,
  })
  const orphanItems: TRemoveStrictOrphanItem[] = []

  for (const item of dryRunReport.orphanCleanup.items) {
    const orphanFiles = await writeStrictFiles({
      cwd,
      dryRunFiles: item.files,
    })

    orphanItems.push(
      removeStrictOrphanItemSchema.parse({
        dependencyDepth: item.dependencyDepth,
        dependedOnBy: item.dependedOnBy,
        files: orphanFiles,
        itemRemoveState: REMOVE_STRICT_ITEM_STATE__REMOVED,
        name: item.name,
        registryDependencies: item.registryDependencies,
      }),
    )
  }

  const nextItems = { ...lockfileData.items }

  delete nextItems[dryRunReport.itemName]
  orphanItems.forEach((item) => {
    delete nextItems[item.name]
  })

  const removedDependencyKeys = new Set(removedDependencies.map(createDependencyCleanupKey))
  const nextLockfileData = consumerLockfileSchema.parse({
    ...lockfileData,
    dependencies: lockfileData.dependencies.filter(
      (dependency) => !removedDependencyKeys.has(createDependencyCleanupKey(dependency)),
    ),
    items: nextItems,
  })

  await fs.writeFile(path.join(cwd, AMINO_UI_LOCK_FILE_NAME), `${JSON.stringify(nextLockfileData, null, 2)}\n`, "utf8")

  return {
    files,
    lockfileData: nextLockfileData,
    orphanCleanup: createStrictOrphanCleanup({
      dryRunReport,
      items: orphanItems,
    }),
  }
}

const createRemoveStrictEffects = ({
  applied,
  dependencyCleanupExecution,
  dryRunReport,
  files,
  orphanCleanup,
  removedDependencyCount,
}: {
  applied: boolean
  dependencyCleanupExecution: TRemoveStrictDependencyCleanupExecution
  dryRunReport: TRemoveDryRunReport
  files: readonly TRemoveStrictFile[]
  orphanCleanup: z.infer<typeof removeStrictOrphanCleanupSchema>
  removedDependencyCount: number
}) => {
  const deletedCount = files.filter((file) => file.removedFile).length
  const removedFileRecordCount = files.filter((file) => file.removedLockfileRecord).length
  const orphanCleanupStatus =
    !orphanCleanup.enabled || orphanCleanup.plannedItemCount === 0
      ? CLI_WRITE_STATUS__NOT_WRITTEN
      : applied
        ? CLI_WRITE_STATUS__WRITTEN
        : CLI_WRITE_STATUS__BLOCKED
  const dependencyStatus =
    removedDependencyCount > 0
      ? CLI_WRITE_STATUS__WRITTEN
      : dependencyCleanupExecution.mode === REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_MODE__BLOCKED ||
          dependencyCleanupExecution.packageManagerExecution === DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTION__FAILED
        ? CLI_WRITE_STATUS__BLOCKED
        : CLI_WRITE_STATUS__NOT_WRITTEN

  return {
    dependencies: {
      packageManagerExecution: dependencyCleanupExecution.packageManagerExecution,
      packageManagerWrites: dependencyCleanupExecution.packageManagerWrites,
      plannedRemovalCount: dryRunReport.wouldEffects.dependencies.plannedRemovalCount,
      removedCount: removedDependencyCount,
      status: dependencyStatus,
    },
    files: {
      deletedCount,
      plannedDeleteCount: dryRunReport.summary.wouldRemoveFileCount,
      plannedLockfileRecordRemovalCount: dryRunReport.summary.wouldRemoveLockfileRecordCount,
      preservedCount: dryRunReport.summary.skippedFileCount + dryRunReport.summary.blockedFileCount,
    },
    installsDependencies: false,
    removesDependencies: dependencyCleanupExecution.packageManagerWrites,
    lockfile: {
      plannedItem: dryRunReport.files.length > 0 ? dryRunReport.itemName : undefined,
      removedFileRecordCount,
      removedItem: applied,
      status: applied
        ? CLI_WRITE_STATUS__WRITTEN
        : dryRunReport.files.length > 0
          ? CLI_WRITE_STATUS__BLOCKED
          : CLI_WRITE_STATUS__NOT_WRITTEN,
    },
    orphanCleanup: {
      deletedCount: orphanCleanup.deletedFileCount,
      enabled: orphanCleanup.enabled,
      plannedFileCount: orphanCleanup.plannedFileCount,
      plannedItemCount: orphanCleanup.plannedItemCount,
      removedFileRecordCount: orphanCleanup.removedLockfileRecordCount,
      removedItemCount: orphanCleanup.removedItemCount,
      status: orphanCleanupStatus,
    },
    writesConfig: false,
    writesFiles: deletedCount > 0 || orphanCleanup.deletedFileCount > 0,
    writesLockfile: applied,
  } as const
}

const resolveItemRemoveState = ({ applied, dryRunReport }: { applied: boolean; dryRunReport: TRemoveDryRunReport }) => {
  if (applied) return REMOVE_STRICT_ITEM_STATE__REMOVED
  if (dryRunReport.itemRemoveState === "unavailable") return REMOVE_STRICT_ITEM_STATE__UNAVAILABLE

  return REMOVE_STRICT_ITEM_STATE__BLOCKED
}

export const createRemoveStrictReport = async ({
  cwd,
  includeOrphans = false,
  itemName,
  removeDependencies = false,
  registrySourcePath,
}: TCreateRemoveStrictReportOptions): Promise<TRemoveStrictReport> => {
  const dryRunReport = await createRemoveDryRunReport({
    cwd,
    includeOrphans,
    itemName,
    registrySourcePath,
  })
  const lockfilePlan = await readConsumerLockfileForStrictRemove(cwd)
  let dependencyCleanupExecution = createDependencyCleanupExecution({
    cwd,
    dryRunReport,
    removeDependencies,
  })
  const blockers = dedupeBlockers([
    ...lockfilePlan.findings,
    ...createDryRunBlockers(dryRunReport),
    ...createProjectStateBlockers(dryRunReport),
    ...createDependencyCleanupStrictBlockers({
      dependencyCleanupExecution,
      itemName,
    }),
    ...createLockfileBlockers({
      dryRunReport,
      lockfileData: lockfilePlan.lockfileData,
    }),
    ...createOrphanLockfileBlockers({
      dryRunReport,
      lockfileData: lockfilePlan.lockfileData,
    }),
    ...(await createFileBlockers({
      cwd,
      dryRunReport,
    })),
    ...(await createOrphanFileBlockers({
      cwd,
      dryRunReport,
    })),
  ])

  if (blockers.length > 0) {
    const files = resolveBlockedFiles(dryRunReport.files)
    const orphanCleanup = createStrictOrphanCleanup({
      dryRunReport,
      items: resolveBlockedOrphanItems(dryRunReport),
    })

    return removeStrictReportSchema.parse({
      applied: false,
      blockers,
      cwd,
      dependencyCleanup: dryRunReport.dependencyCleanup,
      dependencyCleanupExecution,
      dependencies: dryRunReport.dependencies,
      effects: createRemoveStrictEffects({
        applied: false,
        dependencyCleanupExecution,
        dryRunReport,
        files,
        orphanCleanup,
        removedDependencyCount: 0,
      }),
      files,
      findings: [...dryRunReport.findings, ...blockers],
      itemName,
      itemRemoveState: resolveItemRemoveState({
        applied: false,
        dryRunReport,
      }),
      lockfileData: lockfilePlan.lockfileData,
      orphanCleanup,
      registrySource: dryRunReport.registrySource,
      status: dryRunReport.status,
    })
  }

  if (
    dependencyCleanupExecution.mode === REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_MODE__ELIGIBLE &&
    dependencyCleanupExecution.recommendedCommands.length > 0
  ) {
    const executedDependencyCleanupCommands: TRemoveStrictDependencyCleanupCommand[] = []
    let failedDependencyCleanupCommands: TRemoveStrictDependencyCleanupCommandFailure[] = []

    for (const command of dependencyCleanupExecution.recommendedCommands) {
      const executionCommand = getDependencyCleanupExecutionCommand(command)
      const workingDirectory = path.resolve(cwd, executionCommand.workingDirectory ?? ".")
      const beforePackageManagerBoundary = await snapshotPackageManagerMutationBoundary({
        consumerRoot: cwd,
        targetManifestPath: executionCommand.targetManifestPath,
        workingDirectory,
      })

      try {
        await execa(executionCommand.packageManager, executionCommand.args, {
          cwd: workingDirectory,
        })
        executedDependencyCleanupCommands.push(executionCommand)
      } catch (error) {
        const afterPackageManagerBoundary = await snapshotPackageManagerMutationBoundary({
          consumerRoot: cwd,
          targetManifestPath: executionCommand.targetManifestPath,
          workingDirectory,
        })
        const mutatedPaths = getMutatedPackageManagerBoundaryPaths({
          afterSnapshot: afterPackageManagerBoundary,
          beforeSnapshot: beforePackageManagerBoundary,
        })
        const errorRecord = error && typeof error === "object" ? error : {}
        const message = error instanceof Error ? error.message : "Package-manager dependency cleanup failed."

        failedDependencyCleanupCommands = [
          removeStrictDependencyCleanupCommandFailureSchema.parse({
            args: executionCommand.args,
            command: executionCommand.command,
            exitCode:
              "exitCode" in errorRecord && typeof errorRecord.exitCode === "number" ? errorRecord.exitCode : undefined,
            message,
            mutatedPaths,
            packageManager: executionCommand.packageManager,
            packageManagerWrites: mutatedPaths.length > 0,
            signal: "signal" in errorRecord && typeof errorRecord.signal === "string" ? errorRecord.signal : undefined,
            stderr: "stderr" in errorRecord ? limitDependencyCommandOutput(errorRecord.stderr) : undefined,
            stdout: "stdout" in errorRecord ? limitDependencyCommandOutput(errorRecord.stdout) : undefined,
            workingDirectory: executionCommand.workingDirectory,
          }),
        ]
        break
      }
    }

    dependencyCleanupExecution = createDependencyCleanupExecution({
      cwd,
      dryRunReport,
      executedCommands: executedDependencyCleanupCommands,
      failedCommands: failedDependencyCleanupCommands,
      packageManagerExecution:
        failedDependencyCleanupCommands.length > 0
          ? DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTION__FAILED
          : DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTION__COMPLETED,
      packageManagerWrites:
        executedDependencyCleanupCommands.length > 0 ||
        failedDependencyCleanupCommands.some((command) => command.packageManagerWrites),
      removeDependencies,
    })

    if (failedDependencyCleanupCommands.length > 0) {
      const failedCommand = failedDependencyCleanupCommands[0]
      const dependencyCleanupFailureBlocker = createRemoveStrictBlocker({
        code: "strict-remove-dependency-cleanup-execution-failed",
        itemName,
        kind: REMOVE_STRICT_BLOCKER_KIND__PROJECT,
        message: `Package-manager dependency cleanup failed while running "${failedCommand.command}". No Amino source files or lockfile records were removed.`,
      })
      const files = resolveBlockedFiles(dryRunReport.files)
      const orphanCleanup = createStrictOrphanCleanup({
        dryRunReport,
        items: resolveBlockedOrphanItems(dryRunReport),
      })

      return removeStrictReportSchema.parse({
        applied: false,
        blockers: [dependencyCleanupFailureBlocker],
        cwd,
        dependencyCleanup: dryRunReport.dependencyCleanup,
        dependencyCleanupExecution,
        dependencies: dryRunReport.dependencies,
        effects: createRemoveStrictEffects({
          applied: false,
          dependencyCleanupExecution,
          dryRunReport,
          files,
          orphanCleanup,
          removedDependencyCount: 0,
        }),
        files,
        findings: [...dryRunReport.findings, dependencyCleanupFailureBlocker],
        itemName,
        itemRemoveState: resolveItemRemoveState({
          applied: false,
          dryRunReport,
        }),
        lockfileData: lockfilePlan.lockfileData,
        orphanCleanup,
        registrySource: dryRunReport.registrySource,
        status: dryRunReport.status,
      })
    }
  }

  const removedDependencies =
    removeDependencies && dependencyCleanupExecution.mode === REMOVE_STRICT_DEPENDENCY_CLEANUP_EXECUTION_MODE__ELIGIBLE
      ? getDependencyCleanupCandidates(dryRunReport)
      : []
  const result = await writeStrictRemove({
    cwd,
    dryRunReport,
    lockfileData: lockfilePlan.lockfileData,
    removedDependencies,
  })

  return removeStrictReportSchema.parse({
    applied: true,
    blockers: [],
    cwd,
    dependencyCleanup: dryRunReport.dependencyCleanup,
    dependencyCleanupExecution,
    dependencies: result.lockfileData.dependencies,
    effects: createRemoveStrictEffects({
      applied: true,
      dependencyCleanupExecution,
      dryRunReport,
      files: result.files,
      orphanCleanup: result.orphanCleanup,
      removedDependencyCount: removedDependencies.length,
    }),
    files: result.files,
    findings: dryRunReport.findings,
    itemName,
    itemRemoveState: resolveItemRemoveState({
      applied: true,
      dryRunReport,
    }),
    lockfileData: result.lockfileData,
    orphanCleanup: result.orphanCleanup,
    registrySource: dryRunReport.registrySource,
    status: dryRunReport.status,
  })
}
