import { act, render, screen } from "@testing-library/react-native"
import { createRef, type ComponentProps } from "react"
import { type NativeSyntheticEvent, View } from "react-native"

import { createNativeKeyScope } from "../keyScope"
import {
  createNativeLocalKeySession,
  NativeFocusHost,
  type NativeFocusView,
  type TNativeLocalKeyFrame,
} from "../NativeFocusView"
import { useNativeKeyScope } from "../NativeKeyboardScope"
import type { NativeKeyData } from "../specs/CUIFocusViewNativeComponent"

jest.mock("../NativeKeyboardScope", () => ({ useNativeKeyScope: jest.fn(() => null) }))

jest.mock("../specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestKeyboardFocus: jest.fn(), requestKeyboardBlur: jest.fn(), inspectAccessibility: jest.fn() },
}))

const baseFrame = (extra: Partial<TNativeLocalKeyFrame> = {}): TNativeLocalKeyFrame => ({
  ownerId: "thumb",
  descriptorRevision: "binding-1",
  viewOwnerId: "thumb",
  target: 17,
  surfaceId: 1,
  windowId: "actual-window",
  epoch: 1,
  sequence: 1,
  scopeOwnerId: "",
  scopeEpoch: 0,
  attached: true,
  active: true,
  enabled: true,
  focusedTarget: 17,
  isComposing: false,
  ...extra,
})
const eventFor = (original: View, frame: TNativeLocalKeyFrame, extra: Partial<NativeKeyData> = {}) =>
  ({
    target: original,
    currentTarget: original,
    persist: jest.fn(),
    nativeEvent: {
      kind: "keyboard",
      ownerId: frame.ownerId,
      target: 17,
      key: "ArrowRight",
      phase: "down",
      nativeCode: 79,
      characters: "",
      repeat: false,
      cancelled: false,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      nativeDefaultHandled: true,
      timestamp: 10,
      localFrame: JSON.stringify(frame),
      ...extra,
    },
  }) as unknown as NativeSyntheticEvent<NativeKeyData>

let find: jest.SpyInstance
beforeEach(() => {
  jest.mocked(useNativeKeyScope).mockReturnValue(null)
  find = jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockReturnValue(17)
})
afterEach(() => find.mockRestore())
const setup = () => {
  let original: View | null = {} as View,
    revision = "binding-1",
    canAct = true
  const onKey = jest.fn(),
    onRetire = jest.fn(),
    tokens = ["0000:ArrowRight", "1000:ArrowRight"]
  const session = createNativeLocalKeySession({
    original: () => original,
    ownerId: "thumb",
    revision: () => revision,
    tokens: () => tokens,
    canAct: () => canAct,
    onKey,
    onRetire,
  })
  session.configure()
  const send = (frame: TNativeLocalKeyFrame, extra: Partial<NativeKeyData> = {}) =>
    session.receive(eventFor(original!, frame, extra))
  const status = (frame = baseFrame()) => send(frame, { kind: "key-status" })
  return {
    session,
    onKey,
    onRetire,
    send,
    status,
    tokens,
    get original() {
      return original!
    },
    set original(value: View | null) {
      original = value
    },
    set revision(value: string) {
      revision = value
    },
    set canAct(value: boolean) {
      canAct = value
    },
  }
}

