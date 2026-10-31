import assert from "node:assert/strict"
import { mkdtemp, readdir, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

// Actual pinned feature/source comparison with explicit IO/ref/frame models.
// No browser, native Fabric query, rendering or installed acceptance executes.
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const reactRequire = createRequire(path.join(repository, "packages/react/package.json"))
const viteRequire = createRequire(
  createRequire(reactRequire.resolve("vitest/package.json")).resolve("vite/package.json"),
)
const { build } = viteRequire("esbuild")
const output = await mkdtemp("/private/tmp/codon-native-viewport-source-oracle-")
const packages = path.join(repository, "node_modules/.pnpm")
const motionPackage = (await readdir(packages)).find((name) => name.startsWith("framer-motion@12.40.0"))
assert(motionPackage, "The pinned Motion package must already be installed")
const entry = path.join(
  packages,
  motionPackage,
  "node_modules/framer-motion/dist/es/motion/features/viewport/index.mjs",
)
const pinned = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
  logLevel: "silent",
})
const pinnedFile = path.join(output, "pinned.mjs")
await writeFile(pinnedFile, pinned.outputFiles[0].text)
const { InViewFeature } = await import(pathToFileURL(pinnedFile).href)
const nativeRoot = path.join(repository, "packages/react-native/src/motion")
const native = await build({
  stdin: {
    contents: `export {NativeMotionViewport} from ${JSON.stringify(nativeRoot + "/viewport/NativeMotionViewport.ts")};export {MotionGlobalConfig,frameData,time} from ${JSON.stringify(nativeRoot + "/kernel/index.ts")}`,
    resolveDir: repository,
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
  logLevel: "silent",
  define: { requestAnimationFrame: "fixtureRequestFrame", __DEV__: "true" },
  banner: {
    js: "const fixtureFrames=new Map();let frameId=0;const fixtureRequestFrame=callback=>{fixtureFrames.set(++frameId,callback);return frameId};export{fixtureFrames};",
  },
  plugins: [
    {
      name: "explicit-native-delivery-model",
      setup(context) {
        context.onResolve({ filter: /input\/motionGeometry$/ }, () => ({
          path: "geometry",
          namespace: "viewport-model",
        }))
        context.onResolve({ filter: /^\.\/nativeViewport$/ }, () => ({ path: "query", namespace: "viewport-model" }))
        context.onLoad({ filter: /.*/, namespace: "viewport-model" }, ({ path: name }) => ({
          contents:
            name === "geometry"
              ? "export const observeNativeMotionGeometry=(_,listener)=>{globalThis.viewportFixtureListener=listener;return()=>{globalThis.viewportFixtureListener=undefined}}"
              : "export const readNativeViewport=(_,root)=>{globalThis.viewportFixtureRoot=root;return globalThis.viewportFixtureEntry}",
          loader: "js",
        }))
      },
    },
  ],
})
const nativeFile = path.join(output, "native-model.mjs")
await writeFile(nativeFile, native.outputFiles[0].text)
const { NativeMotionViewport, MotionGlobalConfig, frameData, time, fixtureFrames } = await import(
  pathToFileURL(nativeFile).href
)
MotionGlobalConfig.useManualTiming = true
const callbacks = new WeakMap(),
  observerOptions = new WeakMap()
globalThis.document = {}
globalThis.IntersectionObserver = class {
  constructor(callback, options) {
    this.callback = callback
    this.options = options
  }
  observe(target) {
    callbacks.set(target, this.callback)
    observerOptions.set(target, this.options)
  }
  unobserve(target) {
    callbacks.delete(target)
  }
}
const rows = []
for (const amount of [undefined, "some", "all", 0, 0.4, 1]) {
  for (const once of [undefined, false, true]) {
    for (const change of ["none", "once-only", "amount", "margin", "root-current", "root-ref", "callbacks"]) {
      const target = {},
        nativeTarget = {},
        rootElement = {},
        sourceRoot = { current: rootElement },
        nativeRootRef = { current: rootElement }
      const sourceTrace = [],
        nativeTrace = [],
        rootTrace = []
      const handlers = (trace, suffix = "") => ({
        onViewportEnter: (entry) => trace.push(["enter" + suffix, entry.isIntersecting, entry.intersectionRatio]),
        onViewportLeave: (entry) => trace.push(["leave" + suffix, entry.isIntersecting, entry.intersectionRatio]),
      })
      let sourceProps = { viewport: { root: sourceRoot, amount, once, margin: "0px" }, ...handlers(sourceTrace) }
      let nativeProps = { viewport: { root: nativeRootRef, amount, once, margin: "0px" }, ...handlers(nativeTrace) }
      const node = {
        current: target,
        props: sourceProps,
        prevProps: {},
        getProps() {
          return this.props
        },
        animationState: {
          setActive(key, state) {
            sourceTrace.push([key, state])
            return Promise.resolve()
          },
        },
      }
      const owner = {
        current: nativeTarget,
        isStatic: () => false,
        getProps: () => nativeProps,
        captureVisualLease: () => () => true,
        animationState: {
          setActive(key, value) {
            nativeTrace.push([key, value])
            return Promise.resolve()
          },
        },
      }
      const source = new InViewFeature(node),
        receiver = new NativeMotionViewport(owner, (error) => {
          throw error
        })
      source.mount()
      receiver.refresh()
      for (const [index, [isIntersecting, intersectionRatio]] of [
        [false, 0],
        [true, 0],
        [true, 0.2],
        [true, 1],
        [false, 0],
        [true, 0.5],
      ].entries()) {
        if (index === 3) {
          const a = { ...sourceProps.viewport },
            b = { ...nativeProps.viewport }
          if (change === "once-only") {
            a.once = !once
            b.once = !once
          }
          if (change === "amount") {
            a.amount = 0.7
            b.amount = 0.7
          }
          if (change === "margin") {
            a.margin = "10% 2px"
            b.margin = "10% 2px"
          }
          if (change === "root-current") {
            a.root.current = {}
            b.root.current = a.root.current
          }
          if (change === "root-ref") {
            const replacement = {}
            a.root = { current: replacement }
            b.root = { current: replacement }
          }
          sourceProps = { viewport: a, ...handlers(sourceTrace, change === "callbacks" ? ":latest" : "") }
          nativeProps = { viewport: b, ...handlers(nativeTrace, change === "callbacks" ? ":latest" : "") }
          node.prevProps = node.props
          node.props = sourceProps
          source.update()
          receiver.refresh()
        }
        callbacks.get(target)([{ target, isIntersecting, intersectionRatio }])
        globalThis.viewportFixtureEntry = { target: nativeTarget, isIntersecting, intersectionRatio }
        globalThis.viewportFixtureListener({ attached: true })
        time.set(1000 + index * 16)
        frameData.timestamp = 1000 + index * 16
        const pending = [...fixtureFrames.values()]
        fixtureFrames.clear()
        pending.forEach((callback) => callback(frameData.timestamp))
        await Promise.resolve()
        assert.equal(
          globalThis.viewportFixtureRoot ?? null,
          observerOptions.get(target).root ?? null,
          "captured root identity",
        )
        rootTrace.push(globalThis.viewportFixtureRoot === rootElement ? "original" : "replacement")
      }
      assert.deepEqual(nativeTrace, sourceTrace, JSON.stringify({ amount, once, change }))
      source.unmount()
      receiver.detach()
      rows.push({ amount: amount ?? "default", once: once ?? "default", change, trace: nativeTrace, rootTrace })
    }
  }
}
const result = {
  pinnedMotion: "12.40.0",
  comparisons: rows.length,
  recordsPerCase: 6,
  rows,
  nativeDelivery:
    "Explicit IO/owner/ref/frame/native query models. Actual pinned InViewFeature and native source controller execute; no browser, Fabric query, native drawing or timing executes.",
  nativeActions: 0,
}
await writeFile("/private/tmp/codon-native-card-viewport-oracle.json", JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ comparisons: result.comparisons, records: result.comparisons * 6, nativeActions: 0 }))
