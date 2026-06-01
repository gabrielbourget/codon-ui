export const REGISTRY_SOURCE_PACKAGE__REACT = "@amino-ui/react"

export const REGISTRY_ITEM_TYPE__COMPONENT = "component"
export const REGISTRY_ITEM_TYPE__SUPPORT = "support"
export const REGISTRY_ITEM_TYPE__STYLE = "style"
export const REGISTRY_ITEM_TYPE__THEME = "theme"
export const REGISTRY_ITEM_TYPE__ASSET = "asset"
export const REGISTRY_ITEM_TYPE__TEST = "test"

export const REGISTRY_ITEM_TYPES = [
  REGISTRY_ITEM_TYPE__COMPONENT,
  REGISTRY_ITEM_TYPE__SUPPORT,
  REGISTRY_ITEM_TYPE__STYLE,
  REGISTRY_ITEM_TYPE__THEME,
  REGISTRY_ITEM_TYPE__ASSET,
  REGISTRY_ITEM_TYPE__TEST,
] as const

export const REGISTRY_FILE_ROLE__SOURCE = "source"
export const REGISTRY_FILE_ROLE__STYLE = "style"
export const REGISTRY_FILE_ROLE__TEST = "test"
export const REGISTRY_FILE_ROLE__THEME = "theme"
export const REGISTRY_FILE_ROLE__SUPPORT = "support"
export const REGISTRY_FILE_ROLE__ASSET = "asset"

export const REGISTRY_FILE_ROLES = [
  REGISTRY_FILE_ROLE__SOURCE,
  REGISTRY_FILE_ROLE__STYLE,
  REGISTRY_FILE_ROLE__TEST,
  REGISTRY_FILE_ROLE__THEME,
  REGISTRY_FILE_ROLE__SUPPORT,
  REGISTRY_FILE_ROLE__ASSET,
] as const

export const REGISTRY_TARGET_ROLE__COMPONENTS = "components"
export const REGISTRY_TARGET_ROLE__TOKENS = "tokens"
export const REGISTRY_TARGET_ROLE__UTILS = "utils"
export const REGISTRY_TARGET_ROLE__TYPES = "types"
export const REGISTRY_TARGET_ROLE__THEME = "theme"
export const REGISTRY_TARGET_ROLE__ASSETS = "assets"

export const REGISTRY_TARGET_ROLES = [
  REGISTRY_TARGET_ROLE__COMPONENTS,
  REGISTRY_TARGET_ROLE__TOKENS,
  REGISTRY_TARGET_ROLE__UTILS,
  REGISTRY_TARGET_ROLE__TYPES,
  REGISTRY_TARGET_ROLE__THEME,
  REGISTRY_TARGET_ROLE__ASSETS,
] as const

export type TRegistryItemType = (typeof REGISTRY_ITEM_TYPES)[number]
export type TRegistryFileRole = (typeof REGISTRY_FILE_ROLES)[number]
export type TRegistryTargetRole = (typeof REGISTRY_TARGET_ROLES)[number]
export type TRegistryDependencyMap = Readonly<Record<string, string>>

export type TRegistryManifestFile = {
  sourcePath: string
  targetRole: TRegistryTargetRole
  targetPath: string
  role: TRegistryFileRole
}

export type TRegistryManifestItem = {
  name: string
  type: TRegistryItemType
  sourcePackage: string
  files: readonly TRegistryManifestFile[]
  registryDependencies?: readonly string[]
  peerDependencies?: TRegistryDependencyMap
  runtimeDependencies?: TRegistryDependencyMap
  devDependencies?: TRegistryDependencyMap
}

export type TRegistryManifest = readonly TRegistryManifestItem[]
