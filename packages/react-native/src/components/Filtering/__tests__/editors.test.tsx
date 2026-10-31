import { fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { StyleSheet, type TextInput, type View } from "react-native"

import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeFloatingScopeContext } from "../../../overlays/floating/scope"
import { NativeThemeProvider } from "../../../theme"
import { BooleanFilterArgument } from "../BooleanArgument"
import { ComboBoxFilterArgument } from "../ComboBoxArgument"
import { ListFilterArgument } from "../ListArgument"
import { NumberFilterArgument } from "../NumberArgument"
import { RangeFilterArgument } from "../RangeArgument"
import { TextFilterArgument } from "../TextArgument"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
const wrap = (child: React.ReactNode) => (
  <NativeThemeProvider>
    <NativeFloatingLayerHost>{child}</NativeFloatingLayerHost>
  </NativeThemeProvider>
)
const numberLabels = { incrementLabel: "Increase argument", decrementLabel: "Decrease argument" }
const rangeLabels = {
  minimumIncrement: "Increase minimum",
  minimumDecrement: "Decrease minimum",
  maximumIncrement: "Increase maximum",
  maximumDecrement: "Decrease maximum",
}

it.each([undefined, null, false, 0, ""] as const)(
  "keeps scalar text %s controlled and preserves its actual ref",
  async (argument) => {
    const change = jest.fn(),
      ref = createRef<TextInput>()
    await render(wrap(<TextFilterArgument argument={argument} ref={ref} onArgumentChange={change} />))
    const target = ref.current
    expect(target).not.toBeNull()
    const input = screen.getByLabelText("Filter Argument")
    await fireEvent.changeText(input, "edited")
    expect(change).toHaveBeenCalledWith({ argument: "edited" })
    expect(input).toHaveDisplayValue("")
    await screen.rerender(wrap(<TextFilterArgument argument="echo" ref={ref} onArgumentChange={change} />))
    expect(screen.getByLabelText("Filter Argument")).toHaveDisplayValue("echo")
    expect(ref.current).toBe(target)
  },
)
it.each([undefined, null, false])("keeps incomplete Boolean %s owned in both modes", async (argument) => {
  for (const mode of ["Checkbox", "Toggle"] as const) {
    const change = jest.fn(),
      ref = createRef<View>()
    const { unmount } = await render(
      wrap(
        <BooleanFilterArgument
          ref={ref}
          argument={argument}
          booleanArgumentComponent={mode}
          onArgumentChange={change}
        />,
      ),
    )
    expect(ref.current).not.toBeNull()
    const input = screen.getByRole(mode === "Checkbox" ? "checkbox" : "switch")
    await fireEvent.press(input)
    await fireEvent.press(input)
    expect(change.mock.calls).toEqual([[{ argument: true }], [{ argument: true }]])
    expect(input.props.accessibilityState.checked).toBe(false)
    await unmount()
  }
})
it.each([undefined, null, 0, "", NaN])(
  "keeps numeric %s owned through repeated requests and echoes without remounting",
  async (argument) => {
    const change = jest.fn(),
      ref = createRef<TextInput>()
    await render(
      wrap(<NumberFilterArgument {...numberLabels} ref={ref} argument={argument} onArgumentChange={change} />),
    )
    const target = ref.current
    expect(target).not.toBeNull()
    await fireEvent.press(screen.getByRole("button", { name: "Increase argument" }))
    await fireEvent.press(screen.getByRole("button", { name: "Increase argument" }))
    expect(change.mock.calls).toEqual([[{ argument: argument === 0 ? 1 : 0 }], [{ argument: argument === 0 ? 1 : 0 }]])
    expect(screen.getByTestId("number-input-input")).toHaveDisplayValue(argument === 0 ? "0" : "")
    await screen.rerender(
      wrap(<NumberFilterArgument {...numberLabels} ref={ref} argument={2} onArgumentChange={change} />),
    )
    expect(ref.current).toBe(target)
    expect(screen.getByTestId("number-input-input")).toHaveDisplayValue("2")
    await fireEvent.changeText(screen.getByTestId("number-input-input"), "")
    await fireEvent(screen.getByTestId("number-input-input"), "endEditing", { nativeEvent: { text: "" } })
    expect(change).toHaveBeenLastCalledWith({ argument: null })
    expect(screen.getByTestId("number-input-input")).toHaveDisplayValue("2")
  },
)
it.each([undefined, null, []])("keeps incomplete range %s and empty list Add owned", async (argument) => {
  const change = jest.fn()
  const { unmount } = await render(
    wrap(
      <RangeFilterArgument dataType="text" numberLabels={rangeLabels} argument={argument} onArgumentChange={change} />,
    ),
  )
  const minimum = screen.getByLabelText("Min Value")
  await fireEvent.changeText(minimum, "edited")
  expect(change).toHaveBeenCalledWith({ argument: ["edited", undefined] })
  expect(minimum).toHaveDisplayValue("")
  await unmount()
  change.mockClear()
  await render(wrap(<ListFilterArgument argument={argument} onArgumentChange={change} />))
  expect(screen.queryAllByTestId("input")).toHaveLength(0)
  await fireEvent.press(screen.getByRole("button", { name: "Add Filter Argument Entry" }))
  expect(change).toHaveBeenCalledWith({ argument: [""] })
  expect(screen.queryAllByTestId("input")).toHaveLength(0)
})
it.each([undefined, ""])(
  "controls numeric bound %s, preserves raw siblings and emits blank for numeric clearing",
  async (minimum) => {
    const change = jest.fn()
    await render(
      wrap(
        <RangeFilterArgument
          dataType="number"
          numberLabels={rangeLabels}
          argument={[minimum, 7]}
          onArgumentChange={change}
        />,
      ),
    )
    await fireEvent.press(screen.getByRole("button", { name: "Increase minimum" }))
    expect(change).toHaveBeenCalledWith({ argument: [0, 7] })
    const inputs = screen.getAllByTestId("number-input-input")
    expect(inputs[0]).toHaveDisplayValue("")
    await fireEvent.changeText(inputs[1], "")
    await fireEvent(inputs[1], "endEditing", { nativeEvent: { text: "" } })
    expect(change).toHaveBeenLastCalledWith({ argument: [minimum, null] })
    expect(inputs[1]).toHaveDisplayValue("7")
  },
)
it("keeps mixed list entries owned and preserves untouched types through edit/add/delete", async () => {
  const change = jest.fn(),
    argument = [0, 1, undefined, null]
  Object.freeze(argument)
  await render(wrap(<ListFilterArgument argument={argument} onArgumentChange={change} />))
  await fireEvent.changeText(screen.getByLabelText("Filter Argument 0"), "edited")
  expect(change).toHaveBeenLastCalledWith({ argument: ["edited", 1, undefined, null] })
  expect(screen.getByLabelText("Filter Argument 0")).toHaveDisplayValue("0")
  const deletes = screen.getAllByRole("button", { name: "Delete Filter Entry" })
  expect(deletes[0]).toBeDisabled()
  await fireEvent.press(deletes[0])
  expect(change).toHaveBeenCalledTimes(1)
  await fireEvent.press(deletes[1])
  expect(change).toHaveBeenLastCalledWith({ argument: [0, undefined, null] })
  await fireEvent.press(screen.getByRole("button", { name: "Add Filter Argument Entry" }))
  expect(change).toHaveBeenLastCalledWith({ argument: [0, 1, undefined, null, ""] })
  expect(argument).toEqual([0, 1, undefined, null])
})
it.each([undefined, null])("keeps incomplete ComboBox %s owned and emits names with exact keys", async (argument) => {
  const change = jest.fn()
  await render(
    wrap(
      <ComboBoxFilterArgument
        argument={argument}
        filterArgumentSelectedKey={null}
        availableFilterArguments={[{ id: "", name: "Alpha", argumentValue: false }]}
        inputLabel="Edit argument"
        closeLabel="Close arguments"
        onArgumentChange={change}
      />,
    ),
  )
  await fireEvent.press(screen.getByRole("button", { name: "Show filter argument suggestions" }))
  const input = screen.getByLabelText("Edit argument")
  await fireEvent.changeText(input, "Al")
  expect(change).toHaveBeenCalledWith({ argument: "Al" })
  expect(input).toHaveDisplayValue("")
  await fireEvent.press(screen.getByRole("radio", { name: "Alpha" }))
  expect(change).toHaveBeenLastCalledWith({ argument: "Alpha", filterArgumentSelectedKey: "" })
})
it("uses current callbacks/arguments and rejects saved edits after closure or unmount", async () => {
  const old = jest.fn(),
    current = jest.fn()
  let active = true
  const { unmount } = await render(
    wrap(<ListFilterArgument argument={[0, 1]} onArgumentChange={old} canAct={() => active} />),
  )
  const saved = screen.getByLabelText("Filter Argument 0").props.onChangeText
  await screen.rerender(wrap(<ListFilterArgument argument={[0, 9]} onArgumentChange={current} canAct={() => active} />))
  expect(current).not.toHaveBeenCalled()
  saved("next")
  expect(current).toHaveBeenCalledWith({ argument: ["next", 9] })
  expect(old).not.toHaveBeenCalled()
  active = false
  saved("closed")
  expect(current).toHaveBeenCalledTimes(1)
  await unmount()
  active = true
  saved("unmounted")
  expect(current).toHaveBeenCalledTimes(1)
})
it("splits number text/box styles and honors source label overrides", async () => {
  await render(
    wrap(
      <NumberFilterArgument
        {...numberLabels}
        labels={{ label: "Quantity", placeholder: "Choose" }}
        customFieldStyles={{ marginTop: 7 }}
        customInputStyles={{ width: "70%", fontSize: 23, color: "tomato" }}
        onArgumentChange={() => {}}
      />,
    ),
  )
  expect(StyleSheet.flatten(screen.getByTestId("form-field").props.style)).toMatchObject({ marginTop: 7 })
  expect(StyleSheet.flatten(screen.getByTestId("number-input").props.style)).toMatchObject({ width: "70%" })
  expect(StyleSheet.flatten(screen.getByTestId("number-input-input").props.style)).toMatchObject({
    fontSize: 23,
    color: "tomato",
  })
  expect(screen.getByLabelText("Quantity")).toHaveProp("placeholder", "Choose")
})
it("rejects non-array range/list arguments without interpreting them as lists", async () => {
  await expect(render(wrap(<ListFilterArgument argument={0} onArgumentChange={() => {}} />))).rejects.toThrow(
    "must be an array",
  )
})

