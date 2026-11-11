import { fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { createRef, useState } from "react"
import { Platform, TextInput, type TextInputProps } from "react-native"

import { Input, NativeThemeProvider, type TNativeInputProps, type TNativeInputRef } from "../../.."

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
const event = { nativeEvent: { text: "Native text", eventCount: 1, target: 1 } }

describe("Input public native contract", () => {
  it("preserves native defaults, font scaling, single-line editing and placeholder roles", async () => {
    await render(<Input placeholder="Native text" />)
    const input = screen.getByPlaceholderText("Native text")
    expect(input).toHaveStyle({ minHeight: 44, minWidth: 44, fontSize: 14, borderRadius: 5, color: "#171717" })
    expect(input.props).toMatchObject({
      multiline: false,
      editable: true,
      readOnly: false,
      placeholderTextColor: "#707070",
      underlineColorAndroid: "transparent",
    })
    expect(input.props.allowFontScaling).not.toBe(false)
  })

  it("types through the native onChangeText contract and preserves controlled value", async () => {
    const changed = jest.fn()
    const Controlled = () => {
      const [value, setValue] = useState("")
      return (
        <Input
          value={value}
          onChangeText={(next) => {
            changed(next)
            setValue(next)
          }}
        />
      )
    }
    await render(<Controlled />)
    await userEvent.setup().type(screen.getByTestId("input"), "Bonjour", { skipBlur: true })
    expect(screen.getByTestId("input")).toHaveDisplayValue("Bonjour")
    expect(changed).toHaveBeenLastCalledWith("Bonjour")
  })

  it("retains its initial defaultValue until keyed remount", async () => {
    const ref = createRef<TNativeInputRef>()
    const onChange = jest.fn(),
      onChangeText = jest.fn()
    const view = await render(
      <Input key="original" defaultValue="Initial draft" ref={ref} {...{ onChange, onChangeText }} />,
    )
    const original = ref.current
    const input = screen.getByTestId("input")
    expect(original).not.toBeNull()
    for (const defaultValue of ["Later default", "", undefined]) {
      await view.rerender(
        <Input key="original" defaultValue={defaultValue} ref={ref} {...{ onChange, onChangeText }} />,
      )
      expect(screen.getByTestId("input")).toBe(input)
      expect(ref.current).toBe(original)
      expect(input.props.defaultValue).toBe("Initial draft")
      expect(input).toHaveDisplayValue("Initial draft")
    }
    await view.rerender(<Input key="replacement" defaultValue="New draft" ref={ref} {...{ onChange, onChangeText }} />)
    expect(ref.current).not.toBe(original)
    expect(screen.getByTestId("input")).toHaveDisplayValue("New draft")
    expect(onChange).not.toHaveBeenCalled()
    expect(onChangeText).not.toHaveBeenCalled()
  })

  it.each([
    { name: "empty", initial: "" },
    { name: "absent", initial: undefined },
  ])("keeps the $name initial defaultValue when a later default arrives", async ({ initial }) => {
    const changed = jest.fn()
    const view = await render(<Input defaultValue={initial} onChangeText={changed} />)
    const original = screen.getByTestId("input")
    await view.rerender(<Input defaultValue="Later default" onChangeText={changed} />)
    expect(screen.getByTestId("input")).toBe(original)
    expect(original.props.defaultValue).toBe(initial)
    expect(original).toHaveDisplayValue("")
    expect(changed).not.toHaveBeenCalled()
  })

  it("retains the initial renderer default while controlled empty and current values stay authoritative", async () => {
    const ref = createRef<TNativeInputRef>()
    const changed = jest.fn()
    const renderer = jest.fn((props: TextInputProps) => <TextInput {...props} testID="rendered-default" />)
    const view = await render(
      <Input defaultValue="Initial draft" value="" ref={ref} render={renderer} onChangeText={changed} />,
    )
    const original = ref.current
    expect(original).not.toBeNull()
    for (const value of ["", "Owned current"]) {
      await view.rerender(
        <Input defaultValue="Later default" value={value} ref={ref} render={renderer} onChangeText={changed} />,
      )
      expect(renderer.mock.calls.at(-1)?.[0].defaultValue).toBe("Initial draft")
      expect(screen.getByTestId("rendered-default")).toHaveDisplayValue(value)
      expect(ref.current).toBe(original)
    }
    expect(changed).not.toHaveBeenCalled()
  })

  it("forwards native change/submit/selection events without creating DOM events", async () => {
    const onChange = jest.fn(),
      onSubmitEditing = jest.fn(),
      onSelectionChange = jest.fn()
    await render(<Input {...{ onChange, onSubmitEditing, onSelectionChange }} />)
    const input = screen.getByTestId("input")
    await fireEvent(input, "change", event)
    await fireEvent(input, "submitEditing", event)
    await fireEvent(input, "selectionChange", { nativeEvent: { selection: { start: 1, end: 2 } } })
    expect(onChange).toHaveBeenCalledWith(event)
    expect(onSubmitEditing).toHaveBeenCalledWith(event)
    expect(onSelectionChange.mock.calls[0][0].nativeEvent.selection).toEqual({ start: 1, end: 2 })
  })

  it.each(["isDisabled", "isReadOnly"] as const)("suppresses synthetic text changes with %s", async (flag) => {
    const onChange = jest.fn(),
      onChangeText = jest.fn()
    await render(<Input {...{ [flag]: true, onChange, onChangeText }} defaultValue="Keep" />)
    const input = screen.getByTestId("input")
    await fireEvent.changeText(input, "Changed")
    await fireEvent(input, "change", event)
    expect(onChange).not.toHaveBeenCalled()
    expect(onChangeText).not.toHaveBeenCalled()
    expect(input.props.editable).toBe(false)
    expect(input.props.readOnly).toBe(true)
    expect(input.props.accessibilityState.disabled).toBe(flag === "isDisabled")
    expect(input).toHaveStyle({ opacity: flag === "isDisabled" ? 0.4 : 1 })
  })

  it.each([
    [{}, "#9e9e9e"],
    [{ successState: true }, "#2f7d18"],
    [{ successState: true, warningState: true }, "#a66b00"],
    [{ successState: true, warningState: true, errorState: true }, "#b73434"],
  ] as [TNativeInputProps, string][])("uses validation priority for %p", async (props, color) => {
    await render(<Input {...props} />)
    expect(screen.getByTestId("input")).toHaveStyle({ borderColor: color })
  })

  it("composes focus/blur, allows read-only discovery and supports focus-style opt-out", async () => {
    const onFocus = jest.fn(),
      onBlur = jest.fn()
    const { rerender } = await render(<Input onFocus={onFocus} onBlur={onBlur} />)
    await fireEvent(screen.getByTestId("input"), "focus", event)
    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("input")).toHaveStyle({ outlineWidth: 1.5 })
    await rerender(<Input isReadOnly />)
    expect(screen.getByTestId("input").props).toMatchObject({
      focusable: true,
      accessibilityState: { disabled: false },
    })
    await rerender(<Input enableFocusStyle={false} onBlur={onBlur} />)
    expect(screen.getByTestId("input").props.style.outlineWidth).toBeUndefined()
    await fireEvent(screen.getByTestId("input"), "blur", event)
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  it("retains custom dimensions in callback defaults and respects prop/final dimensions", async () => {
    const { rerender } = await render(
      <Input
        height={32}
        customStyles={{ width: 24, height: 24 }}
        style={({ defaultStyle, isInvalid }) => [defaultStyle, { color: isInvalid ? "red" : "blue" }]}
        errorState
      />,
    )
    expect(screen.getByTestId("input")).toHaveStyle({ width: 24, height: 24, color: "red" })
    expect(screen.getByTestId("input").props.style.minHeight).toBeUndefined()
    await rerender(<Input width={80} height={32} />)
    expect(screen.getByTestId("input")).toHaveStyle({ width: 80, height: 32 })
    expect(screen.getByTestId("input").props.style.minWidth).toBeUndefined()
  })

  it("uses size, geometry, provider colors/fonts and explicit placeholder/native input options", async () => {
    await render(
      <NativeThemeProvider
        mode="dark"
        overrides={{
          typography: { fontFamilies: { body: "CustomBody" } },
          colors: { validationErrorBorder: "#123456" },
        }}
      >
        <Input
          textSize="large"
          geometry="round"
          errorState
          placeholderTextColor="tomato"
          keyboardType="email-address"
          autoComplete="email"
          maxLength={80}
        />
      </NativeThemeProvider>,
    )
    expect(screen.getByTestId("input")).toHaveStyle({
      fontSize: 16,
      fontFamily: "CustomBody",
      borderRadius: 10000,
      borderColor: "#123456",
      color: "#ffffff",
    })
    expect(screen.getByTestId("input").props).toMatchObject({
      placeholderTextColor: "tomato",
      keyboardType: "email-address",
      autoComplete: "email",
      maxLength: 80,
    })
  })

  it("forwards native refs and prefers native label/test props", async () => {
    const ref = createRef<TNativeInputRef>()
    await render(<Input ref={ref} testID="native" data-testid="alias" accessibilityLabel="Native" aria-label="Alias" />)
    expect(ref.current).not.toBeNull()
    expect(screen.getByTestId("native").props.accessibilityLabel).toBe("Native")
    expect(typeof ref.current?.focus).toBe("function")
  })

  it("uses Android's minimum without restricting text scaling", async () => {
    const platform = jest.replaceProperty(Platform, "OS", "android")
    try {
      await render(<Input textSize="small" />)
      expect(screen.getByTestId("input")).toHaveStyle({ minHeight: 48, fontSize: 12 })
    } finally {
      platform.restore()
    }
  })

  it.each([
    { placeholderTextColor: "var(--placeholder)" },
    { selectionColor: "var(--selection)" },
    { style: { color: "var(--text)" } },
    { customStyles: { boxShadow: "0 0 1px var(--shadow)" } },
  ])("rejects unsupported native colors %p", async (props) => {
    await expect(render(<Input {...props} />)).rejects.toThrow(TypeError)
  })
})
