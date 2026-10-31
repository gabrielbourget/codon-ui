import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { createRef, useState } from "react"
import { PlatformColor, StyleSheet } from "react-native"

import {
  Button,
  FormField,
  Input,
  NativeThemeProvider,
  Switch,
  Text,
  type FormFieldProps,
  type TNativeFormFieldFocusTarget,
  type TNativeFormFieldRef,
} from "../../.."

it("CAP.form-field.001 renders the native root, top cradle and caller content in canonical order", async () => {
  await render(
    <FormField>
      <Input accessibilityLabel="Email" />
    </FormField>,
  )
  expect(screen.getByTestId("form-field")).toHaveStyle({ width: "100%", flexDirection: "column", gap: 5 })
  expect(screen.getByTestId("form-field-top-row")).toHaveStyle({ flexDirection: "row", justifyContent: "flex-end" })
  expect(screen.getByTestId("form-field-top-right-content")).toBeOnTheScreen()
  expect(screen.getByLabelText("Email")).toBeOnTheScreen()
  expect(screen.queryByTestId("form-field-bottom-row")).toBeNull()
  expect(screen.queryByTestId("form-field-description")).toBeNull()
})

it("CAP.form-field.002 maps label identity, marker and the current native focus ref without a control request", async () => {
  const focus = jest.fn()
  const target = { current: { focus } }
  const change = jest.fn()
  await render(
    <FormField label="Email" labelID="email-label" labelFor={target} required>
      <Input accessibilityLabel="Email input" accessibilityLabelledBy="email-label" value="" onChangeText={change} />
    </FormField>,
  )
  const label = screen.getByTestId("form-field-label")
  expect(label).toHaveTextContent("Email *")
  expect(label.props).toMatchObject({ nativeID: "email-label", selectable: false })
  expect(label.props.allowFontScaling).not.toBe(false)
  expect(label).toHaveStyle({ fontSize: 12 })
  expect(screen.getByTestId("form-field-required-indicator")).toHaveStyle({ color: "#b73434" })
  expect(screen.getByTestId("form-field-top-row")).toHaveStyle({ justifyContent: "space-between" })
  await fireEvent.press(label)
  expect(focus).toHaveBeenCalledTimes(1)
  expect(change).not.toHaveBeenCalled()
  expect(screen.getByTestId("input").props).toMatchObject({
    value: "",
    accessibilityLabel: "Email input",
    accessibilityLabelledBy: "email-label",
  })
})

it("CAP.form-field.003 keeps both right content owners and preserves a primitive zero", async () => {
  await render(<FormField topRightContent={0} bottomRightContent={<Text>Bottom</Text>} />)
  expect(screen.getByTestId("form-field-top-right-content")).toHaveTextContent("0")
  expect(screen.getByTestId("form-field-bottom-right-content")).toHaveTextContent("Bottom")
  expect(screen.getByTestId("form-field-bottom-row")).toHaveStyle({
    justifyContent: "flex-end",
    alignItems: "flex-start",
  })
})

it("CAP.form-field.004 preserves all caller messages in error, warning, success order", async () => {
  const errors = Object.freeze(["Error 1", "Error 2"])
  const warnings = Object.freeze(["Warning"])
  const successes = Object.freeze(["Success"])
  await render(<FormField errorMessages={errors} warningMessages={warnings} successMessages={successes} />)
  const messages = screen.getAllByTestId(/form-field-(error|warning|success)-messages/)
  expect(messages.map((message) => message.props.children)).toEqual(["Error 1", "Error 2", "Warning", "Success"])
  expect(messages[0]).toHaveStyle({ color: "#b73434", fontSize: 12 })
  expect(messages[2]).toHaveStyle({ color: "#a66b00" })
  expect(messages[3]).toHaveStyle({ color: "#2f7d18" })
  expect(errors).toEqual(["Error 1", "Error 2"])
  expect(screen.getByTestId("form-field-validation-messages")).toHaveStyle({
    width: "100%",
    flexDirection: "column",
    gap: 5,
  })
})

it("CAP.form-field.005 renders an independently styled italic description after bottom content", async () => {
  const { rerender } = await render(<FormField description="Email instructions" bottomRightContent="Tail" />)
  expect(screen.getByTestId("form-field-description")).toHaveStyle({ fontStyle: "italic", fontSize: 12 })
  await rerender(
    <FormField description="Email instructions" customDescriptionStyles={{ fontStyle: "normal", color: "blue" }} />,
  )
  expect(screen.getByTestId("form-field-description")).toHaveStyle({ fontStyle: "normal", color: "blue" })
  await rerender(<FormField description="" />)
  expect(screen.queryByTestId("form-field-description")).toBeNull()
})

