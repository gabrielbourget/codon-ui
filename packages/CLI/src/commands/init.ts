import { existsSync, promises as fs } from "fs"
import path from "path"

import chalk from "chalk"
import { Command } from "commander"
import { detect as detectPackageManager } from "detect-package-manager"
import { execa } from "execa"
import ora from "ora"
import prompts from "prompts"
import { z } from "zod"

import { createConsumerInitAdvisory } from "@/src/helpers"
import { getConfig, resolveConfigPaths } from "@/src/helpers/config"
import { coreConfigSchema, type TConfig } from "@/src/helpers/config/schema"
import {
  AMINO_HELPER_FILE_MARKER_REGEX,
  DEFAULT_COMPONENT_CONFIG_FILE,
  DEFAULT_COMPONENTS_PATH,
  DEFAULT_CONSTANTS_PATH,
  DEFAULT_GLOBAL_CSS_PATH,
  DEFAULT_TEXT_CSS_PATH,
  DEFAULT_TYPES_PATH,
  DEFAULT_UTILS_PATH,
} from "@/src/helpers/constants/cli"
import { getProjectConfig } from "@/src/helpers/getProjectInfo"
import { handleError } from "@/src/helpers/handleError"
import { logger } from "@/src/helpers/logger"
import { fetchHelperTree, getItemTargetPath, getRegistryIndex, resolveHelperTree } from "@/src/helpers/registry"
import type { THelperRegistryIndex } from "@/src/helpers/registry/schema"

import { computePackageManagerAddCommand } from "../helpers/packageManagerHelpers"

// - TODO: -> Figure out what's in this list.
const BASE_COMPONENT_LIBRARY_DEPENDENCIES = ["react", "react-dom", "classnames"]

const initOptionsSchema = z.object({
  cwd: z.string().default(process.cwd()),
  yes: z.boolean().default(true),
  defaults: z.boolean().default(false),
  advisory: z.boolean().default(false),
  json: z.boolean().default(false),
})

const parseInitOptions = (CLIOptions: unknown) => {
  const options = initOptionsSchema.parse(typeof CLIOptions === "object" && CLIOptions ? CLIOptions : {})

  return {
    cwd: options.cwd,
    advisory: options.advisory,
    defaults: options.defaults,
    json: options.json,
    skipConfirmationPrompt: options.yes,
  }
}

export const init = new Command()
  .name("init")
  .description("Initialize and configure your repository to use components from this library.")
  .option("-c, --cwd <cwd>", "The chosen working directory. Defaults to the current directory.", process.cwd())
  .option("-y, --yes", "Skip the confirmation prompt.", true)
  .option("-d, --defaults", "Use the default component library configuration.", false)
  .option("--advisory", "Report the proposed consumer setup without writing files or installing dependencies.", false)
  .option("--json", "Print machine-readable advisory output.", false)
  .action(async (CLIOptions) => {
    try {
      const options = parseInitOptions(CLIOptions)
      const cwd = path.resolve(options.cwd)

      if (!existsSync(cwd)) {
        logger.error(`The path ${cwd} could not be found. Please try again.`)
        process.exit(1)
      }

      if (options.advisory) {
        const advisory = createConsumerInitAdvisory(cwd)

        if (options.json) {
          console.log(JSON.stringify(advisory, null, 2))
          return
        }

        logger.info(`${chalk.green("[ Advisory Init ]")} No files were written.`)
        logger.info(`Package manager: ${advisory.packageManager}`)
        logger.info(`Config file: ${advisory.configFile}`)
        logger.info(`Lockfile: ${advisory.lockfile}`)
        logger.info(`Layout mode: ${advisory.proposedConfig.layoutMode}`)
        logger.info(`Theme tier: ${advisory.proposedConfig.theme.tier}`)
        logger.info(`Dependency policy: ${advisory.proposedConfig.dependencies.policy}`)

        return
      }

      const projectConfig = await getProjectConfig(cwd)

      if (projectConfig) {
        // - TODO: -> Consider edge case where there is an existing config but you'd like to modify it through the command line interface.
        logger.info(`${chalk.green("[ Existing Configuration Detected ]")} No further action required.`)
        return
      } else {
        const existingConfig = await getConfig(cwd)
        const config = await promptForConfig(cwd, existingConfig, options.skipConfirmationPrompt)
        await runInit(cwd, config)
      }

      logger.newLine()
      logger.info(`
        ${chalk.green("[ Success ]")} Project initialization successfully concluded.
        You may now proceed with adding components to your project.
      `)
      logger.newLine()
    } catch (error) {
      handleError(error)
    }
  })