it("uses the original standalone host event and nativeEvent as the sole action frame", () => {
  const x = setup()
  expect(x.status()).toBe(true)
  const event = eventFor(x.original!, baseFrame({ eventId: 1, admitted: true }))
  expect(x.session.receive(event)).toBe(true)
  expect(x.onKey.mock.calls[0][0]).toBe(event)
  expect(x.onKey.mock.calls[0][0].nativeEvent).toBe(event.nativeEvent)
  expect(x.onKey.mock.calls[0][1]).toMatchObject({ admitted: true, isComposing: false })
  expect(event.persist).toHaveBeenCalledTimes(1)
  expect(x.send(baseFrame({ eventId: 2, admitted: false }), { phase: "up" })).toBe(true)
  expect(x.onKey.mock.calls[1][1].admitted).toBe(false)
})
it("requires native lifecycle acknowledgment and rejects duplicate observation", () => {
  const x = setup(),
    frame = baseFrame({ eventId: 1, admitted: true })
  expect(x.send(frame)).toBe(false)
  x.status()
  expect(x.send(frame)).toBe(true)
  expect(x.send(frame)).toBe(false)
  expect(x.onKey).toHaveBeenCalledTimes(1)
})
it("admits repeated downs only when the native producer admitted that exact frame", () => {
  const x = setup()
  x.status()
  expect(x.send(baseFrame({ eventId: 1, admitted: true }))).toBe(true)
  expect(x.send(baseFrame({ eventId: 2, admitted: true }), { repeat: true })).toBe(true)
  expect(x.send(baseFrame({ eventId: 3, admitted: false }), { repeat: true, nativeDefaultHandled: false })).toBe(true)
  expect(x.onKey.mock.calls.map((call) => call[1].admitted)).toEqual([true, true, false])
})
it("requires real composition metadata and rejects admitted composing frames", () => {
  const x = setup()
  x.status(baseFrame({ isComposing: true }))
  expect(x.send(baseFrame({ isComposing: true, eventId: 1, admitted: true }))).toBe(false)
  expect(x.send(baseFrame({ isComposing: true, eventId: 2, admitted: false }), { nativeDefaultHandled: false })).toBe(
    true,
  )
  expect(
    x.send({
      ...baseFrame({ eventId: 3, admitted: false }),
      isComposing: undefined,
    } as unknown as TNativeLocalKeyFrame),
  ).toBe(false)
})
it("uses only explicit modifier tokens without blanket capture", () => {
  const x = setup()
  x.status()
  expect(x.send(baseFrame({ eventId: 1, admitted: true }), { shiftKey: true })).toBe(true)
  expect(x.send(baseFrame({ eventId: 2, admitted: true }), { ctrlKey: true })).toBe(false)
  expect(x.send(baseFrame({ eventId: 3, admitted: false }), { ctrlKey: true, nativeDefaultHandled: false })).toBe(true)
  expect(x.tokens).toEqual(["0000:ArrowRight", "1000:ArrowRight"])
})
it.each([{ phase: "up" }, { cancelled: true }, { nativeDefaultHandled: false }] as Partial<NativeKeyData>[])(
  "never accepts false action authority %p",
  (extra) => {
    const x = setup()
    x.status()
    expect(x.send(baseFrame({ eventId: 1, admitted: true }), extra)).toBe(false)
  },
)
it.each([
  { epoch: 2 },
  { surfaceId: 2 },
  { sequence: 2 },
  { windowId: "replacement" },
  { scopeEpoch: 2 },
  { focusedTarget: 18 },
  { active: false },
  { enabled: false },
  { attached: false },
  { descriptorRevision: "retired" },
  { target: 18 },
  { viewOwnerId: "other" },
] as Partial<TNativeLocalKeyFrame>[])("rejects stale or ineligible native identity %p", (extra) => {
  const x = setup()
  x.status()
  expect(x.send(baseFrame({ eventId: 1, admitted: true, ...extra }))).toBe(false)
})
it("retires once on real focus/window epochs and does not revive old frames", () => {
  const x = setup()
  x.status()
  x.send(baseFrame({ eventId: 1, admitted: true }))
  x.status(baseFrame({ epoch: 2, sequence: 2, active: false, focusedTarget: 0 }))
  expect(x.onRetire).toHaveBeenCalledTimes(1)
  expect(x.send(baseFrame({ eventId: 2, admitted: true }))).toBe(false)
  x.status(baseFrame({ epoch: 3, sequence: 3, windowId: "new-window" }))
  expect(x.send(baseFrame({ epoch: 3, sequence: 3, windowId: "new-window", eventId: 3, admitted: true }))).toBe(true)
})
it("retires detached statuses even without a current native window or surface", () => {
  const x = setup()
  x.status()
  expect(
    x.status(
      baseFrame({
        epoch: 2,
        sequence: 2,
        attached: false,
        active: false,
        focusedTarget: 0,
        windowId: "",
        surfaceId: -1,
      }),
    ),
  ).toBe(true)
  expect(x.onRetire).toHaveBeenCalledTimes(1)
})
it("keeps insertion retirement callback-free until the safe lifecycle flush", () => {
  const x = setup()
  x.status()
  x.revision = "binding-2"
  x.session.configure()
  expect(x.onRetire).not.toHaveBeenCalled()
  x.session.flushRetirement()
  x.session.flushRetirement()
  expect(x.onRetire).toHaveBeenCalledTimes(1)
  expect(x.send(baseFrame({ eventId: 1, admitted: true }))).toBe(false)
  x.status(baseFrame({ descriptorRevision: "binding-2" }))
  expect(x.send(baseFrame({ descriptorRevision: "binding-2", eventId: 1, admitted: true }))).toBe(true)
})
it("rejects transient null refs and foreign original event targets without replacing the event", () => {
  const x = setup()
  x.status()
  const original = x.original,
    event = eventFor(original!, baseFrame({ eventId: 1, admitted: true }))
  x.original = null
  expect(x.session.receive(event)).toBe(false)
  x.original = original
  expect(x.session.receive({ ...event, currentTarget: {} as View } as NativeSyntheticEvent<NativeKeyData>)).toBe(false)
  expect(x.session.receive(event)).toBe(true)
  expect(x.onRetire).not.toHaveBeenCalled()
  x.canAct = false
  expect(x.send(baseFrame({ eventId: 2, admitted: true }))).toBe(false)
})
it("invalidates queued frames immediately and requires a new binding after logical window retirement", () => {
  const x = setup()
  x.status()
  x.session.invalidate()
  expect(x.onRetire).not.toHaveBeenCalled()
  expect(x.send(baseFrame({ eventId: 1, admitted: true }))).toBe(false)
  x.session.configure()
  expect(x.send(baseFrame({ eventId: 2, admitted: true }))).toBe(false)
  x.session.flushRetirement()
  expect(x.onRetire).toHaveBeenCalledTimes(1)
})
it("binds the private policy to the existing original host and keeps it off the public View API", async () => {
  const ref = createRef<View>(),
    onKey = jest.fn(),
    onRetire = jest.fn(),
    legacy = jest.fn()
  const policy = {
    tokens: ["0000:ArrowRight"],
    isEnabled: true,
    lifetimeKey: "thumb:0",
    canAct: () => true,
    onKey,
    onRetire,
  }
  await render(
    <NativeFocusHost ref={ref} testID="thumb" nativeKeyPolicy={policy} onKeyDown={legacy}>
      <View testID="body" />
    </NativeFocusHost>,
  )
  const host = screen.getByTestId("thumb"),
    original = ref.current!
  const binding = JSON.parse(host.props.nativeKeyBinding)
  expect(binding).toMatchObject({ enabled: true, tokens: ["0000:ArrowRight"] })
  const frame = baseFrame({
    ownerId: host.props.ownerId,
    viewOwnerId: host.props.ownerId,
    descriptorRevision: binding.descriptorRevision,
  })
  const deliver = host.props.onNativeKey
  await act(() => deliver(eventFor(original!, frame, { kind: "key-status" })))
  const event = eventFor(original!, { ...frame, eventId: 1, admitted: true })
  await act(() => deliver(event))
  expect(onKey.mock.calls[0][0]).toBe(event)
  expect(legacy.mock.calls[0][0]).toBe(event)
  await screen.rerender(
    <NativeFocusHost ref={ref} testID="thumb" nativeKeyPolicy={{ ...policy, lifetimeKey: "thumb:1" }} />,
  )
  expect(ref.current).toBe(original)
  expect(onRetire).toHaveBeenCalledTimes(1)
  await act(() => deliver(event))
  expect(onKey).toHaveBeenCalledTimes(1)
  await screen.unmount()
  // The private host seam cannot be called through the package's public NativeFocusView props.
  const publicProps: ComponentProps<typeof NativeFocusView> = {
    // @ts-expect-error Private admission is not a public NativeFocusView API.
    nativeKeyPolicy: policy,
  }
  expect(publicProps).toBeDefined()
})

