import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { Fragment, createRef } from "react"
import { Platform, View } from "react-native"

import { NativeThemeProvider, Switch, type TNativeSwitchRef } from "../../.."

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
const event = { nativeEvent: { timestamp: 100 } }
const part = (name: string) => screen.getByTestId(`switch-${name}`, { includeHiddenElements: true })

describe("Switch public native contract", () => {
  it("forwards the original native activation object while retaining owned selection", async () => {
    const onPress = jest.fn(),
      onChange = jest.fn()
    await render(<Switch isSelected={false} onPress={onPress} onChange={onChange} aria-label="Setting" />)
    const control = screen.getByRole("switch")
    await fireEvent(control, "press", event)
    expect(onPress.mock.calls).toEqual([[event]])
    expect(onPress.mock.calls[0][0]).toBe(event)
    expect(onChange.mock.calls).toEqual([[true]])
    expect(control.props.accessibilityState.checked).toBe(false)
    for (const prop of ["isSelected", "defaultSelected", "onChange", "isDisabled", "isReadOnly"]) {
      expect(control.props[prop]).toBeUndefined()
    }
  })

  it("keeps a small decorative track inside a single full-size target with grouped labels", async () => {
    await render(<Switch leftContent={["Enable ", <Fragment key="label">3</Fragment>]} rightContent="items" />)
    const control = screen.getByRole("switch", { name: "Enable 3 items" })
    expect(control).toHaveStyle({ minWidth: 44, minHeight: 44 })
    expect(control.props.accessibilityState).toEqual({ checked: false, disabled: false })
    expect(part("track")).toHaveStyle({ width: 30, height: 15, borderRadius: 10000, backgroundColor: "#c6c6c6" })
    expect(screen.getByText("Enable 3").props.selectable).toBe(false)
  })

  it("changes an uncontrolled value once per activation and composes native press events", async () => {
    const onChange = jest.fn(),
      onPress = jest.fn(),
      onPressIn = jest.fn(),
      onPressOut = jest.fn()
    await render(<Switch defaultSelected {...{ onChange, onPress, onPressIn, onPressOut }} aria-label="Setting" />)
    await userEvent.setup().press(screen.getByRole("switch"))
    expect(onChange.mock.calls).toEqual([[false]])
    for (const callback of [onPress, onPressIn, onPressOut]) expect(callback).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("switch").props.accessibilityState.checked).toBe(false)
  })

  it("requests controlled selection without changing it, and ignores later defaultSelected", async () => {
    const onChange = jest.fn()
    const { rerender } = await render(<Switch isSelected={false} onChange={onChange} />)
    await userEvent.setup().press(screen.getByRole("switch"))
    expect(onChange.mock.calls).toEqual([[true]])
    expect(screen.getByRole("switch").props.accessibilityState.checked).toBe(false)
    await rerender(<Switch isSelected onChange={onChange} />)
    expect(screen.getByRole("switch").props.accessibilityState.checked).toBe(true)
    await rerender(<Switch defaultSelected={false} />)
    await rerender(<Switch defaultSelected />)
    expect(screen.getByRole("switch").props.accessibilityState.checked).toBe(false)
  })

  it.each(["isDisabled", "isReadOnly"] as const)("suppresses selection/native activation with %s", async (flag) => {
    const onChange = jest.fn(),
      onPress = jest.fn(),
      onLongPress = jest.fn(),
      onPressIn = jest.fn()
    await render(<Switch {...{ [flag]: true, onChange, onPress, onLongPress, onPressIn }} />)
    const control = screen.getByRole("switch")
    await fireEvent.press(control, event)
    await fireEvent(control, "pressIn", event)
    await fireEvent(control, "longPress", event)
    for (const callback of [onChange, onPress, onLongPress, onPressIn]) expect(callback).not.toHaveBeenCalled()
    expect(control.props.accessibilityState.disabled).toBe(flag === "isDisabled")
  })

  it("cancels an active gesture when blocked even if subsequently unblocked", async () => {
    const onChange = jest.fn()
    const { rerender } = await render(<Switch onChange={onChange} />)
    await fireEvent(screen.getByRole("switch"), "pressIn", event)
    await rerender(<Switch isReadOnly onChange={onChange} />)
    await rerender(<Switch onChange={onChange} />)
    await fireEvent.press(screen.getByRole("switch"), event)
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.setup().press(screen.getByRole("switch"))
    expect(onChange.mock.calls).toEqual([[true]])
  })

  it("places the selected thumb using measured content and authored indicator bounds", async () => {
    await render(
      <Switch defaultSelected customTrackStyles={{ width: 90, height: 25 }} customIndicatorStyles={{ width: 17 }} />,
    )
    await fireEvent(part("track-content"), "layout", { nativeEvent: { layout: { width: 90, height: 25 } } })
    await fireEvent(part("indicator"), "layout", { nativeEvent: { layout: { width: 17, height: 25 } } })
    expect(part("indicator")).toHaveStyle({ left: 15, width: 17, height: 25 })
    await act(() => jest.advanceTimersByTime(250))
    expect(part("indicator")).toHaveStyle({ left: 73, width: 17, height: 25 })
    expect(part("track")).toHaveStyle({ width: 90, height: 25 })
  })

  it("allows a fresh accessibility-style activation after a cancelled gesture ends", async () => {
    const onChange = jest.fn()
    const { rerender } = await render(<Switch onChange={onChange} />)
    await fireEvent(screen.getByRole("switch"), "pressIn", event)
    await rerender(<Switch isReadOnly onChange={onChange} />)
    await fireEvent(screen.getByRole("switch"), "pressOut", event)
    await rerender(<Switch onChange={onChange} />)
    await fireEvent.press(screen.getByRole("switch"), event)
    expect(onChange).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole("switch"), { nativeEvent: { timestamp: 101 } })
    expect(onChange.mock.calls).toEqual([[true]])
  })

  it("preserves custom dimensions in an identity callback and leaves explicit minima last", async () => {
    const callback = jest.fn(({ defaultStyle }) => defaultStyle)
    await render(<Switch height={21} customStyles={{ width: 24, height: 24, minWidth: 12 }} style={callback} />)
    expect(screen.getByRole("switch")).toHaveStyle({ width: 24, height: 24, minWidth: 12 })
    expect(screen.getByRole("switch").props.style.minHeight).toBeUndefined()
    expect(part("track")).toHaveStyle({ width: 42, height: 21 })
    expect(callback.mock.calls[0][0]).toMatchObject({
      isSelected: false,
      defaultStyle: { width: 24, height: 24, minWidth: 12 },
    })
  })

  it("uses Android's 48-unit target", async () => {
    const platform = jest.replaceProperty(Platform, "OS", "android")
    try {
      await render(<Switch />)
      expect(screen.getByRole("switch")).toHaveStyle({ minWidth: 48, minHeight: 48 })
    } finally {
      platform.restore()
    }
  })

  it("resolves order/inversion/custom colors and uses pressed feedback before resting selection", async () => {
    const { rerender } = await render(<Switch isSelected order="tertiary" invertColorsOnToggle showBorder />)
    expect(part("track")).toHaveStyle({ backgroundColor: "#2f7d18", borderColor: "#2f7d18" })
    expect(part("indicator")).toHaveStyle({ backgroundColor: "#2563eb" })
    await rerender(<Switch isSelected invertColorsOnToggle showBorder trackColor="#123456" indicatorColor="#abcdef" />)
    expect(part("track")).toHaveStyle({ backgroundColor: "#2f7d18" })
    await act(() => jest.advanceTimersByTime(275))
    expect(part("track")).toHaveStyle({ backgroundColor: "#123456" })
    expect(part("indicator")).toHaveStyle({ backgroundColor: "#abcdef" })
    await fireEvent(screen.getByRole("switch"), "pressIn", event)
    await act(() => jest.advanceTimersByTime(275))
    expect(part("track")).toHaveStyle({ backgroundColor: "#c6c6c6" })
    await rerender(<Switch isSelected invertColorsOnToggle showBorder />)
    await fireEvent(screen.getByRole("switch"), "pressOut", event)
    await act(() => jest.advanceTimersByTime(275))
    expect(part("track")).toHaveStyle({ backgroundColor: "#2c2c2c" })
  })

  it("supports provider overrides, custom part styles and focus opt-out", async () => {
    const { rerender } = await render(
      <NativeThemeProvider mode="dark" overrides={{ colors: { controlTrackBackground: "#123456" } }}>
        <Switch
          geometry="orthogonal"
          raised={false}
          customTrackStyles={{ borderRadius: 7 }}
          customIndicatorStyles={{ backgroundColor: "#abcdef" }}
        />
      </NativeThemeProvider>,
    )
    expect(part("track")).toHaveStyle({ backgroundColor: "#123456", borderRadius: 7 })
    await fireEvent(screen.getByRole("switch"), "focus", event)
    expect(part("indicator")).toHaveStyle({ outlineColor: "#2563eb", outlineWidth: 2, backgroundColor: "#abcdef" })
    await rerender(<Switch enableFocusStyle={false} />)
    expect(part("indicator").props.style.outlineWidth).toBeUndefined()
  })

  it("preserves explicit-null icon slots and excludes decoration from accessibility", async () => {
    await render(<Switch showOnOffIcons iconOn={null} iconOff={<View testID="authored-icon" />} />)
    expect(screen.queryByText("✓", { includeHiddenElements: true })).toBeNull()
    expect(screen.getByTestId("authored-icon", { includeHiddenElements: true })).toBeOnTheScreen()
    expect(part("track").props.importantForAccessibility).toBe("no-hide-descendants")
  })

  it("forwards refs and prefers native test/label props", async () => {
    const ref = createRef<TNativeSwitchRef>()
    await render(
      <Switch ref={ref} testID="native" data-testid="alias" accessibilityLabel="Native" aria-label="Alias" />,
    )
    expect(screen.getByRole("switch", { name: "Native" })).toBe(screen.getByTestId("native"))
    expect(ref.current).not.toBeNull()
  })

  it.each([
    { trackColor: "var(--color)" },
    { indicatorColor: "var(--color)" },
    { customTrackStyles: { backgroundColor: "var(--color)" } },
    { customIndicatorStyles: { boxShadow: "0 0 1px var(--color)" } },
    { width: 0 },
    { height: Infinity },
  ])("rejects invalid native values %p", async (props) => {
    await expect(render(<Switch {...props} />)).rejects.toThrow(TypeError)
  })
})
