import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const reactRequire = createRequire(path.join(repository, "packages/react/package.json"))
const viteRequire = createRequire(
  createRequire(reactRequire.resolve("vitest/package.json")).resolve("vite/package.json"),
)
const { build } = viteRequire("esbuild")
const framer = path.dirname(
  createRequire(reactRequire.resolve("motion/package.json")).resolve("framer-motion/package.json"),
)
const dom = path.join(repository, "node_modules/.pnpm/motion-dom@12.40.0/node_modules/motion-dom/dist/es/index.mjs")
const utils = path.join(
  repository,
  "node_modules/.pnpm/motion-utils@12.39.0/node_modules/motion-utils/dist/es/index.mjs",
)
const kernel = path.join(repository, "packages/react-native/src/motion/kernel/index.ts")
const ts = createRequire(path.join(repository, "packages/react-native/package.json"))("typescript")
const modules = {},
  graphs = {}
for (const native of [false, true]) {
  const name = native ? "native" : "upstream"
  const contents = native
    ? `export {NativeMotionDrag as Drag} from ${JSON.stringify(path.join(repository, "packages/react-native/src/motion/interactions/NativeMotionDrag.ts"))};export * as constraints from ${JSON.stringify(path.join(repository, "packages/react-native/src/motion/interactions/dragConstraints.ts"))};export {motionValue,frameData,MotionGlobalConfig,time} from ${JSON.stringify(kernel)}`
    : `export {VisualElementDragControls as Drag} from ${JSON.stringify(framer + "/dist/es/gestures/drag/VisualElementDragControls.mjs")};export * as constraints from ${JSON.stringify(framer + "/dist/es/gestures/drag/utils/constraints.mjs")};export {motionValue,frameData,time} from ${JSON.stringify(dom)};export {MotionGlobalConfig} from ${JSON.stringify(utils)}`
  const output = await build({
    absWorkingDir: repository,
    stdin: { contents, resolveDir: repository, sourcefile: `card-drag-${name}.mjs` },
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    metafile: true,
    logLevel: "silent",
    define: {
      __DEV__: "true",
      requestAnimationFrame: "fixtureRequestFrame",
      ...(native ? {} : { window: "fixtureWindow" }),
    },
    banner: {
      js: "const fixtureWindow={addEventListener(){},removeEventListener(){}};const fixtureFrames=new Map();let nextFrame=0;const fixtureRequestFrame=callback=>{fixtureFrames.set(++nextFrame,callback);return nextFrame};export {fixtureFrames};globalThis.fixtureDragEnvironment={};",
    },
    plugins: native
      ? [
          {
            name: "explicit-native-query-model",
            setup(builder) {
              builder.onLoad({ filter: /(?:input\/motionGeometry|measurement\/targetGeometry)\.ts$/ }, (args) => ({
                contents: args.path.endsWith("targetGeometry.ts")
                  ? "export const readNativeMotionTargetGeometry=(...args)=>globalThis.fixtureDragEnvironment.target(...args)"
                  : "export const readNativeMotionGeometry=(...args)=>globalThis.fixtureDragEnvironment.read(...args);export const observeNativeMotionGeometry=()=>()=>{}",
                loader: "js",
              }))
            },
          },
        ]
      : [],
  })
  if (native) {
    const forbidden = new Set([
      "document",
      "window",
      "HTMLElement",
      "SVGElement",
      "IntersectionObserver",
      "getComputedStyle",
      "WAAPI",
    ])
    const tree = ts.createSourceFile(
      "native-drag.js",
      output.outputFiles[0].text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    )
    const visit = (node) => {
      if ((ts.isIdentifier(node) || ts.isStringLiteralLike(node)) && forbidden.has(node.text))
        assert.fail(`Retained browser reference: ${node.text}`)
      ts.forEachChild(node, visit)
    }
    visit(tree)
  }
  modules[name] = await import(
    `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString("base64")}`
  )
  graphs[name] = {
    retained: Object.values(output.metafile.outputs).flatMap((entry) =>
      Object.entries(entry.inputs)
        .filter(([, value]) => value.bytesInOutput)
        .map(([name]) => name),
    ),
    bundleSha256: createHash("sha256").update(output.outputFiles[0].contents).digest("hex"),
  }
}
const turn = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve()
}
const run = async (module, native, scenario) => {
  module.MotionGlobalConfig.useManualTiming = true
  module.frameData.timestamp = 1000
  module.time.set(1000)
  const completions = new Map()
  const trace = [],
    values = new Map(),
    props = {
      ...scenario,
      onDragStart: (event, info) => trace.push(["start", event.id, structuredClone(info)]),
      onDrag: (event, info) => trace.push(["move", event.id, structuredClone(info)]),
      onDragEnd: (event, info) => trace.push(["end", event.id, structuredClone(info)]),
      onDirectionLock: (axis) => trace.push(["direction", axis]),
      onDragTransitionEnd: () => trace.push(["settled"]),
    }
  const scale = scenario.pointScale ? 2 : 1
  const layout = { x: { min: 10 * scale, max: 110 * scale }, y: { min: 20 * scale, max: 70 * scale } }
  const current = { ownerDocument: { defaultView: { addEventListener() {}, removeEventListener() {} } } }
  const snapshot = { untransformed: { box: [10, 20, 100, 50] }, model: { box: [10, 20, 100, 50] } }
  globalThis.fixtureDragEnvironment = {
    read: async () => ({ windowId: "oracle-native-window", attached: true, snapshot }),
    target: async () => ({
      windowId: "oracle-native-window",
      ownerSnapshot: snapshot,
      targetSnapshot: { model: { box: [0, 0, 300, 200] } },
    }),
  }
  const getValue = (axis, fallback = 0) => {
    if (!values.has(axis)) values.set(axis, module.motionValue(scenario.initial?.[axis] ?? fallback))
    return values.get(axis)
  }
  let active = false
  const owner = {
    current,
    latestValues: {},
    getProps: () => props,
    getValue,
    getTransformPagePoint: () => (scenario.pointScale ? (p) => ({ x: p.x * 2, y: p.y * 2 }) : undefined),
    captureAnimationLease: () => () => true,
    animationState: {
      setActive: (_, value) => {
        if (active !== value) {
          active = value
          trace.push(["active", value])
        }
        return Promise.resolve()
      },
    },
    render() {},
    projection: {
      layout: { layoutBox: layout },
      root: {
        updateScroll() {
          this.scroll = { offset: { x: 0, y: 0 } }
        },
      },
    },
    animateValue: (axis, _value, _target, transition, complete) => {
      trace.push(["inertia", axis, transition])
      completions.set(axis, complete)
      return {
        stop() {
          if (completions.get(axis) === complete) completions.delete(axis)
        },
      }
    },
  }
  const errors = [],
    controls = new module.Drag(owner, (error) => errors.push(String(error)))
  if (!native)
    controls.startAxisValueAnimation = (axis, transition) => {
      trace.push(["inertia", axis, transition])
      return new Promise((resolve) => completions.set(axis, resolve))
    }
  if (scenario.ref) {
    const ref = { current: { getBoundingClientRect: () => ({ left: 0, top: 0, right: 300, bottom: 200 }) } }
    props.dragConstraints = ref
    if (scenario.override) props.onMeasureDragConstraints = () => ({ left: -4, right: 9, top: -7, bottom: 11 })
  }
  if (native) {
    controls.refresh()
    await turn()
  }
  const event = (type, x, y, id) =>
    native
      ? {
          id,
          nativeEvent: { type, pageX: x, pageY: y, pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 },
          persist() {},
        }
      : { id, type, pageX: x, pageY: y, pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 }
  const flush = async (timestamp) => {
    module.frameData.timestamp = timestamp
    module.time.set(timestamp)
    const pending = [...module.fixtureFrames.values()]
    module.fixtureFrames.clear()
    pending.forEach((callback) => callback(timestamp))
    const completed = [...completions.values()]
    completions.clear()
    completed.forEach((done) => done())
    await turn()
  }
  controls.start(event("pointerdown", 10, 20, "down"), {
    snapToCursor: scenario.cursor,
    distanceThreshold: scenario.threshold,
  })
  await turn()
  for (const [i, [x, y]] of [
    [11, 21],
    [14, 25],
    [50, 45],
    [100, 80],
  ].entries()) {
    const moved = event("pointermove", x, y, "move-" + i)
    if (native) controls.move(moved)
    else controls.panSession.handlePointerMove(moved, { point: { x, y } })
    await flush(1016 + i * 16)
    trace.push(["values", getValue("x").get(), getValue("y").get()])
  }
  const up = event(scenario.cancel ? "pointercancel" : "pointerup", 120, 90, "up")
  if (native) controls.finish(up, scenario.cancel)
  else controls.panSession.handlePointerUp(up, { point: { x: 120, y: 90 } })
  await turn()
  await flush(1100)
  if (native) controls.retire()
  else controls.cancel()
  await turn()
  module.fixtureFrames.clear()
  module.MotionGlobalConfig.useManualTiming = false
  assert.deepEqual(errors, [])
  return trace
}
const records = []
for (const drag of [true, "x", "y"])
  for (const dragDirectionLock of [false, true])
    for (const shape of ["free", "relative", "ref", "override"])
      for (const dragElastic of [false, 0.35, { left: 0, right: 0.8, top: 0.2, bottom: 0.5 }])
        for (const cancel of [false, true]) {
          const scenario = {
            drag,
            dragDirectionLock,
            dragElastic,
            cancel,
            dragMomentum: true,
            dragConstraints: shape === "relative" ? { left: -4, right: 10, top: -3, bottom: 12 } : false,
            ref: shape === "ref" || shape === "override",
            override: shape === "override",
          }
          const expected = await run(modules.upstream, false, scenario),
            actual = await run(modules.native, true, scenario)
          assert.deepEqual(actual, expected, JSON.stringify(scenario))
          records.push({ scenario, trace: actual })
        }
