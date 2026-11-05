import { act, fireEvent, render, renderHook, screen } from "@testing-library/react-native"
import * as RN from "react-native"

import { Slider } from "../../.."
import { useNativeSliderGesture } from "../gesture"
import { useNativeSliderState } from "../state"

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

type TFrame = [number, number, number, number]
const ReactNative = jest.requireActual<typeof RN>("react-native")
const nativeMethods: { measure: jest.Mock } = jest.requireActual(
  "@react-native/jest-preset/jest/MockNativeMethods",
).default
const track = () => screen.getByTestId("slider-track")
const target = (index = 1) => screen.getByTestId(`slider-thumb-${index}-target`)
const originalHost = (id: string) => {
  let fiber = screen.getByTestId(id).unstable_fiber
  while (fiber) {
    const node = fiber.stateNode as RN.View | null
    if (typeof node?.measure === "function") return node
    fiber = fiber.return
  }
  throw new Error(`Original native host missing for ${id}`)
}
const tag = (id: string) => ReactNative.findNodeHandle(originalHost(id))!
let deferred: (() => void)[] | undefined
beforeEach(() => {
  jest.replaceProperty(RN.Platform, "OS", "ios")
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  const tags = new WeakMap<object, number>()
  let sequence = 400
  jest.spyOn(ReactNative, "findNodeHandle").mockImplementation((node) => {
    if (typeof node === "number") return node
    if (!node || typeof node !== "object") return null
    if (!tags.has(node)) tags.set(node, ++sequence)
    return tags.get(node)!
  })
  deferred = undefined
  nativeMethods.measure.mockImplementation(function (
    this: { props: { testID: string } },
    callback: RN.MeasureOnSuccessCallback,
  ) {
    // These are the retained installed corner's real track and transformed thumb AABBs.
    const frame: TFrame =
      this.props.testID === "slider-track"
        ? [26, 572.6229150997701, 300, 44]
        : [204.77430862936296, 575.3972237291332, 38.451382741274074, 38.451382741274074]
    const resolve = () => callback(0, 0, frame[2], frame[3], frame[0], frame[1])
    if (deferred) deferred.push(resolve)
    else resolve()
  })
})
afterEach(() => jest.restoreAllMocks())

const point = (x: number, nativeTarget?: number | string, identifier = 0) => ({
  pageX: x,
  pageY: 577.3333333333333,
  identifier,
  ...(nativeTarget === undefined ? {} : { target: nativeTarget }),
})
const event = (x: number, nativeTarget?: number, broadcastTarget?: number) => ({
  nativeEvent: { ...point(x, broadcastTarget), changedTouches: [point(x, nativeTarget)] },
})
const mount = async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  const view = await render(
    <Slider
      accessibilityLabel="Quantity"
      minValue={0}
      maxValue={1}
      step={0.05}
      defaultValue={0.5}
      onChange={changed}
      onChangeEnd={ended}
    />,
  )
  await fireEvent(track(), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 44 } } })
  return { view, changed, ended }
}

it("uses the original native track hit instead of an overlapping transformed thumb AABB", async () => {
  const { changed, ended } = await mount()
  const nativeTrack = tag("slider-track")
  await fireEvent(track(), "responderGrant", event(206.66666666666666, nativeTrack))
  expect(changed.mock.calls).toEqual([[0.6]])
  expect(target()).toHaveAccessibilityValue({ now: 0.6 })
  expect(ended).not.toHaveBeenCalled()
  for (const x of [214, 257.3333333333333, 258]) await fireEvent(track(), "responderMove", event(x, nativeTrack))
  await fireEvent(track(), "responderRelease", event(258, nativeTrack))
  expect(changed.mock.calls).toEqual([[0.6], [0.65], [0.8]])
  expect(ended.mock.calls).toEqual([[0.8]])
})

it("reads the native string tag from the event itself when changedTouches are absent", async () => {
  const { changed, ended } = await mount()
  const nativeEvent = point(206.66666666666666, String(tag("slider-track")))
  await fireEvent(track(), "responderGrant", { nativeEvent })
  expect(changed.mock.calls).toEqual([[0.6]])
  await fireEvent(track(), "responderRelease", { nativeEvent })
  expect(ended.mock.calls).toEqual([[0.6]])
})

it("retains the original thumb grab offset using its per-touch target over the broadcast track target", async () => {
  const { changed, ended } = await mount()
  const nativeTrack = tag("slider-track"),
    nativeThumb = tag("slider-thumb-1-target")
  await fireEvent(track(), "responderGrant", event(206.66666666666666, nativeThumb, nativeTrack))
  expect(changed).not.toHaveBeenCalled()
  expect(target()).toHaveAccessibilityValue({ now: 0.5 })
  await fireEvent(track(), "responderMove", event(258, nativeThumb, nativeTrack))
  await fireEvent(track(), "responderRelease", event(258, nativeThumb, nativeTrack))
  expect(changed.mock.calls).toEqual([[0.7]])
  expect(ended.mock.calls).toEqual([[0.7]])
})

it.each([undefined, 999_999])(
  "preserves geometric fallback for missing or unknown native target %s",
  async (nativeTarget) => {
    const { changed, ended } = await mount()
    const broadcastTrack = tag("slider-track")
    await fireEvent(track(), "responderGrant", event(206.66666666666666, nativeTarget, broadcastTrack))
    expect(changed).not.toHaveBeenCalled()
    await fireEvent(track(), "responderMove", event(258, nativeTarget))
    await fireEvent(track(), "responderRelease", event(258, nativeTarget))
    expect(changed.mock.calls).toEqual([[0.7]])
    expect(ended.mock.calls).toEqual([[0.7]])
  },
)

