import { existsSync, readFileSync } from "fs"
import path from "path"

import {
  CONSUMER_DEPENDENCY_POLICY__REPORT_ONLY,
  CONSUMER_DEPENDENCY_POLICIES,
  type TConsumerDependencyPolicy,
} from "@/src/helpers/consumerContract"
import type { TRegistryInstallPlan } from "@/src/helpers/installPlan/schema"

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

export const DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCE__PACKAGE_JSON_OPTION = "package-json-option"
export const DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCE__NEAREST_PACKAGE_JSON = "nearest-package-json"
export const DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCE__MISSING = "missing"

export const DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCES = [
  DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCE__PACKAGE_JSON_OPTION,
  DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCE__NEAREST_PACKAGE_JSON,
  DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCE__MISSING,
] as const

export const DEPENDENCY_INSTALL_POLICY_SOURCE__CLI_OPTION = "cli-option"
export const DEPENDENCY_INSTALL_POLICY_SOURCE__CONFIG = "config"
export const DEPENDENCY_INSTALL_POLICY_SOURCE__DEFAULT = "default"

export const DEPENDENCY_INSTALL_POLICY_SOURCES = [
  DEPENDENCY_INSTALL_POLICY_SOURCE__CLI_OPTION,
  DEPENDENCY_INSTALL_POLICY_SOURCE__CONFIG,
  DEPENDENCY_INSTALL_POLICY_SOURCE__DEFAULT,
] as const

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
  source: (typeof DEPENDENCY_INSTALL_TARGET_MANIFEST_SOURCES)[number]
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

type TDependencyInstallCommand = {
  args: string[]
  command: string
  dependencyTarget: "dependencies" | "devDependencies"
  dependencies: TDependencyInstallRecommendation[]
  packageManager: TDependencyInstallPackageManager
  targetManifestPath?: string
  workingDirectory?: string
}

type TDependencyInstallPlan = {
  commands: TDependencyInstallCommand[]
  dependencyPolicy: TDependencyInstallPolicyPlan
  packageManager: TPackageManagerDetection
  recommendedCommands: TDependencyInstallCommand[]
  recommendations: TDependencyInstallRecommendation[]
  status: "not-written"
  targetManifest: TDependencyInstallTargetManifest
}

type TPackageJsonWithPackageManager = {
  name?: string
  packageManager?: string
}

export type TDependencyInstallPolicySource = (typeof DEPENDENCY_INSTALL_POLICY_SOURCES)[number]

type TDependencyInstallPolicyPlan = {
  configPolicy?: TConsumerDependencyPolicy
  packageManagerExecution: "not-run"
  packageManagerWrites: false
  policy: TConsumerDependencyPolicy
  policyOverride?: TConsumerDependencyPolicy
  source: TDependencyInstallPolicySource
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
}: {
  consumerRoot: string
  packageManager?: TDependencyInstallPackageManager
  targetManifest: TResolvedDependencyInstallTarget
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

  const packageManagerFromManifest = getPackageManagerNameFromManifestField(targetManifest.manifest.packageManagerField)

  if (packageManagerFromManifest) {
    return {
      name: packageManagerFromManifest,
      packageManagerField: targetManifest.manifest.packageManagerField,
      packageManifestPath: targetManifest.manifest.path,
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
      packageManagerField: targetManifest.manifest.packageManagerField,
      packageManifestPath: targetManifest.manifest.path,
      source: DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__LOCKFILE,
    }
  }

  return {
    name: PACKAGE_MANAGER_UNKNOWN,
    packageManagerField: targetManifest.manifest.packageManagerField,
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
  kind === "dev" ? "devDependencies" : "dependencies"

export const isKnownDependencyInstallPolicy = (policy: string): policy is TConsumerDependencyPolicy =>
  CONSUMER_DEPENDENCY_POLICIES.some((knownPolicy) => knownPolicy === policy)

export const createDependencyInstallPolicyPlan = ({
  configPolicy = CONSUMER_DEPENDENCY_POLICY__REPORT_ONLY,
  configSource = DEPENDENCY_INSTALL_POLICY_SOURCE__DEFAULT,
  policyOverride,
}: {
  configPolicy?: TConsumerDependencyPolicy
  configSource?: typeof DEPENDENCY_INSTALL_POLICY_SOURCE__CONFIG | typeof DEPENDENCY_INSTALL_POLICY_SOURCE__DEFAULT
  policyOverride?: TConsumerDependencyPolicy
} = {}): TDependencyInstallPolicyPlan => ({
  configPolicy,
  packageManagerExecution: "not-run",
  packageManagerWrites: false,
  policy: policyOverride ?? configPolicy,
  policyOverride,
  source: policyOverride ? DEPENDENCY_INSTALL_POLICY_SOURCE__CLI_OPTION : configSource,
})

const createDependencyInstallCommand = ({
  dependencies,
  dependencyTarget,
  packageManager,
  targetManifest,
}: {
  dependencies: TDependencyInstallRecommendation[]
  dependencyTarget: "dependencies" | "devDependencies"
  packageManager: TDependencyInstallPackageManager
  targetManifest: TDependencyInstallTargetManifest
}): TDependencyInstallCommand => {
  const addCommand = computePackageManagerAddCommand(packageManager)
  const dependencySpecifiers = dependencies.map((dependency) => dependency.specifier)
  const args =
    dependencyTarget === "devDependencies"
      ? [addCommand, computePackageManagerDevDependencyFlag(packageManager), ...dependencySpecifiers]
      : [addCommand, ...dependencySpecifiers]

  return {
    args,
    command: [packageManager, ...args].join(" "),
    dependencies,
    dependencyTarget,
    packageManager,
    targetManifestPath: targetManifest.path,
    workingDirectory: targetManifest.directory,
  }
}

export const createDependencyInstallPlan = ({
  consumerRoot,
  dependencyPlan,
  dependencyPolicy = createDependencyInstallPolicyPlan(),
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
  const detectedPackageManager = detectDependencyInstallPackageManager({
    consumerRoot,
    packageManager,
    targetManifest,
  })
  const recommendationsByCommandKind = recommendations.reduce(
    (accumulator, recommendation) => {
      accumulator[getDependencyTarget(recommendation)].push(recommendation)

      return accumulator
    },
    {
      dependencies: [] as TDependencyInstallRecommendation[],
      devDependencies: [] as TDependencyInstallRecommendation[],
    },
  )
  const commands = DEPENDENCY_INSTALL_PACKAGE_MANAGERS.flatMap((dependencyPackageManager) =>
    (["dependencies", "devDependencies"] as const).flatMap((dependencyTarget) => {
      const dependencies = recommendationsByCommandKind[dependencyTarget]

      if (dependencies.length === 0) return []

      return [
        createDependencyInstallCommand({
          dependencies,
          dependencyTarget,
          packageManager: dependencyPackageManager,
          targetManifest: targetManifest.manifest,
        }),
      ]
    }),
  )

  return {
    commands,
    dependencyPolicy,
    packageManager: detectedPackageManager,
    recommendedCommands:
      detectedPackageManager.name === PACKAGE_MANAGER_UNKNOWN
        ? []
        : commands.filter((command) => command.packageManager === detectedPackageManager.name),
    recommendations,
    status: "not-written",
    targetManifest: targetManifest.manifest,
  }
}
