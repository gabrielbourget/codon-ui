import { fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, type View } from "react-native"

import { ToggleSwitcher } from "../ToggleSwitcher"
import type { TNativeToggleSwitcherProps } from "../types"

jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: {
    requestKeyboardFocus: jest.fn(),
    requestContainerFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    inspectAccessibility: jest.fn(),
    queryMotionGeometry: jest.fn(),
    sampleMotionColors: jest.fn(),
  },
}))
const items = [
  { id: "a", label: "First" },
  { id: "b", label: "Second" },
]
beforeEach(() => jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true))
afterEach(() => jest.restoreAllMocks())

it("forwards original stock pointer/activation click records and replacement callbacks through the unchanged root", async () => {
  const first = jest.fn(),
    next = jest.fn(),
    capture = jest.fn(),
    change = jest.fn()
  const ref = createRef<View>()
  const result = await render(
    <ToggleSwitcher
      items={items}
      ref={ref}
      selectedKey="a"
      onSelectionChange={change}
      onClick={first}
      onClickCapture={capture}
    />,
  )
  const original = ref.current
  const pointer = {
    nativeEvent: { pointerId: 4, pointerType: "mouse" },
    target: {},
    currentTarget: original,
    persist: jest.fn(),
  }
  const activation = { nativeEvent: {}, target: {}, currentTarget: original, persist: jest.fn() }
  await fireEvent(screen.getByTestId("toggle-switcher"), "clickCapture", pointer)
  await fireEvent(screen.getByTestId("toggle-switcher"), "click", activation)
  expect(capture.mock.calls[0][0]).toBe(pointer)
  expect(first.mock.calls[0][0]).toBe(activation)
  await result.rerender(
    <ToggleSwitcher
      items={items}
      ref={ref}
      selectedKey="a"
      onSelectionChange={change}
      onClick={next}
      onClickCapture={capture}
    />,
  )
  await fireEvent(screen.getByTestId("toggle-switcher"), "click", pointer)
  expect(next.mock.calls[0][0]).toBe(pointer)
  expect(first).toHaveBeenCalledTimes(1)
  expect(ref.current).toBe(original)
  expect(change).not.toHaveBeenCalled()
})

it("transports all stock lifecycle/over/out/touch capture callbacks without replacing targets or emitting selection", async () => {
  const keys = [
    "onFocusCapture",
    "onBlurCapture",
    "onGotPointerCapture",
    "onGotPointerCaptureCapture",
    "onLostPointerCapture",
    "onLostPointerCaptureCapture",
    "onPointerOver",
    "onPointerOverCapture",
    "onPointerOut",
    "onPointerOutCapture",
    "onTouchStartCapture",
    "onTouchMoveCapture",
    "onTouchCancelCapture",
  ] as const
  const callbacks = Object.fromEntries(keys.map((key) => [key, jest.fn()])) as Pick<
    TNativeToggleSwitcherProps,
    (typeof keys)[number]
  >
  const change = jest.fn(),
    ref = createRef<View>()
  await render(<ToggleSwitcher {...callbacks} ref={ref} items={items} selectedKey="a" onSelectionChange={change} />)
  const original = ref.current
  for (const key of keys) {
    const event = {
      nativeEvent: { pointerId: 4, pointerType: "pen" },
      target: {},
      currentTarget: original,
      persist: jest.fn(),
    }
    await fireEvent(screen.getByTestId("toggle-switcher"), key, event)
    expect(callbacks[key]).toHaveBeenCalledTimes(1)
    expect(jest.mocked(callbacks[key]!).mock.calls[0][0]).toBe(event)
  }
  expect(ref.current).toBe(original)
  expect(change).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "First" }).props.accessibilityState.checked).toBe(true)
})

it("retains original stock bubbled focus and blur records through the owned root", async () => {
  const focus = jest.fn(),
    blur = jest.fn(),
    ref = createRef<View>()
  const result = await render(<ToggleSwitcher items={items} ref={ref} onFocus={focus} onBlur={blur} />)
  const original = ref.current
  const event = { nativeEvent: { target: 47 }, target: {}, currentTarget: original, persist: jest.fn() }
  await fireEvent(screen.getByTestId("toggle-switcher"), "focus", event)
  await fireEvent(screen.getByTestId("toggle-switcher"), "blur", event)
  expect(focus.mock.calls[0][0]).toBe(event)
  expect(blur.mock.calls[0][0]).toBe(event)
  expect(ref.current).toBe(original)
  await result.unmount()
  expect(ref.current).toBeNull()
})

it("retains native description and detail references while explicit empty/removal clears them without replacing owned controls", async () => {
  const ref = createRef<View>()
  const change = jest.fn()
  const node = (description?: string, details?: string) => (
    <ToggleSwitcher
      items={items}
      ref={ref}
      selectedKey="a"
      onSelectionChange={change}
      aria-describedby={description}
      aria-details={details}
      accessibilityHint="Authored native hint"
      aria-live="polite"
    />
  )
  const result = await render(node("hint other", "details"))
  const original = ref.current
  const option = screen.getByRole("button", { name: "First" })
  const root = () => screen.getByTestId("toggle-switcher")
  expect(root().props.nativeDescribedBy).toEqual(["hint", "other"])
  expect(root().props.nativeDetailsBy).toEqual(["details"])
  expect(root().props["aria-describedby"]).toBeUndefined()
  expect(root().props["aria-details"]).toBeUndefined()
  expect(root().props.accessibilityHint).toBe("Authored native hint")
  expect(root().props.accessibilityLiveRegion).toBe("polite")
  await result.rerender(node("", ""))
  expect(root().props.nativeDescribedBy).toEqual([])
  expect(root().props.nativeDetailsBy).toEqual([])
  await result.rerender(node())
  expect(root().props.nativeDescribedBy).toBeUndefined()
  expect(root().props.nativeDetailsBy).toBeUndefined()
  expect(ref.current).toBe(original)
  expect(screen.getByRole("button", { name: "First" })).toBe(option)
  expect(option.props.accessibilityState.checked).toBe(true)
  expect(change).not.toHaveBeenCalled()
})

it("maps the modal alias to native metadata with authored native precedence and stable original controls", async () => {
  const ref = createRef<View>()
  const node = (alias?: boolean, native?: boolean) => (
    <ToggleSwitcher items={items} ref={ref} selectedKey="a" aria-modal={alias} accessibilityViewIsModal={native} />
  )
  const result = await render(node(true))
  const original = ref.current
  const option = screen.getByRole("button", { name: "First" })
  const root = () => screen.getByTestId("toggle-switcher")
  expect(root().props.accessibilityViewIsModal).toBe(true)
  expect(root().props["aria-modal"]).toBeUndefined()
  await result.rerender(node(true, false))
  expect(root().props.accessibilityViewIsModal).toBe(false)
  await result.rerender(node(false, true))
  expect(root().props.accessibilityViewIsModal).toBe(true)
  await result.rerender(node())
  expect(root().props.accessibilityViewIsModal).toBeUndefined()
  expect(ref.current).toBe(original)
  expect(screen.getByRole("button", { name: "First" })).toBe(option)
  expect(root().props.accessible).toBe(false)
  expect(option.props.accessibilityState.checked).toBe(true)
})
