import "../../../collection/__tests__/nativeReceipts"

import { screen } from "@testing-library/react-native"
import { isValidElement } from "react"
import { StyleSheet } from "react-native"

import {
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  rerenderWithNativeCollections,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeThemeProvider } from "../../../theme"
import { AVAILABLE_FILTER_ARGUMENT_TYPES } from "../../Table/filterMetadata"
import { DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS } from "../dispatchLabels"
import { computeFilterArgumentAccessibleLabel } from "../metadata"
import {
  renderNonTemporalFilterArgumentInput,
  type TNonTemporalFilterArgumentContext,
} from "../renderNonTemporalArgument"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
const nativeLabels: TNonTemporalFilterArgumentContext["nativeLabels"] = {
  number: { incrementLabel: "Increase argument", decrementLabel: "Decrease argument" },
  range: {
    minimumIncrement: "Increase minimum",
    minimumDecrement: "Decrease minimum",
    maximumIncrement: "Increase maximum",
    maximumDecrement: "Decrease maximum",
  },
  options: { inputLabel: "Edit filter argument", closeLabel: "Close arguments" },
}
const propsFor = (extra: Partial<TNonTemporalFilterArgumentContext> = {}): TNonTemporalFilterArgumentContext => ({
  dataType: "text",
  filterArgumentType: "Input",
  argument: "held",
  nativeLabels,
  onArgumentChange: jest.fn(),
  ...extra,
})
const wrap = (props: TNonTemporalFilterArgumentContext) => (
  <NativeThemeProvider>
    <NativeFloatingLayerHost>{renderNonTemporalFilterArgumentInput(props)}</NativeFloatingLayerHost>
  </NativeThemeProvider>
)

