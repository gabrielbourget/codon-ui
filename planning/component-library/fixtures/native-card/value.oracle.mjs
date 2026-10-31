import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { realpath } from "node:fs/promises"
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
const dom = await realpath(path.join(repository, "node_modules/.pnpm/motion-dom@12.40.0/node_modules/motion-dom"))
const utils = await realpath(path.join(repository, "node_modules/.pnpm/motion-utils@12.39.0/node_modules/motion-utils"))
const modules = {},
  graphs = {}
const sources = {
  upstream: `export {animateMotionValue as animateValue} from ${JSON.stringify(dom + "/dist/es/animation/interfaces/motion-value.mjs")};export {AsyncMotionValueAnimation as ValueAnimation} from ${JSON.stringify(dom + "/dist/es/animation/AsyncMotionValueAnimation.mjs")};export {KeyframeResolver} from ${JSON.stringify(dom + "/dist/es/animation/keyframes/KeyframesResolver.mjs")};export {motionValue,frame,frameData,time} from ${JSON.stringify(dom + "/dist/es/index.mjs")};export {MotionGlobalConfig} from ${JSON.stringify(utils + "/dist/es/index.mjs")}`,
  native: `export {animateNativeMotionValue as animateValue,NativeValueAnimation as ValueAnimation} from ${JSON.stringify(path.join(repository, "packages/react-native/src/motion/value/index.ts"))};export {motionValue,frame,frameData,time,MotionGlobalConfig} from ${JSON.stringify(path.join(repository, "packages/react-native/src/motion/kernel/index.ts"))}`,
}
for (const [name, contents] of Object.entries(sources)) {
  const result = await build({
    absWorkingDir: repository,
    stdin: { contents, resolveDir: repository, sourcefile: `card-value-${name}.mjs` },
    bundle: true,
    write: false,
    metafile: true,
    format: "esm",
    platform: "neutral",
    logLevel: "silent",
    define: {
      __DEV__: "true",
      requestAnimationFrame: "fixtureRequestFrame",
      ...(name === "upstream" ? { window: "fixtureWindow", HTMLElement: "FixtureHTMLElement" } : {}),
    },
    footer: { js: `//# sourceURL=card-value-${name}.mjs` },
    banner: {
      js:
        (name === "upstream" ? "class FixtureHTMLElement {};" : "") +
        "const fixtureWindow={};const fixtureFrames=new Map();let nextFrame=0;const fixtureRequestFrame=callback=>{fixtureFrames.set(++nextFrame,callback);return nextFrame};export {fixtureFrames};",
    },
  })
  const code = result.outputFiles[0].text
  modules[name] = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`)
  const retained = Object.values(result.metafile.outputs).flatMap((output) =>
    Object.entries(output.inputs)
      .filter(([, input]) => input.bytesInOutput)
      .map(([file]) => file),
  )
  graphs[name] = {
    discoveredInputs: Object.keys(result.metafile.inputs).length,
    retainedInputs: retained.length,
    retained,
    bundleSha256: createHash("sha256").update(code).digest("hex"),
  }
  if (name === "native") {
    assert.ok(retained.every((file) => file.startsWith("packages/react-native/src/motion/")))
    const tree = ts.createSourceFile("native.js", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
    assert.equal(tree.parseDiagnostics.length, 0)
    const forbidden = new Set([
      "document",
      "window",
      "HTMLElement",
      "SVGElement",
      "IntersectionObserver",
      "getComputedStyle",
      "WAAPI",
    ])
    const visit = (node) => {
      if ((ts.isIdentifier(node) || ts.isStringLiteralLike(node)) && forbidden.has(node.text))
        assert.fail(`Native runtime retained ${node.text}`)
      ts.forEachChild(node, visit)
    }
    visit(tree)
  }
}
const clone = (value) =>
  value === undefined
    ? null
    : JSON.parse(
        JSON.stringify(value, (_key, item) => (typeof item === "number" ? Math.round(item * 1e8) / 1e8 : item)),
      )
const context = {
  isCurrent: () => true,
  readValue: () => {
    throw new Error("fixture has no actual native geometry")
  },
  resolveColors: (colors) => colors,
}
const setTime = (module, timestamp) => {
  module.frameData.timestamp = timestamp
  module.time.set(timestamp)
}
const flush = async (module, timestamp) => {
  setTime(module, timestamp)
  const callbacks = [...module.fixtureFrames.values()]
  module.fixtureFrames.clear()
  callbacks.forEach((callback) => callback(timestamp))
  for (let i = 0; i < 6; i++) await Promise.resolve()
}
const records = []
const compare = async (label, run) => {
  const traces = {}
  for (const [name, module] of Object.entries(modules)) {
    module.MotionGlobalConfig.useManualTiming = true
    setTime(module, 1000)
    traces[name] = await run(module, name)
    await flush(module, 11000)
    module.fixtureFrames.clear()
    module.MotionGlobalConfig.useManualTiming = false
  }
  assert.deepEqual(traces.native, traces.upstream, label)
  records.push({ label, sha256: createHash("sha256").update(JSON.stringify(traces.native)).digest("hex") })
}
const transitions = [
  {},
  { duration: 0.1, ease: "linear" },
  { type: "spring", stiffness: 170, damping: 24 },
  { type: "spring", duration: 0.2, bounce: 0.3 },
  { type: "tween", duration: 0.12, ease: [0.4, 0, 0.2, 1] },
  { duration: 0.1, delay: 0.04 },
  { duration: 0.1, repeat: 1, repeatType: "reverse" },
  { duration: 0.1, repeat: 2, repeatType: "mirror", repeatDelay: 0.02 },
  { type: false },
  { duration: 0 },
  { duration: 0, delay: 0.08 },
  { duration: 0.1, from: 20 },
  { duration: 0.1, elapsed: 40 },
  { duration: 0.1, skipAnimations: true },
]
const values = [
  { name: "x", initial: 0, target: 100 },
  { name: "opacity", initial: 0.2, target: 0.8 },
  { name: "width", initial: "10%", target: "80%" },
  { name: "rotate", initial: "0deg", target: "90deg" },
  { name: "x", initial: 10, target: [null, 100] },
  { name: "zIndex", initial: 0, target: 5 },
  { name: "opacity", initial: 0.5, target: 0.5 },
]
for (const [transitionIndex, transition] of transitions.entries())
  for (const specification of values) {
    if (transition.from !== undefined && typeof specification.initial === "string") continue
    await compare(
      `factory ${specification.name}/${JSON.stringify(specification.target)} transition ${transitionIndex}`,
      async (module, name) => {
        const trace = [],
          value = module.motionValue(specification.initial)
        const selected = {
          ...transition,
          onUpdate: (latest) => trace.push(["update", clone(latest)]),
          onPlay: () => trace.push(["play"]),
          onComplete: () => trace.push(["complete"]),
          onStop: () => trace.push(["stop"]),
        }
        const control = module.animateValue(
          specification.name,
          value,
          specification.target,
          selected,
          name === "native" ? context : undefined,
        )(() => trace.push(["owner-complete"]))
        if (control?.ready) await control.ready
        for (const delta of [0, 16, 40, 80, 120, 200, 400, 800, 1600, 3200]) {
          await flush(module, 1000 + delta)
          trace.push(["sample", delta, clone(value.get()), control?.state ?? null])
        }
        if (control) trace.push(["metadata", control.duration, control.iterationDuration, control.speed, control.state])
        control?.stop()
        value.destroy()
        return clone(trace)
      },
    )
  }
for (const action of [
  "pause-seek-play",
  "cancel-play",
  "stop-play",
  "complete",
  "replay",
  "reverse",
  "timeline",
  "stop-pause",
  "stop-complete",
  "stop-cancel",
  "stop-seek",
]) {
  await compare(`resolved playback ${action}`, async (module, name) => {
    const value = module.motionValue(0),
      trace = []
    const control = module.animateValue(
      "x",
      value,
      100,
      { duration: 0.1, ease: "linear" },
      name === "native" ? context : undefined,
    )(() => trace.push(["complete"]))
    if (control.ready) await control.ready
    let done = false
    void control.finished.then(() => {
      done = true
    })
    await flush(module, 1040)
    trace.push(["before", value.get(), control.state, done])
    if (action === "pause-seek-play") {
      control.pause()
      control.time = 0.02
      control.speed = 2
      control.play()
    }
    if (action === "cancel-play") {
      control.cancel()
      trace.push(["cancel", value.get()])
      control.play()
    }
    if (action === "stop-play") {
      control.stop()
      control.play()
    }
    if (action.startsWith("stop-")) {
      control.stop()
      if (action === "stop-pause") control.pause()
      if (action === "stop-complete") control.complete()
      if (action === "stop-cancel") control.cancel()
      if (action === "stop-seek") control.time = 0.07
    }
    if (action === "complete") control.complete()
    if (action === "reverse") control.speed = -1
    if (action === "replay") {
      await flush(module, 1100)
      const previous = control.finished
      control.play()
      trace.push(["new-promise", previous !== control.finished])
      done = false
      void control.finished.then(() => {
        done = true
      })
    }
    if (action === "timeline") {
      const release = control.attachTimeline({
        observe: (animation) => {
          trace.push(["observed", animation.duration])
          return () => trace.push(["unobserved"])
        },
      })
      release()
    }
    for (const timestamp of [1120, 1160, 1200, 1300]) {
      await flush(module, timestamp)
      trace.push([timestamp, value.get(), control.state, done, control.time])
    }
    control.stop()
    value.destroy()
    return clone(trace)
  })
}
for (const delay of [20, 40, 41, 100])
  await compare(`asynchronous resolution ${delay}ms`, async (module, name) => {
    const trace = [],
      value = module.motionValue("rgba(255, 0, 0, 1)")
    let resolve
    let element
    if (name === "upstream") {
      class DeferredResolver extends module.KeyframeResolver {
        scheduleResolve() {
          resolve = () => {
            this.readKeyframes()
            this.complete()
          }
        }
      }
      element = { KeyframeResolver: DeferredResolver }
    }
    const control = new module.ValueAnimation({
      keyframes: ["rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)"],
      motionValue: value,
      name: "color",
      duration: 100,
      ease: "linear",
      element,
      context: {
        ...context,
        resolveColors: (colors) =>
          new Promise((accept) => {
            resolve = () => accept(colors)
          }),
      },
      onUpdate: (latest) => {
        value.set(latest)
        trace.push(["update", latest])
      },
      onComplete: () => trace.push(["complete"]),
    })
    setTime(module, 1000 + delay)
    resolve()
    if (control.ready) await control.ready
    for (const timestamp of [1000 + delay, 1050 + delay, 1100 + delay]) {
      await flush(module, timestamp)
      trace.push(["sample", timestamp, value.get(), control.state, control.startTime])
    }
    control.stop()
    value.destroy()
    return clone(trace)
  })
for (const specification of [
  {
    name: "transform",
    keyframes: [
      [{ translateX: 0 }, { scale: 1 }],
      [{ translateX: 100 }, { scale: 3 }],
    ],
  },
  { name: "transform", keyframes: [[{ matrix: [1, 0, 0, 1, 0, 0] }], [{ matrix: [2, 0, 0, 2, 100, 100] }]] },
  {
    name: "boxShadow",
    keyframes: [[{ offsetX: 0, color: "rgba(255, 0, 0, 1)" }], [{ offsetX: 20, color: "rgba(0, 0, 255, 1)" }]],
  },
  { name: "color", keyframes: ["rgba(255, 0, 0, 1)"] },
])
  await compare(`structured/single native value ${JSON.stringify(specification)}`, async (module, name) => {
    const trace = [],
      value = module.motionValue(specification.keyframes[0])
    const control = new module.ValueAnimation({
      ...specification,
      motionValue: value,
      duration: 100,
      ease: "linear",
      context,
      onUpdate: (latest) => {
        value.set(latest)
        trace.push(["update", clone(latest)])
      },
    })
    if (control.ready) await control.ready
    for (const timestamp of [1000, 1025, 1050, 1075, 1100]) {
      await flush(module, timestamp)
      trace.push(["sample", timestamp, clone(value.get()), control.state])
    }
    control.stop()
    value.destroy()
    return trace
  })
console.log(
  JSON.stringify(
    {
      scope:
        "Actual pinned value wrapper/factory versus native backend; injected source-only color/read providers, no installed geometry or native sample proof",
      comparisons: records.length,
      records,
      graphs,
      nativeActions: 0,
    },
    null,
    2,
  ),
)
