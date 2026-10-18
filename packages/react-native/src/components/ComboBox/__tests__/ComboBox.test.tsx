import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { createContext, createRef, useContext, useState } from "react"
import { AccessibilityInfo, Platform, StyleSheet, type TextInput } from "react-native"

import {
  ComboBox,
  NativeOverlayProvider,
  NativeThemeProvider,
  Text,
  useNativeTheme,
  type TNativeComboBoxProps,
  type TNativeComboBoxRef,
} from "../../.."

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})
beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
type TChoice = { key: string | number; label: string }
const items = [
  { key: 0, label: "Numeric zero" },
  { key: "0", label: "String zero" },
  { key: "blocked", label: "Unavailable" },
]
const base: TNativeComboBoxProps<TChoice> = {
  items,
  getKey: (item) => item.key,
  getTextValue: (item) => item.label,
  accessibilityLabel: "Choose",
  inputLabel: "Search choices",
  closeLabel: "Close choices",
}
const press = async (name: string) => userEvent.setup().press(screen.getByRole("button", { name }))
const choose = async (name = "String zero") => userEvent.setup().press(screen.getByRole("radio", { name }))
const edit = async (text: string) => fireEvent.changeText(screen.getByLabelText("Search choices"), text)

// The first mounted picker competes with parallel package tests on shared CI.
it("keeps all three controlled axes authoritative through repeated vetoes and sends ordered independent requests", async () => {
  const requests: unknown[][] = []
  const props = {
    ...base,
    value: 0,
    inputValue: "held query",
    isOpen: false,
    onChange: (key: string | number | null) => requests.push(["value", key]),
    onInputChange: (text: string) => requests.push(["query", text]),
    onOpenChange: (open: boolean) => requests.push(["open", open]),
  }
  const { rerender } = await render(<ComboBox {...props} />)
  await press("Choose")
  await press("Choose")
  expect(requests).toEqual([
    ["open", true],
    ["open", true],
  ])
  expect(screen.queryByLabelText("Search choices")).toBeNull()
  await rerender(<ComboBox {...props} isOpen />)
  const input = screen.getByLabelText("Search choices")
  await edit("new query")
  await edit("new query")
  expect(input.props.value).toBe("held query")
  await choose()
  await choose()
  expect(requests.slice(-6)).toEqual([
    ["value", "0"],
    ["query", "String zero"],
    ["open", false],
    ["value", "0"],
    ["query", "String zero"],
    ["open", false],
  ])
  expect(screen.getByRole("radio", { name: "Numeric zero" }).props.accessibilityState.checked).toBe(true)
  expect(screen.getByLabelText("Search choices").props.value).toBe("held query")
  await press("Close choices")
  await press("Close choices")
  expect(requests.slice(-2)).toEqual([
    ["open", false],
    ["open", false],
  ])
  await rerender(<ComboBox {...props} value={null} inputValue="" isOpen={false} placeholder="Empty" />)
  expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityValue.text).toBe("Empty")
}, 15_000)

it.each(["value", "query", "open"] as const)("allows the owner to accept only the %s axis", async (accepted) => {
  const Owner = () => {
    const [value, setValue] = useState<string | number | null>(0)
    const [query, setQuery] = useState("held")
    const [open, setOpen] = useState(true)
    return (
      <ComboBox
        {...base}
        value={value}
        inputValue={query}
        isOpen={open}
        onChange={accepted === "value" ? setValue : undefined}
        onInputChange={accepted === "query" ? setQuery : undefined}
        onOpenChange={accepted === "open" ? setOpen : undefined}
      />
    )
  }
  await render(<Owner />)
  await choose()
  if (accepted === "open") {
    expect(screen.queryByRole("radio")).toBeNull()
    expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityValue.text).toBe("held")
  } else {
    expect(screen.getByRole("radio", { name: "String zero" }).props.accessibilityState.checked).toBe(
      accepted === "value",
    )
    expect(screen.getByLabelText("Search choices").props.value).toBe(accepted === "query" ? "String zero" : "held")
  }
})