it("keeps each changed touch's original thumb instead of broadcasting one event target", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  await render(
    <Slider
      accessibilityLabel="Quantity"
      minValue={0}
      maxValue={1}
      step={0.05}
      defaultValue={[0.25, 0.75]}
      onChange={changed}
      onChangeEnd={ended}
    />,
  )
  await fireEvent(track(), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 44 } } })
  const nativeTrack = tag("slider-track"),
    first = tag("slider-thumb-1-target"),
    second = tag("slider-thumb-2-target")
  await fireEvent(track(), "responderGrant", {
    nativeEvent: { ...point(224, nativeTrack), changedTouches: [point(224, first, 0), point(224, second, 1)] },
  })
  expect(changed).not.toHaveBeenCalled()
  await fireEvent(track(), "responderMove", {
    nativeEvent: { ...point(249.6, nativeTrack), changedTouches: [point(249.6, first, 0), point(198.4, second, 1)] },
  })
  await fireEvent(track(), "responderRelease", {
    nativeEvent: { ...point(249.6, nativeTrack), changedTouches: [point(249.6, first, 0), point(198.4, second, 1)] },
  })
  expect(changed.mock.calls).toEqual([[[0.35, 0.75]], [[0.35, 0.65]]])
  expect(ended.mock.calls).toEqual([[[0.35, 0.65]]])
})

it("retires native-target measurements and old events across original root replacement", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  const node = (key: string) => (
    <Slider
      accessibilityLabel="Quantity"
      minValue={0}
      maxValue={1}
      step={0.05}
      defaultValue={0.5}
      onChange={changed}
      onChangeEnd={ended}
      render={(props) => <RN.View {...props} key={key} />}
    />
  )
  const view = await render(node("original"))
  const oldTrack = track().props,
    oldTag = tag("slider-track")
  deferred = []
  await fireEvent(track(), "responderGrant", event(206.66666666666666, oldTag))
  const callbacks = deferred
  expect(callbacks).toHaveLength(3)
  await view.rerender(node("replacement"))
  expect(tag("slider-track")).not.toBe(oldTag)
  await act(() => {
    callbacks.forEach((resolve) => resolve())
    oldTrack.onResponderMove(event(258, oldTag))
    oldTrack.onResponderRelease(event(258, oldTag))
  })
  expect(changed).not.toHaveBeenCalled()
  expect(ended).not.toHaveBeenCalled()
  deferred = undefined
  const currentTag = tag("slider-track")
  await fireEvent(track(), "responderGrant", event(206.66666666666666, currentTag))
  await fireEvent(track(), "responderRelease", event(206.66666666666666, currentTag))
  expect(changed.mock.calls).toEqual([[0.6]])
  expect(ended.mock.calls).toEqual([[0.6]])
})

it.each(["measuring", "dragging"])(
  "retires a replaced native thumb while %s and admits its replacement",
  async (phase) => {
    await render(
      <>
        <RN.View testID="slider-track" />
        <RN.View testID="original-thumb" />
        <RN.View testID="replacement-thumb" />
      </>,
    )
    const originalTrack = originalHost("slider-track")
    const originalThumb = originalHost("original-thumb")
    const replacementThumb = originalHost("replacement-thumb")
    const trackRef = { current: originalTrack }
    const renderTrack = { target: originalTrack }
    const targets = { current: new Map([[0, originalThumb]]) }
    const bodies = { current: new Map<number, RN.View>() }
    const changed = jest.fn(),
      ended = jest.fn()
    const { result } = await renderHook(() =>
      useNativeSliderGesture(
        useNativeSliderState({
          accessibilityLabel: "Quantity",
          minValue: 0,
          maxValue: 1,
          step: 0.05,
          defaultValue: 0.5,
          onChange: changed,
          onChangeEnd: ended,
        }),
        trackRef,
        renderTrack,
        targets,
        bodies,
        "horizontal",
        "ltr",
        44,
        "stable",
      ),
    )
    const touch = (x: number, original: RN.View) =>
      event(x, ReactNative.findNodeHandle(original)!) as unknown as RN.GestureResponderEvent
    if (phase === "measuring") deferred = []
    await act(() => result.current.handlers.onResponderGrant!(touch(206.66666666666666, originalThumb)))
    const callbacks = deferred
    if (callbacks) expect(callbacks).toHaveLength(2)
    targets.current.set(0, replacementThumb)
    await act(() => {
      callbacks?.forEach((resolve) => resolve())
      result.current.handlers.onResponderMove!(touch(258, originalThumb))
      result.current.handlers.onResponderRelease!(touch(258, originalThumb))
    })
    expect(changed).not.toHaveBeenCalled()
    expect(ended).not.toHaveBeenCalled()
    deferred = undefined
    await act(() => result.current.handlers.onResponderGrant!(touch(206.66666666666666, replacementThumb)))
    await act(() => result.current.handlers.onResponderRelease!(touch(258, replacementThumb)))
    expect(changed.mock.calls).toEqual([[0.7]])
    expect(ended.mock.calls).toEqual([[0.7]])
  },
)
