import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import vm from "node:vm"

const sdk = resolve(process.argv[2])
const output = resolve(process.argv[3])
assert.equal(JSON.parse(readFileSync(resolve(sdk, "package.json"))).version, "0.86.3")
mkdirSync(output, { recursive: false })
const hash = (source) => createHash("sha256").update(source).digest("hex")
const block = (source, opening) => {
  let depth = 0,
    quote = "",
    comment = ""
  for (let index = opening; index < source.length; index++) {
    const character = source[index],
      next = source[index + 1]
    if (comment === "line") {
      if (character === "\n") comment = ""
      continue
    }
    if (comment === "block") {
      if (character === "*" && next === "/") {
        comment = ""
        index++
      }
      continue
    }
    if (quote) {
      if (character === "\\") index++
      else if (character === quote) quote = ""
      continue
    }
    if (character === "/" && next === "/") {
      comment = "line"
      index++
      continue
    }
    if (character === "/" && next === "*") {
      comment = "block"
      index++
      continue
    }
    if (['"', "'", "`"].includes(character)) {
      quote = character
      continue
    }
    if (character === "{") depth++
    if (character === "}" && --depth === 0) return source.slice(opening, index + 1)
  }
  throw new Error("Incomplete pinned SDK source block")
}
const methods = [
  "functionThatReturnsTrue",
  "functionThatReturnsFalse",
  "SyntheticEvent",
  "executeDispatch",
  "executeDispatchesAndReleaseTopLevel",
  "createOrGetPooledEvent",
  "releasePooledEvent",
  "addEventPoolingTo",
]
const implementations = ["dev", "prod"].map((mode) => {
  const name = `Libraries/Renderer/implementations/ReactFabric-${mode}.js`
  const source = readFileSync(resolve(sdk, name), "utf8")
  const names = mode === "dev" ? [...methods, "validateEventDispatches", "getPooledWarningPropertyDefinition"] : methods
  const excerpts = names.map((name) => {
    const start = source.indexOf(`function ${name}(`)
    assert(start >= 0, `Missing actual SDK ${mode} ${name}`)
    const opening = source.indexOf("{", start)
    return source.slice(start, opening) + block(source, opening)
  })
  const prototypeStart = source.indexOf("assign(SyntheticEvent.prototype,")
  const prototype = block(source, source.indexOf("{", prototypeStart))
  const interfaceStart = source.indexOf("SyntheticEvent.Interface =")
  const eventInterface = block(source, source.indexOf("{", interfaceStart))
  const code = `${excerpts.join("\n")}\nObject.assign(SyntheticEvent.prototype, ${prototype});\nSyntheticEvent.Interface = ${eventInterface};\naddEventPoolingTo(SyntheticEvent);`
  return { mode, name, sourceHash: hash(source), excerptsHash: hash(code), code }
})
const fixture = dirname(fileURLToPath(import.meta.url))
const receiverPath = resolve(fixture, "../../../../packages/react-native/src/input/fieldInput.ts")
const receiverSource = readFileSync(receiverPath, "utf8")
const receiverRequire = createRequire(resolve(fixture, "../../../../packages/react-native/package.json"))
const typescript = receiverRequire("typescript")
const receiverCode = typescript.transpileModule(receiverSource, {
  compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
}).outputText
const receiverContext = vm.createContext({ exports: {}, require: receiverRequire })
vm.runInContext(receiverCode, receiverContext, { filename: receiverPath })
const { receiveNativeFieldPointer, activeNativeFieldInputEvent } = receiverContext.exports
writeFileSync(
  resolve(output, "inventory.json"),
  JSON.stringify(
    {
      sdk: "react-native@0.86.3",
      methods: [
        ...methods,
        "SyntheticEvent.prototype methods",
        "SyntheticEvent.Interface",
        "dev validation/pooling warnings",
      ],
      sources: implementations.map(({ code, ...metadata }) => metadata),
      fixtureHash: hash(readFileSync(fileURLToPath(import.meta.url))),
      productionReceiverHash: hash(receiverSource),
      productionReceiverTranspiledHash: hash(receiverCode),
      typescriptVersion: typescript.version,
      scope:
        "Exact SDK synthetic constructor/methods/pooling/dispatch loop and actual CUI receiver; explicit native-instance, field-module and DEV-fiber doubles. No renderer patch, native pointer/default or installed verdict.",
    },
    null,
    2,
  ) + "\n",
)
let checks = 0
for (const implementation of implementations) {
  writeFileSync(resolve(output, `${implementation.mode}-sdk-excerpts.js`), implementation.code)
  const context = vm.createContext({
    assign: Object.assign,
    isArrayImpl: Array.isArray,
    getNodeFromInstance$1: (instance) => instance,
    runWithFiberInDEV: (_instance, callback, ...args) => callback(...args),
    hasError: false,
    caughtError: null,
    console,
  })
  vm.runInContext(implementation.code, context)
  for (const action of ["none", "prevent", "stop", "both", "group-stop", "throw"]) {
    for (const persistent of [false, true]) {
      const nativeEvent = {
        target: 42,
        pointerId: 3,
        pointerType: "mouse",
        button: 0,
        buttons: 1,
        clientX: 19.5,
        clientY: 37.25,
        screenX: 119.5,
        screenY: 237.25,
        pressure: 0.5,
        timestamp: 91,
        selection: { start: 2, end: 4 },
      }
      const values = { ...nativeEvent },
        order = [],
        targets = [{ id: "child" }, { id: "group" }, { id: "outer" }]
      const event = context.SyntheticEvent.getPooled({ registrationName: "onPointerDown" }, targets[0], nativeEvent, 42)
      const originalError = new Error("original pointer callback failure")
      event._dispatchInstances = targets
      event._dispatchListeners = [
        (event) => {
          assert.equal(event.nativeEvent, nativeEvent)
          assert.equal(event.currentTarget, targets[0])
          order.push("child")
          if (persistent) event.persist()
          if (action === "prevent" || action === "both") event.preventDefault()
          if (action === "stop" || action === "both") event.stopPropagation()
          if (action === "throw") throw originalError
        },
        (event) => {
          assert.equal(event.nativeEvent, nativeEvent)
          order.push("group")
          if (action === "group-stop") event.stopPropagation()
        },
        (event) => {
          assert.equal(event.nativeEvent, nativeEvent)
          order.push("outer")
        },
      ]
      context.hasError = false
      context.caughtError = null
      context.executeDispatchesAndReleaseTopLevel(event)
      const expected =
        action === "stop" || action === "both"
          ? ["child"]
          : action === "group-stop"
            ? ["child", "group"]
            : ["child", "group", "outer"]
      assert.deepEqual(order, expected)
      checks++
      assert.equal(nativeEvent.returnValue === false, action === "prevent" || action === "both")
      checks++
      assert.equal(nativeEvent.cancelBubble === true, ["stop", "both", "group-stop"].includes(action))
      checks++
      assert.equal(context.hasError, action === "throw")
      assert.equal(context.caughtError, action === "throw" ? originalError : null)
      checks++
      for (const key of Object.keys(values)) assert.equal(nativeEvent[key], values[key])
      checks++
      assert.equal(context.SyntheticEvent.eventPool.includes(event), !persistent)
      checks++
      if (persistent) assert.equal(event.nativeEvent, nativeEvent)
      // The original payload remains inspectable after the actual SDK releases
      // the synthetic event; no event method or callback was replaced.
      assert.equal(nativeEvent.selection, values.selection)
      checks++
    }
  }
  for (const [phase, pointerType] of [
    ["pointer-start", "mouse"],
    ["pointer-end", "touch"],
    ["pointer-cancel", "pen"],
  ]) {
    for (const action of ["none", "prevent", "stop", "both", "group-stop", "throw"]) {
      const packet = {
        moduleLease: "module:1",
        token: 1,
        eventId: 1,
        phase,
        identity: {
          ownerId: "field",
          bindingId: "field:1",
          bindingRevision: "rev:1",
          metadataTarget: 15,
          outerTarget: 2,
          inputTarget: 3,
          surfaceId: 11,
          target: 42,
          documentId: "document:1",
          documentRevision: "7",
          windowId: "window:1",
          mountRevision: "mount:7",
          outerInstance: "outer:1",
          inputInstance: "input:1",
          nativeInstance: "component:42",
          editorInstance: "editor:42",
          epoch: 2,
        },
        groups: [
          { target: 3, bindingId: "field:1", bindingRevision: "rev:1", scopeTarget: 2 },
          { target: 2, bindingId: "field:1", bindingRevision: "rev:1", scopeTarget: 2 },
        ],
      }
      const settlements = [],
        order = [],
        targets = [42, 3, 2].map((tag) => ({ tag }))
      const scope = {
        bindingId: "field:1",
        bindingRevision: "rev:1",
        current: () => true,
        native: {
          getLease: () => "module:1",
          acceptsField: () => true,
          settleField: (value) => {
            settlements.push(JSON.parse(value))
            return true
          },
        },
      }
      const nativeEvent = {
        target: 42,
        pointerId: 0,
        pointerType,
        isPrimary: true,
        button: 0,
        fieldDispatch: JSON.stringify(packet),
      }
      const original = context.SyntheticEvent.getPooled(
        {
          registrationName:
            phase === "pointer-start" ? "onPointerDown" : phase === "pointer-end" ? "onPointerUp" : "onPointerCancel",
        },
        targets[0],
        nativeEvent,
        42,
      )
      const methods = [original.preventDefault, original.stopPropagation, original.persist]
      const error = new Error("original CUI pointer callback failure")
      original._dispatchInstances = targets
      original._dispatchListeners = targets.map((target, index) => (event) => {
        assert.equal(event, original)
        assert.equal(event.currentTarget, target)
        assert.equal(
          receiveNativeFieldPointer(scope, event, phase, {
            target: target.tag,
            group: index > 0,
            run: () => {
              assert.equal(activeNativeFieldInputEvent(scope), original)
              order.push(target.tag)
              if (index === 0) {
                if (["prevent", "both"].includes(action)) event.preventDefault()
                if (["stop", "both"].includes(action)) event.stopPropagation()
                if (action === "throw") throw error
              }
              if (index === 1 && action === "group-stop") event.stopPropagation()
            },
          }),
          action !== "throw" || index === 0,
        )
      })
      context.hasError = false
      context.caughtError = null
      context.executeDispatchesAndReleaseTopLevel(original)
      const expected = ["stop", "both"].includes(action)
        ? [42]
        : action === "group-stop"
          ? [42, 3]
          : action === "throw"
            ? [42]
            : [42, 3, 2]
      assert.deepEqual(order, expected)
      checks++
      assert.equal(settlements.length, 1)
      checks++
      assert.equal(settlements[0].phase, phase)
      checks++
      assert.equal(settlements[0].current, action !== "throw")
      checks++
      assert.equal(settlements[0].preventDefault, phase !== "pointer-cancel" && ["prevent", "both"].includes(action))
      checks++
      assert.equal(original.nativeEvent, nativeEvent)
      checks++
      assert.deepEqual([original.preventDefault, original.stopPropagation, original.persist], methods)
      checks++
      assert.equal(context.SyntheticEvent.eventPool.includes(original), false)
      checks++
      assert.equal(activeNativeFieldInputEvent(scope), null)
      checks++
      assert.equal(context.caughtError, action === "throw" ? error : null)
      checks++
    }
  }
}
const result = { checks, implementations: ["dev", "prod"], nativeOrInstalledAcceptance: false }
writeFileSync(resolve(output, "result.json"), JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify(result))
