import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, forwardRef, useState } from "react"
import {
  AccessibilityInfo,
  Platform,
  TextInput,
  View,
  Text as RNText,
  type MeasureOnSuccessCallback,
  type ViewProps,
} from "react-native"

import {
  NativeThemeProvider,
  NativeSliderStateContext,
  Slider,
  type TNativeSliderRef,
  type TNativeSliderRenderState,
  type TNativeSliderRootRender,
  type TNativeSliderStyleState,
} from "../../.."

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

const nativeMethods: { measure: jest.Mock } = jest.requireActual(
  "@react-native/jest-preset/jest/MockNativeMethods",
).default
let state: TNativeSliderStyleState
const observe = (value: TNativeSliderStyleState) => {
  state = value
  return {}
}
const target = () => screen.getByTestId("slider-thumb-1-target")
beforeEach(() => {
  jest.replaceProperty(Platform, "OS", "android")
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => jest.restoreAllMocks())

it("adds and removes a compatible root renderer without replacing the original root, values or owned children", async () => {
  const ref = createRef<TNativeSliderRef>()
  const seen: TNativeSliderRenderState[] = []
  const onLayout = jest.fn()
  const root: TNativeSliderRootRender = (props, current) => {
    seen.push(current)
    expect(props.ref).toBeDefined()
    return <View {...props} nativeID="rendered-slider" />
  }
  const node = (custom: boolean, value: number) => (
    <Slider
      label="Quantity"
      ref={ref}
      value={value}
      style={observe}
      onLayout={onLayout}
      render={custom ? root : undefined}
    />
  )
  const view = await render(node(false, 25))
  const original = ref.current
  expect(original).not.toBeNull()
  await view.rerender(node(true, 40))
  expect(ref.current).toBe(original)
  expect(seen.at(-1)).toMatchObject({ orientation: "horizontal", isDisabled: false })
  expect(seen.at(-1)!.state.values).toEqual([40])
  expect(screen.getByTestId("slider").props.nativeID).toBe("rendered-slider")
  expect(screen.getByTestId("slider").props.render).toBeUndefined()
  expect(screen.getByTestId("slider-label")).toHaveTextContent("Quantity")
  expect(screen.getByTestId("slider-output")).toHaveTextContent("40")
  expect(target()).toHaveAccessibilityValue({ min: 0, max: 100, now: 40 })
  const event = { nativeEvent: { layout: { x: 1, y: 2, width: 300, height: 48 } } }
  await fireEvent(screen.getByTestId("slider"), "layout", event)
  expect(onLayout.mock.calls).toEqual([[event]])
  expect(onLayout.mock.calls[0][0]).toBe(event)
  await view.rerender(node(false, 40))
  expect(ref.current).toBe(original)
  expect(screen.getByTestId("slider").props.nativeID).toBeUndefined()
  expect(state.state.values).toEqual([40])
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("retains a custom native root and caller editor ref/draft through owner and provider changes", async () => {
  const ref = createRef<View>(),
    editor = createRef<TextInput>()
  const Root = forwardRef<View, ViewProps>((props, rootRef) => (
    <View {...props} ref={rootRef} nativeID="consumer-root" />
  ))
  const Consumer = () => {
    const [value, setValue] = useState("unchanged draft")
    return (
      <TextInput
        ref={editor}
        testID="consumer-editor"
        value={value}
        onChangeText={setValue}
        accessibilityLabel="Consumer editor"
      />
    )
  }
  const root: TNativeSliderRootRender = (props) => (
    <Root {...props}>
      {props.children}
      <Consumer />
    </Root>
  )
  const node = (mode: "light" | "dark", value: number) => (
    <NativeThemeProvider mode={mode}>
      <Slider label="Quantity" ref={ref} value={value} render={root} />
    </NativeThemeProvider>
  )
  const view = await render(node("light", 20))
  const originalRoot = ref.current,
    originalEditor = editor.current
  expect(originalEditor).not.toBeNull()
  await fireEvent.changeText(screen.getByTestId("consumer-editor"), "retained draft")
  await view.rerender(node("dark", 50))
  expect(ref.current).toBe(originalRoot)
  expect(editor.current).toBe(originalEditor)
  expect(screen.getByTestId("consumer-editor").props.value).toBe("retained draft")
  expect(target()).toHaveAccessibilityValue({ now: 50 })
  await view.unmount()
  expect(ref.current).toBeNull()
  expect(editor.current).toBeNull()
})

it("warns when a renderer drops the actual ref and never manufactures a replacement native object", async () => {
  const ref = createRef<View>()
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined)
  const root: TNativeSliderRootRender = ({ children }) => <View testID="unbound-root">{children}</View>
  const view = await render(<Slider label="Quantity" ref={ref} render={root} />)
  expect(ref.current).toBeNull()
  expect(warn).toHaveBeenCalledWith(
    "Slider: custom render must forward its ref and props to the actual native root View.",
  )
  expect(target()).toHaveAccessibilityValue({ now: 0 })
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("retires original track measurements across actual root replacement and preserves the next valid gesture", async () => {
  const ref = createRef<View>(),
    onChange = jest.fn(),
    onChangeEnd = jest.fn()
  let deferred: (() => void)[] | undefined = []
  nativeMethods.measure.mockImplementation(function (
    this: { props: { testID: string } },
    callback: MeasureOnSuccessCallback,
  ) {
    const frame =
      this.props.testID === "slider-track"
        ? [100, 200, 300, 48]
        : this.props.testID.endsWith("-target")
          ? [100, 200, 48, 48]
          : [115, 215, 18, 18]
    const resolve = () => callback(0, 0, frame[2], frame[3], frame[0], frame[1])
    if (deferred) deferred.push(resolve)
    else resolve()
  })
  const renderer =
    (key: string): TNativeSliderRootRender =>
    (props) => <View {...props} key={key} />
  const node = (key: string) => (
    <Slider label="Quantity" ref={ref} render={renderer(key)} onChange={onChange} onChangeEnd={onChangeEnd} />
  )
  const view = await render(node("original"))
  const original = ref.current
  const track = () => screen.getByTestId("slider-track")
  const event = (x: number) => ({ nativeEvent: { pageX: x, pageY: 224, identifier: 1 } })
  await fireEvent(track(), "responderGrant", event(200))
  const oldTrack = track().props
  const originalMeasure = deferred!
  expect(originalMeasure).toHaveLength(3)
  await view.rerender(node("replacement"))
  expect(ref.current).not.toBe(original)
  await fireEvent(track(), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 48 } } })
  expect(target()).toHaveStyle({ left: 24 })
  await act(() => {
    oldTrack.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 0 } } })
    expect(oldTrack.onStartShouldSetResponderCapture()).toBe(false)
    expect(oldTrack.onResponderGrant(event(250))).toBe(false)
    oldTrack.onResponderMove(event(250))
    oldTrack.onResponderRelease(event(250))
  })
  expect(target()).toHaveStyle({ left: 24 })
  await act(() => originalMeasure.forEach((resolve) => resolve()))
  expect(onChange).not.toHaveBeenCalled()
  expect(onChangeEnd).not.toHaveBeenCalled()
  deferred = undefined
  await fireEvent(track(), "responderGrant", event(200))
  await fireEvent(track(), "responderRelease", event(200))
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChangeEnd).toHaveBeenCalledTimes(1)
  expect(onChangeEnd.mock.calls[0][0]).toEqual(onChange.mock.calls[0][0])
})

