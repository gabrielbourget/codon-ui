import path from "path"

import {
  CONSUMER_ADVISORY_SEVERITY__WARNING,
  CONSUMER_LAYOUT_MODE__REGISTRY_CONTAINED,
  CONSUMER_TARGET_ROLE__ASSETS,
  CONSUMER_TARGET_ROLE__COMPONENTS,
  CONSUMER_TARGET_ROLE__THEME,
  CONSUMER_TARGET_ROLE__TOKENS,
  CONSUMER_TARGET_ROLE__TYPES,
  CONSUMER_TARGET_ROLE__UTILS,
} from "./constants"
import type { TConsumerAdvisorySeverity, TConsumerConfig, TConsumerLayoutMode, TConsumerTargetRole } from "./schema"

export type TConsumerTargetPathMap = Readonly<Record<TConsumerTargetRole, string>>

export type TConsumerLayoutFinding = {
  code: string
  message: string
  severity: TConsumerAdvisorySeverity
}

export type TConsumerLayoutResolution = {
  findings: readonly TConsumerLayoutFinding[]
  layoutMode: TConsumerLayoutMode
  targetPaths: TConsumerTargetPathMap
}

export type TConsumerRegistryFileTarget = {
  targetRole: TConsumerTargetRole
  targetPath: string
}

export type TResolvedConsumerRegistryFileTarget = {
  targetRole: TConsumerTargetRole
  targetPath: string
  resolvedPath: string
}

export const normalizeConsumerRelativePath = (filePath: string) =>
  path.posix.normalize(filePath.replace(/\\/gu, "/")).replace(/^\/+/u, "")

export const createRegistryContainedTargetPaths = (config: Pick<TConsumerConfig, "paths">): TConsumerTargetPathMap => {
  const registryPath = normalizeConsumerRelativePath(config.paths.registry)

  return {
    [CONSUMER_TARGET_ROLE__ASSETS]: `${registryPath}/assets`,
    [CONSUMER_TARGET_ROLE__COMPONENTS]: normalizeConsumerRelativePath(config.paths.components),
    [CONSUMER_TARGET_ROLE__THEME]: registryPath,
    [CONSUMER_TARGET_ROLE__TOKENS]: `${registryPath}/tokens`,
    [CONSUMER_TARGET_ROLE__TYPES]: `${registryPath}/types`,
    [CONSUMER_TARGET_ROLE__UTILS]: `${registryPath}/utils`,
    ...Object.fromEntries(
      Object.entries(config.paths.roles).map(([targetRole, targetPath]) => [
        targetRole,
        normalizeConsumerRelativePath(targetPath),
      ]),
    ),
  }
}

export const resolveConsumerLayout = (config: TConsumerConfig): TConsumerLayoutResolution => {
  const findings: TConsumerLayoutFinding[] = []

  if (config.layoutMode !== CONSUMER_LAYOUT_MODE__REGISTRY_CONTAINED) {
    findings.push({
      code: "unsupported-layout-mode",
      message: `Layout mode "${config.layoutMode}" is modeled but not implemented yet; using registry-contained path resolution for advisory output.`,
      severity: CONSUMER_ADVISORY_SEVERITY__WARNING,
    })
  }

  return {
    findings,
    layoutMode: config.layoutMode,
    targetPaths: createRegistryContainedTargetPaths(config),
  }
}

export const resolveConsumerRegistryFileTarget = ({
  file,
  targetPaths,
}: {
  file: TConsumerRegistryFileTarget
  targetPaths: TConsumerTargetPathMap
}): TResolvedConsumerRegistryFileTarget => ({
  resolvedPath: normalizeConsumerRelativePath(path.posix.join(targetPaths[file.targetRole], file.targetPath)),
  targetPath: file.targetPath,
  targetRole: file.targetRole,
})
