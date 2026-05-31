export const REGISTRY_SOURCE_PACKAGE__REACT = "@amino-ui/react"

export const REGISTRY_ITEM_TYPE__COMPONENT = "component"
export const REGISTRY_ITEM_TYPE__SUPPORT = "support"
export const REGISTRY_ITEM_TYPE__STYLE = "style"
export const REGISTRY_ITEM_TYPE__THEME = "theme"

export const REGISTRY_ITEM_TYPES = [
  REGISTRY_ITEM_TYPE__COMPONENT,
  REGISTRY_ITEM_TYPE__SUPPORT,
  REGISTRY_ITEM_TYPE__STYLE,
  REGISTRY_ITEM_TYPE__THEME,
] as const

export const REGISTRY_FILE_ROLE__SOURCE = "source"
export const REGISTRY_FILE_ROLE__STYLE = "style"
export const REGISTRY_FILE_ROLE__TEST = "test"
export const REGISTRY_FILE_ROLE__THEME = "theme"
export const REGISTRY_FILE_ROLE__SUPPORT = "support"

export const REGISTRY_FILE_ROLES = [
  REGISTRY_FILE_ROLE__SOURCE,
  REGISTRY_FILE_ROLE__STYLE,
  REGISTRY_FILE_ROLE__TEST,
  REGISTRY_FILE_ROLE__THEME,
  REGISTRY_FILE_ROLE__SUPPORT,
] as const

export type TRegistryItemType = (typeof REGISTRY_ITEM_TYPES)[number]
export type TRegistryFileRole = (typeof REGISTRY_FILE_ROLES)[number]
export type TRegistryDependencyMap = Readonly<Record<string, string>>

export type TRegistryManifestFile = {
  sourcePath: string
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