it("CAP.form-field.006 applies all eight independent style owners, including the validation cradle and text", async () => {
  await render(
    <FormField
      label="Email"
      errorMessages={["Error"]}
      description="Description"
      customStyles={{ backgroundColor: "turquoise", borderRadius: 0 }}
      customTopRowStyles={{ backgroundColor: "red" }}
      customLabelStyles={{ backgroundColor: "green", fontSize: 18 }}
      customTopRightStyles={{ backgroundColor: "purple" }}
      customBottomRowStyles={{ backgroundColor: "indigo" }}
      customBottomRightStyles={{ backgroundColor: "brown" }}
      customValidationMessageStyles={{ backgroundColor: "yellow", color: "black", fontSize: 16 }}
      customDescriptionStyles={{ backgroundColor: "blue" }}
    />,
  )
  for (const [id, backgroundColor] of [
    ["form-field", "turquoise"],
    ["form-field-top-row", "red"],
    ["form-field-label", "green"],
    ["form-field-top-right-content", "purple"],
    ["form-field-bottom-row", "indigo"],
    ["form-field-bottom-right-content", "brown"],
    ["form-field-validation-messages", "yellow"],
    ["form-field-description", "blue"],
  ])
    expect(screen.getByTestId(id)).toHaveStyle({ backgroundColor })
  expect(screen.getByTestId("form-field-label")).toHaveStyle({ fontSize: 18 })
  expect(screen.getByTestId("form-field-error-messages")).toHaveStyle({
    backgroundColor: "yellow",
    color: "black",
    fontSize: 16,
  })
})

it("CAP.form-field.007 preserves computed, custom and final root styles plus native identity precedence", async () => {
  await render(
    <FormField
      testID="chosen"
      data-testid="alias"
      customStyles={{ width: 0, backgroundColor: "turquoise", marginTop: 5 }}
      style={[false, { backgroundColor: "tomato", marginBottom: 10, opacity: 0 }]}
    />,
  )
  expect(screen.getByTestId("chosen")).toHaveStyle({
    width: 0,
    gap: 5,
    backgroundColor: "tomato",
    marginTop: 5,
    marginBottom: 10,
    opacity: 0,
  })
  expect(screen.queryByTestId("alias")).toBeNull()
})

it("CAP.form-field.008 maps supported root aliases and forwards caller-authored native hint text", async () => {
  await render(<FormField ariaLabel="Context" ariaLabelledBy="context-id" accessibilityHint="Email editing section" />)
  expect(screen.getByTestId("form-field").props).toMatchObject({
    accessibilityLabel: "Context",
    accessibilityLabelledBy: "context-id",
    accessibilityHint: "Email editing section",
  })
})

it("CAP.form-field.009 gives native naming props precedence over native aria forms and aliases", async () => {
  const { rerender } = await render(
    <FormField
      accessibilityLabel="Native"
      aria-label="Aria"
      ariaLabel="Alias"
      accessibilityLabelledBy={["native-id"]}
      aria-labelledby="aria-id"
      ariaLabelledBy="alias-id"
    />,
  )
  expect(screen.getByTestId("form-field").props).toMatchObject({
    accessibilityLabel: "Native",
    accessibilityLabelledBy: ["native-id"],
  })
  await rerender(<FormField aria-label="Aria" ariaLabel="Alias" aria-labelledby="aria-id" ariaLabelledBy="alias-id" />)
  expect(screen.getByTestId("form-field").props).toMatchObject({
    accessibilityLabel: "Aria",
    accessibilityLabelledBy: "aria-id",
  })
  await rerender(
    <FormField
      testID=""
      data-testid="alias"
      accessibilityLabel=""
      ariaLabel="Alias"
      accessibilityLabelledBy=""
      ariaLabelledBy="alias-id"
    />,
  )
  expect(screen.getByTestId("").props).toMatchObject({ accessibilityLabel: "", accessibilityLabelledBy: "" })
})

