import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { createRef, useState } from "react"
import { PlatformColor, StyleSheet } from "react-native"

import { NativeThemeProvider, Stepper, Text, type StepperProps, type TNativeStepperRef } from "../../.."
import { resolveNativeTheme } from "../../../theme/defaults"

const names = { accessibilityLabel: "Quantity", incrementLabel: "Add quantity", decrementLabel: "Reduce quantity" }
const input = () => screen.getByTestId("stepper-input")
const group = () => screen.getByTestId("stepper-group")
const plus = () => screen.getByRole("button", { name: names.incrementLabel })
const minus = () => screen.getByRole("button", { name: names.decrementLabel })
const end = (text?: string) => fireEvent(input(), "endEditing", { nativeEvent: { text } })
const pressEvent = { nativeEvent: { timestamp: 1 }, persist: () => undefined }
const hold = () => fireEvent(plus(), "pressIn", pressEvent)
const release = () => fireEvent(plus(), "pressOut", pressEvent)
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms))

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it("CAP.stepper.001 retains decrement/editor/increment order and default segmented presentation", async () => {
  await render(<Stepper {...names} />)
  expect(input()).toHaveDisplayValue("")
  expect(group()).toHaveStyle({ flexDirection: "row", gap: 8 })
  expect(group().props.accessible).toBe(false)
  expect(group().props.accessibilityLabel).toBe("Stepper Input Button Group")
  expect(group().children.map((child) => (typeof child === "object" ? child.props.testID : child))).toEqual([
    "stepper-decrement",
    "stepper-input",
    "stepper-increment",
  ])
  expect(input()).toHaveStyle({ minWidth: 25, maxWidth: 40, marginTop: 2.5, marginBottom: 2.5 })
})

it("CAP.stepper.002 preserves explicit zero dimensions and independent final root sizing", async () => {
  const { rerender } = await render(<Stepper {...names} width={0} height={0} />)
  expect(screen.getByTestId("stepper")).toHaveStyle({ width: 0, height: 0 })
  expect(group()).toHaveStyle({ width: 0, height: 0 })
  await rerender(<Stepper {...names} width="50%" height={50} style={{ width: 175 }} />)
  expect(screen.getByTestId("stepper")).toHaveStyle({ width: 175, height: 50 })
  expect(group()).toHaveStyle({ width: "50%", height: 50 })
})

it.each([
  ["small", "b11"],
  ["medium", "b10"],
  ["large", "b9"],
] as const)("CAP.stepper.003 maps %s text size to existing typography", async (textSize, variant) => {
  await render(<Stepper {...names} textSize={textSize} />)
  expect(input()).toHaveStyle({ fontSize: resolveNativeTheme("light").typography.fontSizes[variant] })
})

it("CAP.stepper.004 explicit color affects the default segmented group and both glyphs", async () => {
  await render(<Stepper {...names} color="red" />)
  expect(group()).toHaveStyle({ backgroundColor: "red" })
  for (const button of [plus(), minus()]) {
    expect(button).toHaveStyle({ backgroundColor: "red" })
    const glyph = button.queryAll((node) => node.props.style?.width === 15 && node.props.style?.height === 2)
    expect(glyph.length).toBeGreaterThan(0)
    expect(glyph[0]).toHaveStyle({ backgroundColor: "red" })
  }
})

it("CAP.stepper.005 preserves cohesive custom outline foreground and transparent buttons", async () => {
  await render(<Stepper {...names} type="cohesive" colorMode="outline" color="#ff0000" />)
  expect(group()).toHaveStyle({ borderColor: "#ff0000" })
  expect(input()).toHaveStyle({ color: "#ff0000", borderColor: "#ff0000" })
  expect(plus()).toHaveStyle({ backgroundColor: "transparent", elevation: undefined })
})

