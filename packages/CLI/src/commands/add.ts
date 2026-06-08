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
  addDryRunSchema,
  addAdvisorySchema,
  addStrictSchema,
  AMINO_UI_CONFIG_FILE_NAME,
  CONSUMER_DEPENDENCY_POLICIES,
  createAddAdvisoryEffects,
  createAddDryRunEffects,
  createAddStrictEffects,
  consumerConfigSchema,
  createStrictAddBlockerFindings,
  createStrictAddLockfileReusePlan,
  createRegistryInstallPlanWithFindings,
  createRegistryInstallPlan,
  handleError,
  INSTALL_PLAN_FINDING__CONSUMER_CONFIG_INVALID,
  INSTALL_PLAN_FINDING__CONSUMER_CONFIG_MISSING,
  INSTALL_PLAN_FINDING_SEVERITY__WARNING,
  INSTALL_PLAN_TARGET_RESOLUTION__REUSE_EXISTING,
  isLocalReactRegistryComponentItemRequest,
  logger,
  readLocalRegistrySource,
  readComponentPacketsForRegistrySource,
  readConsumerConfigForStrictAdd,
  readConsumerLockfileForStrictAdd,
  resolveDefaultAddRegistrySourcePath,
  writeStrictRegistryInstall,
  type TConsumerConfig,
  type TInstallPlanFinding,
} from "@/src/helpers"
import { getConfig } from "@/src/helpers/config"
import {
  computePackageManagerAddCommand,
  computePackageManagerDevDependencyFlag,
  createDependencyInstallPlan,
  createDependencyInstallPolicyPlan,
  DEPENDENCY_INSTALL_POLICY_SOURCE__CONFIG,
  DEPENDENCY_INSTALL_POLICY_SOURCE__DEFAULT,
  DEPENDENCY_INSTALL_PACKAGE_MANAGERS,
  resolveDependencyInstallTarget,
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
    dryRun: z.boolean().default(false),
    dependencyPolicy: z.enum(CONSUMER_DEPENDENCY_POLICIES).optional(),
    installDependencies: z.boolean().default(false),
    json: z.boolean().default(false),
    packageJson: z.string().optional(),
    packageManager: z.enum(DEPENDENCY_INSTALL_PACKAGE_MANAGERS).optional(),
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

const isStrictLocalRegistryComponentAddRequest = ({
  allComponents,
  components,
}: {
  allComponents: boolean
  components?: readonly string[]
}) => !allComponents && components?.length === 1 && isLocalReactRegistryComponentItemRequest(components)

type TConsumerConfigPlanSource =
  | typeof DEPENDENCY_INSTALL_POLICY_SOURCE__CONFIG
  | typeof DEPENDENCY_INSTALL_POLICY_SOURCE__DEFAULT

type TConsumerConfigPlan = {
  config: TConsumerConfig
  configSource: TConsumerConfigPlanSource
  findings: TInstallPlanFinding[]
}

const readConsumerConfigForDryRun = async (cwd: string): Promise<TConsumerConfigPlan> => {
  const configPath = path.join(cwd, AMINO_UI_CONFIG_FILE_NAME)
  const fallbackConfig = consumerConfigSchema.parse({})

  if (!existsSync(configPath)) {
    return {
      config: fallbackConfig,
      configSource: DEPENDENCY_INSTALL_POLICY_SOURCE__DEFAULT,
      findings: [
        {
          code: INSTALL_PLAN_FINDING__CONSUMER_CONFIG_MISSING,
          message: `${AMINO_UI_CONFIG_FILE_NAME} is missing. Dry-run is using the default registry-contained config; strict add will require init/config handling before writes.`,
          severity: INSTALL_PLAN_FINDING_SEVERITY__WARNING,
          targetPath: AMINO_UI_CONFIG_FILE_NAME,
        },
      ],
    }
  }

  try {
    return {
      config: consumerConfigSchema.parse(JSON.parse(await fs.readFile(configPath, "utf8"))),
      configSource: DEPENDENCY_INSTALL_POLICY_SOURCE__CONFIG,
      findings: [],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown config parse error."

    return {
      config: fallbackConfig,
      configSource: DEPENDENCY_INSTALL_POLICY_SOURCE__DEFAULT,
      findings: [
        {
          code: INSTALL_PLAN_FINDING__CONSUMER_CONFIG_INVALID,
          message: `${AMINO_UI_CONFIG_FILE_NAME} could not be read as a consumer config. Dry-run is using the default registry-contained config. ${message}`,
          severity: INSTALL_PLAN_FINDING_SEVERITY__WARNING,
          targetPath: AMINO_UI_CONFIG_FILE_NAME,
        },
      ],
    }
  }
}

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
  .option("--dry-run", "Preview the proposed add operation without writing files or installing dependencies.", false)
  .option(
    "--dependency-policy <policy>",
    "Override dependency install policy for planning. Supported values: report-only, manual, prompt, install.",
  )
  .option(
    "--install-dependencies",
    "Explicitly request dependency installation eligibility planning without running package-manager commands.",
    false,
  )
  .option("--json", "Print machine-readable output.", false)
  .option("--package-json <path>", "Read dependency declarations from a specific package.json for planning.")
  .option("--package-manager <packageManager>", "Override package-manager detection for dependency install planning.")
  .option("--registry-source <path>", "Path to a local registry source JSON file for planning.")
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

      if (options.advisory && options.dryRun) {
        logger.error("Please choose either --advisory or --dry-run, not both.")
        process.exit(1)
      }

      if (options.advisory || options.dryRun) {
        const explicitRequestedItems = options.components ?? []
        const registrySourcePathOption =
          options.registrySource ??
          resolveDefaultAddRegistrySourcePath({
            allComponents: options.allComponents,
            requestedItems: explicitRequestedItems,
          })
        const { registrySource, registrySourcePath, sourceRoot } =
          await readLocalRegistrySource(registrySourcePathOption)
        const requestedItems = options.allComponents
          ? registrySource.items.map((item) => item.name)
          : explicitRequestedItems
        const {
          componentPackets,
          findings: componentPacketFindings,
          registrySource: advisoryRegistrySource,
        } = await readComponentPacketsForRegistrySource({
          registrySource,
          requestedItems,
        })
        const configPlan: TConsumerConfigPlan = options.dryRun
          ? await readConsumerConfigForDryRun(cwd)
          : {
              config: consumerConfigSchema.parse({}),
              configSource: DEPENDENCY_INSTALL_POLICY_SOURCE__DEFAULT,
              findings: [],
            }
        const dependencyPolicy = createDependencyInstallPolicyPlan({
          configPolicy: configPlan.config.dependencies.policy,
          configSource: configPlan.configSource,
          policyOverride: options.dependencyPolicy,
        })
        const dependencyInstallTarget = resolveDependencyInstallTarget({
          consumerRoot: cwd,
          packageJsonPath: options.packageJson,
        })
        const installPlan = createRegistryInstallPlan({
          config: configPlan.config,
          consumerRoot: cwd,
          dependencyPackageJsonPath: dependencyInstallTarget.absolutePath,
          registrySource: advisoryRegistrySource,
          requestedItems,
          sourceRoot,
        })
        const findings = [...configPlan.findings, ...componentPacketFindings, ...installPlan.findings]
        const installPlanWithFindings = createRegistryInstallPlanWithFindings({
          findings,
          installPlan,
        })
        const dependencyInstallPlan = createDependencyInstallPlan({
          consumerRoot: cwd,
          dependencyPlan: installPlanWithFindings.dependencyPlan,
          dependencyPolicy,
          installDependencies: options.installDependencies,
          nonInteractive: options.json,
          packageManager: options.packageManager,
          targetManifest: dependencyInstallTarget,
        })

        if (options.dryRun) {
          const dryRun = addDryRunSchema.parse({
            componentPackets,
            cwd,
            dependencyInstallPlan,
            dryRun: true,
            effects: createAddDryRunEffects(installPlanWithFindings),
            findings,
            installPlan: installPlanWithFindings,
            registrySourcePath,
          })

          if (options.json) {
            console.log(JSON.stringify(dryRun, null, 2))
            return
          }

          logger.info(`${chalk.green("[ Dry Run Add ]")} No files were written.`)
          logger.info(`Registry source: ${dryRun.registrySourcePath}`)
          logger.info(`Requested items: ${dryRun.installPlan.requestedItems.join(", ") || "(none)"}`)
          logger.info(`Planned files: ${dryRun.effects.files.plannedCount}`)
          logger.info(`Would write files: ${dryRun.effects.files.wouldWriteCount}`)
          logger.info(`Reused existing support files: ${dryRun.effects.files.reusedExistingTargetCount}`)
          logger.info(`Existing target blockers: ${dryRun.effects.files.blockedExistingTargetCount}`)
          logger.info(`Missing sources: ${dryRun.effects.files.missingSourceCount}`)
          logger.info(`Dependency decisions: ${dryRun.effects.dependencies.requiresDecisionCount}`)
          logger.info(`Findings: ${dryRun.findings.length}`)

          return
        }

        const advisory = addAdvisorySchema.parse({
          advisory: true,
          componentPackets,
          cwd,
          dependencyInstallPlan,
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

      if (isStrictLocalRegistryComponentAddRequest(options)) {
        const explicitRequestedItems = options.components ?? []
        const registrySourcePathOption =
          options.registrySource ??
          resolveDefaultAddRegistrySourcePath({
            allComponents: options.allComponents,
            requestedItems: explicitRequestedItems,
          })
        const { registrySource, registrySourcePath, sourceRoot } =
          await readLocalRegistrySource(registrySourcePathOption)
        const {
          componentPackets,
          findings: componentPacketFindings,
          registrySource: advisoryRegistrySource,
        } = await readComponentPacketsForRegistrySource({
          registrySource,
          requestedItems: explicitRequestedItems,
        })
        const configPlan = await readConsumerConfigForStrictAdd(cwd)
        const lockfilePlan = await readConsumerLockfileForStrictAdd(cwd)
        const dependencyPolicy = createDependencyInstallPolicyPlan({
          configPolicy: configPlan.config.dependencies.policy,
          configSource: configPlan.configSource,
          policyOverride: options.dependencyPolicy,
        })
        const dependencyInstallTarget = resolveDependencyInstallTarget({
          consumerRoot: cwd,
          packageJsonPath: options.packageJson,
        })
        const installPlan = createRegistryInstallPlan({
          config: configPlan.config,
          consumerRoot: cwd,
          dependencyPackageJsonPath: dependencyInstallTarget.absolutePath,
          registrySource: advisoryRegistrySource,
          requestedItems: explicitRequestedItems,
          sourceRoot,
        })
        const planWithInitialFindings = createRegistryInstallPlanWithFindings({
          findings: [
            ...configPlan.findings,
            ...lockfilePlan.findings,
            ...componentPacketFindings,
            ...installPlan.findings,
          ],
          installPlan,
        })
        const reusableTargetPlan = createStrictAddLockfileReusePlan({
          installPlan: planWithInitialFindings,
          lockfileData: lockfilePlan.lockfileData,
        })
        const strictBlockerFindings = createStrictAddBlockerFindings(reusableTargetPlan)
        const findings = [...reusableTargetPlan.findings, ...strictBlockerFindings]
        const installPlanWithFindings = createRegistryInstallPlanWithFindings({
          findings,
          installPlan: reusableTargetPlan,
        })
        const dependencyInstallPlan = createDependencyInstallPlan({
          consumerRoot: cwd,
          dependencyPlan: installPlanWithFindings.dependencyPlan,
          dependencyPolicy,
          installDependencies: options.installDependencies,
          nonInteractive: options.json,
          packageManager: options.packageManager,
          targetManifest: dependencyInstallTarget,
        })

        if (strictBlockerFindings.length > 0) {
          const blockedResult = addStrictSchema.parse({
            applied: false,
            componentPackets,
            cwd,
            dependencyInstallPlan,
            effects: createAddStrictEffects({
              applied: false,
              installPlan: installPlanWithFindings,
            }),
            findings,
            installPlan: installPlanWithFindings,
            lockfileData: lockfilePlan.lockfileData,
            registrySourcePath,
          })

          if (options.json) {
            console.log(JSON.stringify(blockedResult, null, 2))
          } else {
            logger.error(`${chalk.red("[ Strict Add ]")} No files were written.`)
            logger.error(`Findings: ${blockedResult.findings.length}`)
            logger.error(`Dependency decisions: ${blockedResult.effects.dependencies.requiresDecisionCount}`)
            logger.error(`Reused existing support files: ${blockedResult.effects.files.reusedExistingTargetCount}`)
            logger.error(`Existing target blockers: ${blockedResult.effects.files.blockedExistingTargetCount}`)
            logger.error(`Missing sources: ${blockedResult.effects.files.missingSourceCount}`)
          }

          process.exitCode = 1
          return
        }

        const lockfileData = await writeStrictRegistryInstall({
          consumerRoot: cwd,
          installPlan: installPlanWithFindings,
          lockfileData: lockfilePlan.lockfileData,
          sourceRoot,
          themeTier: configPlan.config.theme.tier,
        })
        const writtenFileCount = installPlanWithFindings.files.filter(
          (file) => file.targetResolution !== INSTALL_PLAN_TARGET_RESOLUTION__REUSE_EXISTING,
        ).length
        const result = addStrictSchema.parse({
          applied: true,
          componentPackets,
          cwd,
          dependencyInstallPlan,
          effects: createAddStrictEffects({
            applied: true,
            installPlan: installPlanWithFindings,
            writtenFileCount,
          }),
          findings,
          installPlan: installPlanWithFindings,
          lockfileData,
          registrySourcePath,
        })

        if (options.json) {
          console.log(JSON.stringify(result, null, 2))
          return
        }

        logger.info(`${chalk.green("[ Strict Add ]")} ${explicitRequestedItems.join(", ")} installed.`)
        logger.info(`Registry source: ${result.registrySourcePath}`)
        logger.info(`Written files: ${result.effects.files.writtenCount}`)
        logger.info(`Reused existing support files: ${result.effects.files.reusedExistingTargetCount}`)
        logger.info(`Lockfile items: ${result.effects.lockfile.plannedItems.length}`)
        logger.info(`Findings: ${result.findings.length}`)

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