it("CAP.form-field.010 consumes wrapper props while preserving the real native root ref and layout event", async () => {
  const ref = createRef<TNativeFormFieldRef>()
  const layout = jest.fn()
  const props: FormFieldProps = {
    label: "Label",
    labelID: "label-id",
    labelFor: { current: null },
    required: false,
    raised: true,
    topRightContent: 0,
    bottomRightContent: 0,
    errorMessages: [],
    warningMessages: [],
    successMessages: [],
    description: "Description",
    customStyles: {},
    customTopRowStyles: {},
    customLabelStyles: {},
    customTopRightStyles: {},
    customBottomRowStyles: {},
    customBottomRightStyles: {},
    customValidationMessageStyles: {},
    customDescriptionStyles: {},
    ariaLabel: "Alias",
    ariaLabelledBy: "alias-id",
    "data-testid": "alias-test-id",
  }
  await render(
    <FormField
      {...props}
      ref={ref}
      testID="root"
      nativeID="field-id"
      onLayout={layout}
      pointerEvents="box-none"
      collapsable={false}
    />,
  )
  const root = screen.getByTestId("root")
  for (const key of Object.keys(props)) expect(root.props[key]).toBeUndefined()
  expect(root.props).toMatchObject({ nativeID: "field-id", pointerEvents: "box-none", collapsable: false })
  expect(typeof ref.current?.measure).toBe("function")
  const event = { nativeEvent: { layout: { x: 1, y: 2, width: 0, height: 20 } } }
  await fireEvent(root, "layout", event)
  expect(layout).toHaveBeenCalledWith(event)
})

it.each(["errorMessages", "warningMessages", "successMessages"] as const)(
  "retains an explicit empty %s array and a bottom-right zero without publishing a message",
  async (field) => {
    await render(<FormField {...{ [field]: [] }} bottomRightContent={0} />)
    expect(screen.getByTestId("form-field-bottom-row")).toHaveStyle({ justifyContent: "space-between" })
    expect(screen.getByTestId("form-field-bottom-right-content")).toHaveTextContent("0")
    expect(screen.queryAllByTestId(/form-field-(error|warning|success)-messages/)).toHaveLength(0)
  },
)

it.each([undefined, null, false, 0, ""])(
  "does not create the bottom row for bottom-right content %p alone",
  async (content) => {
    await render(<FormField bottomRightContent={content} />)
    expect(screen.queryByTestId("form-field-bottom-row")).toBeNull()
  },
)

it("omits empty labels and required markers without altering caller-owned control guards", async () => {
  const { rerender } = await render(
    <FormField label="" required>
      <Input accessibilityLabel="Email" value="" />
    </FormField>,
  )
  expect(screen.queryByTestId("form-field-label")).toBeNull()
  expect(screen.getByTestId("form-field-top-row")).toHaveStyle({ justifyContent: "flex-end" })
  expect(screen.getByLabelText("Email").props).toMatchObject({ value: "", editable: true })
  await rerender(<FormField label="Email" required={false} />)
  expect(screen.getByTestId("form-field-required-indicator")).toHaveTextContent("")
  expect(screen.getByTestId("form-field-label").props.onPress).toBeUndefined()
})

it("keeps a live caller ref target and safely ignores a temporarily null target", async () => {
  const first = jest.fn()
  const second = jest.fn()
  const target = createRef<TNativeFormFieldFocusTarget>()
  await render(<FormField label="Label" labelFor={target} />)
  await fireEvent.press(screen.getByTestId("form-field-label"))
  target.current = { focus: first }
  await fireEvent.press(screen.getByTestId("form-field-label"))
  target.current = { focus: second }
  await fireEvent.press(screen.getByTestId("form-field-label"))
  expect(first).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledTimes(1)
})

it("retires old label handlers after ref replacement, removal, restoration and unmount", async () => {
  const first = jest.fn()
  const second = jest.fn()
  const firstRef = { current: { focus: first } }
  const secondRef = { current: { focus: second } }
  const { rerender, unmount } = await render(<FormField label="Label" labelFor={firstRef} />)
  const oldPress = screen.getByTestId("form-field-label").props.onPress
  await rerender(<FormField label="Label" labelFor={secondRef} />)
  await act(() => oldPress())
  expect(first).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId("form-field-label"))
  expect(second).toHaveBeenCalledTimes(1)
  const replacedPress = screen.getByTestId("form-field-label").props.onPress
  await rerender(<FormField label="" labelFor={secondRef} />)
  await rerender(<FormField label="Label" labelFor={secondRef} />)
  await act(() => replacedPress())
  expect(second).toHaveBeenCalledTimes(1)
  const finalPress = screen.getByTestId("form-field-label").props.onPress
  await unmount()
  await act(() => finalPress())
  expect(second).toHaveBeenCalledTimes(1)
})

