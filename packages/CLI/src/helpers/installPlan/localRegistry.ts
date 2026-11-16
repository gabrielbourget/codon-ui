import { existsSync, readFileSync } from "fs"
import { readFile } from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

import { consumerConfigSchema, consumerLockfileSchema } from "../consumerContract/schema"

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
  "indicator",
  "circle-loader",
  "lagging-lines-loader",
  "link",
  "breadcrumbs",
  "pagination",
  "input",
  "text-area",
  "number-input",
  "stepper",
  "time-picker",
  "date-time-picker",
  "date-time-range-picker",
  "toggle-button",
  "toggle-switcher",
  "table",
  "toaster",
  "radio",
  "radio-group",
  "text",
  "placeholder-text",
  "list-box-item",
  "select",
  "sort-and-filter-panel",
  "combo-box",
  "tag-combo-box",
  "typeahead-search",
  "compact-typeahead-search",
  "thumbnail-image",
  "thumbnail-showcase",
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
    path.resolve(moduleDirectory, "registry/local-react-support.registry.json"),
    path.resolve(moduleDirectory, "../registry/local-react-support.registry.json"),
    path.resolve(moduleDirectory, "../../../registry/local-react-support.registry.json"),
  ]

  return candidatePaths.find((candidatePath) => existsSync(candidatePath)) ?? candidatePaths[0]
}

export const getDefaultLocalReactRegistrySourcePath = () => {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
  const candidatePaths = [
    path.resolve(moduleDirectory, "registry/local-react.registry.json"),
    path.resolve(moduleDirectory, "../registry/local-react.registry.json"),
    path.resolve(moduleDirectory, "../../../registry/local-react.registry.json"),
  ]

  return candidatePaths.find((candidatePath) => existsSync(candidatePath)) ?? candidatePaths[0]
}

export const getDefaultLocalNativeRegistrySourcePath = () => {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
  const candidatePaths = [
    path.resolve(moduleDirectory, "registry/local-native.registry.json"),
    path.resolve(moduleDirectory, "../registry/local-native.registry.json"),
    path.resolve(moduleDirectory, "../../../registry/local-native.registry.json"),
  ]
  return candidatePaths.find((candidatePath) => existsSync(candidatePath)) ?? candidatePaths[0]
}

export const isNativeRegistryConsumer = (consumerRoot: string) => {
  try {
    const config = consumerConfigSchema.parse(
      JSON.parse(readFileSync(path.join(consumerRoot, "codon-ui.config.json"), "utf8")),
    )
    return config.registry.sourcePackage === "@codon-ui/react-native"
  } catch {
    return false
  }
}

export const getDefaultLocalRegistrySourcePath = getDefaultLocalSupportRegistrySourcePath

export const resolveDefaultAddRegistrySourcePath = ({
  consumerRoot,
  allComponents,
  requestedItems,
}: {
  consumerRoot?: string
  allComponents: boolean
  requestedItems: readonly string[]
}) => {
  if (consumerRoot && isNativeRegistryConsumer(consumerRoot)) return getDefaultLocalNativeRegistrySourcePath()

  if (!allComponents && isLocalReactRegistryComponentItemRequest(requestedItems)) {
    return getDefaultLocalReactRegistrySourcePath()
  }

  return getDefaultLocalSupportRegistrySourcePath()
}

export const readLocalRegistrySource = async (
  registrySourcePath = getDefaultLocalRegistrySourcePath(),
  options: { consumerRoot?: string; requestedItems?: readonly string[] } = {},
): Promise<TLocalRegistryReadResult> => {
  const resolvedRegistrySourcePath = path.resolve(registrySourcePath)

  if (!existsSync(resolvedRegistrySourcePath)) {
    throw new Error(`Local registry source not found at ${resolvedRegistrySourcePath}.`)
  }

  let registrySource = localRegistrySourceSchema.parse(JSON.parse(await readFile(resolvedRegistrySourcePath, "utf8")))
  registrySource = resolveNativeRegistryProfile(registrySource, options)
  const sourceRoot = path.resolve(path.dirname(resolvedRegistrySourcePath), registrySource.sourceRoot ?? ".")

  return {
    registrySource,
    registrySourcePath: resolvedRegistrySourcePath,
    sourceRoot,
  }
}

export const resolveNativeRegistryProfile = (
  registrySource: TLocalRegistrySource,
  options: { consumerRoot?: string; requestedItems?: readonly string[] } = {},
): TLocalRegistrySource => {
  if (registrySource.sourceIdentity !== "@codon-ui/react-native-local") return registrySource
  if (!registrySource.native) throw new Error("Native registry profile is missing; regenerate the native registry.")
  let selected: string[] = []
  let isModule = false
  if (options.consumerRoot) {
    const lockPath = path.join(options.consumerRoot, "codon-ui.lock.json")
    if (existsSync(lockPath))
      selected = Object.keys(consumerLockfileSchema.parse(JSON.parse(readFileSync(lockPath, "utf8"))).items)
    const packagePath = path.join(options.consumerRoot, "package.json")
    if (existsSync(packagePath)) isModule = JSON.parse(readFileSync(packagePath, "utf8"))?.type === "module"
  }
  const table = [...selected, ...(options.requestedItems ?? [])].some(
    (name) => name === "table" || name === "native-table",
  )
  const native = registrySource.native
  return {
    ...registrySource,
    items: registrySource.items.map((item) => {
      if (item.name === "native-composition")
        return {
          ...item,
          files: table ? native.composition.table : native.composition.core,
          registryDependencies: [...new Set([...item.registryDependencies, ...(table ? ["native-table"] : [])])],
        }
      if (item.name === "native-integration")
        return { ...item, files: [isModule ? native.rootConfig.module : native.rootConfig.commonjs] }
      return item
    }),
  }
}