it("provides isolated current state to custom-root descendants and restores the outer state around a nested Slider", async () => {
  const ref = createRef<View>()
  const read = (id: string) => (
    <NativeSliderStateContext.Consumer>
      {(current) => <RNText testID={id}>{current ? current.values.join(",") : "outside"}</RNText>}
    </NativeSliderStateContext.Consumer>
  )
  const inner: TNativeSliderRootRender = (props) => (
    <View {...props}>
      {props.children}
      {read("inner-state")}
    </View>
  )
  const outer =
    (value: number): TNativeSliderRootRender =>
    (props) => (
      <View {...props}>
        {props.children}
        {read("outer-before")}
        <Slider label="Nested" testID="nested" value={value} render={inner} />
        {read("outer-after")}
      </View>
    )
  const node = (value: number, nested: number) => (
    <>
      {read("outside-state")}
      <Slider label="Outer" ref={ref} value={value} render={outer(nested)} />
    </>
  )
  const view = await render(node(40, 10))
  const original = ref.current
  expect(screen.getByTestId("outside-state")).toHaveTextContent("outside")
  expect(screen.getByTestId("outer-before")).toHaveTextContent("40")
  expect(screen.getByTestId("inner-state")).toHaveTextContent("10")
  expect(screen.getByTestId("outer-after")).toHaveTextContent("40")
  await view.rerender(node(70, 20))
  expect(ref.current).toBe(original)
  expect(screen.getByTestId("outer-before")).toHaveTextContent("70")
  expect(screen.getByTestId("inner-state")).toHaveTextContent("20")
  expect(screen.getByTestId("outer-after")).toHaveTextContent("70")
})
