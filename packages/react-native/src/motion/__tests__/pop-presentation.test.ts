import { TurboModuleRegistry } from "react-native"
import type { View } from "react-native"

import { createNativePopRoot } from "../presence/nativePopFrame"

// Explicit native protocol/ref models. No Fabric hook, drawing or before-paint
// behavior is executed by these source ownership cases.
const setup = () => {
  const document = {},
    view = { isConnected: true, ownerDocument: document },
    root = { isConnected: true, ownerDocument: document }
  let actual: typeof view | null = view,
    scope = "window:1",
    live = true,
    tag = 31,
    sequence = 0
  const backend = jest.fn((encoded: string) => {
    const request = JSON.parse(encoded)
    if (request.action !== "capture")
      return JSON.stringify({ lease: request.lease, released: request.action === "release" })
    return JSON.stringify({
      ...request,
      kind: "native-pop-frame",
      lease: `lease:${++sequence}`,
      surfaceId: 1,
      fabricRevision: "2",
      positionedParent: 11,
      width: 100,
      height: 50,
      left: 10,
      top: 20,
      right: 190,
      bottom: 130,
      direction: "rtl",
    })
  })
  jest.spyOn(TurboModuleRegistry, "get").mockReturnValue({ popPresentation: backend } as never)
  jest
    .spyOn(jest.requireActual<typeof import("react-native")>("react-native"), "findNodeHandle")
    .mockImplementation((target) => (target === (view as unknown as View) ? tag : 11))
  const owner = createNativePopRoot(() => actual as unknown as View, { isCurrent: () => live, scope: () => scope })
  return {
    owner,
    view,
    root,
    backend,
    read: () => owner.read({ current: root as unknown as View }),
    actions: () => backend.mock.calls.map(([encoded]) => JSON.parse(encoded)),
    retire: (kind: string) => {
      if (kind === "scope") scope = "window:2"
      if (kind === "owner") live = false
      if (kind === "ref") actual = { ...view }
      if (kind === "disconnect") view.isConnected = false
      if (kind === "document") view.ownerDocument = {}
      if (kind === "root-document") root.ownerDocument = {}
      if (kind === "tag") tag++
    },
  }
}
afterEach(() => jest.restoreAllMocks())

it("activates only the captured lease and sends no caller rectangle or editor data", () => {
  const test = setup(),
    frame = test.read(),
    release = test.owner.freeze(frame, "right", "bottom")
  expect(test.actions()[1]).toEqual({
    action: "activate",
    owner: expect.any(String),
    lease: "lease:1",
    anchorX: "right",
    anchorY: "bottom",
  })
  release()
  release()
  test.owner.dispose()
  expect(test.actions().map((entry) => entry.action)).toEqual(["capture", "activate", "release"])
})
it("rejects a copied or invented frame even when its values are identical", () => {
  const test = setup(),
    frame = test.read()
  expect(() => test.owner.freeze({ ...frame }, "left", "top")).toThrow("foreign or retired")
  expect(test.actions().map((entry) => entry.action)).toEqual(["capture"])
  test.owner.dispose()
})
it.each(["scope", "owner", "ref", "disconnect", "document", "root-document", "tag"])(
  "retires %s changes before activation",
  (kind) => {
    const test = setup(),
      frame = test.read()
    test.retire(kind)
    expect(test.owner.isCurrent(frame)).toBe(false)
    expect(() => test.owner.freeze(frame, "left", "top")).toThrow("retired")
    expect(test.actions().map((entry) => entry.action)).toEqual(["capture", "release"])
  },
)
it.each(["scope", "ref", "disconnect", "document"])("releases the original active family on %s retirement", (kind) => {
  const test = setup(),
    frame = test.read(),
    release = test.owner.freeze(frame, "left", "top")
  test.retire(kind)
  test.owner.retireIfChanged()
  release()
  expect(test.actions().map((entry) => entry.action)).toEqual(["capture", "activate", "release"])
})
it("retires the previous capture before a new exit generation can own the root", () => {
  const test = setup(),
    old = test.read(),
    frame = test.read()
  expect(() => test.owner.freeze(old, "left", "top")).toThrow("retired")
  const release = test.owner.freeze(frame, "right", "top")
  expect(test.actions().map((entry) => [entry.action, entry.lease])).toEqual([
    ["capture", undefined],
    ["release", "lease:1"],
    ["capture", undefined],
    ["activate", "lease:2"],
  ])
  release()
})
it("releases a capture when its window changes inside the synchronous native call", () => {
  const test = setup(),
    original = test.backend.getMockImplementation()!
  test.backend.mockImplementation((encoded) => {
    const response = original(encoded)
    if (JSON.parse(encoded).action === "capture") test.retire("scope")
    return response
  })
  expect(test.read).toThrow("retired during capture")
  expect(test.actions().map((entry) => entry.action)).toEqual(["capture", "release"])
})
it("releases a lease when the activation acknowledgement belongs to another family", () => {
  const test = setup(),
    frame = test.read(),
    original = test.backend.getMockImplementation()!
  test.backend.mockImplementation((encoded) =>
    JSON.parse(encoded).action === "activate"
      ? JSON.stringify({ lease: "foreign", released: false })
      : original(encoded),
  )
  expect(() => test.owner.freeze(frame, "left", "top")).toThrow("acknowledgement")
  expect(test.actions().map((entry) => entry.action)).toEqual(["capture", "activate", "release"])
})
