import { existsSync, promises as fs } from "fs"
import path from "path"

import chalk from "chalk"
import { Command } from "commander"
import { detect as detectPackageManager } from "detect-package-manager"
import { execa } from "execa"
import ora from "ora"
import prompts from "prompts"
import { z } from "zod"

import {
  addAdvisorySchema,
  createAddAdvisoryEffects,
  consumerConfigSchema,
  createRegistryInstallPlanWithFindings,
  createRegistryInstallPlan,
  createRegistrySourceWithDraftSwitchPacket,
  createUnresolvedDependencyFindings,
  getDefaultLocalRegistrySourcePath,
  handleError,
  logger,
  readLocalRegistrySource,
} from "@/src/helpers"
import { getConfig } from "@/src/helpers/config"
import {
  computePackageManagerAddCommand,
  computePackageManagerDevDependencyFlag,
} from "@/src/helpers/packageManagerHelpers"
import {
  fetchComponentTree,
  fetchHelperTree,
  getItemTargetPath,
  getRegistryIndex,
  resolveComponentTree,
  resolveHelperTree,
} from "@/src/helpers/registry"
import { registryIndexItemDirectorySchema } from "@/src/helpers/registry/schema"
import type {
  TComponentRegistryIndex,
  TComponentRegistryIndexItem,
  THelperRegistryIndex,
  TRegistryIndexItemDirectory,
  TRegistryIndexItemFile,
  componentRegistryIndexItemSchema,
} from "@/src/helpers/registry/schema"

import type { TConfig } from "../helpers/config/schema"
import { AMINO_HELPER_FILE_MARKER_REGEX, DEFAULT_COMPONENT_CONFIG_FILE } from "../helpers/constants/cli"
import { transform } from "../helpers/transformers"

const addOptionsSchema = z
  .object({
    components: z.array(z.string()).optional(),
    yes: z.boolean().default(true),
    overwrite: z.boolean().default(false),
    cwd: z.string().default(process.cwd()),
    all: z.boolean().default(false),
    path: z.string().optional(),
    advisory: z.boolean().default(false),
    json: z.boolean().default(false),
    registrySource: z.string().optional(),
  })
  .transform(({ all, components, yes, ...options }) => ({
    ...options,
    allComponents: all,
    components,
    skipConfirmationPrompt: yes,
  }))

const parseAddOptions = (components: string[] | undefined, CLIOptions: unknown) =>
  addOptionsSchema.parse({ components, ...(typeof CLIOptions === "object" && CLIOptions ? CLIOptions : {}) })

const resolveTargetFilePath = (filePath: string, config: TConfig) => {
  if (config.tsx) return filePath

  return filePath.replace(/\.tsx$/u, ".jsx").replace(/\.ts$/u, ".js")
}

const isRegistryDirectory = (
  item: TRegistryIndexItemFile | TRegistryIndexItemDirectory,
): item is TRegistryIndexItemDirectory => registryIndexItemDirectorySchema.safeParse(item).success

const processComponentFilesFromRegistry = async (
  targetPath: string,
  directory: TRegistryIndexItemDirectory,
  config: TConfig,
) => {
  const directoryPath = path.resolve(targetPath, directory.name)
  if (!existsSync(directoryPath)) await fs.mkdir(directoryPath, { recursive: true })

  for (const directoryItem of directory.content) {
    if (isRegistryDirectory(directoryItem)) {
      await processComponentFilesFromRegistry(directoryPath, directoryItem, config)
      continue
    }

    const filePath = resolveTargetFilePath(path.resolve(directoryPath, directoryItem.name), config)
    const fileNameComponents = directoryItem.name.split(".")
    const extension = fileNameComponents[fileNameComponents.length - 1]

    if (extension === "css") await fs.writeFile(filePath, directoryItem.content)
    else {
      const transformedFileContent = await transform({
        filename: directoryItem.name,
        raw: directoryItem.content,
        config,
      })

      await fs.writeFile(filePath, transformedFileContent)
    }
  }
}

