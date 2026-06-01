import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { reactRegistryManifest } from "./src/registry"

const LOCAL_REGISTRY_SOURCE_SCHEMA_VERSION = 1
const LOCAL_REGISTRY_SOURCE_IDENTITY = "@amino-ui/react-local-support"
const LOCAL_REGISTRY_SOURCE_ROOT = "../../.."

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(packageRoot, "../..")
const localRegistrySnapshotPath = path.join(repoRoot, "packages/CLI/registry/local-react-support.registry.json")

const fail = (message: string) => {
  console.error(`[local-registry-snapshot-contract] ${message}`)
  process.exitCode = 1
}

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`
  }

  return JSON.stringify(value)
}

const snapshot = JSON.parse(readFileSync(localRegistrySnapshotPath, "utf8")) as unknown
const expectedSnapshot = {
  schemaVersion: LOCAL_REGISTRY_SOURCE_SCHEMA_VERSION,
  sourceIdentity: LOCAL_REGISTRY_SOURCE_IDENTITY,
  sourceRoot: LOCAL_REGISTRY_SOURCE_ROOT,
  items: reactRegistryManifest,
}

const actualSnapshotSignature = stableStringify(snapshot)
const expectedSnapshotSignature = stableStringify(expectedSnapshot)

if (actualSnapshotSignature !== expectedSnapshotSignature) {
  fail(
    "packages/CLI/registry/local-react-support.registry.json has drifted from packages/react/src/registry/manifest.ts.",
  )
  fail("Update the tracked snapshot to match the canonical React manifest, or add an approved generator pass.")
}

if (process.exitCode) {
  process.exit()
}

console.log("[local-registry-snapshot-contract] local support registry snapshot matches reactRegistryManifest.")
