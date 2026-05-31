import { cosmiconfig } from "cosmiconfig"
import { loadConfig } from "tsconfig-paths"

import { type TConfig, coreConfigSchema, type TCoreConfig, configSchema } from "@/src/helpers/config/schema"
import { DEFAULT_COMPONENT_CONFIG_FILE } from "@/src/helpers/constants/cli"
import { resolveImport } from "@/src/helpers/resolveImport"

export const getConfig = async (cwd: string) => {
  const config = await getCoreConfig(cwd)

  if (!config) return null

  return await resolveConfigPaths(cwd, config)
}

export const resolveConfigPaths = async (cwd: string, config: TCoreConfig): Promise<TConfig> => {
  const tsConfig = loadConfig(cwd)

  if (tsConfig.resultType === "failed") {
    throw new Error(`Failed to load ${config.tsx ? "tsconfig" : "jsconfig"}.json. ${tsConfig.message ?? ""}`.trim())
  }

  return configSchema.parse({
    ...config,
    resolvedPaths: {
      components: await resolveImport(config.aliases["components"], tsConfig),
      icons: await resolveImport(`${config.aliases["components"]}/icons`, tsConfig),
      utils: await resolveImport(config.aliases["utils"], tsConfig),
      types: await resolveImport(config.aliases["types"], tsConfig),
      constants: await resolveImport(config.aliases["constants"], tsConfig),
      globalCSS: await resolveImport(config.aliases["globalCSS"], tsConfig),
      textCSS: await resolveImport(config.aliases["textCSS"], tsConfig),
    },
  })
}

export const getCoreConfig = async (cwd: string): Promise<TCoreConfig | undefined> => {
  try {
    // - TODO: -> Consider supporting user-customized config file name and type.
    const explorer = cosmiconfig("amino-ui", { searchPlaces: [DEFAULT_COMPONENT_CONFIG_FILE] })
    const configResult = await explorer.search(cwd)

    if (!configResult) return undefined

    return coreConfigSchema.parse(configResult.config)
  } catch (error) {
    console.log(`Error encountered while retrieving config -> ${error}`)
  }
}