for (const scenario of [
  { drag: true, cursor: true },
  { drag: "x", initial: { x: "25%" } },
  { drag: true, dragMomentum: false },
  { drag: true, dragSnapToOrigin: "x" },
  { drag: true, dragSnapToOrigin: true },
  { drag: "x", dragTransition: { power: 0.4, timeConstant: 200, restDelta: 0.2 } },
  { drag: true, pointScale: true, ref: true },
  { drag: true, pointScale: true, cursor: true },
]) {
  const expected = await run(modules.upstream, false, scenario),
    actual = await run(modules.native, true, scenario)
  assert.deepEqual(actual, expected, JSON.stringify(scenario))
  records.push({ scenario, trace: actual })
}
const a = modules.native.constraints,
  b = modules.upstream.constraints
let mathComparisons = 0
for (const min of [-20, 0, 5])
  for (const max of [10, 40])
    for (const value of [-50, 0, 20, 80])
      for (const elastic of [false, true, 0.2, { left: 0.1, right: 0.8 }]) {
        assert.deepEqual(a.nativeDragElastic(elastic), b.resolveDragElastic(elastic))
        const resolved = a.nativeDragElastic(elastic)
        assert.equal(
          a.applyNativeDragConstraints(value, { min, max }, resolved.x),
          b.applyConstraints(value, { min, max }, resolved.x),
        )
        mathComparisons += 2
      }
const result = {
  scope:
    "Actual pinned drag controls/constraints versus the private native adapter. Explicit native query/ref/event models and inert upstream subscription/projection targets; inertia option selection is compared, while existing generator and new source tests cover playback. No installed native geometry, rendering, delivery or performance proof.",
  comparisons: records.length,
  mathComparisons,
  graphs,
  nativeActions: 0,
  records,
}
await writeFile("/private/tmp/codon-native-card-drag-oracle.json", JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ ...result, records: `${records.length} exact traces stored outside seals` }, null, 2))
