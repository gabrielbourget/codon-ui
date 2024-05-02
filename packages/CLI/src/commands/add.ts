import { existsSync, promises as fs } from "fs";
import ora from "ora";
import path from "path";
import { Command } from "commander";
import { z } from "zod";
import chalk from "chalk";
import prompts from "prompts";
import { execa } from "execa";
const { detect: detectPackageManager } = require("detect-package-manager");

import { logger, handleError } from "@/src/helpers";
import {
  fetchComponentTree, fetchHelperTree, getItemTargetPath, getRegistryIndex, resolveComponentTree, resolveHelperTree
} from "@/src/helpers/registry";
import {
  TComponentRegistryIndex, TComponentRegistryIndexItem, THelperRegistryIndex, THelperRegistryIndexItem,
  TRegistryIndexItemDirectory, TRegistryIndexItemFile, componentRegistryIndexItemSchema
} from "@/src/helpers/registry/schema";
import {
  computePackageManagerAddCommand, computePackageManagerDevDependencyFlag
} from "@/src/helpers/packageManagerHelpers";
import { getConfig } from "@/src/helpers/config";
import { AMINO_HELPER_FILE_MARKER_REGEX } from "../helpers/constants/cli";
import { transform } from "../helpers/transformers";
import { TConfig } from "../helpers/config/schema";

const addOptionsSchema = z.object({
  components: z.array(z.string()).optional(),
  skipConfirmationPrompt: z.boolean(),
  overwrite: z.boolean(),
  cwd: z.string(),
  allComponents: z.boolean(),
  path: z.string().optional()
});

const processComponentFilesFromRegistry = async (
  targetPath: string,
  item: TComponentRegistryIndexItem,
  config: TConfig
) => {
  item.directory!.content.forEach(async (directoryItem: TRegistryIndexItemFile | TRegistryIndexItemDirectory) => {
    let filePath = path.resolve(targetPath, item.directory!.name, directoryItem.name);
    
    if (directoryItem) {

    } else {

    }
    // - TODO: -> Run code transforms here.

    // await fs.writeFile(filePath, item.content);
  });
}

