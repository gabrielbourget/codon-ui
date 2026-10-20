import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, realpath, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const reactRequire = createRequire(path.join(repository, "packages/react/package.json"))
const viteRequire = createRequire(
  createRequire(reactRequire.resolve("vitest/package.json")).resolve("vite/package.json"),
)
const { build } = viteRequire("esbuild")
const ts = createRequire(path.join(repository, "packages/react-native/package.json"))("typescript")
const framer = path.dirname(
  createRequire(reactRequire.resolve("motion/package.json")).resolve("framer-motion/package.json"),
)
const dom = await realpath(path.join(repository, "node_modules/.pnpm/motion-dom@12.40.0/node_modules/motion-dom"))
const utils = await realpath(path.join(repository, "node_modules/.pnpm/motion-utils@12.39.0/node_modules/motion-utils"))
const modules = {},
  graphs = {}
const entries = {
  upstream: `export {PanSession} from ${JSON.stringify(framer + "/dist/es/gestures/pan/PanSession.mjs")};export {frameData} from ${JSON.stringify(dom + "/dist/es/index.mjs")};export {MotionGlobalConfig} from ${JSON.stringify(utils + "/dist/es/index.mjs")}`,
  native: `export {NativePanSession as PanSession} from ${JSON.stringify(path.join(repository, "packages/react-native/src/motion/interactions/NativePanSession.ts"))};export {frameData,MotionGlobalConfig} from ${JSON.stringify(path.join(repository, "packages/react-native/src/motion/kernel/index.ts"))}`,
}
for (const [name, contents] of Object.entries(entries)) {
  const result = await build({
    absWorkingDir: repository,
    stdin: { contents, resolveDir: repository, sourcefile: `card-pan-${name}.mjs` },
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    metafile: true,
    logLevel: "silent",
    define: {
      __DEV__: "true",
      requestAnimationFrame: "fixtureRequestFrame",
      ...(name === "upstream" ? { window: "fixtureWindow" } : {}),
    },
    banner: {
      js: "const fixtureWindow={addEventListener(){},removeEventListener(){}};const fixtureFrames=new Map();let nextFrame=0;const fixtureRequestFrame=callback=>{fixtureFrames.set(++nextFrame,callback);return nextFrame};export {fixtureFrames};",
    },
  })
  modules[name] = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`
  )
  const retained = Object.values(result.metafile.outputs).flatMap((output) =>
    Object.entries(output.inputs)
      .filter(([, value]) => value.bytesInOutput)
      .map(([file]) => file),
  )
  graphs[name] = { retained, bundleSha256: createHash("sha256").update(result.outputFiles[0].contents).digest("hex") }
  if (name === "native") {
    assert(
      retained.every((file) => file.startsWith("packages/react-native/src/motion/") || file === "card-pan-native.mjs"),
    )
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
      "native-pan.js",
      result.outputFiles[0].text,
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
}
const point = (x, y) => ({ x, y })
const run = (kernel, native, scenario) => {
  kernel.MotionGlobalConfig.useManualTiming = true
  kernel.frameData.timestamp = 1000
  const trace = [],
    errors = []
  let angle = 0
  const transformPagePoint =
    scenario.transform === "scale"
      ? (value) => point(value.x * 2, value.y * 3)
      : scenario.transform === "rotate"
        ? (value) =>
            point(
              value.x * Math.cos(angle) - value.y * Math.sin(angle),
              value.x * Math.sin(angle) + value.y * Math.cos(angle),
            )
        : undefined
  const event = (type, coordinates, id = "event") => {
    const data = {
      type,
      pageX: coordinates[0],
      pageY: coordinates[1],
      pointerId: 7,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
    }
    return native
      ? {
          id,
          nativeEvent:
            scenario.transport === "touch"
              ? { pageX: coordinates[0], pageY: coordinates[1], identifier: 7, touches: [{ identifier: 7 }] }
              : data,
          persist() {},
        }
      : { id, ...data }
  }
  const handlers = Object.fromEntries(
    ["onSessionStart", "onStart", "onMove", "onEnd", "onSessionEnd"].map((name) => [
      name,
      (original, info) => trace.push({ phase: name, event: original.id, info: structuredClone(info) }),
    ]),
  )
  handlers.resumeAnimation = () => trace.push({ phase: "resume" })
  const session = new kernel.PanSession(event("pointerdown", [10, 20], "down"), handlers, {
    transformPagePoint,
    dragSnapToOrigin: scenario.snap,
    distanceThreshold: scenario.threshold,
    ...(native ? { isCurrent: () => true, onError: (error) => errors.push(String(error)) } : {}),
  })
  const flush = (timestamp) => {
    kernel.frameData.timestamp = timestamp
    const pending = [...kernel.fixtureFrames.values()]
    kernel.fixtureFrames.clear()
    pending.forEach((callback) => callback(timestamp))
  }
  for (const [index, step] of scenario.steps.entries()) {
    if (step.move) {
      const original = event("pointermove", step.move, `move-${index}`)
      if (native) session.move(original)
      else session.handlePointerMove(original, { point: point(...step.move) })
    }
    if (step.angle !== undefined) angle = step.angle
    if (step.time !== undefined) flush(step.time)
  }
  const original = event(scenario.cancel ? "pointercancel" : "pointerup", scenario.end, "end")
  if (native) session.finish(original, scenario.cancel)
  else session.handlePointerUp(original, { point: point(...scenario.end) })
  session.end()
  flush(6000)
  kernel.fixtureFrames.clear()
  kernel.MotionGlobalConfig.useManualTiming = false
  assert.deepEqual(errors, [])
  return trace
}
const profiles = {
  click: [],
  below: [{ move: [11, 21], time: 1016 }],
  threshold: [{ move: [13, 20], time: 1016 }],
  coalesced: [{ move: [11, 21] }, { move: [20, 25], time: 1016 }, { move: [25, 30], time: 1032 }],
  held: [
    { move: [20, 20], time: 2000 },
    { move: [30, 20], time: 2010 },
    { move: [40, 20], time: 2020 },
  ],
  idle: [{ move: [20, 25], time: 1016 }, { time: 1032 }, { time: 1048 }, { time: 1200 }],
  transform: [
    { move: [20, 25], time: 1016 },
    { angle: Math.PI / 2, time: 1032 },
    { angle: Math.PI, time: 1048 },
  ],
  beforeFrame: [{ move: [20, 25] }],
}
let comparisons = 0
const records = []
for (const [profile, steps] of Object.entries(profiles))
  for (const transport of ["pointer", "touch"])
    for (const transform of ["none", "scale", "rotate"])
      for (const threshold of [0, 3, 10])
        for (const cancel of [false, true])
          for (const snap of [false, true]) {
            const scenario = { steps, transform, threshold, cancel, snap, transport, end: [45, 35] }
            const expected = run(modules.upstream, false, scenario),
              actual = run(modules.native, true, scenario)
            assert.deepEqual(actual, expected, `${profile}/${transform}/${threshold}/${cancel}/${snap}`)
            comparisons++
            records.push({ profile, transport, transform, threshold, cancel, snap, trace: actual })
          }
const sourceMap = JSON.parse(await readFile(framer + "/dist/es/gestures/pan/PanSession.mjs.map", "utf8"))
const result = {
  scope:
    "Actual pinned PanSession versus native source adapter, with explicit point/event/frame models and inert upstream subscription targets. This does not exercise native event delivery, native geometry or hardware.",
  comparisons,
  graphs,
  pinnedPanSourceSha256: createHash("sha256").update(sourceMap.sourcesContent[0]).digest("hex"),
  nativeActions: 0,
  records,
}
await writeFile("/private/tmp/codon-native-card-pan-oracle.json", JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ ...result, records: `${records.length} exact traces stored outside seals` }, null, 2))