export const add = new Command()
  .name("add")
  .description("Add one or more components to your project.")
  .argument("[components...]", "The components you'd like to add.")
  .option("-y, --yes", "Skip the confirmation prompt.", true)
  .option("-o, --overwrite", "Overwrite existing files.", false)
  .option("-c, --cwd <cwd>", "The chosen working directory. Defaults to the current directory.", process.cwd())
  .option("-a, --all", "Add all available components to your project.", false)
  .option("--advisory", "Report the proposed install plan without writing files or installing dependencies.", false)
  .option("--json", "Print machine-readable advisory output.", false)
  .option(
    "--registry-source <path>",
    "Path to a local registry source JSON file for advisory planning.",
    getDefaultLocalRegistrySourcePath(),
  )
  .option(
    "-p, --path <path>",
    "A path to the directory where your chosen components should be added. Defaults to 'components'.",
    "components",
  )
  .action(async (components, CLIOptions) => {
    try {
      const options = parseAddOptions(components, CLIOptions)
      const cwd = path.resolve(options.cwd)

      if (!existsSync(cwd)) {
        logger.error(`The path ${cwd} could not be found. Please try again.`)
        process.exit(1)
      }

      if (options.advisory) {
        const { registrySource, registrySourcePath, sourceRoot } = await readLocalRegistrySource(options.registrySource)
        const requestedItems = options.allComponents
          ? registrySource.items.map((item) => item.name)
          : (options.components ?? [])
        const {
          componentPackets,
          findings: componentPacketFindings,
          registrySource: advisoryRegistrySource,
        } = await createRegistrySourceWithDraftSwitchPacket({
          registrySource,
          requestedItems,
        })
        const installPlan = createRegistryInstallPlan({
          config: consumerConfigSchema.parse({}),
          consumerRoot: cwd,
          registrySource: advisoryRegistrySource,
          requestedItems,
          sourceRoot,
        })
        const findings = [
          ...componentPacketFindings,
          ...installPlan.findings,
          ...createUnresolvedDependencyFindings(installPlan.dependencies),
        ]
        const installPlanWithFindings = createRegistryInstallPlanWithFindings({
          findings,
          installPlan,
        })
        const advisory = addAdvisorySchema.parse({
          advisory: true,
          componentPackets,
          cwd,
          effects: createAddAdvisoryEffects(installPlanWithFindings),
          findings,
          installPlan: installPlanWithFindings,
          registrySourcePath,
        })

        if (options.json) {
          console.log(JSON.stringify(advisory, null, 2))
          return
        }

        logger.info(`${chalk.green("[ Advisory Add ]")} No files were written.`)
        logger.info(`Registry source: ${advisory.registrySourcePath}`)
        logger.info(`Requested items: ${advisory.installPlan.requestedItems.join(", ") || "(none)"}`)
        logger.info(`Planned files: ${advisory.installPlan.files.length}`)
        logger.info(`Component packets: ${advisory.componentPackets.length}`)
        logger.info(
          `Available sources: ${advisory.installPlan.files.filter((file) => file.sourceStatus === "available").length}`,
        )
        logger.info(
          `Existing targets: ${advisory.installPlan.files.filter((file) => file.targetStatus === "existing").length}`,
        )
        logger.info(`Findings: ${advisory.findings.length}`)

        return
      }

      const config = await getConfig(cwd)
      if (!config) {
        logger.warn(
          `No existing configuration found. Please run the ${chalk.green(`init`)} command to generate an ${DEFAULT_COMPONENT_CONFIG_FILE} configuration file.`,
        )
        process.exit(1)
      }

      const componentRegistryIndex = (await getRegistryIndex({ registryType: "components" })) as TComponentRegistryIndex
      const helperRegistryIndex = (await getRegistryIndex({ registryType: "helpers" })) as THelperRegistryIndex

      let selectedComponents = options.allComponents
        ? componentRegistryIndex.map((entry: z.infer<typeof componentRegistryIndexItemSchema>) => entry.name)
        : options.components

      if (!options.components?.length && !options.allComponents) {
        const { components } = await prompts({
          type: "multiselect",
          name: "components",
          message: "Which components would you like to add to your project?",
          hint: `Press ${chalk.green("<space>")} to select a component.
            Press ${chalk.green("<a>")} to toggle selection for all.
            Press ${chalk.green("<enter>")} when your selection is complete.
          `,
          instructions: false,
          choices: componentRegistryIndex.map((item: TComponentRegistryIndexItem) => ({
            title: item.name,
            value: item.name,
            selected: options.allComponents ? true : options.components?.includes(item.name),
          })),
        })

        selectedComponents = components
      }

      if (!selectedComponents?.length) {
        logger.warn("No components were selected. Please try again.")
        process.exit(0)
      }

      const tree = await resolveComponentTree(componentRegistryIndex, selectedComponents)
      const resolvedPayload = await fetchComponentTree(tree)

      if (!resolvedPayload?.length) {
        logger.warn("The components you selected could not be found.")
        process.exit(0)
      }

      if (!options.skipConfirmationPrompt) {
        const { proceed } = await prompts({
          type: "confirm",
          name: "proceed",
          message: "Are you sure you would like to add the selected components?",
          initial: true,
        })

        if (!proceed) process.exit(0)
      }

      const spinner = ora(`Installing selected components...`).start()

      for (const item of resolvedPayload) {
        spinner.text = `Installing ${item.name}...`

        const targetPathType = item.isIcon ? "icons" : "components"
        const targetPath = await getItemTargetPath(
          config,
          targetPathType,
          options.path ? path.resolve(cwd, options.path) : undefined,
        )

        if (!targetPath) return
        if (!existsSync(targetPath)) await fs.mkdir(targetPath, { recursive: true })

        const componentExists = existsSync(
          path.resolve(targetPath, item.isIcon ? item.file!.name! : item.directory!.name),
        )

        if (componentExists && !options.overwrite) {
          if (!selectedComponents.includes(item.name)) continue

          spinner.stop()
          const { overwrite } = await prompts({
            type: "confirm",
            name: "overwrite",
            message: `Component ${item.name} already exists. Would you like to overwrite its content?`,
            initial: false,
          })

          if (!overwrite) {
            logger.info(
              `Skipped ${item.name}. To overwrite its content, run the command with the ${chalk.green("--overwrite")} flag.`,
            )

            continue
          }

          spinner.start(`Installing ${item.name}...`)
        }

        if (!item.isIcon && !existsSync(path.join(targetPath, item.directory!.name)))
          await fs.mkdir(path.join(targetPath, item.directory!.name), { recursive: true })

        if (item.isIcon) {
          const filePath = path.resolve(targetPath, item.file!.name)

          const transformedFileContent = await transform({
            filename: item.file!.name,
            raw: item.file!.content as string,
            config,
          })

          await fs.writeFile(resolveTargetFilePath(filePath, config), transformedFileContent)
        } else await processComponentFilesFromRegistry(targetPath, item.directory!, config)

        // -> Helpers
        if (item.helperRegistryDependencies) {
          const tree = await resolveHelperTree(helperRegistryIndex, item.helperRegistryDependencies)
          const resolvedHelperPayload = await fetchHelperTree(tree)

          for (const helper of resolvedHelperPayload ?? []) {
            const targetPath = await getItemTargetPath(config, helper.type)

            if (!targetPath) continue
            if (!existsSync(targetPath)) await fs.mkdir(targetPath, { recursive: true })

            const helperFilePath = resolveTargetFilePath(path.join(targetPath, helper.file.name), config)
            const fileExists = existsSync(helperFilePath)

            if (fileExists) {
              const fileContents = await fs.readFile(helperFilePath, "utf-8")

              if (!AMINO_HELPER_FILE_MARKER_REGEX.test(fileContents)) {
                await fs.appendFile(helperFilePath, `\n ${helper.file.content}`)
              }
            } else {
              const transformedFileContent = await transform({
                filename: helper.file.name,
                raw: helper.file.content,
                config,
              })

              await fs.writeFile(helperFilePath, transformedFileContent)
            }
          }
        }

        // -> Dependencies
        const packageManager = await detectPackageManager()
        const packageManagerAddCommand = computePackageManagerAddCommand(packageManager)
        const packageManagerDevDependencyFlag = computePackageManagerDevDependencyFlag(packageManager)

        if (item.dependencies?.length) {
          await execa(packageManager, [packageManagerAddCommand, ...item.dependencies], { cwd })
        }

        if (item.devDependencies?.length) {
          await execa(
            packageManager,
            [packageManagerAddCommand, ...item.devDependencies, packageManagerDevDependencyFlag],
            { cwd },
          )
        }
      }

      spinner.succeed("Selected components were installed successfully.")
    } catch (error) {
      handleError(error)
    }
  })
