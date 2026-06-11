import { existsSync, promises as fs, readFileSync } from "fs"
import path from "path"

import { execa } from "execa"

import {
  CONSUMER_DEPENDENCY_POLICY__INSTALL,
  CONSUMER_DEPENDENCY_POLICY__REPORT_ONLY,
  CONSUMER_DEPENDENCY_POLICIES,
  type TConsumerDependencyPolicy,
} from "@/src/helpers/consumerContract"
import type { TRegistryInstallPlan } from "@/src/helpers/installPlan/schema"
import {
  PACKAGE_MANIFEST_DEPENDENCY_FIELD__DEPENDENCIES,
  PACKAGE_MANIFEST_DEPENDENCY_FIELD__DEV_DEPENDENCIES,
  PACKAGE_MANIFEST_INSTALL_TARGET_FIELDS,
  type TPackageManifestInstallTargetField,
} from "@/src/helpers/packageManifestConstants"

export const PACKAGE_MANAGER_NPM = "npm"
export const PACKAGE_MANAGER_PNPM = "pnpm"
export const PACKAGE_MANAGER_YARN = "yarn"
export const PACKAGE_MANAGER_BUN = "bun"
export const PACKAGE_MANAGER_UNKNOWN = "unknown"

export const DEPENDENCY_INSTALL_PACKAGE_MANAGERS = [
  PACKAGE_MANAGER_NPM,
  PACKAGE_MANAGER_PNPM,
  PACKAGE_MANAGER_YARN,
  PACKAGE_MANAGER_BUN,
] as const

export type TDependencyInstallPackageManager = (typeof DEPENDENCY_INSTALL_PACKAGE_MANAGERS)[number]

export const ADD_COMMAND__NPM = "i"
export const ADD_COMMAND__PNPM = "add"
export const ADD_COMMAND__YARN = "add"
export const ADD_COMMAND__BUN = "add"

export const REMOVE_COMMAND__NPM = "uninstall"
export const REMOVE_COMMAND__PNPM = "remove"
export const REMOVE_COMMAND__YARN = "remove"
export const REMOVE_COMMAND__BUN = "remove"

export const DEV_DEPENDENCY_FLAG__NPM = "-D"
export const DEV_DEPENDENCY_FLAG__PNPM = "-D"
export const DEV_DEPENDENCY_FLAG__YARN = "--dev"
export const DEV_DEPENDENCY_FLAG__BUN = "-d"

export const DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__PACKAGE_MANAGER_FIELD = "packageManager-field"
export const DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__LOCKFILE = "lockfile"
export const DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__CLI_OPTION = "cli-option"
export const DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__UNKNOWN = "unknown"

export const DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCES = [
  DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__CLI_OPTION,
  DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__PACKAGE_MANAGER_FIELD,
  DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__LOCKFILE,
  DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__UNKNOWN,
] as const

export type TDependencyInstallPackageManagerSource = (typeof DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCES)[number]

export const DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCE__PACKAGE_JSON_OPTION = "package-json-option"
export const DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCE__NEAREST_PACKAGE_JSON = "nearest-package-json"
export const DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCE__MISSING = "missing"

export const DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCES = [
  DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCE__PACKAGE_JSON_OPTION,
  DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCE__NEAREST_PACKAGE_JSON,
  DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCE__MISSING,
] as const

export type TDependencyInstallTargetManifestSource = (typeof DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCES)[number]

export const DEPENDENCY_INSTALL_POLICY_SOURCE__CLI_OPTION = "cli-option"
export const DEPENDENCY_INSTALL_POLICY_SOURCE__CONFIG = "config"
export const DEPENDENCY_INSTALL_POLICY_SOURCE__DEFAULT = "default"

export const DEPENDENCY_INSTALL_POLICY_SOURCES = [
  DEPENDENCY_INSTALL_POLICY_SOURCE__CLI_OPTION,
  DEPENDENCY_INSTALL_POLICY_SOURCE__CONFIG,
  DEPENDENCY_INSTALL_POLICY_SOURCE__DEFAULT,
] as const

export const DEPENDENCY_INSTALL_EXECUTION_MODE__NOT_REQUESTED = "not-requested"
export const DEPENDENCY_INSTALL_EXECUTION_MODE__NOT_NEEDED = "not-needed"
export const DEPENDENCY_INSTALL_EXECUTION_MODE__BLOCKED = "blocked"
export const DEPENDENCY_INSTALL_EXECUTION_MODE__ELIGIBLE = "eligible"

export const DEPENDENCY_INSTALL_EXECUTION_MODES = [
  DEPENDENCY_INSTALL_EXECUTION_MODE__NOT_REQUESTED,
  DEPENDENCY_INSTALL_EXECUTION_MODE__NOT_NEEDED,
  DEPENDENCY_INSTALL_EXECUTION_MODE__BLOCKED,
  DEPENDENCY_INSTALL_EXECUTION_MODE__ELIGIBLE,
] as const

export type TDependencyInstallExecutionMode = (typeof DEPENDENCY_INSTALL_EXECUTION_MODES)[number]