it.each([
  ["#ffffff", "#000000"],
  ["#000000", "#ffffff"],
])("CAP.stepper.006–.007 computes readable cohesive fill for %s", async (color, foreground) => {
  await render(<Stepper {...names} type="cohesive" color={color} />)
  expect(group()).toHaveStyle({ backgroundColor: color })
  expect(input()).toHaveStyle({ color: foreground, borderColor: foreground })
})

it("CAP.stepper.008 custom input color overrides computed contrast", async () => {
  await render(<Stepper {...names} type="cohesive" color="#000000" customInputStyles={{ color: "lime" }} />)
  expect(input()).toHaveStyle({ color: "lime", borderColor: "#ffffff" })
})

it.each(["primary", "secondary", "tertiary", "quaternary", "quintenary"] as const)(
  "CAP.stepper.009–.013 preserves %s action pairs and independent mode mappings",
  async (order) => {
    const theme = resolveNativeTheme("light")
    const action = theme.actions[order]
    const { rerender } = await render(<Stepper {...names} type="cohesive" order={order} />)
    expect(group()).toHaveStyle({ backgroundColor: action.background })
    expect(input()).toHaveStyle({ color: action.foreground, borderColor: action.foreground })
    await rerender(<Stepper {...names} type="cohesive" order={order} colorMode="outline" />)
    expect(group()).toHaveStyle({ borderWidth: 2, borderColor: action.border })
    expect(input()).toHaveStyle({ color: theme.colors.controlForeground })
    expect(plus()).toHaveStyle({ backgroundColor: "transparent", borderWidth: 0 })
    await rerender(<Stepper {...names} type="segmented" order={order} colorMode="outline" />)
    expect(plus()).toHaveStyle({ borderWidth: 2, borderColor: action.border })
    expect(group()).toHaveStyle({ backgroundColor: undefined })
    await rerender(<Stepper {...names} order={order} colorMode="outline" />)
    expect(plus()).toHaveStyle({ borderWidth: 0, backgroundColor: action.background })
  },
)

it("CAP.stepper.014 retains explicit segmented margins and live provider roles without resetting value", async () => {
  const example = (mode: "light" | "dark", custom = false) => (
    <NativeThemeProvider
      mode={mode}
      overrides={custom ? { actions: { primary: { background: "purple", foreground: "yellow" } } } : undefined}
    >
      <Stepper {...names} type="cohesive" order="primary" defaultValue={5} />
    </NativeThemeProvider>
  )
  const { rerender } = await render(example("light"))
  await userEvent.setup().press(plus())
  await rerender(example("dark", true))
  expect(input()).toHaveDisplayValue("6")
  expect(input()).toHaveStyle({ color: "yellow" })
  expect(group()).toHaveStyle({ backgroundColor: "purple" })
  await rerender(<Stepper {...names} type="segmented" />)
  expect(input()).toHaveStyle({ marginTop: 0, marginBottom: 0 })
})

it("CAP.stepper.015 changes only flow for vertical orientation", async () => {
  const { rerender } = await render(<Stepper {...names} value={0} orientation="vertical" />)
  expect(group()).toHaveStyle({ flexDirection: "column-reverse" })
  await rerender(<Stepper {...names} value={0} orientation="horizontal" />)
  expect(group()).toHaveStyle({ flexDirection: "row" })
  expect(input()).toHaveDisplayValue("0")
})

it("CAP.stepper.016 applies group focus and offset while preserving the draft on blur", async () => {
  const { rerender } = await render(<Stepper {...names} defaultValue={5} />)
  await fireEvent(input(), "focus", { nativeEvent: {} })
  await fireEvent.changeText(input(), "8.")
  expect(group()).toHaveStyle({ outlineWidth: 1.5, outlineOffset: 1.5 })
  await fireEvent(input(), "blur", { nativeEvent: {} })
  expect(input()).toHaveDisplayValue("8.")
  expect(StyleSheet.flatten(group().props.style).outlineWidth).toBeUndefined()
  await rerender(<Stepper {...names} defaultValue={5} offsetFocusRing={false} />)
  await fireEvent(input(), "focus", { nativeEvent: {} })
  expect(group()).toHaveStyle({ outlineOffset: 0 })
  await rerender(<Stepper {...names} defaultValue={5} enableFocusStyle={false} />)
  expect(StyleSheet.flatten(group().props.style).outlineWidth).toBeUndefined()
})

