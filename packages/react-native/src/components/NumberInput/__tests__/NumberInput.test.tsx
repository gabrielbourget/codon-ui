import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { createRef, useState } from "react"
import { Platform, TextInput, View } from "react-native"

import {
  NativeThemeProvider,
  NumberInput,
  type TNativeNumberInputFormatOptions,
  type TNativeNumberInputRef,
} from "../../.."

const names = { accessibilityLabel: "Quantity", incrementLabel: "Add quantity", decrementLabel: "Reduce quantity" }
const input = () => screen.getByTestId("number-input-input")
const end = async (text?: string) => fireEvent(input(), "endEditing", { nativeEvent: { text } })
const submit = async (text?: string) => fireEvent(input(), "submitEditing", { nativeEvent: { text } })
const change = async (text: string) => fireEvent.changeText(input(), text)
const increment = () => screen.getByRole("button", { name: "Add quantity" })
beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe("NumberInput native composition", () => {
  it("retains a raw draft and publishes only complete final native commits", async () => {
    const onChange = jest.fn(),
      onChangeText = jest.fn()
    await render(<NumberInput {...names} defaultValue={5} onChange={onChange} onChangeText={onChangeText} />)
    for (const text of ["", "-", "0008.", "invalid paste", "8.125"]) {
      await change(text)
      expect(input()).toHaveDisplayValue(text)
    }
    expect(onChange).not.toHaveBeenCalled()
    expect(onChangeText.mock.calls.map(([text]) => text)).toEqual(["", "-", "0008.", "invalid paste", "8.125"])
    await submit("9.125")
    await end("8.125")
    expect(onChange.mock.calls).toEqual([[9.125]])
    expect(input()).toHaveDisplayValue("9.125")
    expect(onChangeText).toHaveBeenCalledTimes(5)
  })
  it("uses the latest native draft when final text is absent and does not commit on blur", async () => {
    const onChange = jest.fn(),
      onBlur = jest.fn()
    await render(<NumberInput {...names} defaultValue={2} onChange={onChange} inputProps={{ onBlur }} />)
    await act(async () => {
      input().props.onChangeText("7.25")
      input().props.onEndEditing({ nativeEvent: {} })
    })
    expect(onChange.mock.calls).toEqual([[7.25]])
    await change("9")
    await fireEvent(input(), "blur", { nativeEvent: {} })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onBlur).toHaveBeenCalledTimes(1)
    await end()
    expect(onChange).toHaveBeenLastCalledWith(9)
  })
  it.each(["-", ".", "bad paste", "1e3", "0x10", "+1", "999999999999999999999999"])(
    "restores an invalid commit %s quietly",
    async (text) => {
      const onChange = jest.fn()
      await render(<NumberInput {...names} defaultValue={5} onChange={onChange} />)
      await change(text)
      await end(text)
      expect(input()).toHaveDisplayValue("5")
      expect(onChange).not.toHaveBeenCalled()
    },
  )
  it("distinguishes empty from zero, skips same values and initializes default once", async () => {
    const onChange = jest.fn()
    const { rerender } = await render(<NumberInput {...names} defaultValue={0} onChange={onChange} />)
    await change("-0")
    await end("-0")
    expect(onChange).not.toHaveBeenCalled()
    await change(" ")
    await end(" ")
    expect(onChange.mock.calls).toEqual([[null]])
    expect(input()).toHaveDisplayValue("")
    await rerender(<NumberInput {...names} defaultValue={8} onChange={onChange} />)
    expect(input()).toHaveDisplayValue("")
    await userEvent.setup().press(increment())
    expect(onChange.mock.calls).toEqual([[null], [0]])
  })
  it("restores controlled presentation without optimistic accumulation when the parent declines", async () => {
    const onChange = jest.fn()
    await render(<NumberInput {...names} value={5} onChange={onChange} />)
    await change("8")
    await submit("8")
    await end("8")
    expect(input()).toHaveDisplayValue("5")
    expect(onChange.mock.calls).toEqual([[8]])
    const user = userEvent.setup()
    await user.press(increment())
    await user.press(increment())
    expect(onChange.mock.calls).toEqual([[8], [6], [6]])
    expect(input()).toHaveDisplayValue("5")
  })
  it("accepts controlled echoes and null without erasing a draft on same-valued renders", async () => {
    const onChange = jest.fn()
    const Controlled = ({ tick = 0 }: { tick?: number }) => {
      const [value, setValue] = useState<number | null>(null)
      return (
        <View testID={String(tick)}>
          <NumberInput
            {...names}
            value={value}
            onChange={(next) => {
              onChange(next)
              setValue(next)
            }}
          />
        </View>
      )
    }
    const { rerender } = await render(<Controlled />)
    await change("001.25")
    await rerender(<Controlled tick={1} />)
    expect(input()).toHaveDisplayValue("001.25")
    await end("001.25")
    expect(input()).toHaveDisplayValue("1.25")
    await change("")
    await end("")
    expect(onChange.mock.calls).toEqual([[1.25], [null]])
  })
  it("cancels drafts on external value/config changes without eagerly normalizing supplied values", async () => {
    const onChange = jest.fn()
    const { rerender } = await render(<NumberInput {...names} value={5} onChange={onChange} />)
    await change("8")
    await rerender(<NumberInput {...names} value={5} minValue={6} maxValue={10} step={2} onChange={onChange} />)
    expect(input()).toHaveDisplayValue("5")
    await end("8")
    expect(onChange).not.toHaveBeenCalled()
    await change("8")
    await rerender(<NumberInput {...names} value={7.5} locale="fr-CA" onChange={onChange} />)
    expect(input()).toHaveDisplayValue("7,5")
    await submit("8")
    expect(onChange).not.toHaveBeenCalled()
  })
  it.each(["isDisabled", "isReadOnly"] as const)("cancels pending edit and press during %s takeover", async (guard) => {
    const onChange = jest.fn()
    const { rerender } = await render(<NumberInput {...names} defaultValue={5} onChange={onChange} />)
    await change("8")
    await fireEvent(increment(), "pressIn", { nativeEvent: { timestamp: 1 } })
    await rerender(<NumberInput {...names} defaultValue={5} onChange={onChange} {...{ [guard]: true }} />)
    await end("8")
    await submit("8")
    await change("9")
    await fireEvent(input(), "accessibilityAction", { nativeEvent: { actionName: "incrementValue" } })
    expect(input()).toHaveDisplayValue("5")
    expect(input().props.accessibilityActions).toEqual([])
    expect(input().props).toMatchObject({ readOnly: true, editable: false, focusable: guard === "isReadOnly" })
    expect(increment().props.accessibilityState.disabled).toBe(guard === "isDisabled")
    await rerender(<NumberInput {...names} defaultValue={5} onChange={onChange} />)
    await fireEvent(increment(), "press", { nativeEvent: { timestamp: 1 } })
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.setup().press(increment())
    expect(onChange.mock.calls).toEqual([[6]])
  })
  it("observes changed option values and unsupported keys when an option object is reused", async () => {
    const onChange = jest.fn()
    const options: TNativeNumberInputFormatOptions = { maximumFractionDigits: 3 }
    const { rerender } = await render(<NumberInput {...names} value={5} formatOptions={options} onChange={onChange} />)
    await change("8.125")
    options.maximumFractionDigits = 0
    await rerender(<NumberInput {...names} value={5} formatOptions={options} onChange={onChange} />)
    expect(input()).toHaveDisplayValue("5")
    await end("8.125")
    expect(onChange).not.toHaveBeenCalled()
    Object.assign(options, { currency: undefined })
    await expect(rerender(<NumberInput {...names} value={5} formatOptions={options} />)).rejects.toThrow(
      "formatOptions",
    )
  })
  it("folds a pending end event into a step and ignores delayed end/submit", async () => {
    const onChange = jest.fn()
    await render(<NumberInput {...names} defaultValue={1} step={0.1} onChange={onChange} />)
    await change("2.2")
    const event = { nativeEvent: { timestamp: 1 } }
    await fireEvent(increment(), "pressIn", event)
    await end("2.25")
    expect(onChange).not.toHaveBeenCalled()
    await fireEvent(increment(), "pressOut", event)
    await fireEvent(increment(), "press", event)
    await end("2.25")
    await submit("2.25")
    expect(onChange.mock.calls).toEqual([[2.3]])
    expect(input()).toHaveDisplayValue("2.3")
  })
  it("keeps custom actions usable after a cancelled read-only press", async () => {
    const onChange = jest.fn()
    const { rerender } = await render(<NumberInput {...names} defaultValue={2} onChange={onChange} />)
    await fireEvent(increment(), "pressIn", { nativeEvent: { timestamp: 1 } })
    await rerender(<NumberInput {...names} defaultValue={2} onChange={onChange} isReadOnly />)
    await rerender(<NumberInput {...names} defaultValue={2} onChange={onChange} />)
    await fireEvent(input(), "accessibilityAction", { nativeEvent: { actionName: "incrementValue" } })
    expect(onChange.mock.calls).toEqual([[3]])
  })
  it("shares numeric feasibility and guarded stepping between touch and custom actions", async () => {
    const onChange = jest.fn()
    await render(
      <NumberInput {...names} defaultValue={0.75} minValue={0} maxValue={1.1} step={0.25} onChange={onChange} />,
    )
    await fireEvent(input(), "accessibilityAction", { nativeEvent: { actionName: "incrementValue" } })
    expect(input()).toHaveDisplayValue("1")
    expect(increment()).toBeDisabled()
    expect(input().props.accessibilityActions).toEqual([{ name: "decrementValue", label: "Reduce quantity" }])
    await fireEvent(input(), "accessibilityAction", { nativeEvent: { actionName: "incrementValue" } })
    expect(onChange.mock.calls).toEqual([[1]])
    await fireEvent(input(), "accessibilityAction", { nativeEvent: { actionName: "decrementValue" } })
    expect(onChange.mock.calls).toEqual([[1], [0.75]])
  })
  it("forwards original native observers after numeric ownership and preserves selection/keyboard hints", async () => {
    const order: string[] = []
    const nativeChange = jest.fn(),
      selection = jest.fn()
    await render(
      <NumberInput
        {...names}
        onChange={() => order.push("numeric")}
        inputProps={{
          keyboardType: "decimal-pad",
          onChange: nativeChange,
          onSelectionChange: selection,
          onSubmitEditing: () => order.push("submit"),
          onEndEditing: () => order.push("end"),
        }}
      />,
    )
    const event = { nativeEvent: { text: "7.125", target: 1, eventCount: 2 } }
    await fireEvent(input(), "change", event)
    await fireEvent(input(), "selectionChange", event)
    await fireEvent(input(), "submitEditing", event)
    await fireEvent(input(), "endEditing", event)
    expect(order).toEqual(["numeric", "submit", "end"])
    expect(nativeChange).toHaveBeenCalledWith(event)
    expect(selection).toHaveBeenCalledWith(event)
    expect(input().props).toMatchObject({
      multiline: false,
      submitBehavior: "blurAndSubmit",
      keyboardType: "decimal-pad",
    })
    expect(input().props.allowFontScaling).not.toBe(false)
  })
  it("owns native names, identities and a real TextInput ref, with no accessible composite parent", async () => {
    const ref = createRef<TNativeNumberInputRef>()
    await render(
      <NumberInput
        {...names}
        aria-label="Alias"
        ref={ref}
        testID="quantity"
        data-testid="alias"
        IncrementIcon={null}
      />,
    )
    expect(screen.getByLabelText("Quantity").props.testID).toBe("quantity-input")
    expect(screen.getByTestId("quantity").props.accessible).toBe(false)
    expect(screen.getByTestId("quantity-increment")).toBeOnTheScreen()
    expect(ref.current).toBeInstanceOf(TextInput)
  })
  it.each(["accessibilityLabel", "incrementLabel", "decrementLabel"] as const)(
    "requires nonempty %s",
    async (field) => {
      await expect(render(<NumberInput {...names} {...{ [field]: " " }} />)).rejects.toThrow("nonempty")
    },
  )
  it.each(["ios", "android"] as const)(
    "keeps independent %s targets and disables opacity once per branch",
    async (platform) => {
      const old = Platform.OS
      Platform.OS = platform
      try {
        await render(<NumberInput {...names} isDisabled />)
        expect(input()).toHaveStyle({ minHeight: platform === "ios" ? 44 : 48, opacity: 0.4 })
        expect(increment()).toHaveStyle({ minHeight: platform === "ios" ? 44 : 48, opacity: 0.4 })
        expect(screen.getByTestId("number-input").props.style.opacity).toBeUndefined()
        expect(input().props.keyboardType).toBe(platform === "ios" ? "numbers-and-punctuation" : "numeric")
      } finally {
        Platform.OS = old
      }
    },
  )
  it("resolves root/part styles, validation priority and focus within the three controls", async () => {
    await render(
      <NativeThemeProvider mode="dark">
        <NumberInput
          {...names}
          errorState
          warningState
          successState
          width={300}
          customStyles={{ width: 280 }}
          style={({ defaultStyle, isFocused, isInvalid }) => ({
            ...defaultStyle,
            width: isFocused && isInvalid ? 260 : 270,
          })}
          customGroupStyles={{ gap: 9 }}
          customInputStyles={{ color: "red", fontSize: 19 }}
          customButtonStyles={{ color: "blue", width: 60 }}
        />
      </NativeThemeProvider>,
    )
    expect(screen.getByTestId("number-input")).toHaveStyle({ width: 270, borderColor: "#ff6b5f" })
    expect(input()).toHaveStyle({ color: "red", fontSize: 19, borderWidth: 0 })
    expect(increment()).toHaveStyle({ width: 60 })
    await fireEvent(increment(), "focus", { nativeEvent: {} })
    expect(screen.getByTestId("number-input")).toHaveStyle({ width: 260, outlineWidth: 1.5 })
    await fireEvent(increment(), "blur", { nativeEvent: {} })
    expect(screen.getByTestId("number-input").props.style.outlineWidth).toBeUndefined()
  })
  it.each(["customStyles", "customGroupStyles", "customInputStyles", "customButtonStyles"] as const)(
    "rejects CSS colors in %s",
    async (field) => {
      await expect(
        render(<NumberInput {...names} {...{ [field]: { backgroundColor: "var(--bad)" } }} />),
      ).rejects.toThrow("unsupported native color")
    },
  )
  it("rejects invalid numeric values and switching ownership", async () => {
    await expect(render(<NumberInput {...names} value={NaN} />)).rejects.toThrow("value")
    const { rerender } = await render(<NumberInput {...names} value={null} />)
    await expect(rerender(<NumberInput {...names} />)).rejects.toThrow("controlled mode")
  })
})
