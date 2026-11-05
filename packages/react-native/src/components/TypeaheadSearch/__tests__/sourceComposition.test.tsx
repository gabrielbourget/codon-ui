import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import type { TextInput, View } from "react-native"

import { AVAILABLE_TYPEAHEAD_SEARCH_STATUSES, TypeaheadSearch, type TypeaheadSearchStatus } from "../../.."

beforeEach(() => {
  jest.useFakeTimers()
  const tags = new WeakMap<object, number>()
  let serial = 100
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockImplementation((target: unknown) => {
    if (!target || typeof target !== "object") return null
    if (!tags.has(target)) tags.set(target, ++serial)
    return tags.get(target)
  })
})
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it("retains original refs, exact native observations and the held query across every caller-owned status", async () => {
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    changed = jest.fn(),
    selection = jest.fn(),
    key = jest.fn(),
    end = jest.fn(),
    calls: unknown[][] = [],
    selected = jest.fn()
  const fixture = (status: TypeaheadSearchStatus) => (
    <TypeaheadSearch
      ref={root}
      inputRef={editor}
      inputValue="  held query  "
      onInputChange={changed}
      onSubmitQuery={(query) => calls.push(["submit", query])}
      status={status}
      items={[
        { id: 0, name: "Zero" },
        { id: "0", name: "String zero" },
      ]}
      getItemKey={(item) => item.id}
      onSelectionChange={selected}
      inputProps={{
        selection: { start: 2, end: 4 },
        onChange: (event) => calls.push(["native", event]),
        onSubmitEditing: (event) => calls.push(["native-submit", event]),
        onSelectionChange: selection,
        onKeyPress: key,
        onEndEditing: end,
      }}
    />
  )
  const { rerender, unmount } = await render(fixture("results"))
  const originalRoot = root.current,
    originalEditor = editor.current,
    input = () => screen.getByTestId("typeahead-search-input")
  expect(originalRoot).not.toBeNull()
  expect(originalEditor).not.toBeNull()
  expect(originalRoot).not.toBe(originalEditor)
  const changeEvent = { nativeEvent: { text: "に", eventCount: 1, target: 7 } },
    selectionEvent = { nativeEvent: { selection: { start: 1, end: 1 }, target: 7 } },
    keyEvent = { nativeEvent: { key: "Enter", target: 7 } },
    submitEvent = { nativeEvent: { text: "native observation", target: 7 } }
  await fireEvent(input(), "change", changeEvent)
  await fireEvent(input(), "selectionChange", selectionEvent)
  await fireEvent(input(), "keyPress", keyEvent)
  await fireEvent.changeText(input(), "日本")
  expect(calls).toEqual([["native", changeEvent]])
  expect(changed.mock.calls).toEqual([["日本"]])
  expect(selection.mock.calls[0][0]).toBe(selectionEvent)
  expect(key.mock.calls[0][0]).toBe(keyEvent)
  for (const status of AVAILABLE_TYPEAHEAD_SEARCH_STATUSES) {
    await rerender(fixture(status))
    expect(root.current).toBe(originalRoot)
    expect(editor.current).toBe(originalEditor)
    expect(input()).toHaveDisplayValue("  held query  ")
    expect(input().props.selection).toEqual({ start: 2, end: 4 })
    if (status !== "results")
      expect(screen.getByTestId(`typeahead-search-${status}-state`).props.accessibilityLiveRegion).toBe("polite")
  }
  await fireEvent(input(), "submitEditing", submitEvent)
  await fireEvent(input(), "endEditing", submitEvent)
  expect(calls).toEqual([
    ["native", changeEvent],
    ["native-submit", submitEvent],
    ["submit", "held query"],
  ])
  expect(calls[1][1]).toBe(submitEvent)
  expect(end.mock.calls[0][0]).toBe(submitEvent)
  expect(selected).not.toHaveBeenCalled()
  expect(changed).toHaveBeenCalledTimes(1)
  await unmount()
  expect(root.current).toBeNull()
  expect(editor.current).toBeNull()
})

it("retires original result focus actions when a caller-owned status removes their receiver", async () => {
  const selection = jest.fn()
  const nativeMethods: { measureLayout: jest.Mock; focus: jest.Mock } = jest.requireActual(
    "@react-native/jest-preset/jest/MockNativeMethods",
  ).default
  const fixture = (status: TypeaheadSearchStatus) => (
    <TypeaheadSearch
      inputValue="held"
      onInputChange={jest.fn()}
      status={status}
      items={[
        { id: 0, name: "Zero" },
        { id: "0", name: "String zero" },
      ]}
      getItemKey={(item) => item.id}
      onSelectionChange={selection}
    />
  )
  const { rerender } = await render(fixture("results"))
  const retired = screen.getByRole("radio", { name: "Zero" }).props.onAccessibilityAction
  expect(retired).toEqual(expect.any(Function))
  nativeMethods.measureLayout.mockClear()
  nativeMethods.focus.mockClear()
  await rerender(fixture("loading"))
  await act(() => retired({ nativeEvent: { actionName: "increment" } }))
  expect(nativeMethods.measureLayout).not.toHaveBeenCalled()
  expect(nativeMethods.focus).not.toHaveBeenCalled()
  expect(selection).not.toHaveBeenCalled()
  await rerender(fixture("results"))
  await fireEvent.press(screen.getByRole("radio", { name: "Zero" }))
  expect(selection.mock.calls).toEqual([[0]])
})