it.each(["isDisabled", "isReadOnly"] as const)(
  "CAP.stepper.017–.018 %s suppresses native editing and both steps",
  async (guard) => {
    const changed = jest.fn()
    await render(<Stepper {...names} defaultValue={5} onChange={changed} {...{ [guard]: true }} />)
    expect(input().props.editable).toBe(false)
    expect(plus()).toBeDisabled()
    expect(minus()).toBeDisabled()
    await fireEvent.changeText(input(), "8")
    await end("8")
    await fireEvent.press(plus())
    expect(input()).toHaveDisplayValue("5")
    expect(changed).not.toHaveBeenCalled()
    expect(input().props.accessibilityActions).toEqual([])
  },
)

it.each([
  ["errorState", "validationErrorBorder"],
  ["warningState", "validationWarningBorder"],
  ["successState", "validationSuccessBorder"],
] as const)("CAP.stepper.019 maps %s to the existing status border", async (flag, role) => {
  await render(<Stepper {...names} type="cohesive" colorMode="outline" {...{ [flag]: true }} />)
  expect(group()).toHaveStyle({ borderColor: resolveNativeTheme("light").colors[role] })
})

it("CAP.stepper.020 gives error precedence over warning and success", async () => {
  await render(<Stepper {...names} errorState warningState successState />)
  expect(group()).toHaveStyle({ borderColor: resolveNativeTheme("light").colors.validationErrorBorder })
})

it("CAP.stepper.021 keeps all four style owners and registered native colors independent", async () => {
  const styles = StyleSheet.create({ root: { marginTop: 5, borderRadius: 0 }, input: { backgroundColor: "green" } })
  const color = PlatformColor("labelColor")
  await render(
    <Stepper
      {...names}
      customStyles={[styles.root, { backgroundColor: color }]}
      customGroupStyles={{ backgroundColor: "orange" }}
      customInputStyles={styles.input}
      customButtonStyles={{ borderRadius: 6 }}
    />,
  )
  expect(screen.getByTestId("stepper")).toHaveStyle({ marginTop: 5, borderRadius: 0, backgroundColor: color })
  expect(group()).toHaveStyle({ backgroundColor: "orange" })
  expect(input()).toHaveStyle({ backgroundColor: "green" })
  expect(plus()).toHaveStyle({ borderRadius: 6 })
  expect(minus()).toHaveStyle({ borderRadius: 6 })
})

it("CAP.stepper.022 preserves custom group label including explicit empty string", async () => {
  const { rerender } = await render(<Stepper {...names} labels={{ inputButtonGroupAriaLabel: "Quantité courante" }} />)
  expect(group().props.accessibilityLabel).toBe("Quantité courante")
  await rerender(<Stepper {...names} labels={{ inputButtonGroupAriaLabel: "" }} />)
  expect(group().props.accessibilityLabel).toBe("")
})

it("CAP.stepper.023 style callbacks receive authoritative state and post-custom defaults", async () => {
  const style = jest.fn(({ defaultStyle, value }) => ({
    width: value === 0 ? 175 : 150,
    marginBottom: defaultStyle.marginTop,
  }))
  await render(
    <Stepper
      {...names}
      value={0}
      height={50}
      width={150}
      customStyles={{ marginTop: 5, color: "red" }}
      style={style}
    />,
  )
  expect(style).toHaveBeenLastCalledWith(
    expect.objectContaining({
      value: 0,
      inputValue: "0",
      isDisabled: false,
      defaultStyle: expect.objectContaining({ width: 150, height: 50, marginTop: 5, color: "red" }),
    }),
  )
  expect(screen.getByTestId("stepper")).toHaveStyle({ width: 175, height: 50, marginTop: 5, marginBottom: 5 })
})

