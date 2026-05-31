import type { TConfig } from "@/src/helpers/config/schema"
import type {
  THelperRegistryIndex,
  THelperRegistryIndexItem,
  TAvailableRegistryItemTypes,
  TAvailableRegistryTypes,
} from "@/src/helpers/registry/schema"
import {
  type TComponentRegistryIndex,
  type TComponentRegistryIndexItem,
  componentRegistryIndexSchema,
  helperRegistryIndexSchema,
  REGISTRY_TYPE__COMPONENTS,
  REGISTRY_ITEM_TYPE__COMPONENT,
  REGISTRY_ITEM_TYPE__UTIL,
  REGISTRY_ITEM_TYPE__TYPE,
  REGISTRY_ITEM_TYPE__ICON,
  REGISTRY_TYPE__HELPERS,
  REGISTRY_ITEM_TYPE__GLOBAL_CSS,
  REGISTRY_ITEM_TYPE__TEXT_CSS,
  REGISTRY_ITEM_TYPE__CONSTANT,
} from "@/src/helpers/registry/schema"

const { COMPONENT_REGISTRY_URL } = process.env

const baseUrl = COMPONENT_REGISTRY_URL ?? "https://aminoui.com"

type TRegistryRequestOptions = {
  reportErrors?: boolean
  timeoutMs?: number
}

export const getRegistryIndex = async ({
  registryType,
  reportErrors = true,
  timeoutMs,
}: {
  registryType: TAvailableRegistryTypes
} & TRegistryRequestOptions): Promise<TComponentRegistryIndex | THelperRegistryIndex> => {
  let registryIndex: TComponentRegistryIndex | THelperRegistryIndex = []
  try {
    if (registryType === REGISTRY_TYPE__COMPONENTS) {
      const [result] = await fetchRegistry(["index.json"], {
        registryType: REGISTRY_TYPE__COMPONENTS,
        reportErrors,
        timeoutMs,
      })
      registryIndex = componentRegistryIndexSchema.parse(result)
    } else if (registryType === REGISTRY_TYPE__HELPERS) {
      const [result] = await fetchRegistry(["index.json"], {
        registryType: REGISTRY_TYPE__HELPERS,
        reportErrors,
        timeoutMs,
      })
      registryIndex = helperRegistryIndexSchema.parse(result)
    }

    return registryIndex
  } catch (error) {
    throw new Error(`Failed to fetch components from registry -> ${error}`)
  }
}

export const getItemTargetPath = async (
  config: TConfig,
  itemType: TAvailableRegistryItemTypes,
  pathOverride?: string,
) => {
  if (pathOverride) return pathOverride

  switch (itemType) {
    case REGISTRY_ITEM_TYPE__COMPONENT:
      return config.resolvedPaths[REGISTRY_ITEM_TYPE__COMPONENT]
    case REGISTRY_ITEM_TYPE__ICON:
      return config.resolvedPaths[REGISTRY_ITEM_TYPE__ICON]
    case REGISTRY_ITEM_TYPE__CONSTANT:
      return config.resolvedPaths[REGISTRY_ITEM_TYPE__CONSTANT]
    case REGISTRY_ITEM_TYPE__UTIL:
      return config.resolvedPaths[REGISTRY_ITEM_TYPE__UTIL]
    case REGISTRY_ITEM_TYPE__TYPE:
      return config.resolvedPaths[REGISTRY_ITEM_TYPE__TYPE]
    case REGISTRY_ITEM_TYPE__GLOBAL_CSS:
      return config.resolvedPaths[REGISTRY_ITEM_TYPE__GLOBAL_CSS]
    case REGISTRY_ITEM_TYPE__TEXT_CSS:
      return config.resolvedPaths[REGISTRY_ITEM_TYPE__TEXT_CSS]
  }
}

