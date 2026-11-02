import { act, render, screen } from "@testing-library/react-native"
import { Activity, createRef } from "react"
import { AccessibilityInfo, View } from "react-native"

import {
  NativeFloatingLayerHost,
  Slider,
  type SliderProps,
  type TNativeSliderStyleState,
  type TNativeSliderValue,
} from "../../.."
import { NativeFormRegistryContext } from "../../../form/context"
import { NativeFormRegistry } from "../../../form/registry"
import { getNativeFocusedTarget } from "../../../input/focus"
import type { TNativeLocalKeyFrame } from "../../../input/NativeFocusView"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import type { NativeKeyData } from "../../../input/specs/CUIFocusViewNativeComponent"

jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: {
    requestKeyboardFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    requestContainerFocus: jest.fn(),
    inspectAccessibility: jest.fn(),
  },
}))
jest.mock("../../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
let tags: WeakMap<object, number>
let tag: (node: object | null) => number
beforeEach(() => {
  tags = new WeakMap()
  let sequence = 300
  tag = (node) => {
    if (!node) return 0
    if (!tags.has(node)) tags.set(node, ++sequence)
    return tags.get(node)!
  }
  jest
    .spyOn(jest.requireActual("react-native"), "findNodeHandle")
    .mockImplementation((node) =>
      typeof node === "number" ? node : node && typeof node === "object" ? tag(node) : null,
    )
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => jest.restoreAllMocks())

const setup = async <T extends TNativeSliderValue>(initial: SliderProps<T>, hosted = false) => {
  let state!: TNativeSliderStyleState,
    rootKey = "first"
  const ref = createRef<View>()
  const registry = new NativeFormRegistry()
  const node = (props: SliderProps<T>, mode: "visible" | "hidden" = "visible") => {
    const slider = (
      <Activity mode={mode}>
        <Slider<T>
          {...props}
          ref={ref}
          render={(rootProps) => <View {...rootProps} key={rootKey} />}
          style={(current) => {
            state = current
            return {}
          }}
        />
      </Activity>
    )
    return (
      <NativeFormRegistryContext.Provider value={registry}>
        {hosted ? <NativeFloatingLayerHost testID="key-host">{slider}</NativeFloatingLayerHost> : slider}
      </NativeFormRegistryContext.Provider>
    )
  }
  const view = await render(node(initial))
  const target = (index = 0) => screen.getByTestId(`slider-thumb-${index + 1}-target`)
  const original = (index = 0) => [...registry.fields.values()][index].editor() as View
  let eventId = 0
  const packet = (
    index = 0,
    key = "ArrowRight",
    extra: Partial<NativeKeyData> = {},
    frameExtra: Partial<TNativeLocalKeyFrame> = {},
  ) => {
    const host = target(index),
      thumb = original(index)
    expect(host.props.nativeKeyBinding).toBeTruthy()
    const binding = JSON.parse(host.props.nativeKeyBinding)
    const frame: TNativeLocalKeyFrame = {
      ownerId: binding.ownerId,
      descriptorRevision: binding.descriptorRevision,
      viewOwnerId: binding.ownerId,
      target: tag(thumb),
      surfaceId: 1,
      windowId: "source-window",
      epoch: 1,
      sequence: 1,
      scopeOwnerId: hosted ? screen.getByTestId("key-host").props.ownerId : "",
      scopeEpoch: hosted ? 1 : 0,
      attached: true,
      active: true,
      enabled: true,
      focusedTarget: tag(thumb),
      isComposing: false,
      eventId: ++eventId,
      admitted: true,
      ...frameExtra,
    }
    return {
      target: thumb,
      currentTarget: thumb,
      persist: jest.fn(),
      isPropagationStopped: () => false,
      nativeEvent: {
        kind: "keyboard",
        ownerId: binding.ownerId,
        target: tag(thumb),
        key,
        nativeCode: 79,
        characters: "",
        phase: "down" as const,
        repeat: false,
        cancelled: false,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        capsLock: false,
        nativeModifierData: "0",
        nativeDefaultHandled: true,
        timestamp: eventId,
        localFrame: JSON.stringify(frame),
        ...extra,
      },
    }
  }
  const acknowledge = async (index = 0, frame: Partial<TNativeLocalKeyFrame> = {}) => {
    const event = packet(index, "", { kind: "key-status" }, { admitted: false, ...frame })
    await act(() => target(index).props.onNativeKey(event))
  }
  const send = async (
    key: string,
    index = 0,
    extra: Partial<NativeKeyData> = {},
    frame: Partial<TNativeLocalKeyFrame> = {},
  ) => {
    const event = packet(index, key, extra, frame)
    await act(() => target(index).props.onNativeKey(event))
    return event
  }
  return {
    view,
    ref,
    target,
    original,
    packet,
    acknowledge,
    send,
    state: () => state.state,
    update: (props: SliderProps<T>, mode?: "visible" | "hidden", nextRootKey = rootKey) => {
      rootKey = nextRootKey
      return view.rerender(node(props, mode))
    },
  }
}

it("binds standalone keyboard actions to the existing original thumb and completes one numeric transaction per admitted down", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  const result = await setup({ label: "Value", defaultValue: 10, onChange: changed, onChangeEnd: ended })
  const root = result.ref.current,
    thumb = result.original()
  await result.acknowledge()
  const firstEvent = await result.send("ArrowRight")
  expect(firstEvent.persist).toHaveBeenCalledTimes(1)
  await result.send("ArrowRight", 0, { repeat: true })
  await result.send("ArrowRight", 0, { phase: "up" }, { admitted: false })
  expect(changed.mock.calls).toEqual([[11], [12]])
  expect(ended.mock.calls).toEqual([[11], [12]])
  expect(changed.mock.invocationCallOrder[0]).toBeLessThan(ended.mock.invocationCallOrder[0]!)
  expect(ended.mock.invocationCallOrder[0]).toBeLessThan(changed.mock.invocationCallOrder[1]!)
  expect(changed.mock.invocationCallOrder[1]).toBeLessThan(ended.mock.invocationCallOrder[1]!)
  expect(result.state().values).toEqual([12])
  expect(result.ref.current).toBe(root)
  expect(result.original()).toBe(thumb)
})

it.each([
  { key: "ArrowRight", direction: "ltr", orientation: "horizontal", shiftKey: false, expected: 51 },
  { key: "ArrowLeft", direction: "ltr", orientation: "horizontal", shiftKey: false, expected: 49 },
  { key: "ArrowRight", direction: "rtl", orientation: "horizontal", shiftKey: false, expected: 49 },
  { key: "ArrowLeft", direction: "rtl", orientation: "horizontal", shiftKey: false, expected: 51 },
  { key: "ArrowUp", direction: "ltr", orientation: "vertical", shiftKey: false, expected: 51 },
  { key: "ArrowDown", direction: "rtl", orientation: "vertical", shiftKey: false, expected: 49 },
  { key: "ArrowRight", direction: "ltr", orientation: "horizontal", shiftKey: true, expected: 60 },
  { key: "ArrowLeft", direction: "rtl", orientation: "vertical", shiftKey: true, expected: 60 },
] as const)(
  "uses the pinned step/page/direction mapping for $key $direction $orientation shift=$shiftKey",
  async ({ key, direction, orientation, shiftKey, expected }) => {
    const changed = jest.fn(),
      ended = jest.fn()
    const result = await setup({
      label: "Value",
      defaultValue: 50,
      direction,
      orientation,
      onChange: changed,
      onChangeEnd: ended,
    })
    await result.acknowledge()
    await result.send(key, 0, { shiftKey })
    expect(changed.mock.calls).toEqual([[expected]])
    expect(ended.mock.calls).toEqual([[expected]])
    expect(result.state().values).toEqual([expected])
  },
)

it.each([
  { key: "PageUp", expected: [30, 60] },
  { key: "PageDown", expected: [10, 60] },
  { key: "Home", expected: [0, 60] },
  { key: "End", expected: [60, 60] },
])("preserves neighboring bounds and array callbacks for $key", async ({ key, expected }) => {
  const changed = jest.fn(),
    ended = jest.fn()
  const result = await setup({ label: "Range", defaultValue: [20, 60], onChange: changed, onChangeEnd: ended })
  await result.acknowledge()
  await result.send(key)
  expect(changed.mock.calls).toEqual([[expected]])
  expect(ended.mock.calls).toEqual([[expected]])
  expect(result.state().values).toEqual(expected)
})

it("retains controlled veto, latest requests and a normal owner echo without retiring the current repeat binding", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  const props = { label: "Value", value: 50, onChange: changed, onChangeEnd: ended }
  const result = await setup(props)
  await result.acknowledge()
  const binding = result.target().props.nativeKeyBinding
  await result.send("ArrowRight")
  await result.send("ArrowRight", 0, { repeat: true })
  expect(changed.mock.calls).toEqual([[51], [51]])
  expect(ended.mock.calls).toEqual([[51], [51]])
  expect(result.state().values).toEqual([50])
  await result.update({ ...props, value: 51 })
  expect(result.target().props.nativeKeyBinding).toBe(binding)
  await result.send("ArrowRight", 0, { repeat: true })
  expect(changed.mock.calls).toEqual([[51], [51], [52]])
  expect(ended.mock.calls).toEqual([[51], [51], [52]])
  expect(result.state().values).toEqual([51])
  const latest = jest.fn()
  await result.update({ ...props, value: 51, onChange: latest })
  expect(result.target().props.nativeKeyBinding).toBe(binding)
  await result.send("ArrowRight", 0, { repeat: true })
  expect(changed.mock.calls).toEqual([[51], [51], [52]])
  expect(latest.mock.calls).toEqual([[52]])
  expect(ended.mock.calls).toEqual([[51], [51], [52], [52]])
})

