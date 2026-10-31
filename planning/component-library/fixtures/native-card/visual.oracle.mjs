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
const upstream = await realpath(path.join(repository, "node_modules/.pnpm/motion-dom@12.40.0/node_modules/motion-dom"))
const metadata = JSON.parse(await readFile(path.join(upstream, "package.json")))
assert.equal(metadata.version, "12.40.0")
assert.equal(metadata.gitHead, "38ebb9480e5b25a51e09e2ec866c101d01d82c60")
const utilsRoot = await realpath(
  path.join(repository, "node_modules/.pnpm/motion-utils@12.39.0/node_modules/motion-utils"),
)
const sources = {
  upstream: `export {buildTransform} from ${JSON.stringify(upstream + "/dist/es/render/html/utils/build-transform.mjs")}; export {buildHTMLStyles} from ${JSON.stringify(upstream + "/dist/es/render/html/utils/build-styles.mjs")}; export {transformPropOrder} from ${JSON.stringify(upstream + "/dist/es/render/utils/keys-transform.mjs")}; export {VisualElement} from ${JSON.stringify(upstream + "/dist/es/render/VisualElement.mjs")}; export {motionValue,frame,frameData,time} from ${JSON.stringify(upstream + "/dist/es/index.mjs")}; export {MotionGlobalConfig} from ${JSON.stringify(utilsRoot + "/dist/es/index.mjs")}`,
  native: `export * from ${JSON.stringify(path.join(repository, "packages/react-native/src/motion/visual/nativeTransform.ts"))}; export {NATIVE_MOTION_TRANSFORM_ORDER} from ${JSON.stringify(path.join(repository, "packages/react-native/src/motion/visual/types.ts"))}; export {NativeMotionVisualState} from ${JSON.stringify(path.join(repository, "packages/react-native/src/motion/visual/state.ts"))}; export {motionValue,frame,frameData,time,MotionGlobalConfig} from ${JSON.stringify(path.join(repository, "packages/react-native/src/motion/kernel/index.ts"))} `,
}
const modules = {},
  graphs = {}
