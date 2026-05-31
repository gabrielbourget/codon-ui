import { existsSync, promises as fs } from "fs"
import path from "path"

import chalk from "chalk"
import { Command } from "commander"
import { diffLines, type Change } from "diff"
import { z } from "zod"

import { handleError, logger } from "@/src/helpers"
import { getConfig } from "@/src/helpers/config"
import type { TConfig } from "@/src/helpers/config/schema"
import { fetchComponentTree, getRegistryIndex } from "@/src/helpers/registry"
import type {
  TComponentRegistryIndex,
  TComponentRegistryIndexItem,
  TRegistryIndexItemDirectory,
  TRegistryIndexItemFile,
} from "@/src/helpers/registry/schema"

const updateOptionsSchema = z.object({
  component: z.string().optional(),
  skipConfirmationPrompt: z.boolean(),
  cwd: z.string(),
  path: z.string().optional(),
})

type RegistryFileDiff = {
  file: string
  filePath: string
  patch: Change[]
}

type RegistryFileWithPath = TRegistryIndexItemFile & {
  relativePath: string
}

const isRegistryDirectory = (
  item: TRegistryIndexItemDirectory | TRegistryIndexItemFile,
): item is TRegistryIndexItemDirectory => Array.isArray(item.content)

const collectRegistryFiles = (
  directory: TRegistryIndexItemDirectory,
  pathSegments: string[] = [],
): RegistryFileWithPath[] =>
  directory.content.flatMap((item) => {
    if (isRegistryDirectory(item)) return collectRegistryFiles(item, [...pathSegments, item.name])

    return [
      {
        ...item,
        relativePath: path.join(...pathSegments, item.name),
      },
    ]
  })

const getComponentInstallPath = (component: TComponentRegistryIndexItem, config: TConfig) => {
  const targetRoot = component.isIcon ? config.resolvedPaths.icons : config.resolvedPaths.components
  const targetEntry = component.isIcon
    ? (component.file?.name ?? component.name)
    : (component.directory?.name ?? component.name)

  return path.resolve(targetRoot, targetEntry)
}

const getComponentRegistryFiles = (component: TComponentRegistryIndexItem): RegistryFileWithPath[] => {
  if (component.isIcon) {
    return component.file
      ? [
          {
            ...component.file,
            relativePath: component.file.name,
          },
        ]
      : []
  }

  if (!component.directory) return []

  return collectRegistryFiles(component.directory, [component.directory.name])
}

export const diff = new Command()
  .name("diff")
  .description("Check for updates to components in the registry.")
  .argument("[component]", "The component you'd like to check for updates.")
  .option("-y, --yes", "Skip the confirmation prompt.", true)
  .option("-c, --cwd <cwd>", "The chosen working directory. Defaults to the current directory.", process.cwd())
  .action(async (name, CLIOptions) => {
    try {
      const options = updateOptionsSchema.parse({ component: name, ...CLIOptions })
      const cwd = path.resolve(options.cwd)

      if (!existsSync(cwd)) {
        logger.error(`The path ${cwd} could not be found. Please try again.`)
        process.exit(1)
      }

      const config = await getConfig(cwd)
      if (!config) {
        logger.warn(
          `No existing configuration found. Please run the ${chalk.green(`init`)} command to generate a components.json file.`,
        )
        process.exit(1)
      }

      const registryIndex = (await getRegistryIndex({ registryType: "components" })) as TComponentRegistryIndex

      // -> No component chosen for analysis.
      if (!options.component) {
        const componentsInProject = registryIndex.filter((item) => existsSync(getComponentInstallPath(item, config)))

        const componentsWithUpdates: { name: string; changes: RegistryFileDiff[] }[] = []
        for (const component of componentsInProject) {
          const changes = await diffComponent(component, config)
          if (changes.length) {
            componentsWithUpdates.push({
              name: component.name,
              changes,
            })
          }
        }

        if (!componentsWithUpdates.length) {
          logger.info("No changes required, your components are up to date.")
          process.exit(0)
        }

        logger.info("The following components have updates available:")
        for (const component of componentsWithUpdates) {
          logger.info(`- ${component.name}`)
          for (const change of component.changes) logger.info(`  - ${change.filePath}`)
        }

        logger.newLine()
        logger.info(`Run ${chalk.green("diff <component>")} to see the relevant changes.`)
        process.exit(0)
      }

      // -> Single component chosen for analysis.
      const component = registryIndex.find((item) => item.name === options.component)

      if (!component) {
        logger.error(`The component ${chalk.green(options.component)} does not exist in the registry.`)
        process.exit(1)
      }

      const changes = await diffComponent(component, config)

      if (!changes.length) {
        logger.info("No changes required, the chosen component is up to date.")
        process.exit(0)
      }

      for (const change of changes) {
        logger.info(`- ${change.filePath}`)
        printDiff(change.patch)
        logger.info("")
      }
    } catch (error) {
      handleError(error)
    }
  })

const diffComponent = async (component: TComponentRegistryIndexItem, config: TConfig): Promise<RegistryFileDiff[]> => {
  const payload = await fetchComponentTree([component])

  if (!payload) {
    console.error(`Error encountered while diffing component for changes.`)
    process.exit(1)
  }

  const changes: RegistryFileDiff[] = []

  for (const item of payload) {
    const targetRoot = item.isIcon ? config.resolvedPaths.icons : config.resolvedPaths.components

    for (const file of getComponentRegistryFiles(item)) {
      const filePath = path.resolve(targetRoot, file.relativePath)

      if (!existsSync(filePath)) continue

      const fileContent = await fs.readFile(filePath, "utf8")
      const patch = diffLines(file.content, fileContent)
      if (patch.length > 1) {
        changes.push({
          file: file.name,
          filePath,
          patch,
        })
      }
    }
  }

  return changes
}

const printDiff = (diff: Change[]) => {
  diff.forEach((diffSegment) => {
    if (diffSegment) {
      if (diffSegment.added) return process.stdout.write(chalk.green(diffSegment.value))
      if (diffSegment.removed) return process.stdout.write(chalk.red(diffSegment.value))
      return process.stdout.write(diffSegment.value)
    }
  })
}