export const DEPENDENCY_INSTALL_APPROVAL_SOURCE__NONE = "none"
export const DEPENDENCY_INSTALL_APPROVAL_SOURCE__CLI_OPTION = "cli-option"

export const DEPENDENCY_INSTALL_APPROVAL_SOURCES = [
  DEPENDENCY_INSTALL_APPROVAL_SOURCE__NONE,
  DEPENDENCY_INSTALL_APPROVAL_SOURCE__CLI_OPTION,
] as const

export type TDependencyInstallApprovalSource = (typeof DEPENDENCY_INSTALL_APPROVAL_SOURCES)[number]

export const DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTION__NOT_RUN = "not-run"
export const DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTION__COMPLETED = "completed"
export const DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTION__FAILED = "failed"

export const DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTIONS = [
  DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTION__NOT_RUN,
  DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTION__COMPLETED,
  DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTION__FAILED,
] as const

export type TDependencyInstallPackageManagerExecution = (typeof DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTIONS)[number]

export const DEPENDENCY_INSTALL_STATUS__NOT_WRITTEN = "not-written"
export const DEPENDENCY_INSTALL_STATUS__WRITTEN = "written"
export const DEPENDENCY_INSTALL_STATUS__FAILED = "failed"

export const DEPENDENCY_INSTALL_STATUSES = [
  DEPENDENCY_INSTALL_STATUS__NOT_WRITTEN,
  DEPENDENCY_INSTALL_STATUS__WRITTEN,
  DEPENDENCY_INSTALL_STATUS__FAILED,
] as const

export type TDependencyInstallStatus = (typeof DEPENDENCY_INSTALL_STATUSES)[number]

export const DEPENDENCY_INSTALL_EXECUTION_BLOCKER__POLICY_NOT_INSTALL = "dependency-install-policy-not-install"
export const DEPENDENCY_INSTALL_EXECUTION_BLOCKER__PACKAGE_MANAGER_UNKNOWN =
  "dependency-install-package-manager-unknown"

export const DEPENDENCY_INSTALL_EXECUTION_BLOCKERS = [
  DEPENDENCY_INSTALL_EXECUTION_BLOCKER__POLICY_NOT_INSTALL,
  DEPENDENCY_INSTALL_EXECUTION_BLOCKER__PACKAGE_MANAGER_UNKNOWN,
] as const

export type TDependencyInstallExecutionBlockerCode = (typeof DEPENDENCY_INSTALL_EXECUTION_BLOCKERS)[number]

export const DEPENDENCY_INSTALL_WORKSPACE_SOURCE__PACKAGE_JSON_WORKSPACES = "package-json-workspaces"
export const DEPENDENCY_INSTALL_WORKSPACE_SOURCE__PNPM_WORKSPACE = "pnpm-workspace"

export const DEPENDENCY_INSTALL_WORKSPACE_SOURCES = [
  DEPENDENCY_INSTALL_WORKSPACE_SOURCE__PACKAGE_JSON_WORKSPACES,
  DEPENDENCY_INSTALL_WORKSPACE_SOURCE__PNPM_WORKSPACE,
] as const

export type TDependencyInstallWorkspaceSource = (typeof DEPENDENCY_INSTALL_WORKSPACE_SOURCES)[number]

export const DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGY__BUN_CWD_OPTION = "bun-cwd-option"
export const DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGY__NPM_WORKSPACE_OPTION = "npm-workspace-option"
export const DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGY__PNPM_FILTER_OPTION = "pnpm-filter-option"
export const DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGY__YARN_WORKSPACE_SUBCOMMAND = "yarn-workspace-subcommand"

export const DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGIES = [
  DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGY__BUN_CWD_OPTION,
  DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGY__NPM_WORKSPACE_OPTION,
  DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGY__PNPM_FILTER_OPTION,
  DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGY__YARN_WORKSPACE_SUBCOMMAND,
] as const

export type TDependencyInstallWorkspaceCommandStrategy =
  (typeof DEPENDENCY_INSTALL_WORKSPACE_COMMAND_STRATEGIES)[number]

type TPackageManagerDetection =
  | {
      name: TDependencyInstallPackageManager
      source:
        | typeof DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__CLI_OPTION
        | typeof DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__PACKAGE_MANAGER_FIELD
        | typeof DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__LOCKFILE
      lockfilePath?: string
      packageManagerOverride?: TDependencyInstallPackageManager
      packageManagerField?: string
      packageManifestPath?: string
    }
  | {
      name: typeof PACKAGE_MANAGER_UNKNOWN
      source: typeof DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__UNKNOWN
      packageManagerField?: string
      packageManifestPath?: string
    }

type TDependencyInstallTargetManifest = {
  directory?: string
  exists: boolean
  packageManagerField?: string
  packageName?: string
  path?: string
  source: TDependencyInstallTargetManifestSource
}

export type TResolvedDependencyInstallTarget = {
  absolutePath?: string
  directoryPath?: string
  manifest: TDependencyInstallTargetManifest
}

type TDependencyInstallRecommendation = {
  kind: TRegistryInstallPlan["dependencyPlan"][number]["kind"]
  name: string
  requiredRange: string
  specifier: string
  status: TRegistryInstallPlan["dependencyPlan"][number]["status"]
}