it("accepts uncontrolled requests without mutating caller data; typing selects no key and cancellation preserves query", async () => {
  const value = jest.fn()
  const query = jest.fn()
  const open = jest.fn()
  await render(<ComboBox {...base} defaultValue={0} onChange={value} onInputChange={query} onOpenChange={open} />)
  expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityValue.text).toBe("Numeric zero")
  await press("Choose")
  await edit("free query")
  expect(value).not.toHaveBeenCalled()
  expect(screen.getByRole("radio", { name: "Numeric zero" }).props.accessibilityState.checked).toBe(true)
  await press("Close choices")
  await press("Choose")
  expect(screen.getByLabelText("Search choices").props.value).toBe("free query")
  await choose()
  expect(value.mock.calls).toEqual([["0"]])
  expect(query.mock.calls).toEqual([["free query"], ["String zero"]])
  expect(open.mock.calls).toEqual([[true], [false], [true], [false]])
  expect(items[0]).toEqual({ key: 0, label: "Numeric zero" })
})

it("keeps explicit empty/default query initial-only and ignores later selected/default changes", async () => {
  const { rerender } = await render(
    <ComboBox {...base} defaultValue={0} defaultInputValue="" defaultOpen placeholder="Empty query" />,
  )
  expect(screen.getByLabelText("Search choices").props.value).toBe("")
  await rerender(<ComboBox {...base} defaultValue="0" defaultInputValue="changed" defaultOpen={false} />)
  expect(screen.getByLabelText("Search choices").props.value).toBe("")
  expect(screen.getByRole("radio", { name: "Numeric zero" }).props.accessibilityState.checked).toBe(true)
})

it("preserves a controlled missing key and independent query across relabel/remove/reorder/async replacement", async () => {
  const changes = jest.fn()
  const inputRef = createRef<TextInput>()
  const props = {
    ...base,
    inputRef,
    value: 0,
    inputValue: "independent",
    isOpen: true,
    onChange: changes,
    onInputChange: changes,
  }
  const { rerender } = await render(<ComboBox {...props} />)
  const input = inputRef.current
  await fireEvent(screen.getByLabelText("Search choices"), "focus", { nativeEvent: {} })
  for (const results of [
    [],
    [{ key: "remote", label: "Remote result" }],
    [
      { key: "0", label: "String zero" },
      { key: 0, label: "Relabeled" },
    ],
  ]) {
    await rerender(<ComboBox {...props} items={results} />)
    expect(inputRef.current).toBe(input)
    expect(screen.getByLabelText("Search choices").props.value).toBe("independent")
  }
  expect(screen.getByRole("radio", { name: "Relabeled" }).props.accessibilityState.checked).toBe(true)
  expect(changes).not.toHaveBeenCalled()
})

it("does not copy subsequent controlled selection changes into an uncontrolled query", async () => {
  const query = jest.fn()
  const { rerender } = await render(<ComboBox {...base} value={0} defaultOpen onInputChange={query} />)
  await rerender(<ComboBox {...base} value="0" defaultOpen onInputChange={query} />)
  expect(screen.getByLabelText("Search choices").props.value).toBe("Numeric zero")
  expect(query).not.toHaveBeenCalled()
})

it("suppresses same-axis requests independently without suppressing label or close requests", async () => {
  const value = jest.fn()
  const query = jest.fn()
  const open = jest.fn()
  const props = {
    ...base,
    value: 0,
    inputValue: "other",
    isOpen: true,
    onChange: value,
    onInputChange: query,
    onOpenChange: open,
  }
  const { rerender } = await render(<ComboBox {...props} />)
  await choose("Numeric zero")
  expect(value).not.toHaveBeenCalled()
  expect(query.mock.calls).toEqual([["Numeric zero"]])
  expect(open.mock.calls).toEqual([[false]])
  await rerender(<ComboBox {...props} inputValue="Numeric zero" />)
  await choose("Numeric zero")
  expect(query).toHaveBeenCalledTimes(1)
  expect(open).toHaveBeenCalledTimes(2)
})

it("allows uncontrolled query acceptance even when selected-value and close owners veto", async () => {
  await render(<ComboBox {...base} value={0} isOpen />)
  await choose()
  expect(screen.getByLabelText("Search choices").props.value).toBe("String zero")
  expect(screen.getByRole("radio", { name: "Numeric zero" }).props.accessibilityState.checked).toBe(true)
})

