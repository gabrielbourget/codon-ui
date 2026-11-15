import { existsSync, readFileSync } from "fs"
import path from "path"

import {
  CODON_UI_CONFIG_FILE_NAME,
  CODON_UI_LOCK_FILE_NAME,
  DEFAULT_REGISTRY_CONTAINED_REGISTRY_PATH,
  CONSUMER_PACKAGE_MANAGER__BUN,
  CONSUMER_PACKAGE_MANAGER__NPM,
  CONSUMER_PACKAGE_MANAGER__PNPM,
  CONSUMER_PACKAGE_MANAGER__UNKNOWN,
  CONSUMER_PACKAGE_MANAGER__YARN,
} from "./constants"
import { consumerProjectContextSchema, type TConsumerPackageManager, type TConsumerProjectContext } from "./schema"

type TPackageJson = {
  name?: string
  packageManager?: string
  dependencies?: Record<string, unknown>
  devDependencies?: Record<string, unknown>
}

const readPackageJson = (packageJsonPath: string): TPackageJson | undefined => {
  try {
    return JSON.parse(readFileSync(packageJsonPath, "utf8")) as TPackageJson
  } catch {
    return undefined
  }
}

const findUp = ({ cwd, fileNames }: { cwd: string; fileNames: readonly string[] }) => {
  let currentDirectory = cwd

  while (true) {
    const matchedFileName = fileNames.find((fileName) => existsSync(path.join(currentDirectory, fileName)))

    if (matchedFileName) return path.join(currentDirectory, matchedFileName)

    const parentDirectory = path.dirname(currentDirectory)
    if (parentDirectory === currentDirectory) return undefined

    currentDirectory = parentDirectory
  }
}

const readPackageManagerFromPackageJson = (packageManager?: string): TConsumerPackageManager | undefined => {
  if (!packageManager) return undefined

  if (packageManager.startsWith(`${CONSUMER_PACKAGE_MANAGER__BUN}@`)) return CONSUMER_PACKAGE_MANAGER__BUN
  if (packageManager.startsWith(`${CONSUMER_PACKAGE_MANAGER__NPM}@`)) return CONSUMER_PACKAGE_MANAGER__NPM
  if (packageManager.startsWith(`${CONSUMER_PACKAGE_MANAGER__PNPM}@`)) return CONSUMER_PACKAGE_MANAGER__PNPM
  if (packageManager.startsWith(`${CONSUMER_PACKAGE_MANAGER__YARN}@`)) return CONSUMER_PACKAGE_MANAGER__YARN

  return undefined
}

export const detectConsumerPackageManager = (cwd: string): TConsumerPackageManager => {
  const packageJsonPath = findUp({ cwd, fileNames: ["package.json"] })
  const packageJson = packageJsonPath ? readPackageJson(packageJsonPath) : undefined
  const packageManagerFromPackageJson = readPackageManagerFromPackageJson(packageJson?.packageManager)

  if (packageManagerFromPackageJson) return packageManagerFromPackageJson

  if (findUp({ cwd, fileNames: ["pnpm-lock.yaml", "pnpm-workspace.yaml"] })) return CONSUMER_PACKAGE_MANAGER__PNPM
  if (findUp({ cwd, fileNames: ["bun.lockb", "bun.lock"] })) return CONSUMER_PACKAGE_MANAGER__BUN
  if (findUp({ cwd, fileNames: ["yarn.lock"] })) return CONSUMER_PACKAGE_MANAGER__YARN
  if (findUp({ cwd, fileNames: ["package-lock.json", "npm-shrinkwrap.json"] })) return CONSUMER_PACKAGE_MANAGER__NPM

  return CONSUMER_PACKAGE_MANAGER__UNKNOWN
}

const hasProjectDependency = (packageJson: TPackageJson | undefined, name: string) =>
  [packageJson?.dependencies, packageJson?.devDependencies].some((dependencies) => {
    const version = dependencies?.[name]
    return typeof version === "string" && version.trim().length > 0
  })

const getProjectKind = (cwd: string, packageJson: TPackageJson | undefined) => {
  if (["next.config.js", "next.config.mjs", "next.config.ts"].some((fileName) => existsSync(path.join(cwd, fileName))))
    return "next"

  if (["vite.config.js", "vite.config.mjs", "vite.config.ts"].some((fileName) => existsSync(path.join(cwd, fileName))))
    return "vite"

  if (hasProjectDependency(packageJson, "expo")) return "expo"

  if (hasProjectDependency(packageJson, "react-native")) return "react-native"

  if (existsSync(path.join(cwd, "index.html"))) return "vite-like"

  return "unknown"
}

export const getConsumerProjectContext = (cwd: string): TConsumerProjectContext => {
  const packageJsonPath = path.join(cwd, "package.json")
  const packageJson = existsSync(packageJsonPath) ? readPackageJson(packageJsonPath) : undefined

  return consumerProjectContextSchema.parse({
    cwd,
    hasComponentsDirectory: existsSync(path.join(cwd, "src/components")),
    hasConfigFile: existsSync(path.join(cwd, CODON_UI_CONFIG_FILE_NAME)),
    hasLockfile: existsSync(path.join(cwd, CODON_UI_LOCK_FILE_NAME)),
    hasPackageJson: existsSync(packageJsonPath),
    hasRegistryDirectory: existsSync(path.join(cwd, DEFAULT_REGISTRY_CONTAINED_REGISTRY_PATH)),
    hasSrcDirectory: existsSync(path.join(cwd, "src")),
    hasTsConfig: existsSync(path.join(cwd, "tsconfig.json")),
    packageManager: detectConsumerPackageManager(cwd),
    packageName: packageJson?.name,
    projectKind: getProjectKind(cwd, packageJson),
  })
}