it("completes a bound key transaction without inventing a value change", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  const result = await setup({ label: "Value", value: 100, onChange: changed, onChangeEnd: ended })
  await result.acknowledge()
  await result.send("ArrowRight")
  expect(changed).not.toHaveBeenCalled()
  expect(ended.mock.calls).toEqual([[100]])
  expect(result.state().values).toEqual([100])
})

it("does not fabricate a terminal callback when the current owner revokes editability during a key request", async () => {
  const ended = jest.fn()
  let revoke: () => void = () => undefined
  const changed = jest.fn(() => revoke())
  const result = await setup({ label: "Value", defaultValue: 50, onChange: changed, onChangeEnd: ended })
  revoke = () => result.state().setThumbEditable(0, false)
  await result.acknowledge()
  await result.send("ArrowRight")
  expect(changed.mock.calls).toEqual([[51]])
  expect(result.state().values).toEqual([51])
  expect(result.state().isThumbEditable(0)).toBe(false)
  expect(ended).not.toHaveBeenCalled()
})

it("selects only plain/Shift numeric tokens and rejects duplicates, observer-only frames, composing input and unrelated keys", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  const result = await setup({ label: "Value", defaultValue: 10, onChange: changed, onChangeEnd: ended })
  const tokens: string[] = JSON.parse(result.target().props.nativeKeyBinding).tokens
  expect(tokens).toHaveLength(16)
  expect(tokens.every((token) => token.startsWith("0000:") || token.startsWith("1000:"))).toBe(true)
  expect(tokens.some((token) => /Tab|Enter|Space|Escape/.test(token))).toBe(false)
  await result.acknowledge()
  const event = await result.send("ArrowRight")
  await act(() => result.target().props.onNativeKey(event))
  expect(event.persist).toHaveBeenCalledTimes(1)
  for (const extra of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
    await result.send("ArrowRight", 0, { ...extra, nativeDefaultHandled: false }, { admitted: false })
    await result.send("ArrowRight", 0, extra)
  }
  for (const key of ["Tab", "Enter", "Space", "Escape"]) {
    await result.send(key, 0, { nativeDefaultHandled: false }, { admitted: false })
  }
  await result.send("ArrowRight", 0, { phase: "up", cancelled: true }, { admitted: false })
  await result.send("ArrowRight", 0, { cancelled: true })
  const composing = { epoch: 2, sequence: 2, isComposing: true }
  await result.acknowledge(0, composing)
  await result.send("ArrowRight", 0, {}, composing)
  await result.send("ArrowRight", 0, { nativeDefaultHandled: false }, { ...composing, admitted: false })
  expect(changed.mock.calls).toEqual([[11]])
  expect(ended.mock.calls).toEqual([[11]])
  expect(result.state().values).toEqual([11])
})

