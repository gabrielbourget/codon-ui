import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import type { View } from "react-native"
import {
  AccessibilityInfo,
  Animated,
  Easing,
  processColor,
  StyleSheet,
  Text as RawText,
  TextInput,
  View as NativeView,
} from "react-native"

import { Counter, NativeThemeProvider, Text } from "../../.."

const hidden = { includeHiddenElements: true }

it("supplies its current root typography to the original native host while preserving raw children and editor ownership", async () => {
  const rootRef = createRef<View>()
  const editorRef = createRef<TextInput>()
  const changed = jest.fn()
  const node = (updated: boolean) => (
    <Counter
      ref={rootRef}
      value={0}
      customStyles={{
        fontStyle: updated ? "normal" : "italic",
        letterSpacing: updated ? 0 : 7,
        color: updated ? "green" : "purple",
      }}
    >
      <NativeView>
        <RawText>Original raw content</RawText>
        <TextInput
          ref={editorRef}
          testID="held-editor"
          value="held"
          selection={{ start: 1, end: 1 }}
          onChangeText={changed}
        />
      </NativeView>
    </Counter>
  )
  const view = await render(node(false))
  const root = rootRef.current
  const editor = editorRef.current
  expect(JSON.parse(screen.getByTestId("counter").props.nativeTypographyStyle ?? "{}")).toMatchObject({
    fontStyle: "italic",
    letterSpacing: 7,
    textAlign: "center",
    color: processColor("purple"),
  })
  await fireEvent.changeText(screen.getByTestId("held-editor"), "request")
  expect(changed).toHaveBeenCalledTimes(1)
  expect(changed).toHaveBeenCalledWith("request")
  expect(screen.getByTestId("held-editor").props.value).toBe("held")
  await view.rerender(node(true))
  expect(rootRef.current === root).toBe(true)
  expect(editorRef.current === editor).toBe(true)
  expect(screen.getByTestId("held-editor").props.selection).toEqual({ start: 1, end: 1 })
  expect(JSON.parse(screen.getByTestId("counter").props.nativeTypographyStyle ?? "{}")).toMatchObject({
    fontStyle: "normal",
    letterSpacing: 0,
    color: processColor("green"),
  })
  await view.unmount()
  expect(rootRef.current).toBeNull()
  expect(editorRef.current).toBeNull()
})