for (const [name, source] of Object.entries(sources)) {
  const result = await build({
    stdin: { contents: source, resolveDir: repository, sourcefile: `card-visual-${name}.mjs` },
    absWorkingDir: repository,
    platform: "neutral",
    format: "esm",
    bundle: true,
    write: false,
    metafile: true,
    logLevel: "silent",
    define: { __DEV__: "true", requestAnimationFrame: "fixtureRequestFrame" },
    banner: {
      js: "const fixtureFrames = new Map();let frameID=0;const fixtureRequestFrame=cb=>{fixtureFrames.set(++frameID,cb);return frameID};export {fixtureFrames};",
    },
  })
  modules[name] = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`
  )
  const retained = Object.values(result.metafile.outputs).flatMap((output) =>
    Object.entries(output.inputs)
      .filter(([, entry]) => entry.bytesInOutput)
      .map(([key]) => key),
  )
  graphs[name] = {
    discoveredInputs: Object.keys(result.metafile.inputs).length,
    retainedInputs: retained.length,
    retained,
    sha256: createHash("sha256").update(result.outputFiles[0].contents).digest("hex"),
  }
  if (name === "native") {
    assert(
      retained.every(
        (entry) => entry.startsWith("packages/react-native/src/motion/") || entry === "card-visual-native.mjs",
      ),
    )
    assert(
      !/\b(?:document|window|HTMLElement|SVGElement|IntersectionObserver|getComputedStyle)\b/.test(
        result.outputFiles[0].text,
      ),
    )
  }
}
assert.deepEqual(modules.native.NATIVE_MOTION_TRANSFORM_ORDER, modules.upstream.transformPropOrder)
const nativeCommands = (transforms) =>
  transforms.map((transform) => {
    const [key, value] = Object.entries(transform)[0]
    if (key === "matrix") return ["translateZ", value[14]]
    return [key, value]
  })
const cssCommands = (value) =>
  value === "none"
    ? []
    : [...value.matchAll(/(\w+)\(([^)]+)\)/g)].map(([, key, argument]) => [
        key === "skew" ? "skewX" : key,
        key.startsWith("rotate") || key.startsWith("skew") || argument.endsWith("%") ? argument : parseFloat(argument),
      ])
const nativeTemplateValues = (values) =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      key.startsWith("rotate") || key.startsWith("skew") || (typeof value === "string" && value.endsWith("%"))
        ? value
        : parseFloat(value),
    ]),
  )
let comparisons = 0
const check = (latest) => {
  const expected = modules.upstream.buildTransform(latest, {})
  const actual = modules.native.buildNativeMotionTransform(latest)
  assert.deepEqual(nativeCommands(actual), cssCommands(expected), JSON.stringify(latest))
  comparisons++
  let expectedValues, expectedGenerated, actualValues, actualGenerated
  modules.upstream.buildTransform(latest, {}, (values, generated) => {
    expectedValues = structuredClone(values)
    expectedGenerated = generated
    return generated
  })
  modules.native.buildNativeMotionTransform(latest, (values, generated) => {
    actualValues = structuredClone(values)
    actualGenerated = structuredClone(generated)
    return generated
  })
  assert.deepEqual(actualValues, nativeTemplateValues(expectedValues), `template values ${JSON.stringify(latest)}`)
  assert.deepEqual(
    nativeCommands(actualGenerated),
    cssCommands(expectedGenerated),
    `template generated ${JSON.stringify(latest)}`,
  )
  comparisons++
}
const samples = {
  transformPerspective: [0, 500, 1000],
  x: [0, 12, -10, "25%", "0%"],
  y: [0, 15, -5, "50%"],
  z: [0, 10, -20],
  translateX: [0, 4, "75%"],
  translateY: [0, -10, "-25%"],
  translateZ: [0, 35],
  scale: [1, 0, 2, -1],
  scaleX: [1, 0.5],
  scaleY: [1, 1.5],
  rotate: [0, 20, "0deg", "0.2rad"],
  rotateX: [0, -20],
  rotateY: [0, 15],
  rotateZ: [0, 5],
  skew: [0, "10deg"],
  skewX: [0, "0.1rad"],
  skewY: [0, -5],
  pathRotation: [0, 10],
}
check({})
for (const [key, values] of Object.entries(samples)) for (const value of values) check({ [key]: value })
let seed = 0xca4d012
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed
}
for (let index = 0; index < 512; index++) {
  const latest = {}
  for (const [key, values] of Object.entries(samples)) if (random() % 3) latest[key] = values[random() % values.length]
  check(latest)
}
for (const originX of [undefined, 0, 0.25, 1, "25%"]) {
  for (const originY of [undefined, 0, 0.75, 1, "50%"]) {
    for (const originZ of [undefined, 0, -10, 30]) {
      const latest = { originX, originY, originZ }
      const state = { style: {}, transform: {}, transformOrigin: {}, vars: {} }
      modules.upstream.buildHTMLStyles(state, latest)
      const actual = modules.native.buildNativeMotionOrigin(latest)
      const [x, y, z] = state.style.transformOrigin.split(" ")
      assert.deepEqual(actual, [x, y, parseFloat(z)])
      comparisons++
    }
  }
}
const bindingCases = []
const bindingTrace = async (kernel, native, scenario) => {
  kernel.MotionGlobalConfig.useManualTiming = true
  kernel.frameData.timestamp = 1000
  kernel.time.set(1000)
  const x = kernel.motionValue(0),
    opacity = kernel.motionValue(1),
    replacement = kernel.motionValue(15)
  const trace = []
  const update = (...args) => trace.push(["update", structuredClone(args)])
  const freshUpdate = (...args) => trace.push(["fresh-update", structuredClone(args)])
  let visual
  const configure = (bindings, callback = update) => {
    if (native) visual.configure(bindings, callback)
    else visual.update({ bindings, onUpdate: callback }, null)
  }
  if (native) {
    visual = new kernel.NativeMotionVisualState({ x, opacity }, update)
    visual.attach()
    visual.subscribe(() => trace.push(["render", structuredClone(visual.getSnapshot())]))
  } else {
    class OracleVisual extends kernel.VisualElement {
      type = "binding-oracle-only"
      scrapeMotionValuesFromProps(props) {
        return props.bindings ?? {}
      }
      build(state, latest) {
        state.latest = { ...latest }
      }
      removeValueFromRenderState(key, state) {
        if (state.latest) delete state.latest[key]
      }
      renderInstance(_instance, state) {
        trace.push(["render", structuredClone(state.latest)])
      }
    }
    visual = new OracleVisual({
      props: { bindings: { x, opacity }, onUpdate: update },
      visualState: { latestValues: {}, renderState: {} },
      reducedMotionConfig: "never",
    })
    visual.mount({})
  }
  const flush = () => {
    kernel.frameData.timestamp += 16
    const callbacks = [...kernel.fixtureFrames.values()]
    kernel.fixtureFrames.clear()
    callbacks.forEach((callback) => callback(kernel.frameData.timestamp))
  }
  const detach = () => (native ? visual.detach() : visual.unmount())
  trace.length = 0
  if (scenario === "batch") {
    x.set(5)
    opacity.set(0.5)
    x.set(10)
    flush()
  }
  if (scenario === "current-callback") {
    x.set(10)
    configure({ x, opacity }, freshUpdate)
    trace.length = 0
    flush()
  }
  if (scenario === "replacement") {
    configure({ x: replacement, opacity })
    trace.length = 0
    x.set(100)
    replacement.set(25)
    flush()
  }
  if (scenario === "detach") {
    x.set(10)
    detach()
    flush()
  }
  if (scenario === "remount") {
    detach()
    if (native) visual.attach()
    else visual.mount({})
    trace.length = 0
    x.set(20)
    flush()
  }
  detach()
  flush()
  kernel.MotionGlobalConfig.useManualTiming = false
  await Promise.resolve()
  return trace
}
for (const scenario of ["batch", "current-callback", "replacement", "detach", "remount"]) {
  const expected = await bindingTrace(modules.upstream, false, scenario).catch((error) => {
    throw new Error(`Upstream binding oracle ${scenario}: ${error.message}`)
  })
  const actual = await bindingTrace(modules.native, true, scenario).catch((error) => {
    throw new Error(`Native binding oracle ${scenario}: ${error.message}`)
  })
  assert.deepEqual(actual, expected, `actual VisualElement binding trace: ${scenario}`)
  comparisons++
  bindingCases.push(scenario)
}

const sourceRefs = []
for (const relative of [
  "render/html/utils/build-transform",
  "render/html/utils/build-styles",
  "render/utils/keys-transform",
  "render/VisualElement",
]) {
  const sourceMap = JSON.parse(await readFile(path.join(upstream, "dist/es", relative + ".mjs.map")))
  const original = sourceMap.sourcesContent[0]
  sourceRefs.push({
    sourceRef: `https://github.com/motiondivision/motion/blob/${metadata.gitHead}/packages/motion-dom/src/${relative}.ts`,
    sha256: createHash("sha256").update(original).digest("hex"),
  })
}
console.log(
  JSON.stringify(
    {
      scope:
        "Actual pinned transform/origin and VisualElement binding comparison; test-only abstract renderer, no native geometry/raster/performance acceptance",
      comparisons,
      mixedVectors: 512,
      bindingCases,
      graphs,
      sourceRefs,
      nativeActions: 0,
    },
    null,
    2,
  ),
)
