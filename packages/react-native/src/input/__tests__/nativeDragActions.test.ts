import { createNativeKeyScope } from "../keyScope"
import { createNativeDragActions, parseNativeDragAction } from "../nativeDragActions"
import type { TNativeDragActionIdentity } from "../nativeDragActions"
import NativeModule from "../specs/NativeCUIDragAndDrop"

jest.mock("../specs/NativeCUIDragAndDrop", () => ({
  __esModule: true,
  default: {
    getLease: jest.fn(() => "native-module"),
    acceptsAction: jest.fn(() => true),
    settleAction: jest.fn(() => true),
  },
}))
const native = NativeModule as jest.Mocked<NonNullable<typeof NativeModule>>
const setup = () => {
  const scope = createNativeKeyScope("owner")
  scope.acceptNativeStatus({
    ownerId: "owner",
    windowId: "window",
    epoch: 1,
    policyRevision: scope.policyRevision(),
    ready: true,
    windowActive: true,
  })
  const actions = createNativeDragActions(scope)
  let live = true
  const dispatch = jest.fn(() => ({ items: [{ "text/plain": "original" }] })),
    retire = jest.fn()
  const registration = actions.register({
    bindingId: "collection",
    revision: "original",
    rootTarget: 20,
    itemTargets: new Set([30]),
    current: () => live,
    dispatch,
    retire,
  })
  const identity: TNativeDragActionIdentity = {
    moduleId: "native-module",
    ownerId: "owner",
    bindingId: "collection",
    revision: "original",
    windowId: "window",
    sessionId: "native-session",
    kind: "lift",
    surfaceId: 1,
    scopeTarget: 10,
    rootTarget: 20,
    itemTarget: 30,
    epoch: 1,
  }
  const packet = (change: Partial<TNativeDragActionIdentity> = {}, token = 1) =>
    JSON.stringify({ version: 1, token, identity: { ...identity, ...change }, payload: { x: 0, y: 0 } })
  return {
    scope,
    actions,
    dispatch,
    retire,
    registration,
    identity,
    packet,
    retireOriginal: () => {
      live = false
    },
  }
}
beforeEach(() => {
  jest.clearAllMocks()
  native.acceptsAction.mockReturnValue(true)
  native.settleAction.mockReturnValue(true)
})

it("dispatches one authenticated current original collection action and returns only its explicit response", () => {
  const f = setup(),
    packet = f.packet()
  expect(f.actions.dispatch(packet)).toEqual({ items: [{ "text/plain": "original" }] })
  const [original, current] = f.dispatch.mock.calls[0] as unknown as [
    ReturnType<typeof parseNativeDragAction>,
    () => boolean,
  ]
  expect(original.identity).toEqual(f.identity)
  expect(current()).toBe(true)
  expect(native.settleAction).toHaveBeenCalledWith(
    JSON.stringify({
      version: 1,
      token: 1,
      identity: f.identity,
      response: JSON.stringify({ items: [{ "text/plain": "original" }] }),
    }),
  )
  expect(() => f.actions.dispatch(packet)).toThrow("authority")
  expect(f.dispatch).toHaveBeenCalledTimes(1)
  f.actions.dispose()
})
it.each([
  { moduleId: "other-module" },
  { ownerId: "other-owner" },
  { bindingId: "other-collection" },
  { revision: "retired" },
  { windowId: "other-window" },
  { epoch: 2 },
  { rootTarget: 21 },
  { itemTarget: 31 },
] satisfies Partial<TNativeDragActionIdentity>[])(
  "rejects foreign original identity %p before invoking application code",
  (change) => {
    const f = setup()
    expect(() => f.actions.dispatch(f.packet(change))).toThrow("authority")
    expect(f.dispatch).not.toHaveBeenCalled()
    expect(native.settleAction).not.toHaveBeenCalled()
    f.actions.dispose()
  },
)
it("requires actual native admission even when the JS metadata is otherwise current", () => {
  const f = setup()
  native.acceptsAction.mockReturnValue(false)
  expect(() => f.actions.dispatch(f.packet())).toThrow("authority")
  expect(f.dispatch).not.toHaveBeenCalled()
  f.actions.dispose()
})
it("acknowledges and preserves a thrown original callback while retiring its drag state", () => {
  const f = setup(),
    failure = new Error("original callback")
  f.dispatch.mockImplementation(() => {
    throw failure
  })
  expect(() => f.actions.dispatch(f.packet())).toThrow(failure)
  expect(JSON.parse(native.settleAction.mock.calls[0][0]).response).toBe(JSON.stringify({ error: "original callback" }))
  expect(f.retire).toHaveBeenCalledTimes(1)
  f.actions.dispose()
})
it("retires an action when native acknowledgement is refused and does not replay it", () => {
  const f = setup()
  native.settleAction.mockReturnValue(false)
  expect(() => f.actions.dispatch(f.packet())).toThrow("acknowledgement was refused")
  expect(f.retire).toHaveBeenCalledTimes(1)
  expect(() => f.actions.dispatch(f.packet())).toThrow("authority")
  expect(f.dispatch).toHaveBeenCalledTimes(1)
  f.actions.dispose()
})
it("rechecks original ownership after callbacks and refuses asynchronous substitutes", () => {
  const f = setup()
  f.dispatch.mockImplementation(() => {
    f.retireOriginal()
    return { items: [] }
  })
  expect(() => f.actions.dispatch(f.packet())).toThrow("authority retired during callback")
  expect(f.retire).toHaveBeenCalledTimes(1)
  f.actions.dispose()
  const other = setup()
  other.dispatch.mockImplementation((() => Promise.resolve({ items: [] })) as unknown as typeof other.dispatch)
  expect(() => other.actions.dispatch(other.packet())).toThrow("synchronous original action response required")
  other.actions.dispose()
})
it("unregisters old collection leases once and never routes a late action into a replacement", () => {
  const f = setup()
  f.registration.unregister()
  f.registration.unregister()
  expect(f.retire).toHaveBeenCalledTimes(1)
  const replacement = jest.fn(() => ({})),
    retired = jest.fn()
  f.actions.register({
    bindingId: "collection",
    revision: "replacement",
    rootTarget: 20,
    itemTargets: new Set([30]),
    current: () => true,
    dispatch: replacement,
    retire: retired,
  })
  expect(() => f.actions.dispatch(f.packet())).toThrow("authority")
  expect(replacement).not.toHaveBeenCalled()
  f.actions.dispose()
  expect(retired).toHaveBeenCalledTimes(1)
})
it("rejects native-window retirement and malformed or non-native scalar tokens", () => {
  const f = setup()
  f.scope.setEnabled(false)
  expect(() => f.actions.dispatch(f.packet())).toThrow("authority")
  for (const token of [0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])
    expect(() => parseNativeDragAction(f.packet({}, token))).toThrow("original token required")
  expect(() => parseNativeDragAction(f.packet({ itemTarget: -1 }))).toThrow("native targets required")
  f.actions.dispose()
})

it.each([undefined, null, 0, false])(
  "preserves the original thrown value %p instead of granting a successful action",
  (original) => {
    const f = setup()
    f.dispatch.mockImplementation(() => {
      throw original
    })
    let threw = false,
      failure: unknown
    try {
      f.actions.dispatch(f.packet())
    } catch (error) {
      threw = true
      failure = error
    }
    expect(threw).toBe(true)
    expect(failure).toBe(original)
    expect(f.retire).toHaveBeenCalledTimes(1)
    f.actions.dispose()
  },
)
