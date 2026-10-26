import "../../../collection/__tests__/nativeReceipts"

import { screen } from "@testing-library/react-native"
import { createRef } from "react"
import { StyleSheet, type View } from "react-native"

import {
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  rerenderWithNativeCollections as rerender,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeThemeProvider } from "../../../theme"
import { DynamicFilterArgumentInput, type TNativeDynamicFilterArgumentInputProps } from "../DynamicFilterArgumentInput"

const propsFor = (
  extra: Partial<TNativeDynamicFilterArgumentInputProps> = {},
): TNativeDynamicFilterArgumentInputProps => ({
  dataType: "text",
  argument: "held",
  filterArgumentType: "Input",
  filterArgumentAccessibleLabel: "Filter Name",
  nativeLabels: {
    number: { incrementLabel: "Increase argument", decrementLabel: "Decrease argument" },
    range: {
      minimumIncrement: "Increase minimum",
      minimumDecrement: "Decrease minimum",
      maximumIncrement: "Increase maximum",
      maximumDecrement: "Decrease maximum",
    },
    options: { inputLabel: "Find argument", closeLabel: "Close arguments" },
  },
  onArgumentChange: jest.fn(),
  ...extra,
})
const wrap = (props: TNativeDynamicFilterArgumentInputProps) => (
  <NativeThemeProvider>
    <DynamicFilterArgumentInput {...props} />
  </NativeThemeProvider>
)
it("merges default, registered/custom and final root styles with zero and empty IDs intact", async () => {
  const registered = StyleSheet.create({ root: { marginTop: 5, backgroundColor: "turquoise" } })
  await render(
    wrap(
      propsFor({
        customStyles: [registered.root, { width: 0 }],
        style: { marginBottom: 10, backgroundColor: "tomato" },
        testID: "",
      }),
    ),
  )
  expect(StyleSheet.flatten(screen.getByTestId("").props.style)).toMatchObject({
    width: 0,
    height: "auto",
    marginTop: 5,
    marginBottom: 10,
    backgroundColor: "tomato",
  })
})
it("retains native label precedence, all relationship aliases and explicit empty overrides", async () => {
  const props = propsFor({
    ariaLabel: "Alias",
    ariaLabelledBy: "label-one label-two",
    ariaDescribedBy: "description-one description-two",
    ariaDetails: "details",
  })
  await render(wrap(props))
  const root = screen.getByTestId("dynamic-filter-argument-input")
  expect(root.props.accessibilityLabel).toBe("Alias")
  expect(root.props.nativeLabelledBy).toEqual(["label-one", "label-two"])
  expect(root.props.nativeDescribedBy).toEqual(["description-one", "description-two"])
  expect(root.props.nativeDetailsBy).toEqual(["details"])
  await rerender(wrap({ ...props, accessibilityLabel: "", "aria-label": "Native", "aria-describedby": "" }))
  expect(root.props.accessibilityLabel).toBe("")
  expect(root.props.nativeDescribedBy).toEqual([])
})
it("forwards field/input slots independently of the root and holds the original editor through owner updates", async () => {
  const props = propsFor({ customFieldStyles: { marginTop: 7 }, customInputStyles: { marginBottom: 9 } })
  await render(wrap(props))
  const input = screen.getByLabelText("Filter Name")
  expect(StyleSheet.flatten(input.props.style)).toMatchObject({ marginBottom: 9 })
  expect(StyleSheet.flatten(screen.getByTestId("form-field").props.style)).toMatchObject({ marginTop: 7 })
  await fireEvent.changeText(input, "request")
  expect(props.onArgumentChange).toHaveBeenCalledWith({ argument: "request" })
  expect(input).toHaveDisplayValue("held")
  await rerender(wrap({ ...props, argument: "echo", customStyles: { marginTop: 12 } }))
  expect(screen.getByLabelText("Filter Name") === input).toBe(true)
  expect(input).toHaveDisplayValue("echo")
})
it("preserves the full-width numeric input owner", async () => {
  await render(wrap(propsFor({ dataType: "number", argument: 130 })))
  expect(StyleSheet.flatten(screen.getByTestId("number-input").props.style)).toMatchObject({ width: "100%" })
  expect(screen.getByTestId("number-input-input")).toHaveDisplayValue("130")
})
it("forwards list row/action slots and keeps untouched sibling values", async () => {
  const props = propsFor({
    argument: [0, 1],
    filterArgumentType: "Multi Input",
    customRowStyles: { columnGap: 15 },
    customActionButtonStyles: { paddingLeft: 20 },
  })
  await render(wrap(props))
  const first = screen.getByLabelText("Filter Argument 0")
  expect(StyleSheet.flatten(first.parent?.props.style)).toMatchObject({ columnGap: 15 })
  expect(
    StyleSheet.flatten(screen.getByRole("button", { name: "Add Filter Argument Entry" }).props.style),
  ).toMatchObject({ paddingLeft: 20 })
  await fireEvent.changeText(first, "edited")
  expect(props.onArgumentChange).toHaveBeenCalledWith({ argument: ["edited", 1] })
})
it("consumes every wrapper-owned argument/slot/callback property", async () => {
  const props = propsFor({
    canAct: () => true,
    customFieldStyles: { marginTop: 1 },
    customInputStyles: { marginTop: 2 },
    customRowStyles: { marginTop: 3 },
    customActionButtonStyles: { marginTop: 4 },
    customPlaceholderStyles: { marginTop: 5 },
    customStyles: { marginTop: 6 },
  })
  await render(wrap(props))
  const root = screen.getByTestId("dynamic-filter-argument-input")
  for (const name of [
    "dataType",
    "argument",
    "filterArgumentType",
    "filterArgumentAccessibleLabel",
    "nativeLabels",
    "onArgumentChange",
    "canAct",
    "customFieldStyles",
    "customInputStyles",
    "customRowStyles",
    "customActionButtonStyles",
    "customPlaceholderStyles",
    "customStyles",
  ])
    expect(Object.hasOwn(root.props, name)).toBe(false)
})
it("keeps original native root events and refs separate from owner requests", async () => {
  const click = jest.fn()
  const ref = createRef<View>()
  const props = propsFor({ onClick: click, role: "group", accessibilityLabel: "Argument group" })
  const renderWithRef = (argument: string) => (
    <NativeThemeProvider>
      <DynamicFilterArgumentInput {...props} argument={argument} ref={ref} />
    </NativeThemeProvider>
  )
  await render(renderWithRef("held"))
  const original = ref.current
  expect(original !== null).toBe(true)
  const root = screen.getByTestId("dynamic-filter-argument-input")
  const event = { nativeEvent: { target: 1 } }
  await fireEvent(root, "click", event)
  expect(click.mock.calls[0]?.[0] === event).toBe(true)
  expect(props.onArgumentChange).not.toHaveBeenCalled()
  await rerender(renderWithRef("echo"))
  expect(ref.current === original).toBe(true)
})
it("renders no root for an unset kind", async () => {
  await render(wrap(propsFor({ filterArgumentType: undefined })))
  expect(screen.queryByTestId("dynamic-filter-argument-input")).toBeNull()
  expect(screen.queryByTestId("input")).toBeNull()
})

it("preserves explicit native tab-stop opt-in without changing the default wrapper or editor", async () => {
  const props = propsFor()
  await render(wrap(props))
  const root = screen.getByTestId("dynamic-filter-argument-input")
  const input = screen.getByLabelText("Filter Name")
  expect(root.props.keyboardFocusable).toBe(false)
  await rerender(wrap({ ...props, tabIndex: 0 }))
  expect(root.props.keyboardFocusable).toBe(true)
  expect(screen.getByLabelText("Filter Name") === input).toBe(true)
  await rerender(wrap({ ...props, tabIndex: -1 }))
  expect(root.props.keyboardFocusable).toBe(false)
})
