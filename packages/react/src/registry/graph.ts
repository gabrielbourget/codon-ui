import type { TRegistryManifest, TRegistryManifestFile, TRegistryManifestItem } from "./types"

export const REGISTRY_GRAPH_ISSUE__DUPLICATE_ITEM = "duplicate-item"
export const REGISTRY_GRAPH_ISSUE__MISSING_ITEM = "missing-item"
export const REGISTRY_GRAPH_ISSUE__MISSING_DEPENDENCY = "missing-registry-dependency"
export const REGISTRY_GRAPH_ISSUE__CIRCULAR_DEPENDENCY = "circular-registry-dependency"
export const REGISTRY_GRAPH_ISSUE__DUPLICATE_FILE_TARGET = "duplicate-file-target"

export const REGISTRY_GRAPH_ISSUES = [
  REGISTRY_GRAPH_ISSUE__DUPLICATE_ITEM,
  REGISTRY_GRAPH_ISSUE__MISSING_ITEM,
  REGISTRY_GRAPH_ISSUE__MISSING_DEPENDENCY,
  REGISTRY_GRAPH_ISSUE__CIRCULAR_DEPENDENCY,
  REGISTRY_GRAPH_ISSUE__DUPLICATE_FILE_TARGET,
] as const

export type TRegistryGraphIssueCode = (typeof REGISTRY_GRAPH_ISSUES)[number]

export type TRegistryGraphIssue = {
  code: TRegistryGraphIssueCode
  message: string
  itemName?: string
  dependencyName?: string
  targetRole?: TRegistryManifestFile["targetRole"]
  targetPath?: string
  registryDependencyPath?: readonly string[]
}

export type TResolvedRegistryGraphItem = {
  item: TRegistryManifestItem
  depth: number
}

export type TRegistryGraphResolution = {
  items: readonly TResolvedRegistryGraphItem[]
  issues: readonly TRegistryGraphIssue[]
}

export const createRegistryFileTargetKey = (file: Pick<TRegistryManifestFile, "targetPath" | "targetRole">) =>
  `${file.targetRole}:${file.targetPath}`

export const resolveRegistryInstallGraph = (
  manifest: TRegistryManifest,
  itemNames: readonly string[] = manifest.map((item) => item.name),
): TRegistryGraphResolution => {
  const issues: TRegistryGraphIssue[] = []
  const itemsByName = new Map<string, TRegistryManifestItem>()

  manifest.forEach((item) => {
    if (itemsByName.has(item.name)) {
      issues.push({
        code: REGISTRY_GRAPH_ISSUE__DUPLICATE_ITEM,
        itemName: item.name,
        message: `Registry item "${item.name}" is defined more than once.`,
      })
      return
    }

    itemsByName.set(item.name, item)
  })

  const resolvedItems: TResolvedRegistryGraphItem[] = []
  const visitedItemNames = new Set<string>()
  const visitingItemNames = new Set<string>()
  const registryDependencyPath: string[] = []

  const visitItem = (itemName: string, depth: number, parentName?: string) => {
    if (visitedItemNames.has(itemName)) return

    const item = itemsByName.get(itemName)

    if (!item) {
      issues.push({
        code: parentName ? REGISTRY_GRAPH_ISSUE__MISSING_DEPENDENCY : REGISTRY_GRAPH_ISSUE__MISSING_ITEM,
        dependencyName: parentName ? itemName : undefined,
        itemName: parentName ?? itemName,
        message: parentName
          ? `Registry item "${parentName}" depends on missing registry item "${itemName}".`
          : `Registry item "${itemName}" was requested but is not defined.`,
      })
      return
    }

    if (visitingItemNames.has(itemName)) {
      const cycleStartIndex = registryDependencyPath.indexOf(itemName)
      const cyclePath = [...registryDependencyPath.slice(Math.max(cycleStartIndex, 0)), itemName]

      issues.push({
        code: REGISTRY_GRAPH_ISSUE__CIRCULAR_DEPENDENCY,
        dependencyName: itemName,
        itemName: parentName ?? itemName,
        message: `Registry item dependency cycle detected: ${cyclePath.join(" -> ")}.`,
        registryDependencyPath: cyclePath,
      })
      return
    }

    visitingItemNames.add(itemName)
    registryDependencyPath.push(itemName)

    item.registryDependencies?.forEach((dependencyName) => {
      visitItem(dependencyName, depth + 1, item.name)
    })

    registryDependencyPath.pop()
    visitingItemNames.delete(itemName)
    visitedItemNames.add(itemName)
    resolvedItems.push({ depth, item })
  }

  itemNames.forEach((itemName) => visitItem(itemName, 0))

  const fileTargetsByKey = new Map<string, { file: TRegistryManifestFile; itemName: string }>()

  resolvedItems.forEach(({ item }) => {
    item.files.forEach((file) => {
      const targetKey = createRegistryFileTargetKey(file)
      const existingTarget = fileTargetsByKey.get(targetKey)

      if (existingTarget) {
        issues.push({
          code: REGISTRY_GRAPH_ISSUE__DUPLICATE_FILE_TARGET,
          itemName: item.name,
          message: `Registry items "${existingTarget.itemName}" and "${item.name}" both target ${targetKey}.`,
          targetPath: file.targetPath,
          targetRole: file.targetRole,
        })
        return
      }

      fileTargetsByKey.set(targetKey, { file, itemName: item.name })
    })
  })

  return {
    issues,
    items: resolvedItems,
  }
}
