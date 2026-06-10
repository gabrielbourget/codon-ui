import { existsSync } from "fs"
import path from "path"

import fg from "fast-glob"
import fs, { pathExists } from "fs-extra"
import { loadConfig } from "tsconfig-paths"

import { getConfig, resolveConfigPaths } from "@/src/helpers/config"
import {
  DEFAULT_COMPONENTS_PATH,
  DEFAULT_CONSTANTS_PATH,
  DEFAULT_GLOBAL_CSS_PATH,
  DEFAULT_TYPES_PATH,
  DEFAULT_TEXT_CSS_PATH,
  DEFAULT_UTILS_PATH,
} from "@/src/helpers/constants/cli"

import type { TCoreConfig, TConfig } from "./config/schema"

export const PROJECT_TYPE__NEXT_APP_SRC = "next-app-src"
export const PROJECT_TYPE__NEXT_APP = "next-app"
export const PROJECT_TYPE__NEXT_PAGES_SRC = "next-pages-src"
export const PROJECT_TYPE__NEXT_PAGES = "next-pages"

// - TODO: -> Expand beyond NextJS to support vanilla React, Remix, Vite, Gatsby, etc.
export const SUPPORTED_PROJECT_TYPES = [
  PROJECT_TYPE__NEXT_APP_SRC,
  PROJECT_TYPE__NEXT_APP,
  PROJECT_TYPE__NEXT_PAGES_SRC,
  PROJECT_TYPE__NEXT_PAGES,
] as const

export type TSupportedProjectTypes = (typeof SUPPORTED_PROJECT_TYPES)[number]

const SHARED_IGNORE = [
  "**/node_modules/**",
  ".next",
  "dist",
  "build",
  "public",
  "coverage",
  "tests",
  "test",
  "spec",
  "specs",
  "mocks",
  "mock",
  ".husky",
  "cypress",
  ".vscode",
  ".git",
  "ci",
]

export const getProjectInfo = async () => {
  const projectInfo = {
    tsconfig: null,
    srcDir: false,
    appDir: false,
    srcComponentsDir: false,
    componentsDir: false,
  }

  try {
    const tsconfig = await getTsConfig()

    return {
      tsconfig,
      srcDir: existsSync(path.resolve("./src")),
      appDir: existsSync(path.resolve("./app")) || existsSync(path.resolve("./src/app")),
      srcComponentsDir: existsSync(path.resolve("./src/components")),
      componentsDir: existsSync(path.resolve("./components")),
      srcComponentsIconDir: existsSync(path.resolve("./src/components/icons")),
      componentsIconDir: existsSync(path.resolve("./components/icons")),
    }
  } catch {
    return projectInfo
  }
}

export const getProjectConfig = async (cwd: string): Promise<TConfig | null> => {
  const existingConfig = await getConfig(cwd)

  if (existingConfig) return existingConfig

  const projectType = await getProjectType(cwd)
  const tsConfigAliasPrefix = await getTsConfigAliasPrefix(cwd)

  // - TODO: -> Check to see if this could block off looking for import aliases in a jsconfig.json file.
  // - TODO: -> Find alternative to needing user to have set up an alias prefix.
  if (!projectType || !tsConfigAliasPrefix) return null

  const isTypescriptProject = await isTypeScriptProject(cwd)

  const defaultCoreConfig: TCoreConfig = {
    rsc: [PROJECT_TYPE__NEXT_APP_SRC, PROJECT_TYPE__NEXT_APP].includes(projectType),
    tsx: isTypescriptProject,
    aliases: {
      components: `${tsConfigAliasPrefix}/${DEFAULT_COMPONENTS_PATH}`,
      utils: `${tsConfigAliasPrefix}/${DEFAULT_UTILS_PATH}`,
      types: `${tsConfigAliasPrefix}/${DEFAULT_TYPES_PATH}`,
      constants: `${tsConfigAliasPrefix}/${DEFAULT_CONSTANTS_PATH}`,
      globalCSS: `${tsConfigAliasPrefix}/${DEFAULT_GLOBAL_CSS_PATH}`,
      textCSS: `${tsConfigAliasPrefix}/${DEFAULT_TEXT_CSS_PATH}`,
    },
  }

  return resolveConfigPaths(cwd, defaultCoreConfig)
}

export const getTsConfig = async () => {
  try {
    const tsconfigPath = path.join("tsconfig.json")
    const tsconfig = await fs.readJSON(tsconfigPath)

    if (!tsconfig) throw new Error("tsconfig.json is missing from the chosen working directory.")

    return tsconfig
  } catch {
    return null
  }
}

export const getProjectType = async (cwd: string): Promise<TSupportedProjectTypes | null> => {
  const files = await fg.glob("**/*", { cwd, deep: 5, ignore: SHARED_IGNORE })

  const isNextProject = files.find((file) => file.startsWith("next.config."))

  // - TODO: -> Expand beyond NextJS to support vanilla React, Remix, etc.
  if (!isNextProject) return null

  const isUsingSrcDir = await fs.pathExists(path.resolve(cwd, "src"))
  const isUsingAppDir = await fs.pathExists(path.resolve(cwd, `${isUsingSrcDir ? "src/" : ""}app`))

  if (isUsingAppDir) return isUsingSrcDir ? PROJECT_TYPE__NEXT_APP_SRC : PROJECT_TYPE__NEXT_APP
  return isUsingSrcDir ? PROJECT_TYPE__NEXT_PAGES_SRC : PROJECT_TYPE__NEXT_PAGES
}

export const getTsConfigAliasPrefix = async (cwd: string) => {
  const tsConfig = loadConfig(cwd)
  const isUsingSrcDir = await fs.pathExists(path.resolve(cwd, "src"))

  if (tsConfig?.resultType === "failed" || !tsConfig?.paths) return null

  // -> This assumes that the first alias is the prefix.
  for (const [alias, paths] of Object.entries(tsConfig.paths)) {
    if (isUsingSrcDir) {
      if (paths.includes("./src/*")) return alias.at(0)
    } else if (paths.includes("./*")) return alias.at(0)
  }

  return null
}

export const isTypeScriptProject = async (cwd: string) => pathExists(path.resolve(cwd, "tsconfig.json"))