it.each(["owner", "bounds", "direction", "disabled", "root"] as const)(
  "retires the original admitted frame across %s takeover and accepts a fresh current key",
  async (change) => {
    const changed = jest.fn(),
      ended = jest.fn()
    const props: SliderProps<readonly number[]> = { label: "Range", value: [50], onChange: changed, onChangeEnd: ended }
    const result = await setup(props)
    await result.acknowledge()
    const original = result.original(),
      root = result.ref.current
    const oldBinding = result.target().props.nativeKeyBinding
    const oldDelivery = result.target().props.onNativeKey
    const oldPacket = result.packet()
    const next = {
      ...props,
      ...(change === "owner"
        ? { value: [40] }
        : change === "bounds"
          ? { minValue: 10 }
          : change === "direction"
            ? { direction: "rtl" as const }
            : change === "disabled"
              ? { isDisabled: true }
              : {}),
    }
    await result.update(next, "visible", change === "root" ? "replacement" : "first")
    expect(result.target().props.nativeKeyBinding).not.toBe(oldBinding)
    await act(() => oldDelivery(oldPacket))
    expect(changed).not.toHaveBeenCalled()
    expect(ended).not.toHaveBeenCalled()
    if (change === "root") {
      expect(result.original()).not.toBe(original)
      expect(result.ref.current).not.toBe(root)
    } else {
      expect(result.original()).toBe(original)
      expect(result.ref.current).toBe(root)
    }
    if (change === "disabled") {
      await result.acknowledge()
      await result.send("ArrowRight")
      expect(changed).not.toHaveBeenCalled()
      await result.update({ ...next, isDisabled: false })
    }
    await result.acknowledge()
    await result.send("ArrowRight")
    const expected = change === "owner" ? [41] : change === "direction" ? [49] : [51]
    expect(changed.mock.calls).toEqual([[expected]])
    expect(ended.mock.calls).toEqual([[expected]])
  },
)

