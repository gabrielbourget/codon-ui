import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Platform, type View } from "react-native"

import { NativeThemeProvider } from "../../../theme"
import { NativeCarouselDotsViewport } from "../NativeCarouselDotsVisualStrip"
import { NativeCarouselDotTarget } from "../NativeCarouselDotTarget"

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => jest.restoreAllMocks())
const graphic = () => screen.getByTestId("dot-graphic", { includeHiddenElements: true })

it.each([
  ["ios", 44],
  ["android", 48],
] as const)("uses a real %s %s-unit target around the unexpanded eight-unit graphic", async (platform, size) => {
  jest.replaceProperty(Platform, "OS", platform)
  await render(
    <NativeCarouselDotTarget
      index={0}
      isSelected={false}
      isFocusable
      accessibilityLabel="Item one"
      variant="default"
      onActivate={jest.fn()}
      testID="dot"
    />,
  )
  const target = screen.getByRole("radio", { name: "Item one" })
  expect(target).toHaveStyle({
    width: size,
    height: size,
    flexShrink: 0,
    backgroundColor: "transparent",
    cursor: "pointer",
  })
  expect(target.props.focusable).toBe(true)
  expect(target.props.accessibilityState).toEqual({ checked: false })
  expect(graphic()).toHaveStyle({ width: 8, height: 8, flexShrink: 0 })
  expect(graphic().props).toMatchObject({
    accessible: false,
    accessibilityElementsHidden: true,
    importantForAccessibility: "no-hide-descendants",
    pointerEvents: "none",
  })
  expect(screen.getAllByRole("radio")).toHaveLength(1)
  expect(target.props.hitSlop).toBeUndefined()
})

it.each([
  ["ios", 44, 338, -98],
  ["android", 48, 366, -106],
] as const)(
  "sizes the %s interactive track for its actual targets instead of overlapping eight-unit cells",
  async (platform, cellSize, width, translateX) => {
    jest.replaceProperty(Platform, "OS", platform)
    await render(
      <NativeCarouselDotsViewport
        cellSize={cellSize}
        visibleCount={7}
        windowStart={2}
        noTransition={false}
        testID="row"
      >
        {Array.from({ length: 10 }, (_, index) => (
          <NativeCarouselDotTarget
            key={index}
            index={index}
            isSelected={index === 5}
            isFocusable={index === 5}
            accessibilityLabel={`Item ${index + 1}`}
            variant={index === 5 ? "active" : "default"}
            onActivate={jest.fn()}
          />
        ))}
      </NativeCarouselDotsViewport>,
    )
    expect(screen.getByTestId("row-track")).toHaveStyle({ width, transform: [{ translateX }] })
    expect(screen.getAllByRole("radio")).toHaveLength(10)
    expect(screen.getByRole("radio", { name: "Item 6" })).toHaveStyle({ width: cellSize, height: cellSize })
  },
)

it("keeps repeated same-index requests and authoritative false/true selection, including empty names", async () => {
  const onActivate = jest.fn()
  const { rerender } = await render(
    <NativeCarouselDotTarget
      index={0}
      isSelected={false}
      isFocusable={false}
      accessibilityLabel=""
      variant="default"
      onActivate={onActivate}
      testID="dot"
    />,
  )
  const target = screen.getByTestId("dot")
  expect(target.props.accessibilityLabel).toBe("")
  expect(target.props.focusable).toBe(false)
  await fireEvent.press(target)
  await fireEvent.press(target)
  expect(onActivate.mock.calls).toEqual([[0], [0]])
  expect(screen.getByTestId("dot").props.accessibilityState.checked).toBe(false)
  await rerender(
    <NativeCarouselDotTarget
      index={0}
      isSelected
      isFocusable
      accessibilityLabel="Current"
      variant="active"
      onActivate={onActivate}
      testID="dot"
    />,
  )
  await fireEvent.press(screen.getByRole("radio", { name: "Current" }))
  expect(onActivate.mock.calls).toEqual([[0], [0], [0]])
  expect(screen.getByTestId("dot").props.accessibilityState.checked).toBe(true)
})

