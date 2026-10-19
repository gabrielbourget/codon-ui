import { TurboModuleRegistry } from "react-native"
import type { View } from "react-native"

import { readNativePopFrame } from "../presence/nativePopFrame"

// Explicit ref/backend models test validation. They do not measure Fabric or
// establish a before-paint/native presentation guarantee.
const harness = () => {
  const document = {},
    view = { isConnected: true, ownerDocument: document },
    root = { isConnected: true, ownerDocument: document }
  let targetTag = 31,
    rootTag = 11
  const native = jest.fn((encoded: string) => {
    const request = JSON.parse(encoded)
    return JSON.stringify({
      kind: "native-pop-frame",
      requestId: request.requestId,
      target: request.target,
      surfaceId: 1,
      fabricRevision: "9007199254740993",
      positionedParent: 21,
      width: 80.25,
      height: 25,
      left: -4.5,
      top: 9.75,
      right: 104.25,
      bottom: 45.25,
      direction: "rtl",
    })
  })
  jest.spyOn(TurboModuleRegistry, "get").mockReturnValue({ getPopFrame: native } as never)
  jest
    .spyOn(jest.requireActual<typeof import("react-native")>("react-native"), "findNodeHandle")
    .mockImplementation((target) => (target === (view as unknown as View) ? targetTag : rootTag))
  return {
    view,
    root,
    native,
    read: () => readNativePopFrame(view as unknown as View, root as unknown as View),
    recycle: () => targetTag++,
    recycleRoot: () => rootTag++,
  }
}
afterEach(() => jest.restoreAllMocks())

it("preserves fractional/negative offsets, RTL, and exact revision strings in an immutable frame", () => {
  const test = harness(),
    frame = test.read()
  expect(frame).toMatchObject({ left: -4.5, width: 80.25, direction: "rtl", fabricRevision: "9007199254740993" })
  expect(Object.isFrozen(frame)).toBe(true)
  expect(JSON.parse(test.native.mock.calls[0][0])).toMatchObject({ target: 31, containingRoot: 11 })
})
it.each(["disconnect", "document", "tag", "root-tag"])(
  "rejects %s changes during the synchronous native call",
  (change) => {
    const test = harness(),
      implementation = test.native.getMockImplementation()!
    test.native.mockImplementation((encoded) => {
      const result = implementation(encoded)
      if (change === "disconnect") test.view.isConnected = false
      if (change === "document") test.view.ownerDocument = {}
      if (change === "tag") test.recycle()
      if (change === "root-tag") test.recycleRoot()
      return result
    })
    expect(test.read).toThrow("retired")
  },
)
it.each([
  ["target", 32],
  ["requestId", "foreign"],
  ["surfaceId", 0],
  ["positionedParent", -1],
  ["fabricRevision", 42],
  ["width", -1],
  ["height", null],
  ["left", "1"],
  ["bottom", null],
  ["direction", "inherit"],
])("rejects invalid %s response data", (key, value) => {
  const test = harness(),
    implementation = test.native.getMockImplementation()!
  test.native.mockImplementation((encoded) => JSON.stringify({ ...JSON.parse(implementation(encoded)), [key]: value }))
  expect(test.read).toThrow("identity or metrics")
})
it("rejects disconnected or cross-document refs before querying native", () => {
  const test = harness()
  test.root.ownerDocument = {}
  expect(test.read).toThrow("one native document")
  expect(test.native).not.toHaveBeenCalled()
})
it("rejects a missing synchronous backend", () => {
  const test = harness()
  jest.spyOn(TurboModuleRegistry, "get").mockReturnValue(null)
  expect(test.read).toThrow("reader unavailable")
})
it("uses the actual positioned ancestor when no containing root is supplied", () => {
  const test = harness()
  expect(readNativePopFrame(test.view as unknown as View).positionedParent).toBe(21)
  expect(JSON.parse(test.native.mock.calls[0][0]).containingRoot).toBe(0)
})
it("preserves a displayed zero-size frame for the presence owner to skip freezing", () => {
  const test = harness(),
    implementation = test.native.getMockImplementation()!
  test.native.mockImplementation((encoded) =>
    JSON.stringify({ ...JSON.parse(implementation(encoded)), width: 0, height: 0 }),
  )
  expect(test.read()).toMatchObject({ width: 0, height: 0 })
})