type TDependencyInstallWorkspaceContext = {
  detected: boolean
  packageJsonPath?: string
  pnpmWorkspacePath?: string
  rootPackageManagerField?: string
  rootPackageName?: string
  rootPath?: string
  sources: TDependencyInstallWorkspaceSource[]
  targetPackageName?: string
  targetPackagePath?: string
}

type TDependencyInstallWorkspaceCommand = {
  args: string[]
  command: string
  packageManager: TDependencyInstallPackageManager
  strategy: TDependencyInstallWorkspaceCommandStrategy
  targetPackageName: string
  targetPackagePath: string
  workingDirectory: string
  workspaceRootPath: string
}

type TDependencyInstallWorkspaceRootCandidate = {
  directoryPath: string
  markerPath: string
  packageJson?: TPackageJsonWithPackageManager
  source: TDependencyInstallWorkspaceSource
}

export type TDependencyInstallCommand = {
  args: string[]
  command: string
  dependencyTarget: TPackageManifestInstallTargetField
  dependencies: TDependencyInstallRecommendation[]
  packageManager: TDependencyInstallPackageManager
  targetManifestPath?: string
  workingDirectory?: string
  workspaceCommand?: TDependencyInstallWorkspaceCommand
}

export type TDependencyInstallCommandFailure = {
  args: string[]
  command: string
  exitCode?: number
  message: string
  mutatedPaths: string[]
  packageManager: TDependencyInstallPackageManager
  packageManagerWrites: boolean
  signal?: string
  stderr?: string
  stdout?: string
  workingDirectory?: string
}

type TDependencyInstallPlan = {
  commands: TDependencyInstallCommand[]
  dependencyPolicy: TDependencyInstallPolicyPlan
  executionPlan: TDependencyInstallExecutionPlan
  packageManager: TPackageManagerDetection
  recommendedCommands: TDependencyInstallCommand[]
  recommendations: TDependencyInstallRecommendation[]
  status: TDependencyInstallStatus
  targetManifest: TDependencyInstallTargetManifest
  workspace: TDependencyInstallWorkspaceContext
}

type TPackageJsonWithPackageManager = {
  name?: string
  packageManager?: string
  workspaces?: unknown
}

export type TDependencyInstallPolicySource = (typeof DEPENDENCY_INSTALL_POLICY_SOURCES)[number]

type TDependencyInstallPolicyPlan = {
  configPolicy?: TConsumerDependencyPolicy
  packageManagerExecution: TDependencyInstallPackageManagerExecution
  packageManagerWrites: boolean
  policy: TConsumerDependencyPolicy
  policyOverride?: TConsumerDependencyPolicy
  source: TDependencyInstallPolicySource
}

type TDependencyInstallExecutionBlocker = {
  code: TDependencyInstallExecutionBlockerCode
  message: string
}

type TDependencyInstallExecutionPlan = {
  approvalSource: TDependencyInstallApprovalSource
  blockers: TDependencyInstallExecutionBlocker[]
  executedCommands: TDependencyInstallCommand[]
  failedCommands: TDependencyInstallCommandFailure[]
  installRequested: boolean
  mode: TDependencyInstallExecutionMode
  nonInteractive: boolean
  packageManagerExecution: TDependencyInstallPackageManagerExecution
  packageManagerWrites: boolean
  requiresExplicitApproval: true
}

const packageManagerLockfiles: ReadonlyArray<{
  fileName: string
  packageManager: TDependencyInstallPackageManager
}> = [
  { fileName: "pnpm-lock.yaml", packageManager: PACKAGE_MANAGER_PNPM },
  { fileName: "pnpm-workspace.yaml", packageManager: PACKAGE_MANAGER_PNPM },
  { fileName: "package-lock.json", packageManager: PACKAGE_MANAGER_NPM },
  { fileName: "npm-shrinkwrap.json", packageManager: PACKAGE_MANAGER_NPM },
  { fileName: "yarn.lock", packageManager: PACKAGE_MANAGER_YARN },
  { fileName: "bun.lock", packageManager: PACKAGE_MANAGER_BUN },
  { fileName: "bun.lockb", packageManager: PACKAGE_MANAGER_BUN },
]

const isKnownDependencyInstallPackageManager = (
  packageManager: string,
): packageManager is TDependencyInstallPackageManager =>
  DEPENDENCY_INSTALL_PACKAGE_MANAGERS.some((knownPackageManager) => knownPackageManager === packageManager)

const readPackageManagerManifest = (packageJsonPath: string): TPackageJsonWithPackageManager | undefined => {
  try {
    return JSON.parse(readFileSync(packageJsonPath, "utf8")) as TPackageJsonWithPackageManager
  } catch {
    return undefined
  }
}

const getPackageJsonWorkspacePatterns = (workspaces: unknown) => {
  if (Array.isArray(workspaces))
    return workspaces.filter((workspace): workspace is string => typeof workspace === "string")

  if (workspaces && typeof workspaces === "object" && "packages" in workspaces) {
    const packages = workspaces.packages

    if (Array.isArray(packages))
      return packages.filter((workspace): workspace is string => typeof workspace === "string")
  }

  return []
}