it("CAP.stepper.024 forwards the native editor ref/events and consumes wrapper props", async () => {
  const ref = createRef<TNativeStepperRef>()
  const nativeChange = jest.fn(),
    layout = jest.fn(),
    focused = jest.fn()
  await render(
    <Stepper
      {...names}
      ref={ref}
      testID="owned"
      data-testid="alias"
      nativeID="root-id"
      type="cohesive"
      orientation="vertical"
      PlusIcon={<Text>More</Text>}
      MinusIcon={<Text>Less</Text>}
      onLayout={layout}
      inputProps={{ onChange: nativeChange, onFocus: focused, keyboardType: "decimal-pad" }}
    />,
  )
  expect(ref.current).toBeTruthy()
  const editor = screen.getByTestId("owned-input")
  const event = { nativeEvent: { text: "4", eventCount: 1 } }
  await fireEvent(editor, "change", event)
  expect(nativeChange).toHaveBeenCalledWith(event)
  const focusEvent = { nativeEvent: {} }
  await fireEvent(editor, "focus", focusEvent)
  expect(focused.mock.calls[0]?.[0]).toBe(focusEvent)
  expect(editor.props.keyboardType).toBe("decimal-pad")
  const root = screen.getByTestId("owned")
  expect(root.props.nativeID).toBe("root-id")
  expect(screen.queryByTestId("alias")).toBeNull()
  for (const key of [
    "type",
    "orientation",
    "colorMode",
    "order",
    "labels",
    "PlusIcon",
    "MinusIcon",
    "customStyles",
    "value",
    "onChange",
  ])
    expect(root.props[key]).toBeUndefined()
  expect(screen.getByText("More", { includeHiddenElements: true })).toBeOnTheScreen()
  expect(screen.getByText("Less", { includeHiddenElements: true })).toBeOnTheScreen()
})

it("retains controlled zero across repeated veto and echoes null without inventing a value", async () => {
  const changed = jest.fn()
  const { rerender } = await render(<Stepper {...names} value={0} onChange={changed} />)
  const user = userEvent.setup()
  await user.press(plus())
  await user.press(plus())
  expect(changed.mock.calls).toEqual([[1], [1]])
  expect(input()).toHaveDisplayValue("0")
  await rerender(<Stepper {...names} value={null} onChange={changed} />)
  expect(input()).toHaveDisplayValue("")
  await user.press(minus())
  expect(changed).toHaveBeenLastCalledWith(0)
  expect(input()).toHaveDisplayValue("")
})

it("initializes a default once and preserves arbitrary caller-authoritative values until a request", async () => {
  const changed = jest.fn()
  const { rerender } = await render(<Stepper {...names} defaultValue={0} onChange={changed} />)
  await rerender(<Stepper {...names} defaultValue={8} onChange={changed} />)
  expect(input()).toHaveDisplayValue("0")
  await userEvent.setup().press(plus())
  expect(input()).toHaveDisplayValue("1")
})

it("uses final native payload once, preserving observer identity after the numeric request", async () => {
  const trace: unknown[] = []
  const observer = jest.fn((event) => trace.push(event))
  await render(
    <Stepper
      {...names}
      defaultValue={5}
      onChange={(value) => trace.push(value)}
      inputProps={{ onSubmitEditing: observer, onEndEditing: observer }}
    />,
  )
  await fireEvent.changeText(input(), "7.2")
  const event = { nativeEvent: { text: "8.25" } }
  await fireEvent(input(), "submitEditing", event)
  await end("7.2")
  expect(trace).toEqual([8.25, event, { nativeEvent: { text: "7.2" } }])
  expect(observer.mock.calls[0]?.[0]).toBe(event)
  expect(input()).toHaveDisplayValue("8.25")
})

it("steps the latest deferred native draft exactly once", async () => {
  const changed = jest.fn()
  await render(<Stepper {...names} defaultValue={1} onChange={changed} step={0.1} />)
  await fireEvent.changeText(input(), "2.2")
  await hold()
  await end("2.3")
  expect(changed).not.toHaveBeenCalled()
  await release()
  await fireEvent.press(plus(), pressEvent)
  expect(changed.mock.calls).toEqual([[2.4]])
  expect(input()).toHaveDisplayValue("2.4")
})