export const fetchRegistry = async (
  paths: string[],
  { registryType, reportErrors = true, timeoutMs }: { registryType: TAvailableRegistryTypes } & TRegistryRequestOptions,
) => {
  try {
    const results = await Promise.all(
      paths.map(async (path) => {
        if (registryType === REGISTRY_TYPE__COMPONENTS) {
          // - TODO: -> Figure out how shadcn uses agent here but it doesn't work for me.
          // const response = await fetch(`${baseUrl}/registry/${path}`, { agent });
          const response = await fetchRegistryJson(`${baseUrl}/registry/components/${path}`, timeoutMs)
          return await response.json()
        } else if (registryType === REGISTRY_TYPE__HELPERS) {
          const response = await fetchRegistryJson(`${baseUrl}/registry/helpers/${path}`, timeoutMs)
          return await response.json()
        }
      }),
    )

    return results
  } catch (error) {
    if (reportErrors) console.log(error)
    throw new Error(`Failed to fetch registry from ${baseUrl}.`)
  }
}

const fetchRegistryJson = async (url: string, timeoutMs?: number) => {
  if (!timeoutMs) return await fetch(url)

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), timeoutMs)

  try {
    return await fetch(url, { signal: abortController.signal })
  } finally {
    clearTimeout(timeout)
  }
}

export const resolveComponentTree = async (
  index: TComponentRegistryIndex,
  itemsToResolve: string[],
): Promise<TComponentRegistryIndex> => {
  const tree: TComponentRegistryIndex = []

  for (const item of itemsToResolve) {
    const entry = index.find((entry: TComponentRegistryIndexItem) => entry.name === item)

    if (!entry) continue

    tree.push(entry)

    if (entry.componentRegistryDependencies) {
      const dependencies = await resolveComponentTree(index, entry.componentRegistryDependencies)
      tree.push(...dependencies)
    }
  }

  // -> Filter out duplicates
  return tree.filter(
    (entry: TComponentRegistryIndexItem, index: number, self: TComponentRegistryIndex) =>
      self.findIndex((e: TComponentRegistryIndexItem) => e.name === entry.name) === index,
  )
}

export const resolveHelperTree = async (
  index: THelperRegistryIndex,
  itemsToResolve: string[],
): Promise<THelperRegistryIndex> => {
  const tree: THelperRegistryIndex = []

  for (const item of itemsToResolve) {
    const entry = index.find((entry: THelperRegistryIndexItem) => entry.name === item)

    if (!entry) continue
    tree.push(entry)
  }

  // -> Filter out duplicates
  return tree.filter(
    (entry: THelperRegistryIndexItem, index: number, self: THelperRegistryIndex) =>
      self.findIndex((e: THelperRegistryIndexItem) => e.name === entry.name) === index,
  )
}

export const fetchComponentTree = async (
  tree: TComponentRegistryIndex,
  { reportErrors = true, timeoutMs }: TRegistryRequestOptions = {},
) => {
  try {
    const paths = tree.map((entry: TComponentRegistryIndexItem) => `${entry.name}.json`)
    const result = await fetchRegistry(paths, { registryType: "components", reportErrors, timeoutMs })

    return componentRegistryIndexSchema.parse(result)
  } catch (error) {
    if (reportErrors) {
      console.error(`Error encountered while fetching import tree from the component registry -> ${error}`)
    }
  }
}

export const fetchHelperTree = async (
  tree: THelperRegistryIndex,
  { reportErrors = true, timeoutMs }: TRegistryRequestOptions = {},
): Promise<THelperRegistryIndex | undefined> => {
  try {
    const paths = tree.map((entry: THelperRegistryIndexItem) => `${entry.name}.json`)
    const result = await fetchRegistry(paths, { registryType: "helpers", reportErrors, timeoutMs })

    return helperRegistryIndexSchema.parse(result)
  } catch (error) {
    if (reportErrors)
      console.error(`Error encountered while fetching import tree from the helpers registry -> ${error}`)
  }
}
