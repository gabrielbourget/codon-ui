import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { createRef, useState } from "react"
import { Platform } from "react-native"

import {
  NativeThemeProvider,
  TextArea,
  type TextAreaProps,
  type TNativeTextAreaRef,
  type TNativeTextAreaStyleState,
} from "../../.."

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
const text = "Bonjour, Montréal!\nA complete second line."
const event = { nativeEvent: { text, eventCount: 1, target: 1 } }

it("owns multiline/newline defaults, a bounded editor and uncapped native scaling", async () => {
  await render(<TextArea aria-label="Notes" numberOfLines={8} />)
  const input = screen.getByLabelText("Notes")
  expect(input.props).toMatchObject({ multiline: true, submitBehavior: "newline", numberOfLines: 8, editable: true })
  expect(input).toHaveStyle({ height: 96, minWidth: 44, fontSize: 14, textAlignVertical: "top" })
  expect(input.props.scrollEnabled).not.toBe(false)
  expect(input.props.allowFontScaling).not.toBe(false)
  expect(input.props.maxFontSizeMultiplier).toBeUndefined()
})

it("preserves complete controlled multiline strings and native uncontrolled defaults", async () => {
  const changed = jest.fn()
  const Controlled = () => {
    const [value, setValue] = useState("")
    return (
      <TextArea
        aria-label="Notes"
        value={value}
        onChangeText={(next) => {
          changed(next)
          setValue(next)
        }}
      />
    )
  }
  const { rerender } = await render(<Controlled />)
  await userEvent.setup().type(screen.getByLabelText("Notes"), text, { skipBlur: true })
  expect(screen.getByLabelText("Notes")).toHaveDisplayValue(text)
  expect(changed).toHaveBeenLastCalledWith(text)
  await rerender(<TextArea aria-label="Draft" defaultValue={text} />)
  expect(screen.getByLabelText("Draft").props.defaultValue).toBe(text)
})

it("forwards final native submit, selection and content-size events without resizing", async () => {
  const onChange = jest.fn(),
    onSubmitEditing = jest.fn(),
    onContentSizeChange = jest.fn(),
    onSelectionChange = jest.fn()
  await render(
    <TextArea
      aria-label="Notes"
      submitBehavior="blurAndSubmit"
      {...{ onChange, onSubmitEditing, onContentSizeChange, onSelectionChange }}
    />,
  )
  const input = screen.getByLabelText("Notes")
  const content = { nativeEvent: { contentSize: { width: 200, height: 450 } } }
  const selection = { nativeEvent: { selection: { start: 2, end: 8 } } }
  await fireEvent(input, "change", event)
  await fireEvent(input, "submitEditing", event)
  await fireEvent(input, "contentSizeChange", content)
  await fireEvent(input, "selectionChange", selection)
  expect(onChange).toHaveBeenCalledWith(event)
  expect(onSubmitEditing).toHaveBeenCalledWith(event)
  expect(onContentSizeChange).toHaveBeenCalledWith(content)
  expect(onSelectionChange).toHaveBeenCalledWith(selection)
  expect(input.props.submitBehavior).toBe("blurAndSubmit")
  expect(input).toHaveStyle({ height: 96 })
})

it.each(["isDisabled", "isReadOnly"] as const)(
  "blocks mutations with %s, applying disabled presentation only when disabled",
  async (flag) => {
    const onChange = jest.fn(),
      onChangeText = jest.fn(),
      onFocus = jest.fn()
    await render(
      <TextArea aria-label="Notes" {...{ [flag]: true, onChange, onChangeText, onFocus }} defaultValue="Keep" />,
    )
    const input = screen.getByLabelText("Notes")
    await fireEvent.changeText(input, text)
    await fireEvent(input, "change", event)
    await act(() => input.props.onFocus(event))
    expect(onChange).not.toHaveBeenCalled()
    expect(onChangeText).not.toHaveBeenCalled()
    expect(onFocus).toHaveBeenCalledTimes(flag === "isDisabled" ? 0 : 1)
    expect(input.props).toMatchObject({
      editable: false,
      readOnly: true,
      focusable: flag !== "isDisabled",
      accessibilityState: { disabled: flag === "isDisabled" },
    })
    expect(input).toHaveStyle({ opacity: flag === "isDisabled" ? 0.4 : 1 })
  },
)