it("blocks disabled opening/editing/results and requests controlled closure only once per takeover", async () => {
  const change = jest.fn()
  const close = jest.fn()
  await render(<ComboBox {...base} isDisabled onOpenChange={close} />)
  await press("Choose")
  expect(close).not.toHaveBeenCalled()
  await screen.unmount()
  const props = {
    ...base,
    isOpen: true,
    isDisabled: true,
    onChange: change,
    onInputChange: change,
    onOpenChange: close,
  }
  const owner = await render(<ComboBox {...props} />)
  await edit("blocked")
  await choose()
  expect(change).not.toHaveBeenCalled()
  expect(close.mock.calls).toEqual([[false]])
  await owner.rerender(<ComboBox {...props} items={[...items]} />)
  expect(close).toHaveBeenCalledTimes(1)
  await press("Close choices")
  expect(close).toHaveBeenCalledTimes(2)
  await owner.rerender(<ComboBox {...props} isDisabled={false} />)
  await owner.rerender(<ComboBox {...props} />)
  expect(close).toHaveBeenCalledTimes(3)
})

it("allows read-only inspection/Close and blocks query and row mutations including disabled keys", async () => {
  const change = jest.fn()
  const { rerender } = await render(<ComboBox {...base} isReadOnly onChange={change} onInputChange={change} />)
  await press("Choose")
  await edit("blocked")
  await choose()
  expect(change).not.toHaveBeenCalled()
  expect(screen.getByLabelText("Search choices").props.editable).toBe(false)
  await press("Close choices")
  await rerender(<ComboBox {...base} disabledKeys={["0"]} onChange={change} />)
  await press("Choose")
  await choose()
  expect(change).not.toHaveBeenCalled()
  await choose("Numeric zero")
  expect(change.mock.calls).toEqual([[0]])
})

it("shares native Back and accessibility escape with owner-vetoable Close without text normalization", async () => {
  const close = jest.fn()
  const change = jest.fn()
  await render(
    <ComboBox
      {...base}
      isOpen
      inputValue="uncommitted"
      onOpenChange={close}
      onChange={change}
      onInputChange={change}
    />,
  )
  await fireEvent(screen.getByTestId("combo-box-window", { includeHiddenElements: true }), "requestClose")
  await fireEvent(screen.getByTestId("combo-box-modal"), "accessibilityEscape")
  await fireEvent(screen.getByLabelText("Search choices"), "blur", { nativeEvent: { text: "different" } })
  expect(close.mock.calls).toEqual([[false], [false]])
  expect(change).not.toHaveBeenCalled()
})

it("retains actual caller context/theme in custom rows and renders scalable empty content", async () => {
  const Context = createContext("missing")
  const Witness = () => <Text>{`${useContext(Context)}:${useNativeTheme().mode}`}</Text>
  const props = { ...base, defaultOpen: true, renderItem: () => <Witness /> }
  const { rerender } = await render(
    <Context.Provider value="caller">
      <NativeThemeProvider mode="dark">
        <ComboBox {...props} />
      </NativeThemeProvider>
    </Context.Provider>,
  )
  expect(screen.getAllByText("caller:dark")).toHaveLength(3)
  await rerender(
    <Context.Provider value="updated">
      <NativeThemeProvider>
        <ComboBox {...props} />
      </NativeThemeProvider>
    </Context.Provider>,
  )
  expect(screen.getAllByText("updated:light")).toHaveLength(3)
  await rerender(<ComboBox {...base} defaultOpen items={[]} emptyListMessage="No matching choices" />)
  expect(screen.getByTestId("combo-box-empty")).toHaveTextContent("No matching choices")
  expect(screen.getByTestId("combo-box-empty").props.allowFontScaling).not.toBe(false)
  expect(screen.getByRole("button", { name: "Close choices" })).toBeOnTheScreen()
})

