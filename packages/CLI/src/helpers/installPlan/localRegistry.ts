import { existsSync } from "fs"
import { readFile } from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

import { localRegistrySourceSchema, type TLocalRegistrySource } from "./schema"

export type TLocalRegistryReadResult = {
  registrySource: TLocalRegistrySource
  registrySourcePath: string
  sourceRoot: string
}

const LOCAL_REACT_REGISTRY_COMPONENT_ITEM_NAMES = new Set([
  "avatar",
  "button",
  "card",
  "carousel",
  "switch",
  "checkbox",
  "checkbox-group",
  "click-popover",
  "tooltip",
  "hover-popover",
  "menu",
  "panel",
  "modal",
  "alert-dialog",
  "line-segment",
  "link",
  "breadcrumbs",
  "pagination",
  "input",
  "text-area",
  "number-input",
  "stepper",
  "time-picker",
  "date-time-picker",
  "toggle-button",
  "toggle-switcher",
  "table",
  "radio",
  "radio-group",
  "text",
  "placeholder-text",
  "list-box-item",
  "select",
  "combo-box",
  "tag-combo-box",
  "slider",
  "tag",
  "tag-group",
  "circular-progress",
  "counter",
  "form-field",
  "linear-progress",
  "meter",
])

export const isLocalReactRegistryComponentItemRequest = (requestedItems: readonly string[]) =>
  requestedItems.some((itemName) => LOCAL_REACT_REGISTRY_COMPONENT_ITEM_NAMES.has(itemName))

export const getDefaultLocalSupportRegistrySourcePath = () => {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
  const candidatePaths = [
    path.resolve(moduleDirectory, "../registry/local-react-support.registry.json"),
    path.resolve(moduleDirectory, "../../../registry/local-react-support.registry.json"),
  ]

  return candidatePaths.find((candidatePath) => existsSync(candidatePath)) ?? candidatePaths[0]
}

export const getDefaultLocalReactRegistrySourcePath = () => {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
  const candidatePaths = [
    path.resolve(moduleDirectory, "../registry/local-react.registry.json"),
    path.resolve(moduleDirectory, "../../../registry/local-react.registry.json"),
  ]

  return candidatePaths.find((candidatePath) => existsSync(candidatePath)) ?? candidatePaths[0]
}

export const getDefaultLocalRegistrySourcePath = getDefaultLocalSupportRegistrySourcePath

export const resolveDefaultAddRegistrySourcePath = ({
  allComponents,
  requestedItems,
}: {
  allComponents: boolean
  requestedItems: readonly string[]
}) => {
  if (!allComponents && isLocalReactRegistryComponentItemRequest(requestedItems)) {
    return getDefaultLocalReactRegistrySourcePath()
  }

  return getDefaultLocalSupportRegistrySourcePath()
}

export const readLocalRegistrySource = async (
  registrySourcePath = getDefaultLocalRegistrySourcePath(),
): Promise<TLocalRegistryReadResult> => {
  const resolvedRegistrySourcePath = path.resolve(registrySourcePath)

  if (!existsSync(resolvedRegistrySourcePath)) {
    throw new Error(`Local registry source not found at ${resolvedRegistrySourcePath}.`)
  }

  const registrySource = localRegistrySourceSchema.parse(JSON.parse(await readFile(resolvedRegistrySourcePath, "utf8")))
  const sourceRoot = path.resolve(path.dirname(resolvedRegistrySourcePath), registrySource.sourceRoot ?? ".")

  return {
    registrySource,
    registrySourcePath: resolvedRegistrySourcePath,
    sourceRoot,
  }
}