const packageJsonDeclaresWorkspaces = (packageJson?: TPackageJsonWithPackageManager) =>
  getPackageJsonWorkspacePatterns(packageJson?.workspaces).length > 0

const getPackageManagerNameFromManifestField = (
  packageManagerField?: string,
): TDependencyInstallPackageManager | undefined => {
  if (!packageManagerField) return undefined

  const packageManagerName = packageManagerField.split("@")[0]

  if (isKnownDependencyInstallPackageManager(packageManagerName)) return packageManagerName

  return undefined
}

const formatReportedPath = ({ consumerRoot, targetPath }: { consumerRoot: string; targetPath: string }) => {
  const relativePath = path.relative(consumerRoot, targetPath).replace(/\\/gu, "/")

  if (!relativePath) return "."
  if (relativePath.startsWith("../") || path.isAbsolute(relativePath)) return targetPath

  return relativePath
}

const findUp = ({ fileNames, startDirectory }: { fileNames: readonly string[]; startDirectory: string }) => {
  let currentDirectory = startDirectory

  while (true) {
    const matchedFileName = fileNames.find((fileName) => existsSync(path.join(currentDirectory, fileName)))

    if (matchedFileName) return path.join(currentDirectory, matchedFileName)

    const parentDirectory = path.dirname(currentDirectory)
    if (parentDirectory === currentDirectory) return undefined

    currentDirectory = parentDirectory
  }
}

const findPackageJsonWorkspaceRoot = ({ startDirectory }: { startDirectory: string }) => {
  let currentDirectory = startDirectory

  while (true) {
    const packageJsonPath = path.join(currentDirectory, "package.json")
    const packageJson = existsSync(packageJsonPath) ? readPackageManagerManifest(packageJsonPath) : undefined

    if (packageJsonDeclaresWorkspaces(packageJson)) {
      return {
        directoryPath: currentDirectory,
        packageJson,
        packageJsonPath,
      }
    }

    const parentDirectory = path.dirname(currentDirectory)
    if (parentDirectory === currentDirectory) return undefined

    currentDirectory = parentDirectory
  }
}

const createTargetManifest = ({
  absolutePath,
  consumerRoot,
  source,
}: {
  absolutePath?: string
  consumerRoot: string
  source: TDependencyInstallTargetManifest["source"]
}): TResolvedDependencyInstallTarget => {
  const packageJson = absolutePath && existsSync(absolutePath) ? readPackageManagerManifest(absolutePath) : undefined
  const directoryPath = absolutePath ? path.dirname(absolutePath) : undefined

  return {
    absolutePath,
    directoryPath,
    manifest: {
      directory: directoryPath ? formatReportedPath({ consumerRoot, targetPath: directoryPath }) : undefined,
      exists: Boolean(absolutePath && existsSync(absolutePath)),
      packageManagerField: packageJson?.packageManager,
      packageName: packageJson?.name,
      path: absolutePath ? formatReportedPath({ consumerRoot, targetPath: absolutePath }) : undefined,
      source,
    },
  }
}

export const resolveDependencyInstallTarget = ({
  consumerRoot,
  packageJsonPath,
}: {
  consumerRoot: string
  packageJsonPath?: string
}): TResolvedDependencyInstallTarget => {
  if (packageJsonPath) {
    return createTargetManifest({
      absolutePath: path.resolve(consumerRoot, packageJsonPath),
      consumerRoot,
      source: DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCE__PACKAGE_JSON_OPTION,
    })
  }

  const nearestPackageJsonPath = findUp({
    fileNames: ["package.json"],
    startDirectory: consumerRoot,
  })

  if (nearestPackageJsonPath) {
    return createTargetManifest({
      absolutePath: nearestPackageJsonPath,
      consumerRoot,
      source: DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCE__NEAREST_PACKAGE_JSON,
    })
  }

  return createTargetManifest({
    consumerRoot,
    source: DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCE__MISSING,
  })
}

