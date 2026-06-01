import { existsSync, promises as fs } from "fs"
import path from "path"

import { rimraf } from "rimraf"

import { componentRegistry } from "./components"
import { componentRegistrySchema } from "./components/schema"
import type { TComponentRegistry } from "./components/schema"
import { helperRegistry } from "./helpers"
import type { THelperRegistry } from "./helpers/schema"
import { helperRegistrySchema } from "./helpers/schema"
import {
  HELPER_REGISTRY_ITEM_TYPE__CONSTANT,
  HELPER_REGISTRY_ITEM_TYPE__GLOBAL_CSS,
  HELPER_REGISTRY_ITEM_TYPE__TEXT_CSS,
  HELPER_REGISTRY_ITEM_TYPE__TYPE,
  HELPER_REGISTRY_ITEM_TYPE__UTIL,
} from "./helpers/schema"
import type {
  TAvailableHelperRegistryItemTypes,
  TComponentRegistryIndexItem,
  THelperRegistryIndexItem,
  TRegistryIndexItemDirectory,
  TRegistryIndexItemFile,
} from "./schema"

const REGISTRY_PATH = path.join(process.cwd(), "public/registry")

export const processComponentDirectoryIntoRegistry = async (
  directoryPath: string,
): Promise<TRegistryIndexItemDirectory> => {
  const files = await fs.readdir(directoryPath)
  const directoryContent: (TRegistryIndexItemFile | TRegistryIndexItemDirectory)[] = []

  files.forEach(async (file) => {
    const filePath = path.join(directoryPath, file)
    const fileInfo = await fs.stat(filePath)

    if (fileInfo.isDirectory()) {
      const subDirectory = await processComponentDirectoryIntoRegistry(filePath)
      directoryContent.push(subDirectory)
    } else {
      const content = await fs.readFile(filePath, "utf-8")
      const pathSegment = path.relative(directoryPath, filePath)
      directoryContent.push({ name: file, pathSegment, content })
    }
  })

  return { name: path.basename(directoryPath), content: directoryContent }
}

export const buildComponentRegistryIndexItems = async (registry: TComponentRegistry): Promise<void> => {
  const targetPath = path.join(REGISTRY_PATH, "components")
  if (!existsSync(targetPath)) await fs.mkdir(targetPath, { recursive: true })

  for (const entry of registry) {
    const indexItemInfo: TComponentRegistryIndexItem = {
      name: entry.name,
      isIcon: entry.isIcon,
      dependencies: entry.dependencies,
      devDependencies: entry.devDependencies,
      componentRegistryDependencies: entry.componentRegistryDependencies,
      helperRegistryDependencies: entry.helperRegistryDependencies,
      directory: entry.isIcon ? undefined : await processComponentDirectoryIntoRegistry(entry.directory!),
      file: entry.isIcon
        ? {
            name: entry.file!,
            pathSegment: "",
            content: await fs.readFile(entry.file!, "utf-8"),
          }
        : undefined,
    }

    await fs.writeFile(
      path.join(targetPath, entry.isIcon ? `${entry.file}.json` : `${entry.directory}.json`),
      JSON.stringify(indexItemInfo, null, 2),
      "utf-8",
    )
  }
}

export const buildComponentRegistry = async (registry: TComponentRegistry): Promise<void> => {
  rimraf.sync(path.join(REGISTRY_PATH, "components", "index.json"))

  await fs.writeFile(path.join(REGISTRY_PATH, "components", "index.json"), JSON.stringify(registry, null, 2), "utf-8")

  await buildComponentRegistryIndexItems(registry)
}

export const computeTargetHelperPath = (type: TAvailableHelperRegistryItemTypes): string => {
  switch (type) {
    case HELPER_REGISTRY_ITEM_TYPE__UTIL:
      return HELPER_REGISTRY_ITEM_TYPE__UTIL
    case HELPER_REGISTRY_ITEM_TYPE__TYPE:
      return HELPER_REGISTRY_ITEM_TYPE__TYPE
    case HELPER_REGISTRY_ITEM_TYPE__CONSTANT:
      return HELPER_REGISTRY_ITEM_TYPE__CONSTANT
    case HELPER_REGISTRY_ITEM_TYPE__GLOBAL_CSS:
    case HELPER_REGISTRY_ITEM_TYPE__TEXT_CSS:
      return ""
  }
}

export const buildHelperRegistryIndexItems = async (registry: THelperRegistry): Promise<void> => {
  const targetPath = path.join(REGISTRY_PATH, "helpers")
  if (!existsSync(targetPath)) await fs.mkdir(targetPath, { recursive: true })

  for (const entry of registry) {
    const indexItemInfo: THelperRegistryIndexItem = {
      name: entry.name,
      type: entry.type,
      file: {
        name: entry.file,
        content: await fs.readFile(path.join(targetPath, computeTargetHelperPath(entry.type), entry.file), "utf-8"),
      },
    }

    await fs.writeFile(
      path.join(targetPath, computeTargetHelperPath(entry.type), `${entry.fileName}.json`),
      JSON.stringify(indexItemInfo, null, 2),
      "utf-8",
    )
  }
}

export const buildHelperRegistry = async (registry: THelperRegistry): Promise<void> => {
  rimraf.sync(path.join(REGISTRY_PATH, "helpers", "index.json"))

  await fs.writeFile(path.join(REGISTRY_PATH, "helpers", "index.json"), JSON.stringify(registry, null, 2), "utf-8")

  await buildHelperRegistryIndexItems(registry)
}
;(async () => {
  try {
    const componentRegistryParse = componentRegistrySchema.safeParse(componentRegistry)

    if (!componentRegistryParse.success) {
      console.error(`Error parsing component registry -> ${componentRegistryParse.error}`)
      process.exit(1)
    }

    const helperRegistryParse = helperRegistrySchema.safeParse(helperRegistry)

    if (!helperRegistryParse.success) {
      console.error(`Error parsing helper registry -> ${helperRegistryParse.error}`)
      process.exit(1)
    }

    await buildComponentRegistry(componentRegistry)
    await buildHelperRegistry(helperRegistry)

    console.log("✅ Registry built successfully.")
  } catch (error) {
    console.error(`Error encountered while building the registry -> ${error}`)
  }
})()
