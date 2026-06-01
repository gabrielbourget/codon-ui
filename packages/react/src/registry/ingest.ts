import type { TRegistryDependencyMap, TRegistryFileRole, TRegistryItemType, TRegistryTargetRole } from "./types"

export const REGISTRY_INGEST_THEME_STRATEGY__DEFAULT_CONTRACT = "default-contract"
export const REGISTRY_INGEST_THEME_STRATEGY__PROOF_COMPATIBILITY_BRIDGE = "proof-compatibility-bridge"
export const REGISTRY_INGEST_THEME_STRATEGY__CONSUMER_OWNED = "consumer-owned"

export const REGISTRY_INGEST_THEME_STRATEGIES = [
  REGISTRY_INGEST_THEME_STRATEGY__DEFAULT_CONTRACT,
  REGISTRY_INGEST_THEME_STRATEGY__PROOF_COMPATIBILITY_BRIDGE,
  REGISTRY_INGEST_THEME_STRATEGY__CONSUMER_OWNED,
] as const

export const REGISTRY_INGEST_VERIFICATION_KIND__COMMAND = "command"
export const REGISTRY_INGEST_VERIFICATION_KIND__SCAN = "scan"

export const REGISTRY_INGEST_VERIFICATION_KINDS = [
  REGISTRY_INGEST_VERIFICATION_KIND__COMMAND,
  REGISTRY_INGEST_VERIFICATION_KIND__SCAN,
] as const

export type TRegistryIngestThemeStrategy = (typeof REGISTRY_INGEST_THEME_STRATEGIES)[number]

export type TRegistryIngestVerificationKind = (typeof REGISTRY_INGEST_VERIFICATION_KINDS)[number]

export type TRegistryIngestFile = {
  sourcePath: string
  targetRole: TRegistryTargetRole
  targetPath: string
  role: TRegistryFileRole
  required?: boolean
}

export type TRegistryIngestPublicExport = {
  exportedName: string
  sourcePath: string
  localName?: string
  typeOnly?: boolean
}

export type TRegistryIngestImportResolution = {
  sourcePath: string
  importSource: string
  registryDependencyName?: string
  replacementSource?: string
  advisory?: boolean
  notes?: readonly string[]
}

export type TRegistryIngestThemeRequirement = {
  strategy: TRegistryIngestThemeStrategy
  cssVariables?: readonly string[]
  files?: readonly TRegistryIngestFile[]
  notes?: readonly string[]
}

export type TRegistryIngestVerificationStep = {
  kind: TRegistryIngestVerificationKind
  command: string
  workingDirectory?: string
  advisory?: boolean
  notes?: readonly string[]
}

export type TRegistryIngestPacket = {
  name: string
  type: TRegistryItemType
  sourcePackage: string
  sourceRepository?: string
  sourceRef?: string
  files: readonly TRegistryIngestFile[]
  publicExports?: readonly TRegistryIngestPublicExport[]
  importResolutions?: readonly TRegistryIngestImportResolution[]
  excludedSourcePaths?: readonly string[]
  registryDependencies?: readonly string[]
  peerDependencies?: TRegistryDependencyMap
  runtimeDependencies?: TRegistryDependencyMap
  devDependencies?: TRegistryDependencyMap
  themeRequirements?: readonly TRegistryIngestThemeRequirement[]
  verification?: readonly TRegistryIngestVerificationStep[]
  notes?: readonly string[]
}