// - TODO: -> Logic to handle adding icons, placing them in their correct directory.
export const add = new Command()
  .name("add")
  .description("Add one or more components to your project.")
  .argument("[components...]", "The components you'd like to add.")
  .option("-y, --yes", "Skip the confirmation prompt.", true)
  .option("-o, --overwrite", "Overwrite existing files.", false)
  .option(
    "-c, --cwd <cwd>",
    "The chosen working directory. Defaults to the current directory.",
    process.cwd()
  )
  .option("-a, --all", "Add all available components to your project.", false)
  .option("-p, --path <path>", "A path to the directory where your chosen components should be added. Defaults to 'components'.", "components")
  .action(async (components, CLIOptions) => {
    try {
      const options = addOptionsSchema.parse({ components, ...CLIOptions });

      const cwd = path.resolve(options.cwd);

      if (!existsSync(cwd)) {
        logger.error(`The path ${cwd} could not be found. Please try again.`);
        process.exit(1);
      }

      const config = await getConfig(cwd);
      if (!config) {
        logger.warn(
          `No existing configuration found. Please run the ${chalk.green(`init`)} command to generate a components.json file.`
        );
        process.exit(1);
      }

      const componentRegistryIndex = await getRegistryIndex({ registryType: "components" }) as TComponentRegistryIndex;
      const helperRegistryIndex = await getRegistryIndex({ registryType: "helpers"}) as THelperRegistryIndex;

      let selectedComponents = (options.allComponents) ?
        componentRegistryIndex.map((entry: z.infer<typeof componentRegistryIndexItemSchema>) => entry.name) : options.components;

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
            selected: options.allComponents ? true : options.components?.includes(item.name)
          }))
        });

        selectedComponents = components;
      }

      if (!selectedComponents?.length) {
        logger.warn("No components were selected. Please try again.");
        process.exit(0);
      }

      const tree = await resolveComponentTree(componentRegistryIndex, selectedComponents);
      const resolvedPayload = await fetchComponentTree(tree);

      if (!resolvedPayload?.length) {
        logger.warn("The components you selected could not be found.");
        process.exit(0);
      }

      if (!options.skipConfirmationPrompt) {
        const { proceed } = await prompts({
          type: "confirm",
          name: "proceed",
          message: "Are you sure you would like to add the selected components?",
          initial: true
        });

        if (!proceed) process.exit(0);
      }

      const spinner = ora(`Installing selected components...`).start();

      resolvedPayload.forEach(async (item: TComponentRegistryIndexItem) => {
        spinner.text = `Installing ${item.name}...`;

        const targetPathType = (item.isIcon) ? "icons" : "components";
        const targetPath = await getItemTargetPath(
          config, targetPathType, options.path ? path.resolve(cwd, options.path) : undefined
        );

        if (!targetPath) return;
        if (!existsSync(targetPath)) await fs.mkdir(targetPath, { recursive: true });

        const componentExists = existsSync(path.resolve(targetPath, (item.isIcon) ? item.file!.name! : item.directory!.name));

        if (componentExists && !options.overwrite) {
          if (selectedComponents.includes(item.name)) {
            spinner.stop()
            const { overwrite } = await prompts({
              type: "confirm",
              name: "overwrite",
              message: `Component ${item.name} already exists. Would you like to overwrite its content?`,
              initial: false,
            });

            if (!overwrite) {
              logger.info(
                `Skipped ${item.name}. To overwrite its content, run the command with the ${chalk.green("--overwrite")} flag.`
              );

              return;
            }

            spinner.start(`Installing ${item.name}...`)
          }
          
          else return;

          spinner.stop();
          logger.warn(`The ${item.name} component already exists. Skipping...`);
          return;
        }

        if (!item.isIcon) await fs.mkdir(path.join(targetPath, item.directory!.name), { recursive: true });

        if (item.isIcon) {
          let filePath = path.resolve(targetPath, item.file!.name);

          const transformedFileContent = await transform({
            filename: item.file!.name,
            raw: item.file!.content as string,
            config
          });

          if (!config.tsx) filePath.replace(/\.tsx?/g, ".jsx");

          await fs.writeFile(filePath, transformedFileContent);
        }
        else {
          
        }

        // -> Helpers
        if (item.helperRegistryDependencies) {
          const tree = await resolveHelperTree(helperRegistryIndex, item.helperRegistryDependencies);
          const resolvedHelperPayload = await fetchHelperTree(tree);

          resolvedHelperPayload?.forEach(async (helper: THelperRegistryIndexItem) => {
            const targetPath = await getItemTargetPath(config, helper.type);

            if (!targetPath) return;
            if (!existsSync(targetPath)) await fs.mkdir(targetPath, { recursive: true });

            const helperFilePath = path.join(targetPath, helper.file.name);
            const fileExists = existsSync(path.join(targetPath, helperFilePath));

            if (fileExists) {
              const fileContents = await fs.readFile(helperFilePath, "utf-8");
              if (!AMINO_HELPER_FILE_MARKER_REGEX.test(fileContents)) {
                await fs.appendFile(helperFilePath, `\n ${helper.file.content}`)
              }
            }

            else await fs.writeFile(helperFilePath, helper.file.content);
          });
        }

        // -> Dependencies
        const packageManager = detectPackageManager();
        const packageManagerAddCommand = computePackageManagerAddCommand(packageManager);
        const packageManagerDevDependencyFlag = computePackageManagerDevDependencyFlag(packageManager);

        if (item.dependencies?.length) {
          await execa(
            packageManager,
            [
              packageManagerAddCommand,
              ...item.dependencies
            ],
            { cwd }
          );
        }

        if (item.devDependencies?.length) {
          await execa(
            packageManager,
            [
              packageManagerAddCommand,
              ...item.devDependencies,
              packageManagerDevDependencyFlag
            ],
            { cwd }
          );
        }
      });

      spinner.succeed("Selected components were installed successfully.");
    } catch (error) {
      handleError(error);
    }
  });