it("retains the native View ref and original focus/blur/layout payloads without claiming imperative focus delivery", async () => {
  const ref = createRef<View>()
  const onFocus = jest.fn(),
    onBlur = jest.fn(),
    onLayout = jest.fn()
  const { rerender } = await render(
    <NativeCarouselDotTarget
      ref={ref}
      index={1}
      isSelected
      isFocusable
      accessibilityLabel="Second"
      variant="active"
      onActivate={jest.fn()}
      onFocus={onFocus}
      onBlur={onBlur}
      onLayout={onLayout}
      testID="dot"
    />,
  )
  const host = ref.current
  expect(host?.measure).toEqual(expect.any(Function))
  const focus = { nativeEvent: { target: 17 } }
  const blur = { nativeEvent: { target: 17 } }
  const layout = { nativeEvent: { layout: { x: 0, y: 0, width: 44, height: 44 } } }
  await fireEvent(screen.getByTestId("dot"), "focus", focus)
  await fireEvent(screen.getByTestId("dot"), "blur", blur)
  await fireEvent(screen.getByTestId("dot"), "layout", layout)
  expect(onFocus.mock.calls[0][0]).toBe(focus)
  expect(onBlur.mock.calls[0][0]).toBe(blur)
  expect(onLayout.mock.calls[0][0]).toBe(layout)
  await rerender(
    <NativeCarouselDotTarget
      ref={ref}
      index={1}
      isSelected
      isFocusable
      accessibilityLabel="Renamed"
      variant="active"
      onActivate={jest.fn()}
      testID="dot"
    />,
  )
  expect(ref.current).toBe(host)
})

it("uses current callbacks for a live target and retires replaced/reinserted keyed native targets", async () => {
  const original = jest.fn(),
    replacement = jest.fn()
  const { rerender, unmount } = await render(
    <NativeCarouselDotTarget
      key={0}
      index={0}
      isSelected={false}
      isFocusable
      accessibilityLabel="First"
      variant="default"
      onActivate={original}
      testID="dot"
    />,
  )
  const oldPress = screen.getByTestId("dot").props.onClick
  const event = { nativeEvent: { timestamp: 1 }, currentTarget: 17, target: 17, stopPropagation: jest.fn() }
  await rerender(
    <NativeCarouselDotTarget
      key={0}
      index={0}
      isSelected={false}
      isFocusable
      accessibilityLabel="First"
      variant="default"
      onActivate={replacement}
      testID="dot"
    />,
  )
  await act(() => oldPress(event))
  expect(original).not.toHaveBeenCalled()
  expect(replacement.mock.calls).toEqual([[0]])
  await rerender(
    <NativeCarouselDotTarget
      key={1}
      index={1}
      isSelected={false}
      isFocusable
      accessibilityLabel="Second"
      variant="default"
      onActivate={replacement}
      testID="dot"
    />,
  )
  await act(() => oldPress(event))
  expect(replacement).toHaveBeenCalledTimes(1)
  await rerender(
    <NativeCarouselDotTarget
      key={0}
      index={0}
      isSelected={false}
      isFocusable
      accessibilityLabel="First again"
      variant="default"
      onActivate={replacement}
      testID="dot"
    />,
  )
  await act(() => oldPress(event))
  expect(replacement).toHaveBeenCalledTimes(1)
  const currentPress = screen.getByTestId("dot").props.onClick
  await unmount()
  await act(() => currentPress(event))
  expect(replacement).toHaveBeenCalledTimes(1)
})

it("keeps caller-owned focus decoration and mounted theme paint separate from selected semantics", async () => {
  const { rerender } = await render(
    <NativeThemeProvider>
      <NativeCarouselDotTarget
        index={0}
        isSelected={false}
        isFocusable
        accessibilityLabel="First"
        variant="near"
        raised
        focusVisible
        onActivate={jest.fn()}
        testID="dot"
      />
    </NativeThemeProvider>,
  )
  await rerender(
    <NativeThemeProvider mode="dark" overrides={{ colors: { controlBorder: "purple", focusRing: "pink" } }}>
      <NativeCarouselDotTarget
        index={0}
        isSelected={false}
        isFocusable
        accessibilityLabel="First"
        variant="near"
        raised
        focusVisible
        onActivate={jest.fn()}
        testID="dot"
      />
    </NativeThemeProvider>,
  )
  expect(graphic()).toHaveStyle({
    backgroundColor: "purple",
    outlineColor: "pink",
    outlineWidth: 1,
    outlineOffset: 2,
    elevation: 2,
    transform: [{ scale: 0.8 }],
  })
  expect(screen.getByTestId("dot").props.accessibilityState.checked).toBe(false)
})