it("retains keyed child state, controlled empty/false values and actual Input requests through field updates", async () => {
  const requests = jest.fn()
  const Child = () => {
    const [count, setCount] = useState(0)
    const [value, setValue] = useState("")
    return (
      <>
        <Button onPress={() => setCount((current) => current + 1)}>Child {count}</Button>
        <Input
          accessibilityLabel="Owned editor"
          value={value}
          onChangeText={(next) => {
            requests(next)
            setValue(next)
          }}
        />
        <Switch accessibilityLabel="Owned false" isSelected={false} onChange={jest.fn()} />
      </>
    )
  }
  const fixture = (changed: boolean) => (
    <NativeThemeProvider mode={changed ? "dark" : "light"}>
      <FormField
        label={changed ? "Changed label" : undefined}
        errorMessages={changed ? ["Error"] : undefined}
        required={changed}
        description={changed ? "Description" : undefined}
        raised={changed}
      >
        <Child key="stable" />
      </FormField>
    </NativeThemeProvider>
  )
  const { rerender } = await render(fixture(false))
  await fireEvent.press(screen.getByRole("button", { name: "Child 0" }))
  await fireEvent.changeText(screen.getByLabelText("Owned editor"), "typed")
  await rerender(fixture(true))
  expect(screen.getByRole("button", { name: "Child 1" })).toBeOnTheScreen()
  expect(screen.getByLabelText("Owned editor").props.value).toBe("typed")
  expect(screen.getByRole("switch", { name: "Owned false" })).not.toBeChecked()
  expect(requests.mock.calls).toEqual([["typed"]])
  await rerender(fixture(false))
  expect(screen.getByRole("button", { name: "Child 1" })).toBeOnTheScreen()
  expect(requests).toHaveBeenCalledTimes(1)
})

it("retains arbitrary keyed right content and primitive caller children", async () => {
  const Counter = () => {
    const [count, setCount] = useState(0)
    return <Button onPress={() => setCount((current) => current + 1)}>Right {count}</Button>
  }
  const { rerender } = await render(
    <FormField topRightContent={<Counter key="stable" />}>{[false, 0, "", null]}</FormField>,
  )
  await fireEvent.press(screen.getByRole("button", { name: "Right 0" }))
  await rerender(
    <FormField label="New" topRightContent={<Counter key="stable" />} errorMessages={[]}>
      {[false, 0, "", null]}
    </FormField>,
  )
  expect(screen.getByRole("button", { name: "Right 1" })).toBeOnTheScreen()
  expect(screen.getByText("0")).toBeOnTheScreen()
})

it("updates severity, marker, inherited foreground, spacing and shadow from the live provider", async () => {
  jest.useFakeTimers()
  const fixture = (dark: boolean) => (
    <NativeThemeProvider
      mode={dark ? "dark" : "light"}
      overrides={dark ? { spacing: { unit: 8 }, colors: { foreground: "purple", statusDanger: "orange" } } : undefined}
    >
      <FormField
        label="Label"
        required
        raised
        errorMessages={["Error"]}
        warningMessages={["Warning"]}
        successMessages={["Success"]}
        description="Description"
        topRightContent="Hint"
      />
    </NativeThemeProvider>
  )
  const { rerender, unmount } = await render(fixture(false))
  try {
    expect(screen.getByTestId("form-field")).toHaveStyle({
      boxShadow: [
        { offsetX: 0, offsetY: 2, blurRadius: 3, color: "rgba(0,0,0,0.12)" },
        { offsetX: 0, offsetY: 2, blurRadius: 2, color: "rgba(0,0,0,0.24)" },
      ],
    })
    await rerender(fixture(true))
    expect(screen.getByTestId("form-field")).toHaveStyle({
      gap: 8,
      boxShadow: [
        { offsetX: 0, offsetY: 2, blurRadius: 3, color: "rgba(0,0,0,0.35)" },
        { offsetX: 0, offsetY: 2, blurRadius: 2, color: "rgba(0,0,0,0.28)" },
      ],
    })
    expect(screen.getByTestId("form-field-error-messages").props.style.color).not.toBe("orange")
    expect(screen.getByTestId("form-field-label").props.style.color).not.toBe("purple")
    await act(() => jest.advanceTimersByTime(275))
    expect(screen.getByTestId("form-field-label")).toHaveStyle({ color: "purple" })
    expect(screen.getByText("Hint")).toHaveStyle({ color: "purple" })
    expect(screen.getByTestId("form-field-required-indicator")).toHaveStyle({ color: "orange" })
    expect(screen.getByTestId("form-field-error-messages")).toHaveStyle({ color: "orange" })
    expect(screen.getByTestId("form-field-warning-messages")).toHaveStyle({ color: "#f0b429" })
    expect(screen.getByTestId("form-field-success-messages")).toHaveStyle({ color: "#6ad060" })
  } finally {
    await unmount()
    jest.useRealTimers()
  }
})