it("preserves ordinary native empty-child props and original refs without requesting automatic hiding", async () => {
  const ref = createRef<View>()
  const childRef = createRef<View>()
  const view = await render(
    <Counter ref={ref} value={0}>
      <NativeView ref={childRef} testID="empty-child" style={{ height: 20, width: 20 }} />
    </Counter>,
  )
  const original = ref.current
  const originalChild = childRef.current
  expect(screen.getByTestId("counter").props.nativeCounterEmptyChildren).toBeUndefined()
  expect(screen.getByTestId("empty-child", hidden)).toHaveStyle({ height: 20, width: 20 })
  await view.rerender(
    <Counter ref={ref} value={0}>
      <NativeView ref={childRef} testID="empty-child" style={{ display: "flex", height: 20, width: 20 }} />
    </Counter>,
  )
  expect(ref.current === original).toBe(true)
  expect(childRef.current === originalChild).toBe(true)
  expect(screen.getByTestId("empty-child")).toHaveStyle({ display: "flex", height: 20, width: 20 })
  await view.unmount()
  expect(ref.current).toBeNull()
  expect(childRef.current).toBeNull()
})

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("inherits root typography into content while numeric text keeps its own style precedence", async () => {
  const ref = createRef<View>()
  const view = await render(
    <Counter ref={ref} value="0" customStyles={{ fontStyle: "italic", letterSpacing: 7 }}>
      Caption
    </Counter>,
  )
  const original = ref.current
  expect(screen.getByText("Caption")).toHaveStyle({ textAlign: "center" })
  expect(screen.getByText("Caption")).toHaveStyle({ fontStyle: "italic", letterSpacing: 7 })
  expect(screen.getByTestId("counter-value")).toHaveStyle({ fontStyle: "italic", letterSpacing: 7 })
  await view.rerender(
    <Counter
      ref={ref}
      value="0"
      customStyles={{ fontStyle: "italic", letterSpacing: 7 }}
      style={{ fontStyle: "normal", letterSpacing: 0 }}
      customTextStyles={{ fontStyle: "italic" }}
    >
      Caption
    </Counter>,
  )
  expect(ref.current === original).toBe(true)
  expect(screen.getByText("Caption")).toHaveStyle({ fontStyle: "normal", letterSpacing: 0 })
  expect(screen.getByTestId("counter-value")).toHaveStyle({ fontStyle: "italic", letterSpacing: 0 })
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("maps canonical render/dimensions/color/ref and optional raw max text", async () => {
  const ref = createRef<View>()
  await render(
    <Counter
      ref={ref}
      aria-label="Count"
      value="0049"
      maxValue="0100"
      showMaxValue
      height={30}
      width={150}
      color="turquoise"
    />,
  )
  expect(screen.getByTestId("counter")).toHaveStyle({ height: 30, width: 150, flexDirection: "row", gap: 5 })
  expect(screen.getByTestId("counter-value")).toHaveTextContent("0049")
  expect(screen.getByTestId("counter-max")).toHaveTextContent("/0100")
  expect(screen.getByTestId("counter-value")).toHaveStyle({ color: "turquoise" })
  expect(ref.current?.measure).toEqual(expect.any(Function))
})

it.each([0, "0", "", "wat", -5, "0042"])("keeps caller-owned raw value %s", async (value) => {
  const owner = Object.freeze({ value })
  await render(<Counter {...owner} />)
  expect(screen.getByTestId("counter-value").props.children).toBe(value)
  expect(owner.value).toBe(value)
})

it.each([0, "0", "", undefined, 100, "100"])("retains truthy max branch ownership for %s", async (maxValue) => {
  await render(<Counter value={0} maxValue={maxValue} showMaxValue showProgressIndicator />)
  expect(!!screen.queryByTestId("counter-max")).toBe(!!maxValue)
  expect(!!screen.queryByTestId("counter-progress")).toBe(!!maxValue)
  if (maxValue === "0") {
    expect(screen.queryByTestId("counter-progress-path", hidden)).toBeNull()
    expect(screen.getByTestId("counter-max")).toHaveTextContent("/0")
  }
})

it("updates show flags and controlled data without changing its native ref", async () => {
  const ref = createRef<View>()
  const { rerender } = await render(<Counter ref={ref} value={18} maxValue={48} />)
  const host = ref.current
  expect(screen.queryByTestId("counter-progress")).toBeNull()
  expect(screen.queryByTestId("counter-max")).toBeNull()
  await rerender(<Counter ref={ref} value={0} maxValue={48} showMaxValue showProgressIndicator />)
  expect(ref.current).toBe(host)
  expect(screen.getByTestId("counter-value").props.children).toBe(0)
  expect(screen.getByTestId("counter-progress")).toHaveAccessibilityValue({ now: 0, text: "0%" })
  await rerender(<Counter ref={ref} value={0} maxValue={48} showMaxValue={false} showProgressIndicator={false} />)
  expect(screen.queryByTestId("counter-progress")).toBeNull()
})

it.each([
  [79.49, 80, 90, "#171717"],
  [79.5, 80, 90, "#a66b00"],
  [89.5, 80, 90, "#b73434"],
  [50, 80, 0, "#b73434"],
  [50, 0, undefined, "#a66b00"],
  [100, 90, 80, "#b73434"],
  ["wat", 0, 0, "#171717"],
  [Infinity, 0, 0, "#171717"],
] as const)(
  "rounds %s before thresholds and prioritizes danger",
  async (value, warningPercentageThreshold, errorOrDangerPercentageThreshold, color) => {
    await render(
      <Counter
        value={value}
        maxValue={100}
        warningPercentageThreshold={warningPercentageThreshold}
        errorOrDangerPercentageThreshold={errorOrDangerPercentageThreshold}
      />,
    )
    expect(screen.getByTestId("counter-value")).toHaveStyle({ color })
  },
)

it("maps all three style owners, final root precedence and child foreground inheritance", async () => {
  const styles = StyleSheet.create({ root: { height: 35, color: "red" }, text: { fontSize: 18, color: "purple" } })
  await render(
    <Counter
      value={95}
      maxValue={100}
      showMaxValue
      showProgressIndicator
      color="blue"
      height={20}
      width={40}
      warningPercentageThreshold={80}
      errorOrDangerPercentageThreshold={90}
      customStyles={styles.root}
      style={{ height: 45, color: "green" }}
      customTextStyles={[styles.text, { fontWeight: "bold" }]}
      customProgressIndicatorStyles={{ width: 22, opacity: 0.7 }}
    >
      <Text testID="child">After value</Text>
      {7n}
    </Counter>,
  )
  expect(screen.getByTestId("counter")).toHaveStyle({ height: 45, width: 40 })
  expect(screen.getByTestId("counter-value")).toHaveStyle({ color: "purple", fontSize: 18, fontWeight: "bold" })
  expect(screen.getByTestId("counter-max")).toHaveStyle({ color: "purple" })
  expect(screen.getByTestId("counter-progress")).toHaveStyle({ width: 22, height: 12, opacity: 0.7 })
  expect(screen.getByTestId("child")).toHaveStyle({ color: "green" })
  expect(screen.getByText("7")).toBeOnTheScreen()
})

it("preserves named indicator color versus actual stroke and label alias precedence", async () => {
  await render(
    <Counter
      value={95}
      maxValue={100}
      showProgressIndicator
      ariaLabel="Legacy"
      aria-label=""
      warningPercentageThreshold={80}
      errorOrDangerPercentageThreshold={90}
    />,
  )
  expect(screen.getByTestId("counter").props.accessibilityLabel).toBe("")
  expect(screen.getByRole("progressbar", { name: "Progress" })).toBeOnTheScreen()
  expect(screen.getByTestId("counter-progress-path", hidden).props).toMatchObject({
    color: "#b73434",
    stroke: { payload: 0xff2563eb },
  })
})

it("updates provider status colors and retains nonnumeric text while omitting invalid path data", async () => {
  const { rerender } = await render(<Counter value="non numeric" maxValue="0" showProgressIndicator showMaxValue />)
  expect(screen.getByTestId("counter-value")).toHaveTextContent("non numeric")
  expect(screen.getByTestId("counter-progress-track", hidden)).toBeOnTheScreen()
  expect(screen.queryByTestId("counter-progress-path", hidden)).toBeNull()
  await rerender(
    <NativeThemeProvider mode="dark" overrides={{ colors: { statusWarning: "orange" } }}>
      <Counter value={85} maxValue={100} warningPercentageThreshold={80} />
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("counter-value")).toHaveStyle({ color: "orange" })
})

it("consumes wrapper props and binds native description/details ID relationships", async () => {
  await render(
    <Counter
      value={1}
      maxValue={2}
      showMaxValue
      warningPercentageThreshold={80}
      ariaDetails="detail"
      ariaDescribedBy="first second"
    />,
  )
  const root = screen.getByTestId("counter")
  for (const key of ["value", "maxValue", "showMaxValue", "warningPercentageThreshold", "customStyles", "color"])
    expect(root.props[key]).toBeUndefined()
  expect(root.props.nativeDescribedBy).toEqual(["first", "second"])
  expect(root.props.nativeDetailsBy).toEqual(["detail"])
  expect(root.props.keyboardFocusable).toBe(false)
})

it.each([
  [0, false, true],
  [-1, true, false],
] as const)("preserves tabIndex %s precedence over focusable %s", async (tabIndex, focusable, expected) => {
  await render(<Counter value={1} tabIndex={tabIndex} focusable={focusable} />)
  expect(screen.getByTestId("counter").props.keyboardFocusable).toBe(expected)
})

it("retains original bubbling core focus and blur callbacks on its native relationship host", async () => {
  const onFocus = jest.fn(),
    onBlur = jest.fn()
  await render(<Counter value={1} onFocus={onFocus} onBlur={onBlur} />)
  const original = { nativeEvent: { target: 41 } }
  await fireEvent(screen.getByTestId("counter"), "focus", original)
  await fireEvent(screen.getByTestId("counter"), "blur", original)
  expect(onFocus.mock.calls).toEqual([[original]])
  expect(onBlur.mock.calls).toEqual([[original]])
})

it("inherits the canonical color transition once, interrupts at current color and cleans up", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const remove = jest.spyOn(Animated.Value.prototype, "removeListener")
  const timing = jest.spyOn(Animated, "timing")
  const { rerender, unmount } = await render(<Counter value={0} style={{ color: "black" }} />)
  await rerender(<Counter value={0} style={{ color: "white" }} />)
  const transition = timing.mock.calls.at(-1)?.[1]
  expect(transition?.duration).toBe(250)
  const ease = Easing.bezier(0.42, 0, 0.58, 1)
  for (const fraction of [0.25, 0.5, 0.75]) expect(transition?.easing?.(fraction)).toBeCloseTo(ease(fraction), 6)
  await act(async () => jest.advanceTimersByTime(64))
  const current = processColor(StyleSheet.flatten(screen.getByTestId("counter-value").props.style).color) as number
  expect(current & 255).toBeGreaterThan(0)
  expect(current & 255).toBeLessThan(128)
  await rerender(<Counter value={0} style={{ color: "red" }} />)
  expect(processColor(StyleSheet.flatten(screen.getByTestId("counter-value").props.style).color)).toBe(current)
  await act(async () => jest.advanceTimersByTime(150))
  expect(processColor(StyleSheet.flatten(screen.getByTestId("counter-value").props.style).color)).not.toBe(
    processColor("red"),
  )
  await act(async () => jest.advanceTimersByTime(150))
  expect(screen.getByTestId("counter-value")).toHaveStyle({ color: "red" })
  await unmount()
  expect(remove).toHaveBeenCalled()
})
