import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { localRegistrySourceSchema } from "../installPlan/schema"

import { TABLE_NATIVE_FILES } from "./ownership"
import { buildNativeRegistry } from "./registry"
import { hashSource } from "./sourceFiles"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..")
const { registry, generated } = await buildNativeRegistry(root)
assert.deepEqual(
  JSON.parse(await readFile(path.join(root, "packages/CLI/registry/local-native.registry.json"), "utf8")),
  registry,
)
const parsed = localRegistrySourceSchema.parse(registry)
assert.equal(parsed.items.filter((item) => item.type === "component").length, 52)
assert.equal(new Set(parsed.items.map((item) => item.name)).size, parsed.items.length)
for (const [file, expected] of generated) assert.equal(await readFile(path.join(root, file), "utf8"), expected, file)
const tableEntry = generated.get("packages/CLI/registry/native/components/table.ts")!
assert.match(tableEntry, /export \* from "[^"\n]+components\/Table\/index"/)
assert.equal((tableEntry.match(/AvailableFilterCriteria/g) ?? []).length, 0)
const tableComponent = parsed.items.find((item) => item.name === "table")!
assert.ok(tableComponent.registryDependencies.includes("native-source/src/components/Table/index.ts"))
assert.ok(
  tableComponent.registryDependencies.includes("native-source/src/components/Filtering/DynamicFilterArgumentInput.tsx"),
)
const table = parsed.items.find((item) => item.name === "native-table")!
assert.deepEqual(
  table.files.map((file) => file.targetPath).sort(),
  TABLE_NATIVE_FILES.map((file) => `native/${file}`).sort(),
)
const core = parsed.items.find((item) => item.name === "native-core")!
const runtimePackage = JSON.parse(generated.get("packages/CLI/registry/native/runtime/package.json")!)
const canonicalPackage = JSON.parse(await readFile(path.join(root, "packages/react-native/package.json"), "utf8"))
assert.equal(runtimePackage.description, canonicalPackage.description) // CocoaPods reads its required summary here.

assert.ok(core.files.every((file) => !table.files.some((other) => other.targetPath === file.targetPath)))
const rootItem = parsed.items.find((item) => item.name === "native-root")!
assert.equal(rootItem.runtimeDependencies["@formatjs/intl-pluralrules"], "6.3.15")
for (const file of [
  ...core.files,
  ...table.files,
  ...parsed.native!.composition.core,
  ...parsed.native!.composition.table,
  ...rootItem.files,
])
  assert.equal(file.contentHash, `sha256:${hashSource(await readFile(path.join(root, file.sourcePath)))}`)
console.log(
  "[codon-ui] canonical native catalogue, generated entries, runtime sources, profiles and bootstrap provenance verified",
)
