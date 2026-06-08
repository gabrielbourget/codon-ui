import { existsSync, readFileSync } from "fs"
import path from "path"

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
export const DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__UNKNOWN = "unknown"

export const DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCES = [
  DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__PACKAGE_MANAGER_FIELD,
  DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__LOCKFILE,
  DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__UNKNOWN,
] as const

type TPackageManagerDetection =
  | {
      name: TDependencyInstallPackageManager
      source:
        | typeof DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__PACKAGE_MANAGER_FIELD
        | typeof DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__LOCKFILE
      lockfilePath?: string
      packageManagerField?: string
      packageManifestPath?: string
    }
  | {
      name: typeof PACKAGE_MANAGER_UNKNOWN
      source: typeof DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__UNKNOWN
      packageManagerField?: string
      packageManifestPath?: string
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
}

type TDependencyInstallPlan = {
  commands: TDependencyInstallCommand[]
  packageManager: TPackageManagerDetection
  recommendedCommands: TDependencyInstallCommand[]
  recommendations: TDependencyInstallRecommendation[]
  status: "not-written"
}

type TPackageJsonWithPackageManager = {
  packageManager?: string
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

const detectDependencyInstallPackageManager = (cwd: string): TPackageManagerDetection => {
  const packageJsonPath = path.join(cwd, "package.json")
  const relativePackageJsonPath = "package.json"
  const packageJson = existsSync(packageJsonPath) ? readPackageManagerManifest(packageJsonPath) : undefined
  const packageManagerFromManifest = getPackageManagerNameFromManifestField(packageJson?.packageManager)

  if (packageManagerFromManifest) {
    return {
      name: packageManagerFromManifest,
      packageManagerField: packageJson?.packageManager,
      packageManifestPath: relativePackageJsonPath,
      source: DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__PACKAGE_MANAGER_FIELD,
    }
  }

  const lockfile = packageManagerLockfiles.find(({ fileName }) => existsSync(path.join(cwd, fileName)))

  if (lockfile) {
    return {
      lockfilePath: lockfile.fileName,
      name: lockfile.packageManager,
      packageManagerField: packageJson?.packageManager,
      packageManifestPath: existsSync(packageJsonPath) ? relativePackageJsonPath : undefined,
      source: DEPENDENCY_INSTALL_PACKAGE_MANAGER_SOURCE__LOCKFILE,
    }
  }

  return {
    name: PACKAGE_MANAGER_UNKNOWN,
    packageManagerField: packageJson?.packageManager,
    packageManifestPath: existsSync(packageJsonPath) ? relativePackageJsonPath : undefined,
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

const createDependencyInstallCommand = ({
  dependencies,
  dependencyTarget,
  packageManager,
}: {
  dependencies: TDependencyInstallRecommendation[]
  dependencyTarget: "dependencies" | "devDependencies"
  packageManager: TDependencyInstallPackageManager
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
  }
}

export const createDependencyInstallPlan = ({
  consumerRoot,
  dependencyPlan,
}: {
  consumerRoot: string
  dependencyPlan: TRegistryInstallPlan["dependencyPlan"]
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
  const packageManager = detectDependencyInstallPackageManager(consumerRoot)
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
        }),
      ]
    }),
  )

  return {
    commands,
    packageManager,
    recommendedCommands:
      packageManager.name === PACKAGE_MANAGER_UNKNOWN
        ? []
        : commands.filter((command) => command.packageManager === packageManager.name),
    recommendations,
    status: "not-written",
  }
}
