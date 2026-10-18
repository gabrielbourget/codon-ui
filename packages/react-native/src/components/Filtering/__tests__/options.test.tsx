import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, useContext } from "react"
import { Platform, StyleSheet, type View } from "react-native"

import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeOverlayProvider, OverlayRegistryContext } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import type { TAvailableListItem } from "../../Table/filterMetadata"
import { SelectFilterArgument, MultiSelectFilterArgument, type TSelectFilterArgumentProps } from "../OptionArguments"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
const wrap = (child: React.ReactNode) => (
  <NativeThemeProvider>
    <NativeFloatingLayerHost>{child}</NativeFloatingLayerHost>
  </NativeThemeProvider>
)
const propsFor = (options: TAvailableListItem[]): TSelectFilterArgumentProps => ({
  availableFilterArguments: options,
  filterArgumentSelectedKey: null,
  closeLabel: "Close argument",
  onArgumentChange: jest.fn(),
})
const pick = async (name: string, option: string) => {
  await fireEvent.press(screen.getByRole("button", { name }))
  await fireEvent.press(screen.getByRole("radio", { name: option }))
}
afterEach(() => jest.restoreAllMocks())

it.each([false, 0, "", null, undefined] as const)(
  "CAP.filter-selectors.004 preserves option %p with the canonical nullish name fallback and empty ID",
  async (argumentValue) => {
    const props = propsFor([{ id: "", name: "Selected", argumentValue }])
    const ref = createRef<View>()
    await render(wrap(<SelectFilterArgument {...props} ref={ref} />))
    const target = ref.current
    expect(target).not.toBeNull()
    await pick("Filter Argument", "Selected")
    expect(props.onArgumentChange).toHaveBeenCalledWith({
      argument: argumentValue ?? "Selected",
      filterArgumentSelectedKey: "",
    })
    expect(screen.getByRole("button", { name: "Filter Argument" }).props.accessibilityValue.text).toBe(
      "Select Filter Argument",
    )
    expect(ref.current).toBe(target)
  },
)
it("retains exact array argument identity and repeated owner vetoes", async () => {
  const value = [0, 1]
  const props = propsFor([{ id: "range", name: "Range", argumentValue: value }])
  await render(wrap(<SelectFilterArgument {...props} />))
  await pick("Filter Argument", "Range")
  await pick("Filter Argument", "Range")
  expect(jest.mocked(props.onArgumentChange).mock.calls[0][0].argument).toBe(value)
  expect(props.onArgumentChange).toHaveBeenCalledTimes(2)
  await screen.rerender(wrap(<SelectFilterArgument {...props} filterArgumentSelectedKey="range" />))
  expect(screen.getByRole("button", { name: "Filter Argument" }).props.accessibilityValue.text).toBe("Range")
})
it("refreshes current option payloads/callbacks without emitting on metadata changes", async () => {
  const old = propsFor([{ id: "a", name: "Old", argumentValue: 0 }]),
    current = propsFor([{ id: "a", name: "Current", argumentValue: false }])
  await render(wrap(<SelectFilterArgument {...old} />))
  await screen.rerender(wrap(<SelectFilterArgument {...current} />))
  expect(current.onArgumentChange).not.toHaveBeenCalled()
  await pick("Filter Argument", "Current")
  expect(current.onArgumentChange).toHaveBeenCalledWith({ argument: false, filterArgumentSelectedKey: "a" })
  expect(old.onArgumentChange).not.toHaveBeenCalled()
})
it("keeps unavailable owner keys and exposes empty collections without a guessed choice", async () => {
  const props = propsFor([])
  await render(wrap(<SelectFilterArgument {...props} filterArgumentSelectedKey="missing" />))
  await fireEvent.press(screen.getByRole("button", { name: "Filter Argument" }))
  expect(screen.queryByRole("radio")).toBeNull()
  expect(props.onArgumentChange).not.toHaveBeenCalled()
})
it("splits text and box input styles while retaining field ownership", async () => {
  await render(
    wrap(
      <SelectFilterArgument
        {...propsFor([])}
        customFieldStyles={{ marginTop: 7 }}
        customInputStyles={{ width: "70%", color: "tomato", fontSize: 23, marginBottom: 9 }}
      />,
    ),
  )
  expect(StyleSheet.flatten(screen.getByTestId("form-field").props.style).marginTop).toBe(7)
  const style = StyleSheet.flatten(screen.getByTestId("select").props.style)
  expect(style).toMatchObject({ width: "70%", marginBottom: 9 })
  expect(style.fontSize).toBeUndefined()
  expect(StyleSheet.flatten(screen.getByText("Select Filter Argument").props.style)).toMatchObject({
    fontSize: 23,
    color: "tomato",
  })
})
let appRestored: (() => boolean) | undefined
const Observe = () => {
  const registry = useContext(OverlayRegistryContext)
  appRestored = () => registry?.canRestore(null) ?? false
  return null
}
it("CAP.filter-selectors.006 admits a real child-window selection while the parent is covered", async () => {
  jest.replaceProperty(Platform, "OS", "ios")
  const props = propsFor([{ id: "a", name: "Zero", argumentValue: 0 }])
  await render(
    <NativeOverlayProvider>
      <Observe />
      {wrap(<SelectFilterArgument {...props} />)}
    </NativeOverlayProvider>,
  )
  await fireEvent.press(screen.getByRole("button", { name: "Filter Argument" }))
  const window = screen.getByTestId("select-window"),
    dismiss = window.props.onDismiss
  await fireEvent(window, "show")
  expect(appRestored?.()).toBe(false)
  await fireEvent.press(screen.getByRole("radio", { name: "Zero" }))
  expect(props.onArgumentChange).toHaveBeenCalledWith({ argument: 0, filterArgumentSelectedKey: "a" })
  await act(() => dismiss())
  expect(appRestored?.()).toBe(true)
})
it("blocks a child selection when the logical owner closes", async () => {
  let active = true
  const props = propsFor([{ id: "a", name: "Zero", argumentValue: 0 }])
  await render(wrap(<SelectFilterArgument {...props} canAct={() => active} />))
  await fireEvent.press(screen.getByRole("button", { name: "Filter Argument" }))
  active = false
  await fireEvent.press(screen.getByRole("radio", { name: "Zero" }))
  expect(props.onArgumentChange).not.toHaveBeenCalled()
})
it("CAP.filter-selectors.005 projects names in metadata order, ignoring argumentValue and numeric coercion", async () => {
  const options = [
    { id: "a", name: "Alpha", argumentValue: 0 },
    { id: "b", name: "Beta", argumentValue: false },
    { id: "zero", name: "0", argumentValue: 99 },
  ]
  const onArgumentChange = jest.fn()
  await render(
    wrap(
      <MultiSelectFilterArgument
        argument={["Beta", "Alpha", "unknown"]}
        availableFilterArguments={options}
        inputLabel="Find arguments"
        closeLabel="Close"
        onArgumentChange={onArgumentChange}
      />,
    ),
  )
  expect(screen.getAllByTestId("tag-remove-button").map((item) => item.props.accessibilityLabel)).toEqual([
    "Remove Alpha",
    "Remove Beta",
  ])
  await fireEvent.press(screen.getByRole("button", { name: "Remove Beta" }))
  expect(onArgumentChange).toHaveBeenCalledWith({ argument: ["Alpha"], filterArgumentSelectedKey: "a" })
  expect(screen.getByRole("button", { name: "Remove Beta" })).toBeOnTheScreen()
  await screen.rerender(
    wrap(
      <MultiSelectFilterArgument
        argument={[0]}
        availableFilterArguments={options}
        inputLabel="Find arguments"
        closeLabel="Close"
        onArgumentChange={onArgumentChange}
      />,
    ),
  )
  expect(screen.queryByTestId("tag-remove-button")).toBeNull()
})
it("emits the next name and last ID when adding and null when removing the final selected option", async () => {
  const options = [
      { id: "", name: "Alpha", argumentValue: false },
      { id: "b", name: "Beta", argumentValue: 0 },
    ],
    onArgumentChange = jest.fn()
  await render(
    wrap(
      <MultiSelectFilterArgument
        argument={[]}
        availableFilterArguments={options}
        inputLabel="Find arguments"
        closeLabel="Close"
        onArgumentChange={onArgumentChange}
      />,
    ),
  )
  await pick("Show filter argument suggestions", "Alpha")
  expect(onArgumentChange).toHaveBeenCalledWith({ argument: ["Alpha"], filterArgumentSelectedKey: "" })
  await screen.rerender(
    wrap(
      <MultiSelectFilterArgument
        argument={["Alpha"]}
        availableFilterArguments={options}
        inputLabel="Find arguments"
        closeLabel="Close"
        onArgumentChange={onArgumentChange}
      />,
    ),
  )
  await fireEvent.press(screen.getByRole("button", { name: "Remove Alpha" }))
  expect(onArgumentChange).toHaveBeenLastCalledWith({ argument: [], filterArgumentSelectedKey: null })
})