it("blocks direct editors while their parent floating scope cannot act", async () => {
  const change = jest.fn()
  await render(
    wrap(
      <NativeFloatingScopeContext.Provider value={{ id: "covered", canAct: () => false }}>
        <TextFilterArgument onArgumentChange={change} />
      </NativeFloatingScopeContext.Provider>,
    ),
  )
  await fireEvent.changeText(screen.getByLabelText("Filter Argument"), "covered")
  expect(change).not.toHaveBeenCalled()
})

it("preserves Boolean row defaults and independent custom row/field/input ownership", async () => {
  await render(
    wrap(
      <BooleanFilterArgument
        booleanArgumentComponent="Checkbox"
        customRowStyles={{ gap: 13 }}
        customFieldStyles={{ marginTop: 7 }}
        customInputStyles={{ marginLeft: 9 }}
        onArgumentChange={() => {}}
      />,
    ),
  )
  expect(StyleSheet.flatten(screen.getByTestId("filter-boolean").props.style)).toMatchObject({
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  })
  expect(StyleSheet.flatten(screen.getByTestId("form-field").props.style)).toMatchObject({ marginTop: 7 })
  expect(StyleSheet.flatten(screen.getByRole("checkbox").props.style)).toMatchObject({ marginLeft: 9 })
})