export const promptForConfig = async (
  cwd: string,
  defaultConfig: TConfig | null = null,
  skip = false,
): Promise<TConfig> => {
  const highlight = (text: string) => chalk.green(text)

  const options = await prompts([
    {
      type: "toggle",
      name: "rsc",
      message: `Are you using ${highlight("React Server Components")}?`,
      initial: defaultConfig?.rsc ?? true,
      active: "yes",
      inactive: "no",
    },
    {
      type: "toggle",
      name: "tsx",
      message: `Would you like to use ${highlight("TypeScript")}? (recommended)`,
      initial: defaultConfig?.tsx ?? true,
      active: "yes",
      inactive: "no",
    },
    {
      type: "text",
      name: "componentsAlias",
      message: `Please configure your preferred import alias for ${highlight("components")}:`,
      initial: defaultConfig?.aliases.components ?? DEFAULT_COMPONENTS_PATH,
    },
    {
      type: "text",
      name: "utilsAlias",
      message: `Please configure your preferred import alias for ${highlight("utils")}:`,
      initial: defaultConfig?.aliases.utils ?? DEFAULT_UTILS_PATH,
    },
    {
      type: "text",
      name: "typesAlias",
      message: `Please configure your preferred import alias for ${highlight("types")}:`,
      initial: defaultConfig?.aliases.types ?? DEFAULT_TYPES_PATH,
    },
    {
      type: "text",
      name: "constantsAlias",
      message: `Please configure your preferred import alias for ${highlight("constants")}:`,
      initial: defaultConfig?.aliases.constants ?? DEFAULT_CONSTANTS_PATH,
    },
    {
      type: "text",
      name: "globalCSSAlias",
      message: `Where is your ${highlight("global CSS")} file?`,
      initial: defaultConfig?.aliases.globalCSS ?? DEFAULT_GLOBAL_CSS_PATH,
    },
    {
      type: "text",
      name: "textCSSAlias",
      message: `Where would you like to place the common ${highlight("text CSS")} file?`,
      initial: defaultConfig?.aliases.globalCSS ?? DEFAULT_TEXT_CSS_PATH,
    },
  ])

  const config = coreConfigSchema.parse({
    $schema: "https://aminoui.com/schema.json",
    rsc: options.rsc,
    tsx: options.tsx,
    aliases: {
      components: options.componentsAlias,
      utils: options.utilsAlias,
      types: options.typesAlias,
      constants: options.constantsAlias,
      globalCSS: options.globalCSSAlias,
      textCSS: options.textCSSAlias,
    },
  })

  if (!skip) {
    const { proceed } = await prompts({
      type: "confirm",
      name: "proceed",
      message: `Configuration will be written to ${highlight(DEFAULT_COMPONENT_CONFIG_FILE)}. Proceed?`,
      initial: true,
    })

    if (!proceed) process.exit(0)
  }

  logger.newLine()
  const spinner = ora(`Writing details to configuration file...`).start()
  // - TODO: -> Consider exposing the config file name and type to the CLI so the user can customize.
  const targetPath = path.resolve(cwd, DEFAULT_COMPONENT_CONFIG_FILE)
  await fs.writeFile(targetPath, JSON.stringify(config, null, 3), "utf8")
  spinner.succeed()

  return await resolveConfigPaths(cwd, config)
}

export const runInit = async (cwd: string, config: TConfig) => {
  const spinner = ora(`Initializing project...`).start()

  for (const resolvedPath of Object.values(config.resolvedPaths)) {
    const dirName = path.extname(resolvedPath) === "" ? resolvedPath : path.dirname(resolvedPath)
    if (!existsSync(dirName)) await fs.mkdir(dirName, { recursive: true })
  }

  // - TODO: -> Run imports code transform before writing files to calibrate imports to config file
  //   aliases in the CLI user's preferences.

  const helperRegistryIndex = (await getRegistryIndex({ registryType: "helpers" })) as THelperRegistryIndex
  const tree = await resolveHelperTree(helperRegistryIndex, ["utils/serverSideStyles"])
  const resolvedHelperPayload = await fetchHelperTree(tree)

  const targetPath = await getItemTargetPath(config, "utils")

  if (!targetPath) return
  if (!existsSync(targetPath)) await fs.mkdir(targetPath, { recursive: true })

  const helperFilePath = path.join(targetPath, resolvedHelperPayload![0].file.name)
  const fileExists = existsSync(path.join(targetPath, helperFilePath))

  if (fileExists) {
    const fileContents = await fs.readFile(helperFilePath, "utf-8")
    if (!AMINO_HELPER_FILE_MARKER_REGEX.test(fileContents)) {
      await fs.appendFile(helperFilePath, `\n ${resolvedHelperPayload![0].file.content}`)
    }
  } else await fs.writeFile(helperFilePath, resolvedHelperPayload![0].file.content)

  spinner?.succeed()

  // -> Install base component library dependencies
  const packageManager = await detectPackageManager()
  const packageManagerAddCommand = computePackageManagerAddCommand(packageManager)

  await execa(packageManager, [packageManagerAddCommand, ...BASE_COMPONENT_LIBRARY_DEPENDENCIES], { cwd })
}
