import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { realpath } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const require = createRequire(path.join(repository, "packages/react/package.json"))
const { build } = createRequire(createRequire(require.resolve("vitest/package.json")).resolve("vite/package.json"))(
  "esbuild",
)
const ts = createRequire(path.join(repository, "packages/react-native/package.json"))("typescript")
const dom = await realpath(path.join(repository, "node_modules/.pnpm/motion-dom@12.40.0/node_modules/motion-dom"))
const sources = {
  upstream: `export {DOMKeyframesResolver} from ${JSON.stringify(dom + "/dist/es/animation/keyframes/DOMKeyframesResolver.mjs")};export {motionValue} from ${JSON.stringify(dom + "/dist/es/value/index.mjs")}`,
  native: `export {NativeMotionMeasurementState} from ${JSON.stringify(path.join(repository, "packages/react-native/src/motion/measurement/state.ts"))};export {NativeMotionGeometryObserver,registerNativeMotionGeometryObserver} from ${JSON.stringify(path.join(repository, "packages/react-native/src/input/motionGeometry.ts"))}`,
}
const modules = {},
  graphs = {}
for (const [name, contents] of Object.entries(sources)) {
  const result = await build({
    absWorkingDir: repository,
    stdin: { contents, resolveDir: repository, sourcefile: `measurement-${name}.mjs` },
    bundle: true,
    write: false,
    metafile: true,
    format: "esm",
    platform: "neutral",
    logLevel: "silent",
    define: { __DEV__: "true", ...(name === "upstream" ? { window: "fixtureWindow" } : {}) },
    banner: {
      js: name === "upstream" ? "const fixtureWindow={getComputedStyle:node=>node.computed,pageYOffset:0};" : "",
    },
    footer: { js: `//# sourceURL=measurement-${name}.mjs` },
  })
  const code = result.outputFiles[0].text
  modules[name] = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`)
  const retained = Object.values(result.metafile.outputs).flatMap((output) =>
    Object.entries(output.inputs)
      .filter(([, value]) => value.bytesInOutput)
      .map(([file]) => file),
  )
  graphs[name] = {
    discoveredInputs: Object.keys(result.metafile.inputs).length,
    retainedInputs: retained.length,
    retained,
    bundleSha256: createHash("sha256").update(code).digest("hex"),
  }
  if (name === "native") {
    assert.ok(retained.every((file) => file.startsWith("packages/react-native/src/")))
    const tree = ts.createSourceFile("native.js", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
    assert.equal(tree.parseDiagnostics.length, 0)
    const forbidden = new Set(["window", "document", "HTMLElement", "getComputedStyle", "IntersectionObserver"])
    const visit = (node) => {
      if (ts.isIdentifier(node) && forbidden.has(node.text)) assert.fail(`native global reference ${node.text}`)
      ts.forEachChild(node, visit)
    }
    visit(tree)
  }
}
const native = modules.native,
  upstream = modules.upstream
const dimension = (value, axis, width) =>
  typeof value === "number"
    ? value
    : value === "auto"
      ? axis === "width"
        ? 240
        : width / 2 + 20
      : parseFloat(value) * 4
const geometry = (values) => {
  const width = dimension(values.width, "width"),
    height = dimension(values.height, "height", width)
  return { width, height }
}
const snapshot = (values) => {
  const { width, height } = geometry(values),
    box = { box: [0, 0, width, height], quad: [0, 0, width, 0, width, height, 0, height] },
    matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  return {
    platform: "android",
    coordinateSpace: "window",
    units: "dp",
    density: 1,
    matrixFormat: "android-row-major-3x3",
    rootTag: 0,
    rootIdentity: "fixture-root",
    root: box,
    layout: [0, 0, width, height],
    untransformed: box,
    model: box,
    presentation: box,
    presentationSource: "fixture",
    ancestors: [
      {
        tag: 71,
        identity: "fixture-view",
        bounds: [0, 0, width, height],
        layout: [0, 0, width, height],
        scroll: [0, 0],
        matrix,
        model: box,
        clip: { complete: true },
      },
    ],
    mountObservationAvailable: true,
  }
}
const records = []
for (const specification of [
  { width: [120, "auto"], height: [40, "auto"] },
  { width: ["25%", "auto"], height: [40, "75%"] },
  { width: ["auto", "25%"], height: ["auto", 80] },
  { width: [12.25, "37.5%"], height: [24.5, "auto"] },
  { width: [0, "auto"], height: [0, "auto"] },
]) {
  const initial = Object.fromEntries(Object.entries(specification).map(([key, frames]) => [key, frames[0]]))
  let rendered = { ...initial }
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, upstream.motionValue(value)]))
  const element = {
    current: { computed: { boxSizing: "border-box" } },
    getValue: (name) => values.get(name),
    readValue: (name) => initial[name],
    measureViewportBox: () => {
      const { width, height } = geometry(rendered)
      return { x: { min: 0, max: width }, y: { min: 0, max: height } }
    },
  }
  const resolvers = Object.entries(specification).map(
    ([name, frames]) => new upstream.DOMKeyframesResolver(frames, () => {}, name, values.get(name), element),
  )
  resolvers.forEach((resolver) => resolver.readKeyframes())
  assert.ok(resolvers.every((resolver) => resolver.needsMeasurement))
  resolvers.forEach((resolver) => resolver.measureInitialState())
  rendered = Object.fromEntries([...values].map(([name, value]) => [name, value.get()]))
  resolvers.forEach((resolver) => resolver.measureEndState())
  const expected = resolvers.map((resolver) => ({
    keyframes: resolver.unresolvedKeyframes,
    finalKeyframe: resolver.finalKeyframe,
  }))
  const target = {},
    trace = []
  let state,
    revision = 0,
    held = false
  const packet = (extra = {}) => ({
    ownerId: "owner",
    bindingId: "binding",
    target: 71,
    kind: "sample",
    requestId: "",
    windowId: "window",
    scopeOwnerId: "scope",
    epoch: 2,
    attachmentRevision: 1,
    geometryRevision: ++revision,
    commitRevision: state?.getSnapshot().revision ?? "",
    transactionId: "fixture-cohort",
    attached: true,
    snapshot: JSON.stringify(snapshot({ ...initial, ...state?.getSnapshot().values })),
    error: "",
    observedAt: 100,
    ...extra,
  })
  const observer = new native.NativeMotionGeometryObserver({
    ownerId: "owner",
    bindingId: "binding",
    target: () => 71,
    scope: () => ({ ownerId: "scope", windowId: "window", epoch: 2 }),
    dispatch: (requestId) => observer.receive(packet({ requestId })),
  })
  const unregister = native.registerNativeMotionGeometryObserver(target, observer)
  state = new native.NativeMotionMeasurementState({
    begin: async () => {
      held = true
      return {
        target,
        release: async () => {
          held = false
        },
        abort: async () => {
          held = false
        },
      }
    },
  })
  const detach = state.attach(target)
  const unsubscribe = state.subscribe(() => {
    const next = state.getSnapshot()
    if (next.revision) {
      trace.push({ values: next.values, held })
      observer.receive(packet({ kind: "mount-after" }))
    }
  })
  const token = { isCurrent: () => true, onCancel: () => () => {} }
  const actual = await Promise.all(
    Object.entries(specification).map(([name, keyframes]) =>
      state.measure({ name, keyframes, token, metric: (record) => record.snapshot.layout[name === "width" ? 2 : 3] }),
    ),
  )
  assert.deepEqual(actual, expected, JSON.stringify(specification))
  assert.ok(trace.every((stage) => stage.held))
  assert.equal(trace.at(-1).values, null)
  assert.equal(held, false)
  records.push({
    specification,
    actual,
    acknowledgedModelStages: trace.length,
    sha256: createHash("sha256").update(JSON.stringify(actual)).digest("hex"),
  })
  unsubscribe()
  detach()
  unregister()
  values.forEach((value) => value.destroy())
}
console.log(
  JSON.stringify(
    {
      scope:
        "Actual pinned DOM resolver versus private native transaction with synthetic geometry and atomic provider; no installed Yoga/layout/paint or actual native atomicity proof",
      comparisons: records.length * 2,
      records,
      graphs,
      nativeActions: 0,
    },
    null,
    2,
  ),
)
