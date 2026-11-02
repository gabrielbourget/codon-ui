import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { createRef, useState } from "react"
import { Dimensions, type TextInput, type View } from "react-native"

import { ComboBox, NativeThemeProvider, type TNativeComboBoxKey } from "../../.."

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("keeps the original editor and independent owners through a deferred explicit-item response and host changes", async () => {
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    requests: unknown[][] = [],
    raw = jest.fn(),
    selection = jest.fn(),
    end = jest.fn(),
    submit = jest.fn()
  const Owner = () => {
    const [items, setItems] = useState([
      { key: 0, text: "Zero" },
      { key: "0", text: "String zero" },
    ])
    return (
      <ComboBox
        ref={root}
        inputRef={editor}
        items={items}
        getKey={(item) => item.key}
        getTextValue={(item) => item.text}
        accessibilityLabel="Choose"
        inputLabel="Original query"
        closeLabel="Close query"
        value={0}
        inputValue="held owner"
        isOpen
        onInputChange={(value) => {
          requests.push(["query", value])
          setTimeout(
            () =>
              setItems([
                { key: "0", text: "Returned string zero" },
                { key: 0, text: "Returned zero" },
              ]),
            50,
          )
        }}
        onChange={(value: TNativeComboBoxKey | null) => requests.push(["selection", value])}
        onOpenChange={(value) => requests.push(["open", value])}
        inputProps={{ onChange: raw, onSelectionChange: selection, onEndEditing: end, onSubmitEditing: submit }}
      />
    )
  }
  const fixture = (mode: "light" | "dark") => (
    <NativeThemeProvider mode={mode}>
      <Owner />
    </NativeThemeProvider>
  )
  const { rerender, unmount } = await render(fixture("light"))
  const originalRoot = root.current,
    originalEditor = editor.current
  expect(originalRoot).not.toBeNull()
  expect(originalEditor).not.toBeNull()
  expect(originalEditor).not.toBe(originalRoot)
  const input = () => screen.getByLabelText("Original query")
  const changed = { nativeEvent: { text: "に", eventCount: 1, target: 7 } },
    selected = { nativeEvent: { selection: { start: 1, end: 1 }, target: 7 } },
    ended = { nativeEvent: { text: "日本", target: 7 } }
  await fireEvent(input(), "change", changed)
  await fireEvent(input(), "selectionChange", selected)
  await fireEvent.changeText(input(), "日本")
  await act(() => jest.advanceTimersByTime(50))
  await rerender(fixture("dark"))
  const previousWindow = Dimensions.get("window"),
    previousScreen = Dimensions.get("screen")
  try {
    await act(() =>
      Dimensions.set({
        window: { width: 844, height: 390, scale: 1, fontScale: 2 },
        screen: { width: 844, height: 390, scale: 1, fontScale: 2 },
      }),
    )
    expect(root.current).toBe(originalRoot)
    expect(editor.current).toBe(originalEditor)
    expect(input()).toHaveDisplayValue("held owner")
    expect(screen.getByRole("radio", { name: "Returned zero" })).toBeChecked()
    await fireEvent(input(), "endEditing", ended)
    await fireEvent(input(), "submitEditing", ended)
    await userEvent.setup().press(screen.getByRole("radio", { name: "Returned string zero" }))
    expect(requests).toEqual([
      ["query", "日本"],
      ["selection", "0"],
      ["open", false],
    ])
    expect(input()).toHaveDisplayValue("held owner")
    expect(editor.current).toBe(originalEditor)
    expect(raw.mock.calls[0][0]).toBe(changed)
    expect(selection.mock.calls[0][0]).toBe(selected)
    expect(end.mock.calls[0][0]).toBe(ended)
    expect(submit.mock.calls[0][0]).toBe(ended)
    expect([raw, selection, end, submit].map((observer) => observer.mock.calls.length)).toEqual([1, 1, 1, 1])
    await unmount()
    expect(root.current).toBeNull()
    expect(editor.current).toBeNull()
  } finally {
    await act(() => Dimensions.set({ window: previousWindow, screen: previousScreen }))
  }
})

it("retains the canonical group name without combining or renaming its independent controls", async () => {
  const props = {
    items: [{ key: "a", text: "Alpha" }],
    getKey: (item: { key: string }) => item.key,
    getTextValue: (item: { text: string }) => item.text,
    accessibilityLabel: "Show choices",
    inputLabel: "Original query",
    closeLabel: "Close choices",
  }
  const { rerender } = await render(<ComboBox {...props} />)
  const group = () => screen.getByTestId("combo-box-group")
  expect(group().props).toMatchObject({
    accessible: false,
    role: "group",
    accessibilityLabel: "ComboBox Input Button Group",
  })
  expect(screen.getByRole("button", { name: "Show choices" })).toBeOnTheScreen()
  await rerender(<ComboBox {...props} labels={{ inputButtonGroupAriaLabel: "Localized controls" }} />)
  expect(group().props.accessibilityLabel).toBe("Localized controls")
  expect(screen.getByRole("button", { name: "Show choices" })).toBeOnTheScreen()
  await rerender(<ComboBox {...props} labels={{ inputButtonGroupAriaLabel: "" }} />)
  expect(group().props.accessibilityLabel).toBe("")
  expect(group().props.accessible).toBe(false)
  await rerender(<ComboBox {...props} labels={{ inputButtonGroupAriaLabel: undefined }} />)
  expect(group().props.accessibilityLabel).toBeUndefined()
  expect(screen.getByRole("button", { name: "Show choices" })).toBeOnTheScreen()
})