const detectDependencyInstallPackageManager = ({
  consumerRoot,
  packageManager,
  targetManifest,
  workspace,
}: {
  consumerRoot: string
  packageManager?: TDependencyInstallPackageManager
  targetManifest: TResolvedDependencyInstallTarget
  workspace: TDependencyInstallWorkspaceContext
}): TPackageManagerDetection => {
  if (packageManager) {
    return {
      name: packageManager,
      packageManagerField: targetManifest.manifest.packageManagerField,
      packageManagerOverride: packageManager,
      packageManifestPath: targetManifest.manifest.path,
      source: DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__CLI_OPTION,
    }
  }

  const packageManagerField = targetManifest.manifest.packageManagerField ?? workspace.rootPackageManagerField
  const packageManagerManifestPath = targetManifest.manifest.packageManagerField
    ? targetManifest.manifest.path
    : workspace.packageJsonPath
  const packageManagerFromManifest = getPackageManagerNameFromManifestField(packageManagerField)

  if (packageManagerFromManifest) {
    return {
      name: packageManagerFromManifest,
      packageManagerField,
      packageManifestPath: packageManagerManifestPath,
      source: DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__PACKAGE_MANAGER_FIELD,
    }
  }

  const lockfileSearchStartDirectory = targetManifest.directoryPath ?? consumerRoot
  const lockfilePath = findUp({
    fileNames: packageManagerLockfiles.map(({ fileName }) => fileName),
    startDirectory: lockfileSearchStartDirectory,
  })
  const lockfile = lockfilePath
    ? packageManagerLockfiles.find(({ fileName }) => path.basename(lockfilePath) === fileName)
    : undefined

  if (lockfile && lockfilePath) {
    return {
      lockfilePath: formatReportedPath({ consumerRoot, targetPath: lockfilePath }),
      name: lockfile.packageManager,
      packageManagerField,
      packageManifestPath: targetManifest.manifest.path,
      source: DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__LOCKFILE,
    }
  }

  return {
    name: PACKAGE_MANAGER_UNKNOWN,
    packageManagerField,
    packageManifestPath: targetManifest.manifest.path,
    source: DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__UNKNOWN,
  }
}

export const computePackageManagerAddCommand = (packageManager: string) => {
  switch (packageManager) {
    case PACKAGE_MANAGER_NPM:
      return ADD_COMMAND__NPM
    case PACKAGE_MANAGER_PNPM:
      return ADD_COMMAND__PNPM
    case PACKAGE_MANAGER_YARN:
      return ADD_COMMAND__YARN
    case PACKAGE_MANAGER_BUN:
      return ADD_COMMAND__BUN
    default:
      return ADD_COMMAND__NPM
  }
}

export const computePackageManagerRemoveCommand = (packageManager: string) => {
  switch (packageManager) {
    case PACKAGE_MANAGER_NPM:
      return REMOVE_COMMAND__NPM
    case PACKAGE_MANAGER_PNPM:
      return REMOVE_COMMAND__PNPM
    case PACKAGE_MANAGER_YARN:
      return REMOVE_COMMAND__YARN
    case PACKAGE_MANAGER_BUN:
      return REMOVE_COMMAND__BUN
    default:
      return REMOVE_COMMAND__NPM
  }
}

export const computePackageManagerDevDependencyFlag = (packageManager: string) => {
  switch (packageManager) {
    case PACKAGE_MANAGER_NPM:
      return DEV_DEPENDENCY_FLAG__NPM
    case PACKAGE_MANAGER_PNPM:
      return DEV_DEPENDENCY_FLAG__PNPM
    case PACKAGE_MANAGER_YARN:
      return DEV_DEPENDENCY_FLAG__YARN
    case PACKAGE_MANAGER_BUN:
      return DEV_DEPENDENCY_FLAG__BUN
    default:
      return DEV_DEPENDENCY_FLAG__NPM
  }
}

const createDependencySpecifier = ({ name, requiredRange }: { name: string; requiredRange: string }) =>
  requiredRange === "TO_DECIDE" ? name : `${name}@${requiredRange}`

const getDependencyTarget = ({ kind }: Pick<TDependencyInstallRecommendation, "kind">) =>
  kind === "dev" ? PACKAGE_MANIFEST_DEPENDENCY_FIELD__DEV_DEPENDENCIES : PACKAGE_MANIFEST_DEPENDENCY_FIELD__DEPENDENCIES

const isSameOrNestedPath = ({ childPath, parentPath }: { childPath: string; parentPath: string }) => {
  const relativePath = path.relative(parentPath, childPath)

  return !relativePath.startsWith("..") && !path.isAbsolute(relativePath)
}

const sortWorkspaceRootCandidates = (candidates: ReadonlyArray<TDependencyInstallWorkspaceRootCandidate>) =>
  [...candidates].sort((candidateA, candidateB) => candidateB.directoryPath.length - candidateA.directoryPath.length)

