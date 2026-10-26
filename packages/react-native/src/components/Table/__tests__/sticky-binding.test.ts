import { TurboModuleRegistry, type View } from "react-native"
import * as Native from "react-native"

import type { Spec } from "../../../input/specs/NativeCUIMotionSnapshot"
import { createNativeTableStickyBinding } from "../stickyBinding"

let modelTag = 0
const makeView = (document: object) =>
  ({ isConnected: true, ownerDocument: document, _nativeTag: ++modelTag }) as unknown as View
let messages: Record<string, unknown>[]
let backend: { tableStickyPresentation: jest.Mock<string, [string]> }
beforeEach(() => {
  messages = []
  backend = {
    tableStickyPresentation: jest.fn((encoded: string) => {
      const message = JSON.parse(encoded)
      messages.push(message)
      return JSON.stringify(
        message.action === "release"
          ? { lease: message.lease, released: true }
          : message.action === "check"
            ? { owner: message.owner, lease: message.lease, current: true }
            : { ...message, lease: `lease:${messages.length}`, registered: true },
      )
    }),
  }
  jest.spyOn(TurboModuleRegistry, "get").mockReturnValue(backend as unknown as Spec)
})
afterEach(() => jest.restoreAllMocks())
const setup = () => {
  const document = {}
  let target: View | null = makeView(document)
  let root: View | null = makeView(document)
  let active = true
  let epoch = 1
  const binding = createNativeTableStickyBinding(
    () => target,
    () => root,
    () => active,
    () => ({ backgroundColor: "white", session: { scopeOwnerId: "scope", windowId: "window", epoch } }),
  )
  return {
    binding,
    document,
    target: () => target,
    root: () => root,
    replaceTarget: (next: View | null) => {
      target = next
    },
    replaceRoot: (next: View | null) => {
      root = next
    },
    setActive: (next: boolean) => {
      active = next
    },
    nextEpoch: () => {
      epoch++
    },
  }
}
it("registers only actual original tags/insets and reuses an unchanged registration without JS geometry", () => {
  const f = setup()
  f.binding.synchronize(true, { top: "10%", bottom: "auto" }, false)
  f.binding.synchronize(true, { top: "10%", bottom: "auto" }, false)
  expect(messages.map((message) => message.action)).toEqual(["register", "check"])
  expect(messages[0]).toMatchObject({
    action: "register",
    target: Native.findNodeHandle(f.target()),
    containingRoot: Native.findNodeHandle(f.root()),
    insets: { top: "10%", bottom: "auto" },
    rendererRequiresStyleAuthority: false,
  })
  expect(messages[0]).not.toHaveProperty("x")
  expect(messages[0]).not.toHaveProperty("y")
})
it("replaces a natively retired lease and a later epoch without reviving the old registration", () => {
  const f = setup()
  f.binding.synchronize(true, { top: 0 }, false)
  const original = backend.tableStickyPresentation.getMockImplementation()!
  backend.tableStickyPresentation.mockImplementation((encoded) =>
    JSON.parse(encoded).action === "check"
      ? JSON.stringify({ ...JSON.parse(encoded), current: false })
      : original(encoded),
  )
  f.binding.synchronize(true, { top: 0 }, false)
  expect(messages.map((message) => message.action)).toEqual(["register", "release", "register"])
  f.nextEpoch()
  f.binding.synchronize(true, { top: 0 }, false)
  expect(messages.map((message) => message.action)).toEqual(["register", "release", "register", "release", "register"])
  expect(messages.at(-1)!.session).toMatchObject({ epoch: 2 })
})
it("releases before configuration changes, current target/root replacement and owner retirement", () => {
  const f = setup()
  f.binding.synchronize(true, { top: 0 }, false)
  f.binding.synchronize(true, { top: 12 }, true)
  expect(messages.map((message) => message.action)).toEqual(["register", "release", "register"])
  expect(messages[2].rendererRequiresStyleAuthority).toBe(true)
  f.replaceTarget(makeView(f.document))
  f.binding.synchronize(true, { top: 12 }, true)
  f.replaceRoot(makeView(f.document))
  f.binding.synchronize(true, { top: 12 }, true)
  f.setActive(false)
  f.binding.retireIfChanged()
  expect(messages.map((message) => message.action)).toEqual([
    "register",
    "release",
    "register",
    "release",
    "register",
    "release",
    "register",
    "release",
  ])
})
it("retires a registration if its original ref changes during the native acknowledgement", () => {
  const f = setup()
  const original = backend.tableStickyPresentation.getMockImplementation()!
  backend.tableStickyPresentation.mockImplementation((encoded) => {
    const result = original(encoded)
    if (JSON.parse(encoded).action === "register") f.replaceTarget(makeView(f.document))
    return result
  })
  f.binding.synchronize(true, { top: 0 }, false)
  expect(messages.map((message) => message.action)).toEqual(["register", "release"])
})
it("does no native work while disabled and cannot revive a disposed generation", () => {
  const f = setup()
  f.binding.synchronize(false, { top: 0 }, false)
  expect(messages).toEqual([])
  f.binding.synchronize(true, { top: 0 }, false)
  f.binding.dispose()
  f.binding.synchronize(true, { top: 0 }, false)
  f.binding.dispose()
  expect(messages.map((message) => message.action)).toEqual(["register", "release"])
})
it("rejects missing source authority and foreign native acknowledgements instead of silently keeping flow", () => {
  const f = setup()
  jest.mocked(TurboModuleRegistry.get).mockReturnValue(null)
  expect(() => f.binding.synchronize(true, { top: 0 }, false)).toThrow("native presentation binding unavailable")
  jest.mocked(TurboModuleRegistry.get).mockReturnValue(backend as unknown as Spec)
  backend.tableStickyPresentation.mockReturnValue(JSON.stringify({ lease: "foreign", registered: true }))
  expect(() => f.binding.synchronize(true, { top: 0 }, false)).toThrow("invalid registration acknowledgement")
})
it("requires connected targets in the same native document and keeps release acknowledgement strict", () => {
  const f = setup()
  f.replaceRoot(makeView({}))
  expect(() => f.binding.synchronize(true, { top: 0 }, false)).toThrow("one document")
  f.replaceRoot(makeView(f.document))
  f.binding.synchronize(true, { top: 0 }, false)
  backend.tableStickyPresentation.mockReturnValue(JSON.stringify({ lease: "wrong", released: true }))
  expect(() => f.binding.dispose()).toThrow("release acknowledgement")
})

it("retires an old lease when a retained model target loses its original native tag", () => {
  const f = setup()
  f.binding.synchronize(true, { top: 0 }, false)
  Object.assign(f.target()!, { _nativeTag: 0 })
  expect(() => f.binding.retireIfChanged()).not.toThrow()
  expect(messages.map((message) => message.action)).toEqual(["register", "release"])
})
