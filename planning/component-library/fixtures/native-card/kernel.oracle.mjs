import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, realpath } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const reactRequire = createRequire(path.join(repository, "packages/react/package.json"))
const viteRequire = createRequire(
  createRequire(reactRequire.resolve("vitest/package.json")).resolve("vite/package.json"),
)
const { build } = viteRequire("esbuild")
const engineRoot = await realpath(
  path.join(repository, "node_modules/.pnpm/motion-dom@12.40.0/node_modules/motion-dom"),
)
const utilsRoot = await realpath(
  path.join(repository, "node_modules/.pnpm/motion-utils@12.39.0/node_modules/motion-utils"),
)
const manifest = JSON.parse(
  await readFile(path.join(repository, "packages/react-native/src/motion/kernel/UPSTREAM.json")),
)
const sources = {
  upstream: `export * from ${JSON.stringify(engineRoot + "/dist/es/index.mjs")}; export {createRenderBatcher} from ${JSON.stringify(engineRoot + "/dist/es/frameloop/batcher.mjs")}; export {frameloopDriver} from ${JSON.stringify(engineRoot + "/dist/es/animation/drivers/frame.mjs")}; export {MotionGlobalConfig,SubscriptionManager} from ${JSON.stringify(utilsRoot + "/dist/es/index.mjs")}`,
  native: `export * from ${JSON.stringify(path.join(repository, "packages/react-native/src/motion/kernel/index.ts"))}`,
}
const modules = {}
const graphs = {}
for (const [name, source] of Object.entries(sources)) {
  const result = await build({
    absWorkingDir: repository,
    stdin: { contents: source, resolveDir: repository, sourcefile: `card-kernel-${name}.mjs` },
    platform: "neutral",
    format: "esm",
    bundle: true,
    write: false,
    metafile: true,
    logLevel: "silent",
    define: { __DEV__: "true", requestAnimationFrame: "fixtureRequestFrame" },
    banner: {
      js: "const fixtureFrameQueue = new Map(); let fixtureFrameId = 0; const fixtureRequestFrame = callback => {fixtureFrameQueue.set(++fixtureFrameId,callback);return fixtureFrameId}; export {fixtureFrameQueue};",
    },
  })
  modules[name] = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`
  )
  const retained = Object.values(result.metafile.outputs).flatMap((output) =>
    Object.entries(output.inputs)
      .filter(([, entry]) => entry.bytesInOutput)
      .map(([file]) => file),
  )
  graphs[name] = {
    discoveredInputs: Object.keys(result.metafile.inputs).length,
    retainedInputs: retained.length,
    bundleSha256: createHash("sha256").update(result.outputFiles[0].contents).digest("hex"),
    retained,
  }
  if (name === "native") {
    assert(
      retained.every(
        (file) => file.startsWith("packages/react-native/src/motion/kernel/") || file === "card-kernel-native.mjs",
      ),
    )
    assert(
      !/\b(?:document|window|HTMLElement|SVGElement|IntersectionObserver|getComputedStyle)\b/.test(
        result.outputFiles[0].text,
      ),
    )
  }
}
for (const [name, expected] of Object.entries(manifest.packages)) {
  const installed = JSON.parse(
    await readFile(path.join(name === "motion-dom" ? engineRoot : utilsRoot, "package.json")),
  )
  assert.equal(installed.version, expected.version)
  assert.equal(installed.gitHead, expected.gitHead)
}
const clone = (value) => structuredClone(value)
let comparisons = 0
const cases = []
const compare = async (name, run) => {
  const expected = await run(modules.upstream)
  const actual = await run(modules.native)
  assert.deepEqual(actual, expected, name)
  comparisons++
  cases.push(name)
}
const times = [-20, 0, 1, 8, 16, 25, 50, 75, 100, 125, 150, 199, 200, 250, 300, 450, 600, 800, 1200, 2000, 5000, 20000]
const springs = [
  {},
  { stiffness: 120, damping: 5 },
  { stiffness: 100, damping: 20 },
  { stiffness: 80, damping: 40 },
  { stiffness: 250, damping: 25, mass: 2 },
  { duration: 350, bounce: 0.4 },
  { duration: 800, bounce: 0 },
  { duration: 450, bounce: 0.8, velocity: 700 },
  { duration: 500, visualDuration: 0.25, bounce: 0.3 },
  { stiffness: 100, duration: 350, bounce: 0.6 },
]
for (const [origin, target] of [
  [0, 100],
  [100, 0],
  [0, 1],
  [-20, 50],
  [4, 4],
]) {
  for (const options of springs) {
    for (const velocity of [0, -250, 650]) {
      await compare(`spring ${JSON.stringify([origin, target, options, velocity])}`, (kernel) => {
        const generator = kernel.spring({ ...options, keyframes: [origin, target], velocity })
        return times.map((time) => ({ time, ...clone(generator.next(time)), velocity: generator.velocity(time) }))
      })
    }
  }
}
for (const ease of [
  "linear",
  "easeIn",
  "easeOut",
  "easeInOut",
  "circIn",
  "circOut",
  "circInOut",
  "backIn",
  "backOut",
  "backInOut",
  "anticipate",
  [0.25, 0.1, 0.25, 1],
  (progress) => progress * progress,
]) {
  await compare(`easing ${String(ease)}`, (kernel) => {
    const animation = new kernel.JSAnimation({
      keyframes: [0, 25, 100],
      duration: 200,
      ease,
      autoplay: false,
      driver: () => ({ start() {}, stop() {}, now: () => 1000 }),
    })
    const samples = times.map((time) => clone(animation.sample(time)))
    animation.stop()
    return samples
  })
}
for (const options of [
  { duration: 300, bounce: 0.3 },
  { duration: 700, bounce: 0 },
  { stiffness: 120, damping: 25 },
]) {
  await compare(`spring easing conversion ${JSON.stringify(options)}`, (kernel) => {
    const converted = kernel.spring.applyToOptions({ ...options })
    return {
      type: converted.type,
      duration: converted.duration,
      values: [0, 0.1, 0.5, 0.9, 1].map(converted.ease),
      text: String(kernel.spring({ ...options, keyframes: [0, 1] })),
    }
  })
}
for (const repeatType of ["loop", "reverse", "mirror"]) {
  await compare(`infinite repeat ${repeatType}`, (kernel) => {
    const animation = new kernel.JSAnimation({
      keyframes: [0, 100],
      duration: 100,
      repeat: Infinity,
      repeatDelay: 30,
      repeatType,
      ease: "linear",
      autoplay: false,
      driver: () => ({ start() {}, stop() {}, now: () => 1000 }),
    })
    const samples = times.map((time) => clone(animation.sample(time)))
    animation.stop()
    return samples
  })
}
for (const options of [
  { velocity: 500 },
  { velocity: -500 },
  { velocity: 0 },
  { velocity: 2000, power: 0.4, timeConstant: 500 },
  { velocity: 1000, max: 120 },
  { velocity: -1000, min: -60 },
  { velocity: 1000, min: -50, max: 100, bounceDamping: 30, bounceStiffness: 200 },
  { velocity: -350, modifyTarget: (value) => Math.round(value / 50) * 50 },
]) {
  for (const origin of [-100, 0, 150]) {
    await compare(`inertia ${origin} ${JSON.stringify(options)}`, (kernel) => {
      const generator = kernel.inertia({ ...options, keyframes: [origin] })
      return times.map((time) => clone(generator.next(time)))
    })
  }
}
for (const keyframes of [
  [0, 100],
  [100, -20],
  [0, 75, 40, 100],
  ["0px", "100px"],
  ["#f00", "#00f"],
  ["10%", "75%"],
]) {
  for (const type of ["tween", "spring"]) {
    if (type === "spring" && keyframes.length > 2) continue
    for (const repeatType of ["loop", "reverse", "mirror"]) {
      for (const delay of [0, 40]) {
        for (const repeatDelay of [0, 50]) {
          await compare(`sample ${JSON.stringify({ keyframes, type, repeatType, delay, repeatDelay })}`, (kernel) => {
            kernel.time.set(1000)
            const animation = new kernel.JSAnimation({
              keyframes: [...keyframes],
              type,
              duration: 200,
              bounce: 0.25,
              ease: "linear",
              repeat: 2,
              repeatType,
              repeatDelay,
              delay,
              autoplay: false,
              driver: () => ({ start() {}, stop() {}, now: () => 1000 }),
            })
            const samples = times.map((time) => clone(animation.sample(time)))
            const duration = animation.duration
            const iterationDuration = animation.iterationDuration
            animation.stop()
            return { samples, duration, iterationDuration }
          })
        }
      }
    }
  }
}
for (const [from, to] of [
  [0, 10],
  ["0px", "20px"],
  ["#f008", "#00ff"],
  ["hsl(10, 50%, 25%)", "rgba(200, 50, 10, 0.5)"],
  [
    [0, "#f00"],
    [100, "#00f"],
  ],
  [
    { x: 0, opacity: 1 },
    { x: 20, y: 30, opacity: 0 },
  ],
  ["translate(0px, 20px) rgba(255,0,0,1)", "translate(100px, 0px) rgba(0,0,255,0.5)"],
  ["none", "block"],
  ["hidden", "visible"],
  ["var(--a)", "var(--b)"],
]) {
  await compare(`mix ${JSON.stringify([from, to])}`, (kernel) => {
    const mixer = kernel.mix(clone(from), clone(to))
    return [-0.5, 0, 0.1, 0.25, 0.5, 0.75, 1, 1.5].map((progress) => clone(mixer(progress)))
  })
}
for (const input of [
  [0, 1],
  [1, 0],
  [0, 0, 1],
  [0, 0.4, 0.6, 1],
]) {
  for (const clamp of [true, false]) {
    await compare(`interpolate ${input} clamp=${clamp}`, (kernel) => {
      const interpolate = kernel.interpolate(
        input,
        input.map((_, index) => index * 50),
        { clamp, ease: (value) => value * value },
      )
      return [-1, 0, 0.1, 0.4, 0.5, 0.6, 1, 2].map(interpolate)
    })
  }
}
const playback = async (kernel, ending) => {
  let clock = 1000
  let update
  let active = false
  let keepAlive = true
  const trace = []
  const driver = (callback) => {
    update = callback
    return {
      now: () => clock,
      start: (keep = true) => {
        active = true
        keepAlive = keep
        trace.push(["driver.start", keep])
      },
      stop: () => {
        active = false
        trace.push(["driver.stop"])
      },
    }
  }
  const advance = (timestamp) => {
    clock = timestamp
    kernel.time.set(clock)
    if (active) {
      if (!keepAlive) active = false
      update(clock)
    }
  }
  kernel.time.set(clock)
  const animation = new kernel.JSAnimation({
    keyframes: [10, 110],
    duration: 200,
    delay: 20,
    type: "tween",
    ease: "linear",
    driver,
    onUpdate: (value) => trace.push(["update", value]),
    onPlay: () => trace.push(["play"]),
    onStop: () => trace.push(["stop"]),
    onCancel: () => trace.push(["cancel"]),
    onComplete: () => trace.push(["complete"]),
    onRepeat: () => trace.push(["repeat"]),
  })
  let settled = false
  animation.finished.then(() => {
    settled = true
    trace.push(["finished"])
  })
  const snapshot = (label) =>
    trace.push([
      label,
      animation.state,
      animation.time,
      animation.speed,
      animation.startTime,
      animation.duration,
      settled,
    ])
  advance(1050)
  snapshot("first")
  animation.pause()
  advance(1080)
  snapshot("paused")
  animation.time = 0.08
  advance(1080)
  snapshot("seek")
  animation.play()
  advance(1100)
  snapshot("resumed")
  animation.speed = 2
  advance(1120)
  snapshot("double")
  animation.speed = -1
  advance(1140)
  snapshot("reverse")
  animation.speed = 0
  advance(1160)
  snapshot("zero")
  animation.speed = 1
  animation[ending]()
  advance(1500)
  await Promise.resolve()
  await Promise.resolve()
  snapshot(ending)
  animation.play()
  advance(1800)
  await Promise.resolve()
  await Promise.resolve()
  snapshot("play-after-ending")
  animation.stop()
  return trace
}
for (const ending of ["stop", "cancel", "complete"])
  await compare(`playback ${ending}`, (kernel) => playback(kernel, ending))
await compare("value velocity/change/passive/dependent/destroy", (kernel) => {
  const trace = []
  kernel.time.set(1000)
  const value = kernel.motionValue("0px")
  const record = (label) => trace.push([label, value.get(), value.getPrevious(), value.getVelocity()])
  const unsubscribe = value.on("change", (...args) => trace.push(["change", ...args]))
  record("initial")
  value.set("0px")
  kernel.time.set(1010)
  value.set("10px")
  record("ten")
  value.set("15px")
  record("same-frame")
  kernel.time.set(1020)
  value.set("35px")
  record("next-frame")
  kernel.time.set(1051)
  record("expired")
  value.setWithVelocity("10px", "30px", 20)
  record("explicit-velocity")
  value.attach(
    (incoming, setter) => setter(`${parseFloat(incoming) * 2}px`),
    () => trace.push(["passive-stop"]),
  )
  value.set("5px")
  record("passive")
  value.jump("7px")
  record("jump")
  unsubscribe()
  value.set("9px")
  record("unsubscribed")
  value.on("destroy", () => trace.push(["destroy"]))
  value.destroy()
  value.set("11px")
  record("after-destroy")
  return trace
})
for (const ending of ["finish", "interrupt", "destroy"]) {
  await compare(`value animation promise ${ending}`, async (kernel) => {
    kernel.time.set(1000)
    const value = kernel.motionValue(0)
    const trace = []
    for (const event of ["animationStart", "animationComplete", "animationCancel", "destroy"])
      value.on(event, (...args) => trace.push([event, ...args]))
    const start = (target) =>
      value.start(
        (resolve) =>
          new kernel.JSAnimation({
            keyframes: [value.get(), target],
            duration: 100,
            ease: "linear",
            driver: () => ({ start() {}, stop() {}, now: () => 1000 }),
            onUpdate: (latest) => value.set(latest),
            onComplete: resolve,
            motionValue: value,
          }),
      )
    let firstSettled = false
    const first = start(100).then(() => {
      firstSettled = true
      trace.push(["first.finished"])
    })
    value.animation.sample(40)
    if (ending === "interrupt") {
      start(200)
      value.animation.sample(100)
    } else if (ending === "destroy") value.destroy()
    else value.animation.sample(100)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    trace.push(["result", value.get(), value.isAnimating(), firstSettled])
    value.stop()
    void first
    return trace
  })
}
await compare("ordered frame phases, keepAlive, cancellation and immediate scheduling", (kernel) => {
  const trace = []
  const batches = []
  const batcher = kernel.createRenderBatcher((callback) => batches.push(callback), true)
  kernel.MotionGlobalConfig.useManualTiming = true
  const repeat = ({ timestamp }) => trace.push(["repeat", timestamp])
  const canceled = () => trace.push(["canceled"])
  for (const phase of [
    "setup",
    "read",
    "resolveKeyframes",
    "preUpdate",
    "update",
    "preRender",
    "render",
    "postRender",
  ]) {
    batcher.schedule[phase](() => {
      trace.push([phase])
      if (phase === "update") batcher.schedule.update(() => trace.push(["immediate"]), false, true)
    })
  }
  batcher.schedule.update(repeat, true)
  batcher.schedule.render(canceled)
  batcher.cancel(canceled)
  batcher.state.timestamp = 1000
  batches.shift()()
  batcher.state.timestamp = 1016
  batches.shift()()
  batcher.cancel(repeat)
  batcher.state.timestamp = 1032
  batches.shift()()
  kernel.MotionGlobalConfig.useManualTiming = false
  return trace
})
console.log(
  JSON.stringify(
    {
      scope: "Pinned source differential model; no installed native animation or frame-performance acceptance",
      comparisons,
      sampleTimes: times.length,
      cases,
      graphs,
      packages: manifest.packages,
      nativeActions: 0,
    },
    null,
    2,
  ),
)
