import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const reactRequire = createRequire(path.join(repository, "packages/react/package.json"))
const viteRequire = createRequire(
  createRequire(reactRequire.resolve("vitest/package.json")).resolve("vite/package.json"),
)
const { build } = viteRequire("esbuild")
const upstream = path.join(
  repository,
  "node_modules/.pnpm/motion-dom@12.40.0/node_modules/motion-dom/dist/es/render/VisualElement.mjs",
)
const native = path.join(repository, "packages/react-native/src/motion/projection/layoutCallbacks.ts")
const modules = {},
  graphs = {}
for (const kind of ["upstream", "native"]) {
  const entry =
    kind === "upstream"
      ? `export {VisualElement} from ${JSON.stringify(upstream)}`
      : `export {NativeMotionLayoutCallbacks} from ${JSON.stringify(native)}`
  const output = await build({
    stdin: { contents: entry, resolveDir: repository },
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    metafile: true,
    logLevel: "silent",
    define: { __DEV__: "true" },
  })
  const destination = `/private/tmp/codon-native-card-layout-callback-oracle-${kind}.mjs`
  await writeFile(destination, output.outputFiles[0].contents)
  modules[kind] = await import(pathToFileURL(destination).href)
  const retained = Object.values(output.metafile.outputs).flatMap((value) =>
    Object.entries(value.inputs)
      .filter(([, input]) => input.bytesInOutput)
      .map(([name]) => name),
  )
  if (kind === "native")
    assert(
      retained.every((name) => !name.includes("node_modules/")),
      retained,
    )
  graphs[kind] = { retained, sha256: createHash("sha256").update(output.outputFiles[0].contents).digest("hex") }
}
const run = (kind, initial, replacement, previousPresent) => {
  const renderer =
    kind === "upstream"
      ? new modules.upstream.VisualElement({ props: {}, visualState: { latestValues: {}, renderState: {} } })
      : new modules.native.NativeMotionLayoutCallbacks()
  const current = Object.freeze({ x: Object.freeze({ min: 1, max: 4 }), y: Object.freeze({ min: 2, max: 9 }) })
  const previous = Object.freeze({ x: Object.freeze({ min: 0, max: 3 }), y: Object.freeze({ min: 1, max: 8 }) })
  const records = []
  const listener =
    (name) =>
    (...args) =>
      records.push({
        name,
        arity: args.length,
        args: args.map((value) => (value === undefined ? "$undefined" : value)),
        currentIdentity: args[0] === current,
        previousIdentity: args[1] === previous,
      })
  const props = (mask, name) => ({
    ...(mask & 1 ? { onBeforeLayoutMeasure: listener(name + ":before") } : {}),
    ...(mask & 2 ? { onLayoutMeasure: listener(name + ":measure") } : {}),
  })
  const dispatch = () => {
    renderer.notify("BeforeLayoutMeasure")
    renderer.notify("LayoutMeasure", current, previousPresent ? previous : undefined)
  }
  const first = props(initial, "first")
  renderer.update(first)
  dispatch()
  renderer.update(replacement === "same" ? first : props(replacement, "next"))
  dispatch()
  if (kind === "upstream") renderer.unmount()
  else renderer.clear()
  dispatch()
  for (const record of records) {
    assert.equal(record.arity, 3)
    if (record.name.endsWith(":before")) assert.deepEqual(record.args, ["$undefined", "$undefined", "$undefined"])
    else {
      assert(record.currentIdentity)
      assert.equal(record.previousIdentity, previousPresent)
      assert.equal(record.args[2], "$undefined")
    }
  }
  return records
}
const records = []
for (const initial of [0, 1, 2, 3])
  for (const replacement of [0, 1, 2, 3, "same"])
    for (const previous of [false, true]) {
      const expected = run("upstream", initial, replacement, previous)
      const actual = run("native", initial, replacement, previous)
      assert.deepEqual(actual, expected)
      records.push({ initial, replacement, previous, actual })
    }
const result = {
  scope:
    "Actual pinned VisualElement/SubscriptionManager versus private native callback adapter; no native mount/input/presentation acceptance",
  profiles: records.length,
  graphs,
  records,
}
await writeFile("/private/tmp/codon-native-card-layout-callback-oracle.json", JSON.stringify(result, null, 2) + "\n")
console.log(
  JSON.stringify({
    profiles: records.length,
    callbacks: records.reduce((count, row) => count + row.actual.length, 0),
    graphs,
  }),
)
