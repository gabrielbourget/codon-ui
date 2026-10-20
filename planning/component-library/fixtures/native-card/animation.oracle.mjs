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
const ts = createRequire(path.join(repository, "packages/react-native/package.json"))("typescript")
const forbidden = new Set([
  "document",
  "window",
  "HTMLElement",
  "SVGElement",
  "IntersectionObserver",
  "getComputedStyle",
  "WAAPI",
])
const forbiddenReferences = (code) => {
  const tree = ts.createSourceFile("native.js", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  assert.equal(tree.parseDiagnostics.length, 0)
  const references = []
  const visit = (node) => {
    if ((ts.isIdentifier(node) || ts.isStringLiteralLike(node)) && forbidden.has(node.text)) references.push(node.text)
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return references
}
assert.deepEqual(forbiddenReferences("/* WAAPI document */ const valid = 1"), [])
assert.deepEqual(forbiddenReferences('window; globalThis["document"]; HTMLElement'), [
  "window",
  "document",
  "HTMLElement",
])
const motion = path.dirname(reactRequire.resolve("motion/package.json"))
const framer = path.dirname(createRequire(motion + "/package.json").resolve("framer-motion/package.json"))
const dom = await realpath(path.join(repository, "node_modules/.pnpm/motion-dom@12.40.0/node_modules/motion-dom"))
const utils = await realpath(path.join(repository, "node_modules/.pnpm/motion-utils@12.39.0/node_modules/motion-utils"))
const named = {
  createAnimationState: "render/utils/animation-state",
  animateVisualElement: "animation/interfaces/visual-element",
  animateVariant: "animation/interfaces/visual-element-variant",
  animateTarget: "animation/interfaces/visual-element-target",
  resolveVariant: "render/utils/resolve-dynamic-variants",
  resolveVariantFromProps: "render/utils/resolve-variants",
  getVariantContext: "render/utils/get-variant-context",
  isControllingVariants: "render/utils/is-controlling-variants",
  getValueTransition: "animation/utils/get-value-transition",
  resolveTransition: "animation/utils/resolve-transition",
  getDefaultTransition: "animation/utils/default-transitions",
  isTransitionDefined: "animation/utils/is-transition-defined",
  calcChildStagger: "animation/utils/calc-child-stagger",
  setTarget: "render/utils/setters",
}
const source = {
  upstream:
    Object.entries(named)
      .map(([name, file]) => `export {${name}} from ${JSON.stringify(dom + "/dist/es/" + file + ".mjs")};`)
      .join("\n") +
    `export {animationControls as nativeAnimationControls} from ${JSON.stringify(framer + "/dist/es/animation/hooks/animation-controls.mjs")}; export {animateMotionValue as backend} from ${JSON.stringify(dom + "/dist/es/animation/interfaces/motion-value.mjs")}; export {motionValue,frame,frameData,time} from ${JSON.stringify(dom + "/dist/es/index.mjs")};export {MotionGlobalConfig} from ${JSON.stringify(utils + "/dist/es/index.mjs")}`,
  native: `export * from ${JSON.stringify(path.join(repository, "packages/react-native/src/motion/animation/index.ts"))};export {motionValue,frame,frameData,time,JSAnimation} from ${JSON.stringify(path.join(repository, "packages/react-native/src/motion/kernel/index.ts"))};export {MotionGlobalConfig} from ${JSON.stringify(path.join(repository, "packages/react-native/src/motion/kernel/utils/index.ts"))}`,
}
const modules = {},
  graphs = {}
for (const [name, contents] of Object.entries(source)) {
  const result = await build({
    absWorkingDir: repository,
    stdin: { contents, resolveDir: repository, sourcefile: `card-animation-${name}.mjs` },
    bundle: true,
    write: false,
    metafile: true,
    format: "esm",
    platform: "neutral",
    logLevel: "silent",
    define: { __DEV__: "true", requestAnimationFrame: "fixtureRequestFrame", window: "fixtureWindow" },
    banner: {
      js: "const fixtureWindow={};const fixtureFrames=new Map();let frameId=0;const fixtureRequestFrame=cb=>{fixtureFrames.set(++frameId,cb);return frameId};export {fixtureFrames};",
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
    retained,
    bundleSha256: createHash("sha256").update(result.outputFiles[0].contents).digest("hex"),
  }
  if (name === "native") {
    assert(
      retained.every(
        (file) => file.startsWith("packages/react-native/src/motion/") || file === "card-animation-native.mjs",
      ),
    )
    assert.deepEqual(forbiddenReferences(result.outputFiles[0].text), [])
  }
}
const normalize = (value) =>
  typeof value === "function"
    ? `[function:${value.name}]`
    : Array.isArray(value)
      ? value.map(normalize)
      : value && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]))
        : value
const clone = (value) => structuredClone(normalize(value))
let comparisons = 0
const categories = {}
const compare = async (category, run) => {
  const expected = await run(modules.upstream, false)
  const actual = await run(modules.native, true)
  assert.deepEqual(actual, expected, category)
  comparisons++
  categories[category.split(":")[0]] = (categories[category.split(":")[0]] ?? 0) + 1
}
const createOwner = (kernel, props = {}, trace = [], name = "root", order = 0) => {
  const values = new Map(),
    latestValues = {}
  let active = true,
    generation = 0
  const owner = {
    props,
    values,
    latestValues,
    variantChildren: new Set(),
    enteringChildren: new Set(),
    presenceContext: { custom: 0 },
    isControllingVariants: kernel.isControllingVariants(props),
    manuallyAnimateOnMount: false,
    blockInitialAnimation: false,
    shouldReduceMotion: false,
    shouldSkipAnimations: false,
    getProps: () => owner.props,
    getVariant: (key) => owner.props.variants?.[key],
    getDefaultTransition: () => owner.props.transition,
    getBaseTarget: (key) => ({ x: 0, y: 0, opacity: 1, scale: 1 })[key],
    hasValue: (key) => values.has(key),
    addValue: (key, value) => {
      values.set(key, value)
      latestValues[key] = value.get()
      value.on("change", (latest) => {
        latestValues[key] = latest
        trace.push(["value", name, key, latest])
      })
    },
    getValue: (key, ...fallback) => {
      if (!values.has(key) && fallback.length) owner.addValue(key, kernel.motionValue(fallback[0]))
      return values.get(key)
    },
    notify: (event, definition) => trace.push([event, name, clone(definition)]),
    sortNodePosition: (other) => order - other.order,
    order,
    captureAnimationLease: () => {
      const current = generation
      return () => active && generation === current
    },
    retire: () => {
      active = false
      generation++
      values.forEach((value) => value.stop())
    },
    animateValue: (key, value, target, transition, complete, isCurrent) => {
      // Both orchestration paths use the real pinned value backend in this oracle.
      // Native keyframe/color/geometry backend acceptance is intentionally separate.
      return modules.upstream.backend(
        key,
        value,
        target,
        transition,
        owner,
      )(() => {
        if (isCurrent()) complete()
      })
    },
  }
  for (const [key, value] of Object.entries({ x: 0, y: 0, opacity: 1, scale: 1 }))
    owner.addValue(key, kernel.motionValue(value))
  return owner
}
for (let seed = 0; seed < 96; seed++) {
  await compare(`state:${seed}`, async (kernel) => {
    const transitions = { duration: 0.1, isSync: true, ease: "linear" }
    const variants = {
      base: { x: seed, opacity: [0, 0.7] },
      over: { x: seed + 5 },
      focus: { opacity: 1 },
      tap: { scale: 0.9 },
      drag: { x: seed + 20 },
      visible: { y: seed + 1 },
      gone: (custom) => ({ x: -Number(custom), transitionEnd: { opacity: 0 } }),
    }
    const parent = createOwner(kernel, {
      initial: "base",
      animate: "base",
      whileHover: "over",
      variants: { base: { transition: { delayChildren: (index, total) => index + total } } },
    })
    const props = {
      initial: seed % 3 === 0 ? false : seed % 3 === 1 ? "base" : undefined,
      animate: seed % 2 ? ["base"] : "base",
      whileHover: "over",
      whileFocus: "focus",
      whileTap: "tap",
      whileDrag: "drag",
      whileInView: "visible",
      exit: "gone",
      custom: seed,
      variants,
      transition: transitions,
    }
    const owner = createOwner(kernel, props)
    if (seed % 4 === 0) owner.parent = parent
    owner.manuallyAnimateOnMount = seed % 5 === 0
    owner.blockInitialAnimation = seed % 7 === 0
    parent.enteringChildren.add(owner)
    owner.presenceContext.custom = seed + 3
    const state = kernel.createAnimationState(owner)
    owner.animationState = state
    const trace = []
    state.setAnimateFunction(() => async (animations) => {
      trace.push(["animations", clone(animations)])
      return []
    })
    const snapshot = (label) => trace.push([label, clone(state.getState())])
    await state.animateChanges()
    snapshot("initial")
    for (const [type, active] of [
      ["whileHover", true],
      ["whileFocus", true],
      ["whileTap", true],
      ["whileDrag", true],
      ["whileDrag", false],
      ["whileHover", false],
      ["whileInView", true],
    ]) {
      await state.setActive(type, active)
      snapshot(type + active)
    }
    owner.props = { ...owner.props, animate: { opacity: 0.2 }, whileTap: undefined }
    await state.animateChanges()
    snapshot("removed-targets")
    await state.setActive("exit", true)
    snapshot("exit")
    owner.props = { ...owner.props, custom: seed + 10 }
    owner.presenceContext.custom = seed + 20
    await state.animateChanges()
    snapshot("exit-custom-change")
    state.reset()
    await state.animateChanges()
    snapshot("reset")
    return trace
  })
}
for (const custom of [undefined, 0, false, "", { id: "frozen" }]) {
  for (const definitionKind of ["label", "function", "function-label", "missing"]) {
    await compare(`resolver:${definitionKind}:${JSON.stringify(custom)}`, (kernel) => {
      const calls = []
      const target = Object.freeze({ x: 20, opacity: 0 })
      const pose = (data, current, velocity) => {
        calls.push([clone(data), clone(current), clone(velocity)])
        return target
      }
      const owner = createOwner(kernel, { custom: "fallback", variants: Object.freeze({ pose }) })
      const definition =
        definitionKind === "label"
          ? "pose"
          : definitionKind === "function"
            ? pose
            : definitionKind === "function-label"
              ? () => "pose"
              : "missing"
      const resolved = kernel.resolveVariant(owner, definition, custom)
      return { result: clone(resolved), identity: resolved === target, calls }
    })
  }
}
for (const when of [undefined, "beforeChildren", "afterChildren"]) {
  for (const staggerDirection of [1, -1]) {
    for (const dynamic of [false, true]) {
      await compare(`stagger:${when}:${staggerDirection}:${dynamic}`, (kernel) => {
        const children = new Set(),
          nodes = [2, 0, 1].map((order) => createOwner(kernel, {}, [], String(order), order))
        nodes.forEach((node) => children.add(node))
        return nodes.map((node) =>
          kernel.calcChildStagger(
            children,
            node,
            dynamic ? (index, total) => index * 0.03 + total * 0.01 : 0.1,
            0.05,
            staggerDirection,
          ),
        )
      })
    }
  }
}
for (const parent of [
  undefined,
  { duration: 0.4, delay: 0.2, default: { ease: "linear" } },
  { repeat: 2, opacity: { duration: 0.1 } },
]) {
  for (const transition of [
    { duration: 0.1 },
    { inherit: true, duration: 0 },
    { inherit: false, delay: 0 },
    { default: { inherit: true, duration: 0.2 } },
    { opacity: { inherit: true, ease: "linear" }, delay: 0.1 },
  ]) {
    await compare(`transition:${JSON.stringify([parent, transition])}`, (kernel) => ({
      resolved: clone(kernel.resolveTransition(transition, parent)),
      specific: clone(kernel.getValueTransition(transition, "opacity")),
      defined: kernel.isTransitionDefined(transition),
    }))
  }
}
for (const key of ["x", "rotate", "scale", "scaleX", "opacity", "width"]) {
  for (const keyframes of [
    [0, 1],
    [1, 0],
    [0, 0.5, 1],
  ])
    await compare(`default:${key}:${keyframes}`, (kernel) => clone(kernel.getDefaultTransition(key, { keyframes })))
}
const drive = async (pending, limit = 100) => {
  let settled = false,
    error
  pending.then(
    () => {
      settled = true
    },
    (reason) => {
      settled = true
      error = reason
    },
  )
  for (let index = 0; index < limit && !settled; index++) {
    for (const kernel of Object.values(modules)) {
      kernel.frameData.timestamp = 1000 + index * 20
      kernel.time.set(kernel.frameData.timestamp)
    }
    for (const kernel of Object.values(modules)) {
      const callbacks = [...kernel.fixtureFrames.values()]
      kernel.fixtureFrames.clear()
      callbacks.forEach((callback) => callback(kernel.frameData.timestamp))
    }
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  }
  assert(settled, "fixed model frame cap exceeded")
  if (error) throw error
}
for (const when of [undefined, "beforeChildren", "afterChildren"]) {
  for (const override of [false, true]) {
    await compare(`controls:${when}:${override}`, async (kernel, native) => {
      for (const module of Object.values(modules)) {
        module.MotionGlobalConfig.useManualTiming = true
        module.frameData.timestamp = 1000
        module.time.set(1000)
      }
      const trace = []
      const transition = {
        duration: 0.1,
        ease: "linear",
        isSync: true,
        when,
        delayChildren: 0.02,
        staggerChildren: 0.03,
        staggerDirection: -1,
      }
      const owner = createOwner(
        kernel,
        { variants: { show: { x: [0, 100], transition, transitionEnd: { opacity: 0.5 } }, later: { x: 25 } } },
        trace,
      )
      const children = [2, 0, 1].map((order) =>
        createOwner(
          kernel,
          { variants: { show: { x: [0, 50], transition: { duration: 0.06, ease: "linear", isSync: true } } } },
          trace,
          String(order),
          order,
        ),
      )
      children.forEach((child) => {
        child.parent = owner
        owner.variantChildren.add(child)
      })
      const controls = kernel.nativeAnimationControls()
      const unsubscribe = controls.subscribe(owner),
        unmount = controls.mount()
      trace.length = 0
      const definition = "show"
      const pending = controls.start(
        definition,
        override ? { duration: 0.08, ease: "linear", isSync: true } : undefined,
      )
      await drive(pending)
      await drive(Promise.resolve())
      // Drain queued transitionEnd work under the same fixed model clock.
      for (const module of Object.values(modules)) {
        const callbacks = [...module.fixtureFrames.values()]
        module.fixtureFrames.clear()
        callbacks.forEach((callback) => callback(module.frameData.timestamp))
      }
      controls.set(["show", "later"])
      const result = {
        events: clone(trace),
        values: clone(Object.fromEntries([...owner.values].map(([key, value]) => [key, value.get()]))),
      }
      controls.stop()
      unsubscribe()
      unmount()
      children.forEach((child) => child.retire())
      owner.retire()
      for (const module of Object.values(modules)) {
        const callbacks = [...module.fixtureFrames.values()]
        module.fixtureFrames.clear()
        callbacks.forEach((callback) => callback(module.frameData.timestamp))
        module.MotionGlobalConfig.useManualTiming = false
      }
      void native
      return result
    })
  }
}
for (const overlap of [false, true]) {
  await compare(`labels:${overlap}`, async (kernel) => {
    for (const module of Object.values(modules)) {
      module.MotionGlobalConfig.useManualTiming = true
      module.frameData.timestamp = 1000
      module.time.set(1000)
    }
    const trace = []
    const owner = createOwner(
      kernel,
      {
        variants: {
          move: { x: [0, 100], transition: { duration: 0.1, isSync: true, ease: "linear" } },
          other: overlap
            ? { x: [0, 25], transition: { duration: 0.1, isSync: true, ease: "linear" } }
            : { opacity: [1, 0.2], transition: { duration: 0.1, isSync: true, ease: "linear" } },
        },
      },
      trace,
    )
    const controls = kernel.nativeAnimationControls(),
      definition = Object.freeze(["move", "other"])
    const unsubscribe = controls.subscribe(owner),
      unmount = controls.mount()
    let settled = false
    const pending = controls.start(definition).then(() => {
      settled = true
    })
    if (!overlap) await drive(pending)
    else {
      for (let step = 0; step < 12; step++) {
        for (const module of Object.values(modules)) {
          module.frameData.timestamp = 1000 + step * 20
          module.time.set(module.frameData.timestamp)
        }
        for (const module of Object.values(modules)) {
          const callbacks = [...module.fixtureFrames.values()]
          module.fixtureFrames.clear()
          callbacks.forEach((callback) => callback(module.frameData.timestamp))
        }
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      }
    }
    const before = clone(owner.latestValues)
    controls.set(definition)
    const result = {
      settled,
      before,
      after: clone(owner.latestValues),
      definition: [...definition],
      events: clone(trace),
    }
    controls.stop()
    unsubscribe()
    unmount()
    owner.retire()
    for (const module of Object.values(modules)) {
      const callbacks = [...module.fixtureFrames.values()]
      module.fixtureFrames.clear()
      callbacks.forEach((callback) => callback(module.frameData.timestamp))
      module.MotionGlobalConfig.useManualTiming = false
    }
    return result
  })
}
console.log(
  JSON.stringify(
    {
      scope:
        "Pinned orchestration/state/control source models; shared real upstream value backend; native value/keyframe/geometry/color/backend and complete Card remain unproven",
      comparisons,
      categories,
      graphs,
      nativeActions: 0,
    },
    null,
    2,
  ),
)