const resolveDependencyInstallWorkspaceContext = ({
  consumerRoot,
  targetManifest,
}: {
  consumerRoot: string
  targetManifest: TResolvedDependencyInstallTarget
}): TDependencyInstallWorkspaceContext => {
  const startDirectory = targetManifest.directoryPath ?? consumerRoot
  const packageJsonWorkspaceRoot = findPackageJsonWorkspaceRoot({ startDirectory })
  const pnpmWorkspacePath = findUp({
    fileNames: ["pnpm-workspace.yaml"],
    startDirectory,
  })
  const workspaceRootCandidates: TDependencyInstallWorkspaceRootCandidate[] = []

  if (packageJsonWorkspaceRoot) {
    workspaceRootCandidates.push({
      directoryPath: packageJsonWorkspaceRoot.directoryPath,
      markerPath: packageJsonWorkspaceRoot.packageJsonPath,
      packageJson: packageJsonWorkspaceRoot.packageJson,
      source: DEPENDENCY_INSTALL_WORKSPACE_SOURCE__PACKAGE_JSON_WORKSPACES,
    })
  }

  if (pnpmWorkspacePath) {
    workspaceRootCandidates.push({
      directoryPath: path.dirname(pnpmWorkspacePath),
      markerPath: pnpmWorkspacePath,
      source: DEPENDENCY_INSTALL_WORKSPACE_SOURCE__PNPM_WORKSPACE,
    })
  }

  const candidates = sortWorkspaceRootCandidates(workspaceRootCandidates)
  const rootCandidate = candidates[0]

  if (!rootCandidate) {
    return {
      detected: false,
      sources: [],
      targetPackageName: targetManifest.manifest.packageName,
    }
  }

  const rootPath = formatReportedPath({
    consumerRoot,
    targetPath: rootCandidate.directoryPath,
  })
  const targetPackagePath =
    targetManifest.directoryPath &&
    isSameOrNestedPath({ childPath: targetManifest.directoryPath, parentPath: rootCandidate.directoryPath })
      ? path.relative(rootCandidate.directoryPath, targetManifest.directoryPath).replace(/\\/gu, "/") || "."
      : undefined

  return {
    detected: true,
    packageJsonPath: packageJsonWorkspaceRoot?.packageJsonPath
      ? formatReportedPath({ consumerRoot, targetPath: packageJsonWorkspaceRoot.packageJsonPath })
      : undefined,
    pnpmWorkspacePath: pnpmWorkspacePath
      ? formatReportedPath({ consumerRoot, targetPath: pnpmWorkspacePath })
      : undefined,
    rootPackageManagerField: packageJsonWorkspaceRoot?.packageJson?.packageManager,
    rootPackageName: packageJsonWorkspaceRoot?.packageJson?.name,
    rootPath,
    sources: candidates
      .filter((candidate) => candidate.directoryPath === rootCandidate.directoryPath)
      .map((candidate) => candidate.source),
    targetPackageName: targetManifest.manifest.packageName,
    targetPackagePath,
  }
}

export const isKnownDependencyInstallPolicy = (policy: string): policy is TConsumerDependencyPolicy =>
  CONSUMER_DEPENDENCY_POLICIES.some((knownPolicy) => knownPolicy === policy)

export const createDependencyInstallPolicyPlan = ({
  configPolicy = CONSUMER_DEPENDENCY_POLICY__REPORT_ONLY,
  configSource = DEPENDENCY_INSTALL_POLICY_SOURCE__DEFAULT,
  packageManagerExecution = DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTION__NOT_RUN,
  packageManagerWrites = false,
  policyOverride,
}: {
  configPolicy?: TConsumerDependencyPolicy
  configSource?: typeof DEPENDENCY_INSTALL_POLICY_SOURCE__CONFIG | typeof DEPENDENCY_INSTALL_POLICY_SOURCE__DEFAULT
  packageManagerExecution?: TDependencyInstallPackageManagerExecution
  packageManagerWrites?: boolean
  policyOverride?: TConsumerDependencyPolicy
} = {}): TDependencyInstallPolicyPlan => ({
  configPolicy,
  packageManagerExecution,
  packageManagerWrites,
  policy: policyOverride ?? configPolicy,
  policyOverride,
  source: policyOverride ? DEPENDENCY_INSTALL_POLICY_SOURCE__CLI_OPTION : configSource,
})

const createDependencyInstallCommand = ({
  dependencies,
  dependencyTarget,
  packageManager,
  targetManifest,
  workspace,
}: {
  dependencies: TDependencyInstallRecommendation[]
  dependencyTarget: TPackageManifestInstallTargetField
  packageManager: TDependencyInstallPackageManager
  targetManifest: TDependencyInstallTargetManifest
  workspace: TDependencyInstallWorkspaceContext
}): TDependencyInstallCommand => {
  const addCommand = computePackageManagerAddCommand(packageManager)
  const dependencySpecifiers = dependencies.map((dependency) => dependency.specifier)
  const args =
    dependencyTarget === PACKAGE_MANIFEST_DEPENDENCY_FIELD__DEV_DEPENDENCIES
      ? [addCommand, computePackageManagerDevDependencyFlag(packageManager), ...dependencySpecifiers]
      : [addCommand, ...dependencySpecifiers]
  const workspaceCommand = createDependencyInstallWorkspaceCommand({
    addCommand,
    dependencySpecifiers,
    dependencyTarget,
    packageManager,
    workspace,
  })

  return {
    args,
    command: [packageManager, ...args].join(" "),
    dependencies,
    dependencyTarget,
    packageManager,
    targetManifestPath: targetManifest.path,
    workingDirectory: targetManifest.directory,
    workspaceCommand,
  }
}