it("retires a removed thumb's old key delivery and preserves the surviving original member", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  const props = { label: "Range", value: [20, 60], onChange: changed, onChangeEnd: ended }
  const result = await setup(props)
  await result.acknowledge(1)
  const surviving = result.original(),
    oldDelivery = result.target(1).props.onNativeKey,
    oldPacket = result.packet(1)
  await result.update({ ...props, value: [20] })
  await act(() => oldDelivery(oldPacket))
  expect(changed).not.toHaveBeenCalled()
  expect(ended).not.toHaveBeenCalled()
  expect(result.original()).toBe(surviving)
  await result.acknowledge()
  await result.send("ArrowRight")
  expect(changed.mock.calls).toEqual([[[21]]])
  expect(ended.mock.calls).toEqual([[[21]]])
})

it("accepts the approved fresh-session admitted repeat after reactivation while rejecting the prior window epoch", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  const result = await setup({ label: "Value", defaultValue: 10, onChange: changed, onChangeEnd: ended })
  await result.acknowledge()
  await result.send("ArrowRight")
  const oldPacket = result.packet()
  await result.acknowledge(0, { epoch: 2, sequence: 2, active: false, focusedTarget: 0 })
  await act(() => result.target().props.onNativeKey(oldPacket))
  const active = { epoch: 3, sequence: 3 }
  await result.acknowledge(0, active)
  const fresh = await result.send("ArrowRight", 0, { repeat: true }, active)
  expect(fresh.nativeEvent.repeat).toBe(true)
  expect(changed.mock.calls).toEqual([[11], [12]])
  expect(ended.mock.calls).toEqual([[11], [12]])
  expect(result.state().values).toEqual([12])
})

it("uses the same original local admission inside a floating host without adding a scoped numeric policy", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  const result = await setup({ label: "Value", defaultValue: 10, onChange: changed, onChangeEnd: ended }, true)
  expect(screen.getByTestId("key-host").props.policies).toEqual([])
  await result.acknowledge()
  await result.send("ArrowRight")
  expect(changed.mock.calls).toEqual([[11]])
  expect(ended.mock.calls).toEqual([[11]])
  expect(screen.getByTestId("key-host").props.policies).toEqual([])
})

it("retires retained hidden keys and restores fresh original-thumb authority after Activity returns", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  const props = { label: "Value", value: 50, onChange: changed, onChangeEnd: ended }
  const result = await setup(props)
  await result.acknowledge()
  const original = result.original(),
    oldDelivery = result.target().props.onNativeKey,
    oldPacket = result.packet()
  await result.update(props, "hidden")
  await act(() => oldDelivery(oldPacket))
  expect(changed).not.toHaveBeenCalled()
  expect(ended).not.toHaveBeenCalled()
  await result.update(props, "visible")
  expect(result.original()).toBe(original)
  await result.acknowledge()
  await result.send("ArrowRight")
  expect(changed.mock.calls).toEqual([[51]])
  expect(ended.mock.calls).toEqual([[51]])
})

it("requests retained logical focus on a replacement root's actual new thumb without inventing native acknowledgment", async () => {
  const props = { label: "Value", value: 50 }
  const result = await setup(props)
  await act(() => result.state().setFocusedThumb(0))
  const previous = result.original()
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  await result.update(props, "visible", "replacement-focus")
  const current = result.original()
  expect(current).not.toBe(previous)
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledWith(current, result.target().props.ownerId)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.every(([target]) => target === current)).toBe(true)
  expect(getNativeFocusedTarget()).toBeNull()
})
