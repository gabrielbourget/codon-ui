import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  REGISTRY_ITEM_TYPE__SUPPORT,
  REGISTRY_ITEM_TYPE__THEME,
  reactRegistryManifest,
  type TRegistryManifest,
} from "./src/registry"

export const LOCAL_REGISTRY_SOURCE_SCHEMA_VERSION = 1
export const LOCAL_REACT_REGISTRY_SOURCE_IDENTITY = "@codon-ui/react-local"
export const LOCAL_SUPPORT_REGISTRY_SOURCE_IDENTITY = "@codon-ui/react-local-support"
export const LOCAL_REGISTRY_SOURCE_ROOT = "../../.."

const LOCAL_SUPPORT_REGISTRY_ITEM_TYPES = new Set([REGISTRY_ITEM_TYPE__SUPPORT, REGISTRY_ITEM_TYPE__THEME])

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(packageRoot, "../..")

export const localReactRegistrySnapshotPath = path.join(repoRoot, "packages/CLI/registry/local-react.registry.json")
export const localSupportRegistrySnapshotPath = path.join(
  repoRoot,
  "packages/CLI/registry/local-react-support.registry.json",
)

export const createLocalRegistrySnapshots = (manifest: TRegistryManifest = reactRegistryManifest) => {
  const localSupportRegistryManifest = manifest.filter((item) => LOCAL_SUPPORT_REGISTRY_ITEM_TYPES.has(item.type))

  return {
    fullReactSnapshot: {
      schemaVersion: LOCAL_REGISTRY_SOURCE_SCHEMA_VERSION,
      sourceIdentity: LOCAL_REACT_REGISTRY_SOURCE_IDENTITY,
      sourceRoot: LOCAL_REGISTRY_SOURCE_ROOT,
      items: manifest,
    },
    supportSnapshot: {
      schemaVersion: LOCAL_REGISTRY_SOURCE_SCHEMA_VERSION,
      sourceIdentity: LOCAL_SUPPORT_REGISTRY_SOURCE_IDENTITY,
      sourceRoot: LOCAL_REGISTRY_SOURCE_ROOT,
      items: localSupportRegistryManifest,
    },
  }
}

export const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`
  }

  return JSON.stringify(value)
}
