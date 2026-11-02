import { act, render, fireEvent, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Platform, View } from "react-native"

import { NativeSliderContext, Slider, type TNativeSliderRootRender, type TNativeSliderStyleState } from "../../.."
import { NATIVE_DEFAULT_SLOT } from "../../../collection/context"

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
let state: TNativeSliderStyleState
const observe = (current: TNativeSliderStyleState) => {
  state = current
  return {}
}
const target = () => screen.getByTestId("slider-thumb-1-target")
beforeEach(() => {
  jest.replaceProperty(Platform, "OS", "android")
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => jest.restoreAllMocks())
it("merges named context props, original events, owner requests and actual refs with caller precedence", async () => {
  const contextRef = createRef<View>(),
    callerRef = createRef<View>()
  const layouts: unknown[] = [],
    requests: unknown[] = [],
    defaults: unknown[] = []
  const value = [25]
  const view = await render(
    <NativeSliderContext.Provider
      value={{
        slots: {
          range: {
            ref: contextRef,
            accessibilityLabel: "Context name",
            value,
            isDisabled: true,
            onChange: (next) => requests.push(next),
            onLayout: (event) => layouts.push(event),
            style: { backgroundColor: "red", padding: 7 },
          },
        },
      }}
    >
      <Slider
        slot="range"
        label="Visible"
        accessibilityLabel="Caller name"
        ref={callerRef}
        isDisabled={false}
        customStyles={{ padding: 0 }}
        onChange={(next) => requests.push(next)}
        onLayout={(event) => layouts.push(event)}
        style={(current) => {
          state = current
          defaults.push(current.defaultStyle)
          return { ...current.defaultStyle, padding: 3 }
        }}
      />
    </NativeSliderContext.Provider>,
  )
  expect(contextRef.current).not.toBeNull()
  expect(callerRef.current).toBe(contextRef.current)
  expect(screen.getByTestId("slider").props.slot).toBeUndefined()
  expect(screen.getByTestId("slider")).toHaveStyle({ backgroundColor: "red", padding: 3 })
  expect(defaults.at(-1)).toMatchObject({ backgroundColor: "red", padding: 7 })
  expect(target().props.accessibilityLabel).toBe("Caller name, Slider Thumb 1")
  expect(target().props.accessibilityState.disabled).toBe(false)
  const event = { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 48 } } }
  await fireEvent(screen.getByTestId("slider"), "layout", event)
  expect(layouts).toEqual([event, event])
  expect(layouts[0]).toBe(event)
  expect(layouts[1]).toBe(event)
  await act(() => state.state.setThumbValue(0, 30))
  expect(requests).toEqual([[30], [30]])
  expect(requests[0]).toBe(requests[1])
  expect(value).toEqual([25])
  expect(target()).toHaveAccessibilityValue({ now: 25 })
  await view.unmount()
  expect(contextRef.current).toBeNull()
  expect(callerRef.current).toBeNull()
})

it("keeps default, named and null slots distinct and rejects missing context slots", async () => {
  const node = (slot?: string | null) => (
    <NativeSliderContext.Provider
      value={{ slots: { [NATIVE_DEFAULT_SLOT]: { maxValue: 200 }, range: { maxValue: 400 } } }}
    >
      <Slider slot={slot} label="Quantity" value={[50]} />
    </NativeSliderContext.Provider>
  )
  const view = await render(node())
  expect(target()).toHaveAccessibilityValue({ max: 200, now: 50 })
  await view.rerender(node("range"))
  expect(target()).toHaveAccessibilityValue({ max: 400, now: 50 })
  await view.rerender(node(null))
  expect(target()).toHaveAccessibilityValue({ max: 100, now: 50 })
  await view.unmount()
  await expect(render(node("missing"))).rejects.toThrow('Invalid slot "missing"')
})

it("reconciles replacement context refs/renderers and latest callbacks without changing owner values or the root", async () => {
  const first = createRef<View>(),
    second = createRef<View>(),
    caller = createRef<View>()
  const oldChange = jest.fn(),
    nextChange = jest.fn()
  const native: TNativeSliderRootRender = (props) => <View {...props} />
  const node = (updated: boolean) => (
    <NativeSliderContext.Provider
      value={{
        ref: updated ? second : first,
        value: [20],
        onChange: updated ? nextChange : oldChange,
        render: updated ? native : undefined,
        accessibilityLabel: updated ? "Next context" : "First context",
      }}
    >
      <Slider label="Visible" ref={caller} style={observe} />
    </NativeSliderContext.Provider>
  )
  const view = await render(node(false))
  const original = caller.current
  expect(first.current).toBe(original)
  await view.rerender(node(true))
  expect(first.current).toBeNull()
  expect(second.current).toBe(original)
  expect(caller.current).toBe(original)
  expect(target().props.accessibilityLabel).toBe("Next context, Slider Thumb 1")
  await act(() => state.state.setThumbValue(0, 30))
  expect(oldChange).not.toHaveBeenCalled()
  expect(nextChange).toHaveBeenCalledWith([30])
  expect(target()).toHaveAccessibilityValue({ now: 20 })
  await view.unmount()
  expect(second.current).toBeNull()
  expect(caller.current).toBeNull()
})

it.each([0, [0]])(
  "preserves contextual value and chained request/end shapes for %p without changing controlled authority",
  async (value) => {
    const inherited: unknown[] = [],
      own: unknown[] = [],
      ended: unknown[] = []
    await render(
      <NativeSliderContext.Provider
        value={{ value, onChange: (next) => inherited.push(next), onChangeEnd: (next) => ended.push(next) }}
      >
        <Slider
          label="Quantity"
          style={observe}
          onChange={(next) => own.push(next)}
          onChangeEnd={(next) => ended.push(next)}
        />
      </NativeSliderContext.Provider>,
    )
    await act(() => {
      state.state.setThumbDragging(0, true)
      state.state.setThumbValue(0, 1)
      state.state.setThumbDragging(0, false)
    })
    const expected = typeof value === "number" ? 1 : [1]
    expect(inherited).toEqual([expected])
    expect(own).toEqual([expected])
    expect(ended).toEqual([expected, expected])
    expect(inherited[0]).toBe(own[0])
    expect(ended[0]).toBe(ended[1])
    expect(state.state.values).toEqual([0])
  },
)

it("keeps no-context runtime defaults as arrays and slot=null independent of scalar context", async () => {
  const calls: number[][] = []
  await render(
    <NativeSliderContext.Provider value={{ value: 90 }}>
      <Slider slot={null} label="Independent" style={observe} onChange={(value) => calls.push(value)} />
    </NativeSliderContext.Provider>,
  )
  expect(state.state.values).toEqual([0])
  await act(() => state.state.setThumbValue(0, 1))
  expect(calls).toEqual([[1]])
})