it("parses locale decimals and exposes the same bounded step path to native actions", async () => {
  const changed = jest.fn()
  await render(
    <Stepper {...names} defaultValue={0} locale="fr-CA" step={0.1} minValue={0} maxValue={0.2} onChange={changed} />,
  )
  await fireEvent.changeText(input(), "0,1")
  await end("0,1")
  expect(changed.mock.calls).toEqual([[0.1]])
  await fireEvent(input(), "accessibilityAction", { nativeEvent: { actionName: "incrementValue" } })
  expect(changed.mock.calls).toEqual([[0.1], [0.2]])
  expect(input()).toHaveDisplayValue("0,2")
  expect(plus()).toBeDisabled()
  expect(input().props.accessibilityActions).toEqual([{ name: "decrementValue", label: names.decrementLabel }])
})

it("repeats an owner veto after600ms/every60ms and adds no release request", async () => {
  const changed = jest.fn()
  await render(<Stepper {...names} value={0} onChange={changed} />)
  await hold()
  await advance(599)
  expect(changed).not.toHaveBeenCalled()
  await advance(1)
  await advance(60)
  await advance(60)
  expect(changed.mock.calls).toEqual([[1], [1], [1]])
  expect(input()).toHaveDisplayValue("0")
  await release()
  await fireEvent.press(plus(), pressEvent)
  await advance(1000)
  expect(changed).toHaveBeenCalledTimes(3)
})

it("repeats from each echoed value and stops at an exhausted bound", async () => {
  const changed = jest.fn()
  const Example = () => {
    const [value, setValue] = useState<number | null>(0)
    return (
      <Stepper
        {...names}
        value={value}
        maxValue={2}
        onChange={(next) => {
          changed(next)
          setValue(next)
        }}
      />
    )
  }
  await render(<Example />)
  await hold()
  await advance(600)
  await advance(60)
  await advance(600)
  expect(changed.mock.calls).toEqual([[1], [2]])
  expect(input()).toHaveDisplayValue("2")
  expect(plus()).toBeDisabled()
})

it.each(["isDisabled", "isReadOnly"] as const)(
  "retires the held cycle across %s takeover and restoration",
  async (guard) => {
    const changed = jest.fn()
    const { rerender } = await render(<Stepper {...names} value={0} onChange={changed} />)
    await hold()
    await rerender(<Stepper {...names} value={0} onChange={changed} {...{ [guard]: true }} />)
    await advance(1000)
    await rerender(<Stepper {...names} value={0} onChange={changed} />)
    await release()
    await fireEvent.press(plus(), pressEvent)
    expect(changed).not.toHaveBeenCalled()
  },
)

it("retires a held configuration change and later editing remains usable after cancellation", async () => {
  const changed = jest.fn()
  const { rerender } = await render(<Stepper {...names} value={0} onChange={changed} />)
  await hold()
  await rerender(<Stepper {...names} value={0} step={0.1} onChange={changed} />)
  await advance(1000)
  await release()
  await fireEvent.press(plus(), pressEvent)
  expect(changed).not.toHaveBeenCalled()
  await fireEvent(input(), "focus", { nativeEvent: {} })
  await fireEvent.changeText(input(), "0.3")
  await end("0.3")
  expect(changed.mock.calls).toEqual([[0.3]])
})

it("press cancellation stops repeats and clears the pending edit without a fabricated step", async () => {
  const changed = jest.fn()
  await render(<Stepper {...names} defaultValue={1} onChange={changed} />)
  await hold()
  await release()
  await advance(1000)
  await end("3")
  expect(changed.mock.calls).toEqual([[3]])
  expect(input()).toHaveDisplayValue("3")
})

