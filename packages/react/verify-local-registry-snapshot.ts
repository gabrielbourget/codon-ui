import { readFileSync } from "node:fs"

import {
  createLocalRegistrySnapshots,
  localReactRegistrySnapshotPath,
  localSupportRegistrySnapshotPath,
  stableStringify,
} from "./local-registry-snapshot"

const fail = (message: string) => {
  console.error(`[local-registry-snapshot-contract] ${message}`)
  process.exitCode = 1
}

const snapshot = JSON.parse(readFileSync(localSupportRegistrySnapshotPath, "utf8")) as unknown
const fullSnapshot = JSON.parse(readFileSync(localReactRegistrySnapshotPath, "utf8")) as unknown
const { fullReactSnapshot: expectedFullSnapshot, supportSnapshot: expectedSnapshot } = createLocalRegistrySnapshots()

const actualSnapshotSignature = stableStringify(snapshot)
const expectedSnapshotSignature = stableStringify(expectedSnapshot)
const actualFullSnapshotSignature = stableStringify(fullSnapshot)
const expectedFullSnapshotSignature = stableStringify(expectedFullSnapshot)

if (actualSnapshotSignature !== expectedSnapshotSignature) {
  fail(
    "packages/CLI/registry/local-react-support.registry.json has drifted from the support/theme subset in packages/react/src/registry/manifest.ts.",
  )
  fail("Run pnpm -F @codon-ui/react generate:local-registry-snapshot and review the generated artifact diff.")
}

if (actualFullSnapshotSignature !== expectedFullSnapshotSignature) {
  fail("packages/CLI/registry/local-react.registry.json has drifted from packages/react/src/registry/manifest.ts.")
  fail("Run pnpm -F @codon-ui/react generate:local-registry-snapshot and review the generated artifact diff.")
}

if (process.exitCode) {
  process.exit()
}

console.log(
  "[local-registry-snapshot-contract] local support and full React registry snapshots match reactRegistryManifest.",
)