it("keeps root/query refs and names distinct and composes native observers once", async () => {
  const root = createRef<TNativeComboBoxRef>()
  const input = createRef<TextInput>()
  const focus = jest.fn()
  const blur = jest.fn()
  const raw = jest.fn()
  const query = jest.fn()
  await render(
    <ComboBox
      {...base}
      ref={root}
      inputRef={input}
      defaultOpen
      testID="native"
      data-testid="alias"
      aria-label="Alias"
      inputProps={{ onChange: raw, onFocus: focus, onBlur: blur }}
      onInputChange={query}
    />,
  )
  expect(root.current).not.toBeNull()
  expect(input.current).not.toBeNull()
  expect(root.current).not.toBe(input.current)
  expect(typeof input.current?.focus).toBe("function")
  const editor = screen.getByTestId("native-input")
  const event = { nativeEvent: { text: "typed", eventCount: 1, target: 0 } }
  await fireEvent(editor, "focus", event)
  await fireEvent(editor, "change", event)
  await edit("typed")
  await fireEvent(editor, "blur", event)
  expect(focus.mock.calls).toEqual([[event]])
  expect(blur.mock.calls).toEqual([[event]])
  expect(raw.mock.calls).toEqual([[event]])
  expect(query.mock.calls).toEqual([["typed"]])
  await press("Close choices")
  expect(input.current).toBeNull()
  expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityValue.text).toBe("typed")
})

it("preserves root and separate slot precedence, validation priority and authored content", async () => {
  const style = jest.fn(({ defaultStyle }) => [defaultStyle, { width: 280, color: "blue" }])
  await render(
    <ComboBox
      {...base}
      defaultOpen
      color="red"
      width={200}
      customStyles={{ width: 240, color: "green" }}
      style={style}
      errorState
      warningState
      successState
      customInputStyles={{ color: "tomato", fontSize: 23 }}
      customButtonStyles={{ color: "purple", minHeight: 65 }}
      customInputButtonGroupStyles={{ borderWidth: 3 }}
      customOptionsListStyles={{ backgroundColor: "pink" }}
      ComponentIcon={<Text>Icon</Text>}
    />,
  )
  expect(screen.getByTestId("combo-box", { includeHiddenElements: true })).toHaveStyle({ width: 280, color: "blue" })
  expect(style).toHaveBeenCalledWith(
    expect.objectContaining({
      isOpen: true,
      isInvalid: true,
      defaultStyle: expect.objectContaining({ width: 240, color: "green" }),
    }),
  )
  expect(screen.getByTestId("combo-box-query-group")).toHaveStyle({ borderColor: "#b73434", borderWidth: 3 })
  expect(screen.getByLabelText("Search choices")).toHaveStyle({ color: "tomato", fontSize: 23 })
  expect(screen.getByTestId("combo-box-list")).toHaveStyle({ backgroundColor: "pink" })
  expect(screen.getByText("Icon", { includeHiddenElements: true })).toBeOnTheScreen()
})

