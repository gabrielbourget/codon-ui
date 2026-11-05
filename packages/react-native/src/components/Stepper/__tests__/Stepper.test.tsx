import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { createRef, useLayoutEffect, useState } from "react"
import { Platform, PlatformColor, StyleSheet, View, type TextInput } from "react-native"

import { NativeThemeProvider, Stepper, Text, type StepperProps, type TNativeStepperRef } from "../../.."
import { NativeFormRegistryContext } from "../../../form/context"
import { NativeFormRegistry } from "../../../form/registry"
import * as focus from "../../../input/focus"
import { NativeKeyboardScope } from "../../../input/NativeKeyboardScope"
import type { TNativeAdmittedPress } from "../../../input/nativePressCycle"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import type { TNativePressEvent } from "../../../input/types"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { resolveNativeTheme } from "../../../theme/defaults"
import { useNumberInputState } from "../../NumberInput/state"
import { useStepperRepeat } from "../repeat"

jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestKeyboardFocus: jest.fn(), requestKeyboardBlur: jest.fn(), inspectAccessibility: jest.fn() },
}))

const names = { accessibilityLabel: "Quantity", incrementLabel: "Add quantity", decrementLabel: "Reduce quantity" }
const input = () => screen.getByTestId("stepper-input")
const group = () => screen.getByTestId("stepper-group")
const plus = () => screen.getByRole("button", { name: names.incrementLabel })
const minus = () => screen.getByRole("button", { name: names.decrementLabel })
const end = (text?: string) => fireEvent(input(), "endEditing", { nativeEvent: { text } })
const pressEvent = {
  persist: () => undefined,
  currentTarget: 17,
  target: 17,
  nativeEvent: {
    target: 17,
    targetSurface: 1,
    timestamp: 1,
    identifier: 0,
    locationX: 0,
    locationY: 0,
    pageX: 0,
    pageY: 0,
  },
}
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms))
const root = () => screen.getByTestId("stepper")
const acknowledge = async (testID = "stepper", epoch = 1, active = true) => {
  for (const ready of [false, active]) {
    const props = screen.getByTestId(testID).props
    await act(() =>
      props.onNativeScopeStatus({
        nativeEvent: {
          ownerId: props.ownerId,
          windowId: "stepper-window",
          epoch,
          policyRevision: props.policyRevision,
          ready,
          windowActive: active,
        },
      }),
    )
  }
  const current = screen.getByTestId(testID).props
  for (const binding of current.ordinaryEditorBindings)
    await act(() =>
      current.onNativeOrdinaryEditorStatus({
        nativeEvent: {
          ...binding,
          ownerId: current.ownerId,
          target: 17,
          windowId: "stepper-window",
          epoch,
          sequence: epoch,
          ready: active,
          windowActive: active,
          error: "",
        },
      }),
    )
}
const action = (direction: -1 | 1) => (direction === 1 ? plus() : minus())
const hold = async () => {
  await acknowledge()
  await fireEvent(plus(), "responderGrant", pressEvent)
}
const release = () => fireEvent(plus(), "responderRelease", pressEvent)
const producerCycles = new Map<string, number>()
const producer = (cohort: string, direction: -1 | 1, phase = "start") => {
  const bindingId = action(direction).props.nativeResponderCohortBinding
  const cycleId = (producerCycles.get(bindingId) ?? 0) + (phase === "start" ? 1 : 0)
  producerCycles.set(bindingId, cycleId)
  return {
    nativeEvent: {
      ownerId: action(direction).props.ownerId,
      bindingId,
      target: 9,
      sourceTarget: 17,
      surfaceId: 1,
      identifier: 0,
      cycleId,
      cohort,
      phase,
      scopeOwnerId: root().props.ownerId,
      windowId: "stepper-window",
      epoch: root().props.acceptedEpoch,
    },
  }
}
const admittedHold = async (cohort: string, direction: -1 | 1 = 1) => {
  await acknowledge()
  const metadata = producer(cohort, direction)
  await fireEvent(action(direction), "nativeResponderCohort", metadata)
  await fireEvent(action(direction), "responderGrant", pressEvent)
  return metadata
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.replaceProperty(Platform, "OS", "ios")
  jest.clearAllMocks()
  producerCycles.clear()
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockImplementation(() => 17)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

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
    await advance(275)
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
  await advance(275)
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
  await fireEvent(plus(), "responderTerminate", pressEvent)
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
    await advance(275)
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

it("retains the original editor and exact event observers through locale and guard composition", async () => {
  const ref = createRef<TNativeStepperRef>()
  const trace: unknown[] = []
  const change = jest.fn((event) => trace.push(event))
  const selection = jest.fn((event) => trace.push(event))
  const final = jest.fn((event) => trace.push(event))
  const example = (locale: string, isReadOnly = false) => (
    <Stepper
      {...names}
      ref={ref}
      value={0}
      step={0.1}
      locale={locale}
      isReadOnly={isReadOnly}
      onChange={(next) => trace.push(next)}
      inputProps={{ onChange: change, onSelectionChange: selection, onEndEditing: final }}
    />
  )
  const { rerender } = await render(example("en-US"))
  const originalEditor = ref.current
  expect(originalEditor).toBeTruthy()
  await rerender(example("fr-CA"))
  expect(ref.current).toBe(originalEditor)
  const nativeChange = { nativeEvent: { text: "0,1", eventCount: 7, target: 42 } }
  const nativeSelection = { nativeEvent: { selection: { start: 1, end: 3 }, target: 42 } }
  const nativeFinal = { nativeEvent: { text: "0,2", target: 42 } }
  await fireEvent(input(), "focus", { nativeEvent: { target: 42 } })
  await fireEvent.changeText(input(), "0,1")
  await fireEvent(input(), "change", nativeChange)
  await fireEvent(input(), "selectionChange", nativeSelection)
  await fireEvent(input(), "endEditing", nativeFinal)
  expect(trace).toEqual([nativeChange, nativeSelection, 0.2, nativeFinal])
  expect(change.mock.calls[0]?.[0]).toBe(nativeChange)
  expect(selection.mock.calls[0]?.[0]).toBe(nativeSelection)
  expect(final.mock.calls[0]?.[0]).toBe(nativeFinal)
  expect(input()).toHaveDisplayValue("0")
  await rerender(example("fr-CA", true))
  expect(ref.current).toBe(originalEditor)
  await fireEvent.changeText(input(), "0,7")
  await fireEvent(input(), "change", nativeChange)
  await fireEvent(input(), "accessibilityAction", { nativeEvent: { actionName: "incrementValue" } })
  expect(trace).toEqual([nativeChange, nativeSelection, 0.2, nativeFinal])
  await rerender(example("en-US"))
  expect(ref.current).toBe(originalEditor)
  await userEvent.setup().press(plus())
  expect(trace).toEqual([nativeChange, nativeSelection, 0.2, nativeFinal, 0.1])
})

it("held veto uses the latest owner callback without restarting its600/60ms clock", async () => {
  const previousOwner = jest.fn()
  const currentOwner = jest.fn()
  const { rerender } = await render(<Stepper {...names} value={0} onChange={previousOwner} />)
  await hold()
  await advance(300)
  await rerender(<Stepper {...names} value={0} onChange={currentOwner} />)
  await advance(299)
  expect(currentOwner).not.toHaveBeenCalled()
  await advance(1)
  await advance(60)
  expect(previousOwner).not.toHaveBeenCalled()
  expect(currentOwner.mock.calls).toEqual([[1], [1]])
  expect(input()).toHaveDisplayValue("0")
  await release()
  await fireEvent.press(plus(), pressEvent)
  expect(currentOwner).toHaveBeenCalledTimes(2)
})

it("owner value takeover retires a pending hold and its release before a fresh action", async () => {
  const changed = jest.fn()
  const { rerender } = await render(<Stepper {...names} value={0} onChange={changed} />)
  await hold()
  await advance(300)
  await rerender(<Stepper {...names} value={5} onChange={changed} />)
  await advance(1000)
  await release()
  await fireEvent.press(plus(), pressEvent)
  expect(changed).not.toHaveBeenCalled()
  expect(input()).toHaveDisplayValue("5")
  await userEvent.setup().press(plus())
  expect(changed.mock.calls).toEqual([[6]])
  expect(input()).toHaveDisplayValue("5")
})

it("locale takeover retires the pending draft and hold without replay after restoration", async () => {
  const changed = jest.fn()
  const example = (locale: string) => <Stepper {...names} value={1} step={0.1} locale={locale} onChange={changed} />
  const { rerender } = await render(example("en-US"))
  await fireEvent.changeText(input(), "2.2")
  await hold()
  await end("2.3")
  await rerender(example("fr-CA"))
  await rerender(example("en-US"))
  await advance(1000)
  await release()
  await fireEvent.press(plus(), pressEvent)
  expect(changed).not.toHaveBeenCalled()
  expect(input()).toHaveDisplayValue("1")
  await userEvent.setup().press(plus())
  expect(changed.mock.calls).toEqual([[1.1]])
})

it.each([
  [-1, "mouse"],
  [1, "mouse"],
  [-1, "pen"],
  [1, "pen"],
] as const)(
  "STP.PRESS.01 direction%s %s requests immediately then400/60 with no release request",
  async (direction, cohort) => {
    jest.replaceProperty(Platform, "OS", "android")
    const changed = jest.fn()
    await render(<Stepper {...names} value={0} onChange={changed} />)
    await admittedHold(cohort, direction)
    expect(changed.mock.calls).toEqual([[direction]])
    await advance(399)
    expect(changed).toHaveBeenCalledTimes(1)
    await advance(1)
    await advance(60)
    expect(changed.mock.calls).toEqual([[direction], [direction], [direction]])
    await fireEvent(action(direction), "nativeResponderCohort", producer(cohort, direction, "end"))
    await fireEvent(action(direction), "responderRelease", pressEvent)
    await advance(1000)
    expect(changed).toHaveBeenCalledTimes(3)
    expect(input()).toHaveDisplayValue("0")
  },
)

it.each([
  [-1, "touch"],
  [1, "touch"],
  [-1, "unknown"],
  [1, "unknown"],
] as const)(
  "STP.PRESS.02 direction%s %s retains raw evidence and600/60 without a post-repeat action",
  async (direction, cohort) => {
    jest.replaceProperty(Platform, "OS", "android")
    const changed = jest.fn()
    await render(<Stepper {...names} value={0} onChange={changed} />)
    const metadata = await admittedHold(cohort, direction)
    expect(metadata.nativeEvent.cohort).toBe(cohort)
    await advance(599)
    expect(changed).not.toHaveBeenCalled()
    await advance(1)
    await advance(60)
    expect(changed.mock.calls).toEqual([[direction], [direction]])
    await fireEvent(action(direction), "responderRelease", pressEvent)
    await advance(1000)
    expect(changed).toHaveBeenCalledTimes(2)
    expect(root().props.policies[0]).toMatchObject({ originalEditorAction: true, targetTag: 17 })
  },
)

it.each(["touch", "unknown"])(
  "STP.PRESS.02 %s short release completes once after the admission ends",
  async (cohort) => {
    jest.replaceProperty(Platform, "OS", "android")
    const changed = jest.fn()
    await render(<Stepper {...names} value={0} onChange={changed} />)
    await admittedHold(cohort)
    await advance(200)
    await fireEvent(plus(), "responderRelease", pressEvent)
    await fireEvent.press(plus(), pressEvent)
    await advance(1000)
    expect(changed.mock.calls).toEqual([[1]])
  },
)

it("STP.PRESS.02 refuses mismatched metadata for held work and retains ordinary successful activation", async () => {
  jest.replaceProperty(Platform, "OS", "android")
  const changed = jest.fn()
  await render(<Stepper {...names} value={0} onChange={changed} />)
  await acknowledge()
  const invalid = producer("mouse", 1)
  invalid.nativeEvent.windowId = "other-window"
  await fireEvent(plus(), "nativeResponderCohort", invalid)
  await fireEvent(plus(), "responderGrant", pressEvent)
  await advance(1000)
  expect(changed).not.toHaveBeenCalled()
  await fireEvent(plus(), "responderRelease", pressEvent)
  expect(changed.mock.calls).toEqual([[1]])
})

it.each(["touch", "pen", "unknown"])("STP.PRESS.03 %s requests only the actual owned Button focus", async (cohort) => {
  jest.replaceProperty(Platform, "OS", "android")
  const editor = createRef<TNativeStepperRef>()
  await render(<Stepper {...names} ref={editor} value={0} />)
  await admittedHold(cohort)
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledWith(expect.anything(), plus().props.ownerId)
  expect((Commands.requestKeyboardFocus as jest.Mock).mock.calls[0][0]).not.toBe(editor.current)
})

it("STP.PRESS.03 mouse requests the original editor only after its real focus binding is acknowledged", async () => {
  jest.replaceProperty(Platform, "OS", "android")
  const editor = createRef<TNativeStepperRef>(),
    requested = jest.fn()
  await render(<Stepper {...names} ref={editor} value={0} />)
  const original = editor.current!
  const unregister = focus.registerNativeFocusTarget(original, {
    canFocus: () => true,
    focus: requested,
    blur: () => undefined,
  })
  try {
    await admittedHold("mouse")
    expect(editor.current).toBe(original)
    expect(requested).toHaveBeenCalledTimes(1)
    expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
    expect(root().props.ordinaryEditorBindings[0]).toHaveProperty("originalEditorAction", true)
    expect(input().props.onNativeOrdinaryEditorKey).toEqual(expect.any(Function))
  } finally {
    unregister()
  }
})

it("STP.PRESS.03 retains an already focused original editor", async () => {
  const editor = createRef<TNativeStepperRef>()
  await render(<Stepper {...names} ref={editor} value={0} />)
  jest.spyOn(focus, "getNativeFocusedTarget").mockImplementation(() => editor.current)
  await hold()
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

it("STP.PRESS.04 keeps a held lease through callback-ref cleanup and a transient same-original handoff", async () => {
  const firstCleanup = jest.fn(),
    secondCleanup = jest.fn(),
    changed = jest.fn()
  let original: TextInput | null = null
  const first = jest.fn((target: TextInput | null) => {
    original = target
    return firstCleanup
  })
  const second = jest.fn((_target: TextInput | null) => secondCleanup)
  const { rerender, unmount } = await render(<Stepper {...names} ref={first} value={0} onChange={changed} />)
  await hold()
  await advance(300)
  await rerender(<Stepper {...names} ref={second} value={0} onChange={changed} />)
  expect(firstCleanup).toHaveBeenCalledTimes(1)
  expect(second.mock.calls[0][0]).toBe(original)
  await advance(300)
  expect(changed.mock.calls).toEqual([[1]])
  await release()
  expect(changed).toHaveBeenCalledTimes(1)
  await unmount()
  expect(secondCleanup).toHaveBeenCalledTimes(1)
})

it("STP.PRESS.04 window loss and recovery permanently retires an old press before a fresh action", async () => {
  const changed = jest.fn()
  await render(<Stepper {...names} value={0} onChange={changed} />)
  await hold()
  await advance(300)
  await acknowledge("stepper", 1, false)
  await acknowledge("stepper", 2)
  await advance(1000)
  await release()
  expect(changed).not.toHaveBeenCalled()
  await hold()
  await release()
  expect(changed.mock.calls).toEqual([[1]])
})

const repeatControls = createRef<ReturnType<typeof useStepperRepeat>>()
const RepeatProbe = ({
  editor,
  lifetime = "owner",
  onChange,
}: {
  editor: TextInput
  lifetime?: string
  onChange: (value: number | null) => void
}) => {
  const numeric = useNumberInputState({ ...names, value: 0, onChange })
  const repeat = useStepperRepeat(numeric, false, { lifetimeKey: lifetime, originalEditor: () => editor })
  useLayoutEffect(() => {
    repeatControls.current = repeat
  })
  return <View />
}

it.each(["editor", "provider"])(
  "STP.PRESS.04 %s replacement never revives an old local completion",
  async (replacement) => {
    const first = {} as TextInput,
      second = {} as TextInput,
      changed = jest.fn()
    const tree = (replaced = false) => (
      <NativeKeyboardScope captureEnabled testID="probe-root">
        <RepeatProbe
          editor={replaced && replacement === "editor" ? second : first}
          lifetime={replaced && replacement === "provider" ? "other-owner" : "owner"}
          onChange={changed}
        />
      </NativeKeyboardScope>
    )
    const { rerender } = await render(tree())
    await acknowledge("probe-root")
    const admission = { cohort: "responder", originalReceiver: {} as View, isCurrent: () => true } as const
    await act(() => {
      repeatControls.current!.prepare(1, pressEvent as unknown as TNativePressEvent)
      repeatControls.current!.start(1, pressEvent as unknown as TNativePressEvent, admission)
    })
    await advance(300)
    await rerender(tree(true))
    await rerender(tree())
    await advance(1000)
    await act(() => {
      repeatControls.current!.up(1)
      repeatControls.current!.end()
      repeatControls.current!.release(1)
    })
    expect(changed).not.toHaveBeenCalled()
  },
)

it("STP.PRESS.04 an invalidated private admission cannot complete after its inputs return", async () => {
  const changed = jest.fn(),
    editor = {} as TextInput
  let current = true
  const admission: TNativeAdmittedPress = {
    cohort: "responder",
    originalReceiver: {} as View,
    isCurrent: () => current,
  }
  await render(
    <NativeKeyboardScope captureEnabled testID="probe-root">
      <RepeatProbe editor={editor} onChange={changed} />
    </NativeKeyboardScope>,
  )
  await acknowledge("probe-root")
  await act(() => {
    repeatControls.current!.prepare(1, pressEvent as unknown as TNativePressEvent)
    repeatControls.current!.start(1, pressEvent as unknown as TNativePressEvent, admission)
  })
  current = false
  await advance(600)
  current = true
  await act(() => {
    repeatControls.current!.up(1)
    repeatControls.current!.release(1)
  })
  expect(changed).not.toHaveBeenCalled()
})

it("STP.PRESS.03 refuses unacknowledged editor focus and never bypasses the real binding", async () => {
  jest.replaceProperty(Platform, "OS", "android")
  const editor = createRef<TNativeStepperRef>(),
    requested = jest.fn()
  await render(<Stepper {...names} ref={editor} value={0} />)
  const unregister = focus.registerNativeFocusTarget(editor.current!, {
    canFocus: () => true,
    focus: requested,
    blur: () => undefined,
  })
  try {
    for (const ready of [false, true]) {
      const props = root().props
      await act(() =>
        props.onNativeScopeStatus({
          nativeEvent: {
            ownerId: props.ownerId,
            windowId: "stepper-window",
            epoch: 1,
            policyRevision: props.policyRevision,
            ready,
            windowActive: true,
          },
        }),
      )
    }
    await fireEvent(plus(), "nativeResponderCohort", producer("mouse", 1))
    await fireEvent(plus(), "responderGrant", pressEvent)
    expect(requested).not.toHaveBeenCalled()
    expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
    await release()
    await admittedHold("mouse")
    expect(requested).toHaveBeenCalledTimes(1)
  } finally {
    unregister()
  }
})

it("STP.PRESS.04 respects the actual floating window activity and never resumes its old hold", async () => {
  const changed = jest.fn()
  let active = true
  const tree = () => (
    <NativeFloatingWindowContext.Provider value={() => active}>
      <Stepper {...names} value={0} onChange={changed} />
    </NativeFloatingWindowContext.Provider>
  )
  const { rerender } = await render(tree())
  await hold()
  await advance(300)
  active = false
  await rerender(tree())
  active = true
  await rerender(tree())
  await advance(1000)
  await release()
  expect(changed).not.toHaveBeenCalled()
  await hold()
  await release()
  expect(changed.mock.calls).toEqual([[1]])
})

it("STP.PRESS.05 explicit Form reset retires an admitted repeating hold and its saved release", async () => {
  const registry = new NativeFormRegistry(),
    changed = jest.fn()
  await render(
    <NativeFormRegistryContext.Provider value={registry}>
      <Stepper {...names} defaultValue={2} onChange={changed} />
    </NativeFormRegistryContext.Provider>,
  )
  await hold()
  await advance(600)
  expect(changed.mock.calls).toEqual([[3]])
  await act(() => [...registry.fields.values()][0].reset("native"))
  await advance(1000)
  await release()
  expect(changed.mock.calls).toEqual([[3], [2]])
  expect(input()).toHaveDisplayValue("2")
})