it("keeps hosted thumb action authority local and retires queued frames on host window loss", async () => {
  const scope = createNativeKeyScope("window-host")
  const acknowledge = (windowActive: boolean) =>
    scope.acceptNativeStatus({
      ownerId: scope.ownerId,
      windowId: "actual-window",
      epoch: 1,
      policyRevision: scope.policyRevision(),
      ready: true,
      windowActive,
    })
  acknowledge(true)
  jest.mocked(useNativeKeyScope).mockReturnValue(scope)
  const ref = createRef<View>(),
    onKey = jest.fn(),
    onRetire = jest.fn()
  const policy = {
    tokens: ["0000:ArrowRight"],
    isEnabled: true,
    lifetimeKey: "thumb:0",
    canAct: () => true,
    onKey,
    onRetire,
  }
  await render(<NativeFocusHost ref={ref} testID="hosted-thumb" nativeKeyPolicy={policy} />)
  const host = () => screen.getByTestId("hosted-thumb")
  const binding = JSON.parse(host().props.nativeKeyBinding)
  const original = ref.current!,
    deliver = host().props.onNativeKey
  const frame = baseFrame({
    ownerId: host().props.ownerId,
    viewOwnerId: host().props.ownerId,
    descriptorRevision: binding.descriptorRevision,
    scopeOwnerId: scope.ownerId,
    scopeEpoch: 1,
  })
  await act(() => deliver(eventFor(original, frame, { kind: "key-status" })))
  const direct = eventFor(original, { ...frame, eventId: 1, admitted: true })
  await act(() => deliver({ ...direct, nativeEvent: { ...direct.nativeEvent, localFrame: undefined } }))
  expect(onKey).not.toHaveBeenCalled()
  await act(() => deliver({ ...direct, target: {} as View }))
  expect(onKey).not.toHaveBeenCalled()
  await act(() => deliver(direct))
  expect(onKey.mock.calls[0][0]).toBe(direct)
  await act(() => acknowledge(false))
  expect(onRetire).toHaveBeenCalledTimes(1)
  expect(JSON.parse(host().props.nativeKeyBinding).descriptorRevision).not.toBe(binding.descriptorRevision)
  await act(() => acknowledge(true))
  await act(() => deliver(eventFor(original, { ...frame, eventId: 2, admitted: true })))
  expect(onKey).toHaveBeenCalledTimes(1)
  await screen.unmount()
})