it.each(AVAILABLE_FILTER_ARGUMENT_TYPES)(
  "dispatches the canonical %s kind without owning its value",
  async (filterArgumentType) => {
    const props = propsFor({
      filterArgumentType,
      argument: ["Range", "Multi Input", "Multi Select"].includes(filterArgumentType)
        ? ["Alpha", "Beta"]
        : ["Boolean", "Checkbox", "Toggle"].includes(filterArgumentType)
          ? false
          : "held",
      booleanArgumentComponent: "Checkbox",
      availableFilterArguments: [
        { id: "a", name: "Alpha" },
        { id: "b", name: "Beta" },
      ],
    })
    expect(isValidElement(renderNonTemporalFilterArgumentInput(props))).toBe(true)
    await render(wrap(props))
    expect(props.onArgumentChange).not.toHaveBeenCalled()
    if (filterArgumentType === "Typeahead Search")
      expect(screen.getByTestId("filter-typeahead-placeholder")).toHaveTextContent(
        "placeholder: typeahead search not implemented yet",
      )
    else if (filterArgumentType === "Multi-Typeahead Search")
      expect(screen.getByTestId("filter-multi-typeahead-placeholder")).toHaveTextContent(
        "placeholder: multi-typeahead search not implemented yet",
      )
    else if (filterArgumentType === "Input") expect(screen.getByLabelText("Filter Argument")).toHaveDisplayValue("held")
    else if (filterArgumentType === "Range") expect(screen.getByLabelText("Min Value")).toHaveDisplayValue("Alpha")
    else if (filterArgumentType === "Multi Input")
      expect(screen.getByLabelText("Filter Argument 0")).toHaveDisplayValue("Alpha")
    else if (filterArgumentType === "Multi Select")
      expect(screen.getByRole("button", { name: "Remove Alpha" })).toBeOnTheScreen()
    else if (filterArgumentType === "Select")
      expect(screen.getByRole("button", { name: "Filter Argument" })).toBeOnTheScreen()
    else if (filterArgumentType === "Combo Box")
      expect(screen.getByRole("button", { name: "Show filter argument suggestions" })).toBeOnTheScreen()
    else
      expect(
        screen.getByRole(filterArgumentType === "Toggle" ? "switch" : "checkbox").props.accessibilityState.checked,
      ).toBe(false)
  },
)
it.each(["Input", "Range"] as const)(
  "retains the source empty Boolean %s renderer outcome",
  async (filterArgumentType) => {
    const props = propsFor({ dataType: "boolean", filterArgumentType, argument: false })
    expect(isValidElement(renderNonTemporalFilterArgumentInput(props))).toBe(true)
    const result = await render(
      <NativeThemeProvider>{renderNonTemporalFilterArgumentInput(props)}</NativeThemeProvider>,
    )
    expect(result.toJSON()).toBeNull()
  },
)
it("retains an absent Boolean mode and an unset kind without inventing a default control", async () => {
  const props = propsFor({ filterArgumentType: "Boolean", argument: false })
  expect(isValidElement(renderNonTemporalFilterArgumentInput(props))).toBe(true)
  const result = await render(<NativeThemeProvider>{renderNonTemporalFilterArgumentInput(props)}</NativeThemeProvider>)
  expect(result.toJSON()).toBeNull()
  expect(renderNonTemporalFilterArgumentInput({ ...props, filterArgumentType: undefined })).toBeNull()
})
it.each(["Checkbox", "Toggle"] as const)(
  "lets explicit %s kinds override the opposite generic Boolean mode",
  async (filterArgumentType) => {
    const props = propsFor({
      filterArgumentType,
      argument: false,
      booleanArgumentComponent: filterArgumentType === "Toggle" ? "Checkbox" : "Toggle",
    })
    await render(wrap(props))
    await fireEvent.press(screen.getByRole(filterArgumentType === "Toggle" ? "switch" : "checkbox"))
    expect(props.onArgumentChange).toHaveBeenCalledWith({ argument: true })
  },
)
it("keeps numeric factory blanks controlled through repeated requests and owner echoes", async () => {
  const props = propsFor({ dataType: "number", argument: "" })
  await render(wrap(props))
  await fireEvent.press(screen.getByRole("button", { name: "Increase argument" }))
  await fireEvent.press(screen.getByRole("button", { name: "Increase argument" }))
  expect(jest.mocked(props.onArgumentChange).mock.calls).toEqual([[{ argument: 0 }], [{ argument: 0 }]])
  expect(screen.getByTestId("number-input-input")).toHaveDisplayValue("")
  await rerenderWithNativeCollections(wrap({ ...props, argument: 0 }))
  expect(screen.getByTestId("number-input-input")).toHaveDisplayValue("0")
})
it("routes current labels, current callbacks and independent field/input slots through scalar composition", async () => {
  const old = propsFor(),
    current = propsFor({
      filterArgumentAccessibleLabel: "Filter Name",
      labels: { ...DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS, label: "Value", placeholder: "Enter" },
      customFieldStyles: { marginTop: 7 },
      customInputStyles: { marginBottom: 9, width: "70%" },
    })
  await render(wrap(old))
  const input = screen.getByLabelText("Filter Argument"),
    saved = input.props.onChangeText
  await rerenderWithNativeCollections(wrap(current))
  expect(screen.getByLabelText("Filter Name")).toBe(input)
  expect(StyleSheet.flatten(screen.getByTestId("form-field").props.style)).toMatchObject({ marginTop: 7 })
  expect(StyleSheet.flatten(input.props.style)).toMatchObject({ marginBottom: 9, width: "70%" })
  expect(input).toHaveProp("placeholder", "Enter")
  saved("next")
  expect(current.onArgumentChange).toHaveBeenCalledWith({ argument: "next" })
  expect(old.onArgumentChange).not.toHaveBeenCalled()
  expect(input).toHaveDisplayValue("held")
})
it("routes list row/action slots and preserves numeric siblings through the dispatcher", async () => {
  const props = propsFor({
    filterArgumentType: "Multi Input",
    dataType: "number",
    argument: [0, 1],
    customRowStyles: { columnGap: 15 },
    customActionButtonStyles: { paddingLeft: 20 },
  })
  await render(wrap(props))
  await fireEvent.changeText(screen.getByLabelText("Filter Argument 0"), "edited")
  expect(props.onArgumentChange).toHaveBeenCalledWith({ argument: ["edited", 1] })
  expect(
    StyleSheet.flatten(screen.getByRole("button", { name: "Add Filter Argument Entry" }).props.style),
  ).toMatchObject({ paddingLeft: 20 })
  expect(screen.getByLabelText("Filter Argument 0").parent?.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ columnGap: 15 })]),
  )
})
it.each(["Typeahead Search", "Multi-Typeahead Search"] as const)(
  "retains custom/empty %s placeholder copy and styles without a synthetic editor",
  async (filterArgumentType) => {
    const key =
      filterArgumentType === "Typeahead Search" ? "typeAheadSearchUnavailable" : "multiTypeAheadSearchUnavailable"
    const props = propsFor({
      filterArgumentType,
      labels: { ...DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS, [key]: "" },
      customPlaceholderStyles: { paddingTop: 25, color: "tomato" },
    })
    await render(wrap(props))
    const placeholder = screen.getByTestId(
      filterArgumentType === "Typeahead Search" ? "filter-typeahead-placeholder" : "filter-multi-typeahead-placeholder",
    )
    expect(placeholder.props.children).toBe("")
    expect(StyleSheet.flatten(placeholder.props.style)).toMatchObject({ paddingTop: 25, color: "tomato" })
    expect(screen.queryByTestId("input")).toBeNull()
    expect(props.onArgumentChange).not.toHaveBeenCalled()
    for (const value of [undefined, null]) {
      const labels = { ...DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS }
      Object.assign(labels, { [key]: value })
      await rerenderWithNativeCollections(wrap({ ...props, labels }))
      expect(
        screen.getByTestId(
          filterArgumentType === "Typeahead Search"
            ? "filter-typeahead-placeholder"
            : "filter-multi-typeahead-placeholder",
        ),
      ).toHaveTextContent(DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS[key])
    }
  },
)
it("preserves Select argumentValue versus ComboBox name request semantics", async () => {
  const props = propsFor({
    filterArgumentType: "Select",
    filterArgumentSelectedKey: null,
    availableFilterArguments: [{ id: "", name: "Alpha", argumentValue: false }],
  })
  await render(wrap(props))
  await fireEvent.press(screen.getByRole("button", { name: "Filter Argument" }))
  await fireEvent.press(screen.getByRole("radio", { name: "Alpha" }))
  expect(props.onArgumentChange).toHaveBeenLastCalledWith({ argument: false, filterArgumentSelectedKey: "" })
  await rerenderWithNativeCollections(wrap({ ...props, filterArgumentType: "Combo Box" }))
  await fireEvent.press(screen.getByRole("button", { name: "Show filter argument suggestions" }))
  await fireEvent.press(screen.getByRole("radio", { name: "Alpha" }))
  expect(props.onArgumentChange).toHaveBeenLastCalledWith({ argument: "Alpha", filterArgumentSelectedKey: "" })
})
it("keeps action vetoes current after dispatch without emitting during rendering", async () => {
  let active = true
  const props = propsFor({ canAct: () => active })
  const { unmount } = await render(wrap(props))
  const saved = screen.getByLabelText("Filter Argument").props.onChangeText
  active = false
  saved("closed")
  expect(props.onArgumentChange).not.toHaveBeenCalled()
  await unmount()
  active = true
  saved("unmounted")
  expect(props.onArgumentChange).not.toHaveBeenCalled()
})
it("rejects an unreceived temporal backend rather than reinterpreting it as a scalar", () => {
  const props = propsFor()
  Object.assign(props, { dataType: "date" })
  expect(() => renderNonTemporalFilterArgumentInput(props)).toThrow("requires text, number or boolean")
})