describe("ComboBox customization contracts", () => {
  const summary = "Current query"
  const hidden = { includeHiddenElements: true }
  // The decorative chevron has no accessible name; inspect only its rendered native views.
  const chevrons = () =>
    screen
      .getByTestId("combo-box-trigger", hidden)
      .queryAll((view) => StyleSheet.flatten(view.props.style)?.borderBottomWidth === 1.5)

  it.each(["ios", "android"] as const)(
    "preserves authored %s dimensions instead of imposing default target minima",
    async (platform) => {
      jest.replaceProperty(Platform, "OS", platform)
      const { rerender } = await render(<ComboBox {...base} />)
      const root = () => screen.getByTestId("combo-box")
      const minimum = platform === "ios" ? 44 : 48
      expect(root()).toHaveStyle({ minWidth: minimum, minHeight: minimum })
      await rerender(<ComboBox {...base} width={30} height={24} />)
      expect(root()).toHaveStyle({ width: 30, height: 24 })
      expect(StyleSheet.flatten(root().props.style)).toMatchObject({ minWidth: undefined, minHeight: undefined })
      expect(screen.getByTestId("combo-box-group")).toHaveStyle({ width: "100%", height: "100%" })
      expect(screen.getByRole("button", { name: "Choose" })).toHaveStyle({ height: "100%" })
      await rerender(<ComboBox {...base} width="75%" height="auto" />)
      expect(root()).toHaveStyle({ width: "75%", height: "auto" })
      await rerender(
        <ComboBox
          {...base}
          width={150}
          height={50}
          customStyles={{ width: 24, height: 26 }}
          style={({ defaultStyle }) => [defaultStyle, { width: 32, height: 34 }]}
        />,
      )
      expect(root()).toHaveStyle({ width: 32, height: 34 })
      expect(StyleSheet.flatten(root().props.style)).toMatchObject({ minWidth: undefined, minHeight: undefined })
    },
  )

  it("propagates the baseline foreground to the owned summary, query and default icon", async () => {
    await render(<ComboBox {...base} inputValue={summary} isOpen color="turquoise" />)
    expect(screen.getByTestId("combo-box", hidden)).toHaveStyle({ color: "turquoise" })
    expect(screen.getByTestId("combo-box-trigger", hidden)).toHaveStyle({ color: "turquoise" })
    expect(screen.getByText(summary, hidden)).toHaveStyle({ color: "turquoise" })
    expect(screen.getByLabelText("Search choices")).toHaveStyle({ color: "turquoise" })
    expect(chevrons()).toHaveLength(1)
    expect(chevrons()[0]).toHaveStyle({ borderColor: "turquoise" })
  })

  it("keeps a custom summary-button foreground separate from the query foreground", async () => {
    await render(
      <ComboBox
        {...base}
        inputValue={summary}
        isOpen
        color="turquoise"
        customButtonStyles={{ color: "purple", minHeight: 65 }}
      />,
    )
    expect(screen.getByTestId("combo-box-trigger", hidden)).toHaveStyle({ color: "purple", minHeight: 65 })
    expect(screen.getByText(summary, hidden)).toHaveStyle({ color: "purple" })
    expect(chevrons()).toHaveLength(1)
    expect(chevrons()[0]).toHaveStyle({ borderColor: "purple" })
    expect(screen.getByLabelText("Search choices")).toHaveStyle({ color: "turquoise" })
    expect(screen.getByTestId("combo-box", hidden)).toHaveStyle({ color: "turquoise" })
  })

  it.each([
    ["rounded", 5],
    ["round", 10000],
    ["orthogonal", 0],
  ] as const)("applies %s geometry to both groups, the trigger and query", async (geometry, borderRadius) => {
    await render(<ComboBox {...base} defaultOpen geometry={geometry} />)
    for (const id of ["combo-box-group", "combo-box-query-group", "combo-box-trigger", "combo-box-input"])
      expect(screen.getByTestId(id, hidden)).toHaveStyle({ borderRadius })
  })

  it.each([
    ["small", 12, 13],
    ["medium", 14, 17],
    ["large", 16, 21],
  ] as const)(
    "maps %s text size on the summary and query, including provider overrides",
    async (textSize, fontSize, overriddenSize) => {
      const { rerender } = await render(
        <NativeThemeProvider>
          <ComboBox {...base} inputValue={summary} isOpen textSize={textSize} />
        </NativeThemeProvider>,
      )
      expect(screen.getByText(summary, hidden)).toHaveStyle({ fontSize })
      expect(screen.getByLabelText("Search choices")).toHaveStyle({ fontSize })
      await rerender(
        <NativeThemeProvider overrides={{ typography: { fontSizes: { b11: 13, b10: 17, b9: 21 } } }}>
          <ComboBox {...base} inputValue={summary} isOpen textSize={textSize} />
        </NativeThemeProvider>,
      )
      expect(screen.getByText(summary, hidden)).toHaveStyle({ fontSize: overriddenSize })
      expect(screen.getByLabelText("Search choices")).toHaveStyle({ fontSize: overriddenSize })
    },
  )

  it.each(["trigger", "query"] as const)("honors focus and offset toggles on the %s group", async (target) => {
    const props = { ...base, isOpen: target === "query" }
    const { rerender } = await render(<ComboBox {...props} />)
    const group = () => screen.getByTestId(target === "query" ? "combo-box-query-group" : "combo-box-group")
    const control = () => screen.getByTestId(target === "query" ? "combo-box-input" : "combo-box-trigger")
    expect(StyleSheet.flatten(group().props.style).outlineWidth).toBeUndefined()
    await fireEvent(control(), "focus", { nativeEvent: {} })
    expect(group()).toHaveStyle({ outlineColor: "#2563eb", outlineWidth: 1.5, outlineOffset: 1.5 })
    await rerender(<ComboBox {...props} enableFocusStyle={false} />)
    expect(StyleSheet.flatten(group().props.style).outlineWidth).toBeUndefined()
    await rerender(<ComboBox {...props} offsetFocusRing={false} />)
    expect(group()).toHaveStyle({ outlineWidth: 1.5, outlineOffset: 0 })
    await rerender(<ComboBox {...props} />)
    expect(group()).toHaveStyle({ outlineOffset: 1.5 })
    await fireEvent(control(), "blur", { nativeEvent: {} })
    expect(StyleSheet.flatten(group().props.style).outlineWidth).toBeUndefined()
    if (target === "query") expect(StyleSheet.flatten(control().props.style).outlineWidth).toBeUndefined()
  })

  it.each([
    [{ errorState: true }, "#b73434"],
    [{ warningState: true }, "#a66b00"],
    [{ successState: true }, "#2f7d18"],
    [{ warningState: true, successState: true }, "#a66b00"],
    [{ errorState: true, warningState: true, successState: true }, "#b73434"],
  ] as const)("renders validation borders and restores the baseline for %p", async (validation, borderColor) => {
    const { rerender } = await render(<ComboBox {...base} defaultOpen {...validation} />)
    for (const id of ["combo-box-group", "combo-box-query-group"])
      expect(screen.getByTestId(id, hidden)).toHaveStyle({ borderColor })
    await rerender(<ComboBox {...base} defaultOpen />)
    for (const id of ["combo-box-group", "combo-box-query-group"])
      expect(screen.getByTestId(id, hidden)).toHaveStyle({ borderColor: "#9e9e9e" })
  })

  it.each([
    { slot: "root", props: { customStyles: { backgroundColor: "tomato", padding: 19 } }, targets: ["combo-box"] },
    {
      slot: "input",
      props: { customInputStyles: { backgroundColor: "tomato", padding: 19 } },
      targets: ["combo-box-input"],
    },
    {
      slot: "button",
      props: { customButtonStyles: { backgroundColor: "tomato", padding: 19 } },
      targets: ["combo-box-trigger"],
    },
    {
      slot: "group",
      props: { customInputButtonGroupStyles: { backgroundColor: "tomato", padding: 19 } },
      targets: ["combo-box-group", "combo-box-query-group"],
    },
    {
      slot: "list",
      props: { customOptionsListStyles: { backgroundColor: "tomato", padding: 19 } },
      targets: ["combo-box-list"],
    },
  ])("applies the $slot style slot independently", async ({ props, targets }) => {
    await render(<ComboBox {...base} inputValue={summary} isOpen {...props} />)
    for (const [id, backgroundColor] of [
      ["combo-box", "#ffffff"],
      ["combo-box-group", "#ffffff"],
      ["combo-box-query-group", "#ffffff"],
      ["combo-box-trigger", "transparent"],
      ["combo-box-input", "transparent"],
      ["combo-box-list", "#ffffff"],
    ]) {
      const node = screen.getByTestId(id, hidden)
      expect(node).toHaveStyle({ backgroundColor: targets.includes(id) ? "tomato" : backgroundColor })
      if (targets.includes(id)) expect(node).toHaveStyle({ padding: 19 })
    }
    expect(screen.getByText(summary, hidden)).toHaveStyle({ color: "#171717" })
  })

  it("renders the decorative open/closed chevron, replaces it with authored content and honors null", async () => {
    const { rerender } = await render(<ComboBox {...base} inputValue={summary} isOpen={false} />)
    expect(chevrons()).toHaveLength(1)
    expect(chevrons()[0]).toHaveStyle({ width: 8, height: 8, borderRightWidth: 1.5, transform: [{ rotate: "45deg" }] })
    await rerender(<ComboBox {...base} inputValue={summary} isOpen />)
    expect(chevrons()[0]).toHaveStyle({ transform: [{ rotate: "225deg" }] })
    await rerender(
      <ComboBox {...base} inputValue={summary} isOpen ComponentIcon={<Text testID="authored-icon">Custom</Text>} />,
    )
    expect(chevrons()).toHaveLength(0)
    expect(screen.getByTestId("authored-icon", hidden)).toHaveTextContent("Custom")
    await rerender(<ComboBox {...base} inputValue={summary} isOpen ComponentIcon={null} />)
    expect(chevrons()).toHaveLength(0)
    expect(screen.queryByTestId("authored-icon", hidden)).toBeNull()
    expect(screen.getByText(summary, hidden)).toBeOnTheScreen()
  })

  it("consumes wrapper props while forwarding only the owned native root props", async () => {
    const consumed: TNativeComboBoxProps<TChoice> = {
      ...base,
      inputValue: summary,
      value: 0,
      isOpen: true,
      isDisabled: false,
      isReadOnly: true,
      width: 150,
      height: 50,
      color: "turquoise",
      textSize: "small",
      geometry: "round",
      enableFocusStyle: false,
      offsetFocusRing: false,
      errorState: true,
      warningState: true,
      successState: true,
      placeholder: "Choose a value",
      emptyListMessage: "No choices",
      disabledKeys: ["blocked"],
      inputRef: createRef<TextInput>(),
      inputProps: { keyboardType: "web-search" },
      renderItem: (item) => <Text>{item.label}</Text>,
      onChange: jest.fn(),
      onInputChange: jest.fn(),
      onOpenChange: jest.fn(),
      ComponentIcon: null,
      customStyles: { margin: 2 },
      customInputStyles: { margin: 3 },
      customButtonStyles: { margin: 4 },
      customInputButtonGroupStyles: { margin: 5 },
      customOptionsListStyles: { margin: 6 },
    }
    const onLayout = jest.fn()
    await render(
      <ComboBox
        {...consumed}
        testID="owned"
        nativeID="native-root"
        id="root-id"
        pointerEvents="box-none"
        collapsable={false}
        onLayout={onLayout}
      />,
    )
    const root = screen.getByTestId("owned", hidden)
    expect(root.props).toMatchObject({
      nativeID: "native-root",
      id: "root-id",
      pointerEvents: "box-none",
      collapsable: false,
      onLayout,
      accessible: false,
    })
    for (const name of Object.keys(consumed)) expect(root.props).not.toHaveProperty(name)
    expect(root).toHaveStyle({ width: 150, height: 50, color: "turquoise", margin: 2 })
    expect(screen.getByTestId("owned-input")).toHaveDisplayValue(summary)
  })
})

