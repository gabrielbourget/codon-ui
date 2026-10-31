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
const ts = createRequire(path.join(repository, "packages/react-native/package.json"))("typescript")
const upstream = path.join(repository, "node_modules/.pnpm/motion-dom@12.40.0/node_modules/motion-dom/dist/es")
const native = path.join(repository, "packages/react-native/src/motion")
const modules = {},
  graphs = {}
for (const kind of ["upstream", "native"]) {
  const isNative = kind === "native"
  const contents = isNative
    ? `export {createProjectionNode} from ${JSON.stringify(native + "/projection/node/create-projection-node.ts")};export {buildNativeProjectionTransform} from ${JSON.stringify(native + "/projection/nativeStyles.ts")};export {frameData,MotionGlobalConfig,time} from ${JSON.stringify(native + "/kernel/index.ts")}`
    : `export {createProjectionNode,buildProjectionTransform,frameData,time} from ${JSON.stringify(upstream + "/index.mjs")};export {MotionGlobalConfig} from ${JSON.stringify(path.join(repository, "node_modules/.pnpm/motion-utils@12.39.0/node_modules/motion-utils/dist/es/index.mjs"))}`
  const output = await build({
    absWorkingDir: repository,
    stdin: { contents, resolveDir: repository, sourcefile: `card-projection-${kind}.mjs` },
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    metafile: true,
    logLevel: "silent",
    define: {
      __DEV__: "true",
      requestAnimationFrame: "fixtureRequestFrame",
      ...(!isNative ? { window: "fixtureWindow" } : {}),
    },
    banner: {
      js: "const fixtureFrames=new Map();let nextFrame=0;const fixtureRequestFrame=callback=>{fixtureFrames.set(++nextFrame,callback);return nextFrame};const fixtureWindow={};export {fixtureFrames};",
    },
  })
  if (isNative) {
    const forbidden = new Set([
      "window",
      "document",
      "navigator",
      "HTMLElement",
      "SVGElement",
      "IntersectionObserver",
      "getComputedStyle",
      "WAAPI",
    ])
    const source = ts.createSourceFile(
      "projection-native.js",
      output.outputFiles[0].text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    )
    const visit = (node) => {
      if ((ts.isIdentifier(node) || ts.isStringLiteralLike(node)) && forbidden.has(node.text))
        assert.fail("Retained browser reference: " + node.text)
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  const bundlePath = `/private/tmp/codon-native-card-projection-oracle-${kind}.mjs`
  await writeFile(bundlePath, output.outputFiles[0].contents)
  modules[kind] = await import(pathToFileURL(bundlePath).href)
  graphs[kind] = {
    retained: Object.values(output.metafile.outputs).flatMap((out) =>
      Object.entries(out.inputs)
        .filter(([, entry]) => entry.bytesInOutput)
        .map(([name]) => name),
    ),
    sha256: createHash("sha256").update(output.outputFiles[0].contents).digest("hex"),
  }
}
const clone = (value) => JSON.parse(JSON.stringify(value))
const box = (x, y, width, height) => ({ x: { min: x, max: x + width }, y: { min: y, max: y + height } })
const turn = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}
const run = async (module, isNative, profile) => {
  module.MotionGlobalConfig.useManualTiming = true
  module.frameData.timestamp = 1000
  module.time.set(1000)
  const events = [],
    nodes = [],
    states = []
  const Projection = module.createProjectionNode({
    measureScroll: () => ({ x: 0, y: 0 }),
    checkIsScrollRoot: (instance) => Boolean(instance.root),
    resetTransform: () => {},
  })
  const root = new Projection({})
  root.mount({
    root: true,
    isConnected: true,
    isCurrent: () => true,
    windowWidth: () => 1000,
    measureNative: () => ({ measuredBox: box(0, 0, 1000, 800), layoutBox: box(0, 0, 1000, 800) }),
  })
  root.setOptions({ layoutScroll: true })
  const make = (label, initial, parent = root) => {
    const state = { box: clone(initial) }
    states.push(state)
    const values = { opacity: 1, borderRadius: 10 }
    const instance = {
      isConnected: true,
      isCurrent: () => true,
      windowWidth: () => 1000,
      measureNative: () => ({ measuredBox: clone(state.box), layoutBox: clone(state.box) }),
      applyNativeProjection() {},
    }
    const visual = {
      props: { style: {} },
      current: instance,
      latestValues: values,
      shouldReduceMotion: profile.reduce,
      getProps: () => ({
        onLayoutAnimationStart: () => events.push([label, "start"]),
        onLayoutAnimationComplete: () => events.push([label, "complete"]),
      }),
      getDefaultTransition: () => ({ duration: 0.2, ease: "linear" }),
      getTransformPagePoint: () => undefined,
      measureViewportBox: () => clone(state.box),
      mount() {},
      setStaticValue(key, value) {
        values[key] = value
      },
      render() {},
      scheduleRender() {},
      notify: (event, ...args) => events.push([label, event, clone(args)]),
    }
    const node = new Projection(values, parent)
    node.setOptions({
      layout: profile.mode,
      layoutId: profile.shared ? "shared" : undefined,
      layoutAnchor: profile.anchor,
      visualElement: visual,
    })
    node.mount(instance)
    node.layout = node.measure(false)
    nodes.push(node)
    return { node, state }
  }
  let parent
  if (profile.parent) parent = make("parent", box(0, 0, 300, 200))
  const first = make("first", box(10, 20, 100, 80), parent?.node)
  const second = profile.shared ? make("second", box(20, 10, 150, 100), parent?.node) : undefined
  const capture = () =>
    clone(
      nodes.map((node) => ({
        layout: node.layout?.layoutBox,
        target: node.target,
        relativeTarget: node.relativeTarget,
        projectionDelta: node.projectionDelta,
        treeScale: node.treeScale,
        animationValues: node.animationValues,
        progress: node.animationProgress,
      })),
    )
  const flush = async (timestamp) => {
    module.frameData.timestamp = timestamp
    module.time.set(timestamp)
    const pending = [...module.fixtureFrames.values()]
    module.fixtureFrames.clear()
    pending.forEach((callback) => callback(timestamp))
    await turn()
  }
  for (const node of nodes) node.willUpdate()
  if (parent) parent.state.box = box(20, 10, 450, 300)
  first.state.box = box(100, 90, profile.resize ? 150 : 100, profile.resize ? 120 : 80)
  if (second) second.state.box = box(200, 150, profile.resize ? 80 : 150, profile.resize ? 60 : 100)
  root.update()
  await turn()
  const trace = [capture()]
  for (const timestamp of [1016, 1064, 1120]) {
    await flush(timestamp)
    trace.push(capture())
  }
  if (profile.interrupt) {
    for (const node of nodes) node.willUpdate()
    first.state.box = box(40, 30, 130, 70)
    if (second) second.state.box = box(60, 20, 180, 100)
    root.update()
    await turn()
    trace.push(capture())
  }
  for (const timestamp of [1160, 1240, 1400]) {
    await flush(timestamp)
    trace.push(capture())
  }
  for (const node of nodes) {
    node.finishAnimation()
    node.unmount()
  }
  root.unmount()
  module.fixtureFrames.clear()
  module.MotionGlobalConfig.useManualTiming = false
  return { trace, events }
}
const records = []
for (const mode of [true, "position", "size", "preserve-aspect", "x", "y"])
  for (const parent of [false, true])
    for (const shared of [false, true])
      for (const interrupt of [false, true])
        for (const resize of [false, true]) {
          const profile = { mode, parent, shared, interrupt, resize, anchor: { x: 0.5, y: 0.5 } }
          const expected = await run(modules.upstream, false, profile),
            actual = await run(modules.native, true, profile)
          assert.deepEqual(actual, expected, JSON.stringify(profile))
          records.push({ profile, ...actual })
        }
const zMatrix = (z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, z, 1]
const parseTransform = (source) => {
  const result = []
  for (const match of source.matchAll(
    /(translate3d|scale|perspective|rotateX|rotateY|rotate|skewX|skewY)\(([^)]+)\)/g,
  )) {
    const [name, args] = [match[1], match[2].split(",").map((part) => parseFloat(part))]
    if (name === "translate3d") {
      result.push({ translateX: args[0] }, { translateY: args[1] })
      if (args[2]) result.push({ matrix: zMatrix(args[2]) })
    } else if (name === "scale") result.push({ scaleX: args[0] }, { scaleY: args[1] ?? args[0] })
    else result.push({ [name]: name === "perspective" ? args[0] : `${args[0]}deg` })
  }
  return result
}
let transforms = 0
for (const tx of [0, 20, -30])
  for (const scale of [1, 0.5, 2])
    for (const tree of [1, 0.75])
      for (const values of [
        {},
        { rotate: 30 },
        { rotate: 30, pathRotation: 15, rotateX: 20, rotateY: 40, skewX: 5, skewY: 6 },
        { transformPerspective: 500, z: 20, rotateX: 30 },
      ]) {
        const delta = {
            x: { translate: tx, scale, origin: 0.5, originPoint: 50 },
            y: { translate: -tx, scale: 1 / scale, origin: 0.5, originPoint: 40 },
          },
          treeScale = { x: tree, y: 1 / tree }
        assert.deepEqual(
          clone(modules.native.buildNativeProjectionTransform(delta, treeScale, values)),
          parseTransform(modules.upstream.buildProjectionTransform(delta, treeScale, values)),
          JSON.stringify({ delta, treeScale, values }),
        )
        transforms++
      }
const result = {
  scope:
    "Actual pinned projection state/geometry/shared-stack/animation traces versus the native core, with explicit immutable box/ref/frame models and inert DOM targets/renderers. Native transform arrays are compared with parsed actual pinned transform output. This is no installed/native geometry, drawing, viewport, timing or performance proof.",
  comparisons: records.length,
  transforms,
  graphs,
  nativeActions: 0,
  records,
}
await writeFile("/private/tmp/codon-native-card-projection-oracle.json", JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ ...result, records: `${records.length} exact traces stored outside seals` }, null, 2))