it("composes focus/blur and post-custom style state with final precedence", async () => {
  const onBlur = jest.fn(),
    style = jest.fn(({ defaultStyle, isFocused }: TNativeTextAreaStyleState) => [
      defaultStyle,
      { color: isFocused ? "red" : "blue", height: 120 },
    ])
  await render(
    <TextArea
      aria-label="Notes"
      height={80}
      customStyles={{ height: 100, width: 200 }}
      style={style}
      onBlur={onBlur}
      offsetFocusRing={false}
    />,
  )
  await fireEvent(screen.getByLabelText("Notes"), "focus", event)
  expect(style).toHaveBeenLastCalledWith(
    expect.objectContaining({
      isFocused: true,
      isDisabled: false,
      isReadOnly: false,
      isInvalid: false,
      defaultStyle: expect.objectContaining({ height: 100, width: 200 }),
    }),
  )
  expect(screen.getByLabelText("Notes")).toHaveStyle({ height: 120, width: 200, color: "red", outlineOffset: 0 })
  await fireEvent(screen.getByLabelText("Notes"), "blur", event)
  expect(onBlur).toHaveBeenCalledWith(event)
  expect(screen.getByLabelText("Notes")).toHaveStyle({ color: "blue" })
})

it.each([
  [{ successState: true }, "#2f7d18"],
  [{ successState: true, warningState: true }, "#a66b00"],
  [{ successState: true, warningState: true, errorState: true }, "#b73434"],
] as [Partial<TextAreaProps>, string][])("uses validation priority for %p", async (props, borderColor) => {
  await render(<TextArea aria-label="Notes" {...props} />)
  expect(screen.getByLabelText("Notes")).toHaveStyle({ borderColor })
})

it("forwards a native ref and keyboard options, preferring native names and identity", async () => {
  const ref = createRef<TNativeTextAreaRef>()
  await render(
    <NativeThemeProvider mode="dark" overrides={{ typography: { fontFamilies: { body: "Body" } } }}>
      <TextArea
        ref={ref}
        accessibilityLabel="Native"
        aria-label="Alias"
        testID="native"
        data-testid="alias"
        geometry="round"
        textSize="large"
        placeholderTextColor="tomato"
        autoCorrect={false}
        selection={{ start: 0, end: 2 }}
      />
    </NativeThemeProvider>,
  )
  expect(typeof ref.current?.focus).toBe("function")
  expect(screen.getByTestId("native")).toBe(screen.getByLabelText("Native"))
  expect(screen.getByTestId("native").props).toMatchObject({
    placeholderTextColor: "tomato",
    autoCorrect: false,
    selection: { start: 0, end: 2 },
  })
  expect(screen.getByTestId("native")).toHaveStyle({
    color: "#ffffff",
    fontFamily: "Body",
    borderRadius: 10000,
    fontSize: 16,
  })
})

it("uses Android width targets and top alignment without imposing line-count sizing", async () => {
  const platform = jest.replaceProperty(Platform, "OS", "android")
  try {
    await render(<TextArea aria-label="Notes" textSize="small" numberOfLines={2} />)
    expect(screen.getByLabelText("Notes")).toHaveStyle({
      minWidth: 48,
      height: 96,
      fontSize: 12,
      textAlignVertical: "top",
    })
  } finally {
    platform.restore()
  }
})

it.each(["", "  "])("rejects empty accessible names %p even with a placeholder", async (label) => {
  await expect(render(<TextArea accessibilityLabel={label} placeholder="Notes" />)).rejects.toThrow(/nonempty/)
})

it.each([
  { placeholderTextColor: "var(--placeholder)" },
  { selectionHandleColor: "currentColor" },
  { cursorColor: "var(--cursor)" },
  { style: { color: "var(--text)" } },
  { customStyles: { boxShadow: "0 0 1px var(--shadow)" } },
])("rejects unresolved native colors %p", async (props) => {
  await expect(render(<TextArea aria-label="Notes" {...props} />)).rejects.toThrow(TypeError)
})