it("retires the active timer on unmount", async () => {
  const changed = jest.fn()
  const { unmount } = await render(<Stepper {...names} defaultValue={0} onChange={changed} />)
  await hold()
  await advance(600)
  expect(changed.mock.calls).toEqual([[1]])
  await unmount()
  await advance(1000)
  expect(changed).toHaveBeenCalledTimes(1)
})

it.each([0, false, "", null])("keeps the canonical default glyph for falsy custom icon %s", async (PlusIcon) => {
  await render(<Stepper {...names} PlusIcon={PlusIcon} />)
  expect(
    plus().queryAll((node) => node.props.style?.width === 2 && node.props.style?.height === 15).length,
  ).toBeGreaterThan(0)
})

it.each([
  { width: -1 },
  { width: "12px" },
  { color: "var(--cui-color-primary-500)" },
  { customGroupStyles: { backgroundColor: "currentColor" } },
])("rejects invalid native dimensions/colors %j", async (props) => {
  const logged = jest.spyOn(console, "error").mockImplementation(() => undefined)
  try {
    await expect(render(<Stepper {...names} {...(props as StepperProps)} />)).rejects.toThrow()
  } finally {
    logged.mockRestore()
  }
})

it("keeps a held gesture through semantically equivalent formatting objects", async () => {
  const changed = jest.fn()
  const { rerender } = await render(
    <Stepper
      {...names}
      value={0}
      onChange={changed}
      formatOptions={{ useGrouping: false, maximumFractionDigits: 3 }}
    />,
  )
  await hold()
  await rerender(
    <Stepper
      {...names}
      value={0}
      onChange={changed}
      formatOptions={{ maximumFractionDigits: 3, useGrouping: false }}
    />,
  )
  await advance(600)
  expect(changed.mock.calls).toEqual([[1]])
  await release()
})

it.each(["light", "dark"] as const)("all five cohesive action roles follow the %s provider", async (mode) => {
  const theme = resolveNativeTheme(mode)
  const example = (order: StepperProps["order"]) => (
    <NativeThemeProvider mode={mode}>
      <Stepper {...names} value={0} type="cohesive" order={order} />
    </NativeThemeProvider>
  )
  const { rerender } = await render(example(undefined))
  expect(group()).toHaveStyle({ backgroundColor: theme.colors.controlForeground })
  expect(input()).toHaveStyle({ color: theme.colors.controlBackground })
  for (const order of ["primary", "secondary", "tertiary", "quaternary", "quintenary"] as const) {
    await rerender(example(order))
    expect(group()).toHaveStyle({ backgroundColor: theme.actions[order].background })
    expect(input()).toHaveStyle({ color: theme.actions[order].foreground })
  }
})

it("supports opaque native colors with the canonical fallback and an explicit foreground override", async () => {
  const color = PlatformColor("labelColor")
  const { rerender } = await render(<Stepper {...names} type="cohesive" color={color} />)
  expect(group()).toHaveStyle({ backgroundColor: color })
  expect(input()).toHaveStyle({ color: "#ffffff" })
  await rerender(
    <Stepper
      {...names}
      type="cohesive"
      color={color}
      customInputStyles={{ color: PlatformColor("secondaryLabelColor") }}
    />,
  )
  expect(input()).toHaveStyle({ color: PlatformColor("secondaryLabelColor") })
})

it("retains explicit inline outline color ahead of validation classes", async () => {
  await render(<Stepper {...names} type="cohesive" colorMode="outline" color="red" errorState warningState />)
  expect(group()).toHaveStyle({ borderColor: "red" })
})

it.each(["light", "dark"] as const)("keeps default segmented editor theme roles in %s mode", async (mode) => {
  const theme = resolveNativeTheme(mode)
  await render(
    <NativeThemeProvider mode={mode}>
      <Stepper {...names} value={0} type="segmented" />
    </NativeThemeProvider>,
  )
  expect(input()).toHaveDisplayValue("0")
  expect(input()).toHaveStyle({ color: theme.colors.controlForeground, borderColor: theme.colors.controlBorder })
})
