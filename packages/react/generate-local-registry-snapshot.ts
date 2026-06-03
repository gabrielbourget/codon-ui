import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import prettier from "prettier"

import {
  createLocalRegistrySnapshots,
  localReactRegistrySnapshotPath,
  localSupportRegistrySnapshotPath,
} from "./local-registry-snapshot"

const writeGeneratedJson = async ({ filePath, value }: { filePath: string; value: unknown }) => {
  const formattedJson = await prettier.format(JSON.stringify(value), { parser: "json" })

  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, formattedJson, "utf8")
}

const { fullReactSnapshot, supportSnapshot } = createLocalRegistrySnapshots()

await writeGeneratedJson({
  filePath: localSupportRegistrySnapshotPath,
  value: supportSnapshot,
})
await writeGeneratedJson({
  filePath: localReactRegistrySnapshotPath,
  value: fullReactSnapshot,
})

console.log("[local-registry-snapshot-generator] wrote CLI local registry snapshots.")