it.each(["ios", "android"] as const)("keeps default %s action targets and uncapped text", async (platform) => {
  jest.replaceProperty(Platform, "OS", platform)
  await render(<ComboBox {...base} defaultOpen />)
  const minimum = platform === "ios" ? 44 : 48
  expect(screen.getByLabelText("Search choices")).toHaveStyle({ minHeight: minimum })
  expect(screen.getByRole("button", { name: "Close choices" })).toHaveStyle({ minHeight: minimum })
})

it("cancels standalone focus restoration after close/unmount or reopen", async () => {
  jest.replaceProperty(Platform, "OS", "android")
  const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent")
  const { unmount } = await render(<ComboBox {...base} defaultOpen />)
  await press("Close choices")
  await unmount()
  const calls = focus.mock.calls.length
  await act(() => jest.runAllTimers())
  expect(focus).toHaveBeenCalledTimes(calls)
})

it("unregisters a managed leaf on owner removal and permits a replacement", async () => {
  const { rerender } = await render(
    <NativeOverlayProvider>
      <ComboBox {...base} key="first" isOpen />
    </NativeOverlayProvider>,
  )
  await fireEvent(screen.getByTestId("combo-box-window", { includeHiddenElements: true }), "show")
  await rerender(<NativeOverlayProvider />)
  await rerender(
    <NativeOverlayProvider>
      <ComboBox {...base} key="second" defaultOpen />
    </NativeOverlayProvider>,
  )
  expect(screen.getByLabelText("Search choices")).toBeOnTheScreen()
})

it.each([
  {
    items: [
      { key: 0, label: "One" },
      { key: 0, label: "Two" },
    ],
  },
  { items: [{ key: Number.NaN, label: "One" }] },
  { items: [{ key: 1, label: " " }] },
  { accessibilityLabel: " " },
  { inputLabel: "" },
  { closeLabel: "" },
  { customInputStyles: { color: "currentColor" } },
  { customOptionsListStyles: { backgroundColor: "var(--surface)" } },
] as const)("rejects invalid public metadata/names/colors even while closed: %p", async (override) => {
  await expect(render(<ComboBox {...base} {...override} />)).rejects.toThrow(/ComboBox:/)
})

it.each(["value", "inputValue", "isOpen"] as const)(
  "rejects changing %s ownership during a mounted instance",
  async (axis) => {
    const { rerender } = await render(<ComboBox {...base} />)
    const controlled =
      axis === "value" ? { value: null } : axis === "inputValue" ? { inputValue: "" } : { isOpen: false }
    await expect(rerender(<ComboBox {...base} {...controlled} />)).rejects.toThrow(
      /changing controlled\/uncontrolled ownership/,
    )
  },
)
