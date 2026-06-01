import {
  resolveConsumerLayout,
  resolveConsumerRegistryFileTarget,
  type TConsumerConfig,
} from "@/src/helpers/consumerContract"

import {
  INSTALL_PLAN_FINDING__CIRCULAR_DEPENDENCY,
  INSTALL_PLAN_FINDING__DUPLICATE_FILE_TARGET,
  INSTALL_PLAN_FINDING__DUPLICATE_ITEM,
  INSTALL_PLAN_FINDING__MISSING_DEPENDENCY,
  INSTALL_PLAN_FINDING__MISSING_ITEM,
  INSTALL_PLAN_FINDING_SEVERITY__ERROR,
} from "./constants"
import {
  installPlanDependenciesSchema,
  registryInstallPlanSchema,
  type TInstallPlanDependencies,
  type TInstallPlanFile,
  type TInstallPlanFinding,
  type TInstallPlanItem,
  type TLocalRegistryItem,
  type TLocalRegistrySource,
  type TRegistryInstallPlan,
} from "./schema"

const mergeDependencyMaps = (dependencyMaps: readonly Record<string, string>[]) =>
  dependencyMaps.reduce<Record<string, string>>(
    (mergedDependencies, dependencyMap) => ({
      ...mergedDependencies,
      ...dependencyMap,
    }),
    {},
  )

const mergeInstallPlanDependencies = (items: readonly TLocalRegistryItem[]): TInstallPlanDependencies =>
  installPlanDependenciesSchema.parse({
    devDependencies: mergeDependencyMaps(items.map((item) => item.devDependencies)),
    peerDependencies: mergeDependencyMaps(items.map((item) => item.peerDependencies)),
    runtimeDependencies: mergeDependencyMaps(items.map((item) => item.runtimeDependencies)),
  })

const createFileTargetKey = (file: Pick<TInstallPlanFile, "resolvedPath">) => file.resolvedPath

export const createRegistryInstallPlan = ({
  config,
  registrySource,
  requestedItems,
}: {
  config: TConsumerConfig
  registrySource: TLocalRegistrySource
  requestedItems: readonly string[]
}): TRegistryInstallPlan => {
  const findings: TInstallPlanFinding[] = []
  const itemsByName = new Map<string, TLocalRegistryItem>()

  registrySource.items.forEach((item) => {
    if (itemsByName.has(item.name)) {
      findings.push({
        code: INSTALL_PLAN_FINDING__DUPLICATE_ITEM,
        itemName: item.name,
        message: `Registry item "${item.name}" is defined more than once.`,
        severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
      })
      return
    }

    itemsByName.set(item.name, item)
  })

  const resolvedItems: TLocalRegistryItem[] = []
  const visitedItemNames = new Set<string>()
  const visitingItemNames = new Set<string>()
  const registryDependencyPath: string[] = []

  const visitItem = (itemName: string, parentName?: string) => {
    if (visitedItemNames.has(itemName)) return

    const item = itemsByName.get(itemName)

    if (!item) {
      findings.push({
        code: parentName ? INSTALL_PLAN_FINDING__MISSING_DEPENDENCY : INSTALL_PLAN_FINDING__MISSING_ITEM,
        itemName: parentName ?? itemName,
        message: parentName
          ? `Registry item "${parentName}" depends on missing registry item "${itemName}".`
          : `Registry item "${itemName}" was requested but is not defined.`,
        severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
      })
      return
    }

    if (visitingItemNames.has(itemName)) {
      const cycleStartIndex = registryDependencyPath.indexOf(itemName)
      const cyclePath = [...registryDependencyPath.slice(Math.max(cycleStartIndex, 0)), itemName]

      findings.push({
        code: INSTALL_PLAN_FINDING__CIRCULAR_DEPENDENCY,
        itemName: parentName ?? itemName,
        message: `Registry item dependency cycle detected: ${cyclePath.join(" -> ")}.`,
        severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
      })
      return
    }

    visitingItemNames.add(itemName)
    registryDependencyPath.push(itemName)

    item.registryDependencies.forEach((dependencyName) => {
      visitItem(dependencyName, item.name)
    })

    registryDependencyPath.pop()
    visitingItemNames.delete(itemName)
    visitedItemNames.add(itemName)
    resolvedItems.push(item)
  }

  requestedItems.forEach((itemName) => visitItem(itemName))

  const layout = resolveConsumerLayout(config)
  findings.push(...layout.findings)

  const files: TInstallPlanFile[] = resolvedItems.flatMap((item) =>
    item.files.map((file) => ({
      ...file,
      itemName: item.name,
      resolvedPath: resolveConsumerRegistryFileTarget({
        file,
        targetPaths: layout.targetPaths,
      }).resolvedPath,
    })),
  )

  const fileTargetOwners = new Map<string, string>()

  files.forEach((file) => {
    const targetKey = createFileTargetKey(file)
    const existingOwner = fileTargetOwners.get(targetKey)

    if (existingOwner) {
      findings.push({
        code: INSTALL_PLAN_FINDING__DUPLICATE_FILE_TARGET,
        itemName: file.itemName,
        message: `Registry items "${existingOwner}" and "${file.itemName}" both target ${targetKey}.`,
        severity: INSTALL_PLAN_FINDING_SEVERITY__ERROR,
        targetPath: targetKey,
      })
      return
    }

    fileTargetOwners.set(targetKey, file.itemName)
  })

  const items: TInstallPlanItem[] = resolvedItems.map((item) => ({
    files: files.filter((file) => file.itemName === item.name),
    name: item.name,
    registryDependencies: item.registryDependencies,
    sourcePackage: item.sourcePackage,
    type: item.type,
  }))

  return registryInstallPlanSchema.parse({
    dependencies: mergeInstallPlanDependencies(resolvedItems),
    files,
    findings,
    items,
    requestedItems,
    sourceIdentity: registrySource.sourceIdentity,
  })
}