it.each([
  ["like", "Filter Name by contained text"],
  ["similar-to", "Filter Name by similar text"],
  ["equal", "Filter Name"],
] as const)("uses the canonical argument label for %s", (operationCode, expected) => {
  expect(computeFilterArgumentAccessibleLabel({ criteriaName: "Name", operationCode })).toBe(expected)
})
it("preserves custom label functions, current criterion names and explicit empty results", () => {
  const labels = {
    argumentAccessibleLabel: ({ criteriaName }: { criteriaName: string }) => criteriaName,
    containedTextArgumentAccessibleLabel: () => "",
    similarTextArgumentAccessibleLabel: ({ criteriaName }: { criteriaName: string }) => `Similar ${criteriaName}`,
  }
  expect(computeFilterArgumentAccessibleLabel({ criteriaName: "", labels })).toBe("")
  expect(computeFilterArgumentAccessibleLabel({ criteriaName: "Current", operationCode: "like", labels })).toBe("")
  expect(computeFilterArgumentAccessibleLabel({ criteriaName: "Current", operationCode: "similar-to", labels })).toBe(
    "Similar Current",
  )
})

it("retains the existing non-string ComboBox rejection without coercing untouched owner values", async () => {
  const props = propsFor({
    dataType: "boolean",
    filterArgumentType: "Combo Box",
    argument: false,
    filterArgumentSelectedKey: null,
    availableFilterArguments: [{ id: "a", name: "Alpha" }],
  })
  await expect(render(wrap(props))).rejects.toThrow(TypeError)
  expect(props.argument).toBe(false)
  expect(props.onArgumentChange).not.toHaveBeenCalled()
})