it("lets explicit root/text and final shadow styles win without overwriting an authored child", async () => {
  await render(
    <FormField
      raised
      customStyles={{ color: "purple" }}
      style={{ color: "orange", boxShadow: [] }}
      label="Label"
      customLabelStyles={{ color: "blue" }}
      required
      description="Description"
    >
      <Text color="green">Authored child</Text>
    </FormField>,
  )
  expect(screen.getByTestId("form-field")).toHaveStyle({ boxShadow: [] })
  expect(screen.getByTestId("form-field-label")).toHaveStyle({ color: "blue" })
  expect(screen.getByTestId("form-field-required-indicator")).toHaveStyle({ color: "#b73434" })
  expect(screen.getByTestId("form-field-description")).toHaveStyle({ color: "orange" })
  expect(screen.getByText("Authored child")).toHaveStyle({ color: "green" })
})

it("accepts registered/array styles, native opaque colors and explicit zero dimensions", async () => {
  const color = PlatformColor("labelColor")
  const styles = StyleSheet.create({ root: { width: 0, height: 0 }, label: { fontSize: 18 } })
  await render(
    <FormField
      label="Label"
      customStyles={[styles.root, false, { color }]}
      customLabelStyles={[styles.label, { color }]}
      style={[undefined, { opacity: 0 }]}
    />,
  )
  expect(screen.getByTestId("form-field")).toHaveStyle({ width: 0, height: 0, opacity: 0 })
  expect(screen.getByTestId("form-field-label")).toHaveStyle({ color, fontSize: 18 })
})

it("inherits root typography through owned text and preserves explicit slot and child overrides", async () => {
  const fixture = (spacing: number) => (
    <FormField
      label="Label"
      description="Description"
      errorMessages={["Error"]}
      topRightContent="Hint"
      customStyles={{ fontStyle: "italic", letterSpacing: 1 }}
      style={{ letterSpacing: spacing }}
      customLabelStyles={{ fontStyle: "normal" }}
    >
      <Text testID="authored-field-child" customStyles={{ letterSpacing: 7, fontStyle: "normal" }}>
        Child
      </Text>
    </FormField>
  )
  const view = await render(fixture(3))
  expect(screen.getByTestId("form-field-label")).toHaveStyle({ fontStyle: "normal", letterSpacing: 3 })
  expect(screen.getByTestId("form-field-error-messages")).toHaveStyle({ fontStyle: "italic", letterSpacing: 3 })
  expect(screen.getByText("Hint")).toHaveStyle({ fontStyle: "italic", letterSpacing: 3 })
  expect(screen.getByTestId("form-field-description")).toHaveStyle({ fontStyle: "italic", letterSpacing: 3 })
  expect(screen.getByTestId("authored-field-child")).toHaveStyle({ fontStyle: "normal", letterSpacing: 7 })
  await view.rerender(fixture(0))
  expect(screen.getByTestId("form-field-error-messages")).toHaveStyle({ fontStyle: "italic", letterSpacing: 0 })
  expect(screen.getByTestId("authored-field-child")).toHaveStyle({ fontStyle: "normal", letterSpacing: 7 })
})

it.each([
  "customStyles",
  "customTopRowStyles",
  "customLabelStyles",
  "customTopRightStyles",
  "customBottomRowStyles",
  "customBottomRightStyles",
  "customValidationMessageStyles",
  "customDescriptionStyles",
  "style",
] as const)("rejects unsupported authored CSS colors in %s", async (field) => {
  await expect(render(<FormField {...{ [field]: { backgroundColor: "var(--unsupported)" } }} />)).rejects.toThrow(
    /unsupported native color/,
  )
})

it("rejects DOM label target IDs rather than silently failing native label activation", async () => {
  await expect(render(<FormField {...({ labelFor: "editor-id" } as unknown as FormFieldProps)} />)).rejects.toThrow(
    /native focus ref/,
  )
})

it("allows a normal native label user press to request focus once", async () => {
  jest.useFakeTimers()
  try {
    const focus = jest.fn()
    await render(<FormField label="Email" labelFor={{ current: { focus } }} />)
    await userEvent.setup().press(screen.getByTestId("form-field-label"))
    expect(focus).toHaveBeenCalledTimes(1)
  } finally {
    jest.useRealTimers()
  }
})