const createDependencyInstallWorkspaceCommand = ({
  addCommand,
  dependencySpecifiers,
  dependencyTarget,
  packageManager,
  workspace,
}: {
  addCommand: string
  dependencySpecifiers: string[]
  dependencyTarget: TPackageManifestInstallTargetField
  packageManager: TDependencyInstallPackageManager
  workspace: TDependencyInstallWorkspaceContext
}): TDependencyInstallWorkspaceCommand | undefined => {
  const { rootPath, targetPackageName, targetPackagePath } = workspace

  if (!workspace.detected || !rootPath || !targetPackageName || !targetPackagePath || targetPackagePath === ".") {
    return undefined
  }

  const devDependencyFlag = computePackageManagerDevDependencyFlag(packageManager)
  const dependencyArgs =
    dependencyTarget === PACKAGE_MANIFEST_DEPENDENCY_FIELD__DEV_DEPENDENCIES
      ? [addCommand, devDependencyFlag, ...dependencySpecifiers]
      : [addCommand, ...dependencySpecifiers]
  const createCommand = ({
    args,
    strategy,
  }: {
    args: string[]
    strategy: TDependencyInstallWorkspaceCommandStrategy
  }): TDependencyInstallWorkspaceCommand => ({
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

const createDependencyInstallExecutionPlan = ({
  dependencyPolicy,
  commands,
  installRequested,
  nonInteractive,
  packageManager,
  recommendedCommands,
  executedCommands = [],
  failedCommands = [],
}: {
  dependencyPolicy: TDependencyInstallPolicyPlan
  commands: TDependencyInstallCommand[]
  installRequested: boolean
  nonInteractive: boolean
  packageManager: TPackageManagerDetection
  recommendedCommands: TDependencyInstallCommand[]
  executedCommands?: TDependencyInstallCommand[]
  failedCommands?: TDependencyInstallCommandFailure[]
}): TDependencyInstallExecutionPlan => {
  const approvalSource = installRequested
    ? DEPENDENCY_INSTALL_APPROVAL_SOURCE__CLI_OPTION
    : DEPENDENCY_INSTALL_APPROVAL_SOURCE__NONE

  if (!installRequested) {
    return {
      approvalSource,
      blockers: [],
      executedCommands,
      failedCommands,
      installRequested,
      mode: DEPENDENCY_INSTALL_EXECUTION_MODE__NOT_REQUESTED,
      nonInteractive,
      packageManagerExecution: dependencyPolicy.packageManagerExecution,
      packageManagerWrites: dependencyPolicy.packageManagerWrites,
      requiresExplicitApproval: true,
    }
  }

  if (commands.length === 0) {
    return {
      approvalSource,
      blockers: [],
      executedCommands,
      failedCommands,
      installRequested,
      mode: DEPENDENCY_INSTALL_EXECUTION_MODE__NOT_NEEDED,
      nonInteractive,
      packageManagerExecution: dependencyPolicy.packageManagerExecution,
      packageManagerWrites: dependencyPolicy.packageManagerWrites,
      requiresExplicitApproval: true,
    }
  }

  const blockers: TDependencyInstallExecutionBlocker[] = []

  if (dependencyPolicy.policy !== CONSUMER_DEPENDENCY_POLICY__INSTALL) {
    blockers.push({
      code: DEPENDENCY_INSTALL_EXECUTION_BLOCKER__POLICY_NOT_INSTALL,
      message: "Dependency installation was requested, but the effective dependency policy is not install.",
    })
  }

  if (packageManager.name === PACKAGE_MANAGER_UNKNOWN || recommendedCommands.length === 0) {
    blockers.push({
      code: DEPENDENCY_INSTALL_EXECUTION_BLOCKER__PACKAGE_MANAGER_UNKNOWN,
      message: "Dependency installation was requested, but no known package manager command can be recommended.",
    })
  }

  return {
    approvalSource,
    blockers,
    executedCommands,
    failedCommands,
    installRequested,
    mode:
      blockers.length === 0 ? DEPENDENCY_INSTALL_EXECUTION_MODE__ELIGIBLE : DEPENDENCY_INSTALL_EXECUTION_MODE__BLOCKED,
    nonInteractive,
    packageManagerExecution: dependencyPolicy.packageManagerExecution,
    packageManagerWrites: dependencyPolicy.packageManagerWrites,
    requiresExplicitApproval: true,
  }
}

export const createDependencyInstallPlan = ({
  consumerRoot,
  dependencyPlan,
  dependencyPolicy = createDependencyInstallPolicyPlan(),
  executedCommands = [],
  failedCommands = [],
  installDependencies = false,
  nonInteractive = false,
  packageJsonPath,
  packageManager,
  targetManifest = resolveDependencyInstallTarget({
    consumerRoot,
    packageJsonPath,
  }),
}: {
  consumerRoot: string
  dependencyPlan: TRegistryInstallPlan["dependencyPlan"]
  dependencyPolicy?: TDependencyInstallPolicyPlan
  executedCommands?: TDependencyInstallCommand[]
  failedCommands?: TDependencyInstallCommandFailure[]
  installDependencies?: boolean
  nonInteractive?: boolean
  packageJsonPath?: string
  packageManager?: TDependencyInstallPackageManager
  targetManifest?: TResolvedDependencyInstallTarget
}): TDependencyInstallPlan => {
  const recommendations = dependencyPlan
    .filter((dependency) => dependency.status !== "satisfied")
    .map((dependency) => ({
      kind: dependency.kind,
      name: dependency.name,
      requiredRange: dependency.requiredRange,
      specifier: createDependencySpecifier(dependency),
      status: dependency.status,
    }))
  const workspace = resolveDependencyInstallWorkspaceContext({
    consumerRoot,
    targetManifest,
  })
  const detectedPackageManager = detectDependencyInstallPackageManager({
    consumerRoot,
    packageManager,
    targetManifest,
    workspace,
  })
  const recommendationsByCommandKind = recommendations.reduce(
    (accumulator, recommendation) => {
      accumulator[getDependencyTarget(recommendation)].push(recommendation)

      return accumulator
    },
    {
      [PACKAGE_MANIFEST_DEPENDENCY_FIELD__DEPENDENCIES]: [] as TDependencyInstallRecommendation[],
      [PACKAGE_MANIFEST_DEPENDENCY_FIELD__DEV_DEPENDENCIES]: [] as TDependencyInstallRecommendation[],
    },
  )
  const commands = DEPENDENCY_INSTALL_PACKAGE_MANAGERS.flatMap((dependencyPackageManager) =>
    PACKAGE_MANIFEST_INSTALL_TARGET_FIELDS.flatMap((dependencyTarget) => {
      const dependencies = recommendationsByCommandKind[dependencyTarget]

      if (dependencies.length === 0) return []

      return [
        createDependencyInstallCommand({
          dependencies,
          dependencyTarget,
          packageManager: dependencyPackageManager,
          targetManifest: targetManifest.manifest,
          workspace,
        }),
      ]
    }),
  )
  const recommendedCommands =
    detectedPackageManager.name === PACKAGE_MANAGER_UNKNOWN
      ? []
      : commands.filter((command) => command.packageManager === detectedPackageManager.name)

  return {
    commands,
    dependencyPolicy,
    executionPlan: createDependencyInstallExecutionPlan({
      dependencyPolicy,
      commands,
      installRequested: installDependencies,
      nonInteractive,
      packageManager: detectedPackageManager,
      recommendedCommands,
      executedCommands,
      failedCommands,
    }),
    packageManager: detectedPackageManager,
    recommendedCommands,
    recommendations,
    status:
      failedCommands.length > 0 ||
      dependencyPolicy.packageManagerExecution === DEPENDENCY_INSTALL_PACKAGE_MANAGER_EXECUTION__FAILED
        ? DEPENDENCY_INSTALL_STATUS__FAILED
        : dependencyPolicy.packageManagerWrites
          ? DEPENDENCY_INSTALL_STATUS__WRITTEN
          : DEPENDENCY_INSTALL_STATUS__NOT_WRITTEN,
    targetManifest: targetManifest.manifest,
    workspace,
  }
}

export const PACKAGE_MANAGER_MUTATION_BOUNDARY_FILE_NAMES = [
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
] as const

const DEPENDENCY_COMMAND_OUTPUT_MAX_LENGTH = 4000

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
        PACKAGE_MANAGER_MUTATION_BOUNDARY_FILE_NAMES.map(async (fileName) => {
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
  if (value.length <= DEPENDENCY_COMMAND_OUTPUT_MAX_LENGTH) return value

  return value.slice(0, DEPENDENCY_COMMAND_OUTPUT_MAX_LENGTH)
}

const getDependencyExecutionCommand = (command: TDependencyInstallCommand): TDependencyInstallCommand => {
  if (!command.workspaceCommand) return command

  return {
    ...command,
    args: command.workspaceCommand.args,
    command: command.workspaceCommand.command,
    packageManager: command.workspaceCommand.packageManager,
    workingDirectory: command.workspaceCommand.workingDirectory,
  }
}

export const executeDependencyInstallCommands = async ({
  commands,
  consumerRoot,
}: {
  commands: readonly TDependencyInstallCommand[]
  consumerRoot: string
}): Promise<{
  executedCommands: TDependencyInstallCommand[]
  failedCommands: TDependencyInstallCommandFailure[]
}> => {
  const executedCommands: TDependencyInstallCommand[] = []
  let failedCommands: TDependencyInstallCommandFailure[] = []

  for (const command of commands) {
    const executionCommand = getDependencyExecutionCommand(command)
    const workingDirectory = path.resolve(consumerRoot, executionCommand.workingDirectory ?? ".")
    const beforePackageManagerBoundary = await snapshotPackageManagerMutationBoundary({
      consumerRoot,
      targetManifestPath: executionCommand.targetManifestPath,
      workingDirectory,
    })

    try {
      await execa(executionCommand.packageManager, executionCommand.args, {
        cwd: workingDirectory,
      })
      executedCommands.push(executionCommand)
    } catch (error) {
      const afterPackageManagerBoundary = await snapshotPackageManagerMutationBoundary({
        consumerRoot,
        targetManifestPath: executionCommand.targetManifestPath,
        workingDirectory,
      })
      const mutatedPaths = getMutatedPackageManagerBoundaryPaths({
        afterSnapshot: afterPackageManagerBoundary,
        beforeSnapshot: beforePackageManagerBoundary,
      })
      const errorRecord = error && typeof error === "object" ? error : {}
      const message = error instanceof Error ? error.message : "Package-manager dependency install failed."

      failedCommands = [
        {
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
        },
      ]
      break
    }
  }

  return {
    executedCommands,
    failedCommands,
  }
}
