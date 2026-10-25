import "../../../collection/__tests__/nativeReceipts"

import { cleanup, userEvent } from "@testing-library/react-native"
import { createRef } from "react"
import type { TextInput, View } from "react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"

import { TableFixture } from "./fixtures/TableFixture"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.setTimeout(10000)
beforeEach(() => jest.useFakeTimers())
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const press = async (name: string) => {
  await userEvent.setup().press(screen.getByRole("button", { name }))
  await act(() => {})
}
it("keeps the same held editor through row reorder and theme changes without writing its value", async () => {
  const editor = createRef<TextInput>()
  const table = createRef<View>()
  await render(<TableFixture editorRef={editor} tableRef={table} />)
  const original = editor.current!
  const originalTable = table.current!
  expect(originalTable).not.toBeNull()
  const write = jest.spyOn(original, "setNativeProps")
  await press("Reverse rows")
  await press("Toggle theme")
  await fireEvent.changeText(screen.getByTestId("table-editor"), "requested")
  expect(screen.getByTestId("table-requests")).toHaveTextContent('["requested"]')
  expect(screen.getByTestId("table-editor").props.value).toBe("held")
  expect(editor.current).toBe(original)
  expect(table.current).toBe(originalTable)
  expect(write).not.toHaveBeenCalled()
})
it("replaces rows with loading content then empty content under the fixture owner", async () => {
  await render(<TableFixture />)
  await press("Toggle loading")
  expect(screen.getByText("Loading")).toBeOnTheScreen()
  expect(screen.queryByTestId("table-editor")).toBeNull()
  await press("Toggle empty")
  await press("Toggle loading")
  expect(screen.getByText("No people")).toBeOnTheScreen()
  expect(screen.queryByText("Loading")).toBeNull()
})

it("keeps the held editor and its value through row hover and theme changes", async () => {
  const editor = createRef<TextInput>()
  await render(<TableFixture editorRef={editor} />)
  const original = editor.current!
  const write = jest.spyOn(original, "setNativeProps")
  await fireEvent(screen.getByTestId("table-row-string:a"), "pointerEnter", {
    nativeEvent: { pointerType: "mouse", pageX: 20, pageY: 30 },
    persist: jest.fn(),
  })
  await press("Toggle theme")
  await fireEvent(screen.getByTestId("table-row-string:a"), "pointerLeave", {
    nativeEvent: { pointerType: "mouse", pageX: 20, pageY: 30 },
    persist: jest.fn(),
  })
  expect(editor.current).toBe(original)
  expect(screen.getByTestId("table-editor").props.value).toBe("held")
  expect(write).not.toHaveBeenCalled()
  expect(screen.getByTestId("table-requests")).toHaveTextContent(/^\[\]$/)
})

it("keeps selection veto/echo and nested editor ownership separate from row actions", async () => {
  const editor = createRef<TextInput>()
  await render(<TableFixture editorRef={editor} />)
  const original = editor.current!
  const write = jest.spyOn(original, "setNativeProps")
  await press("Toggle selection veto")
  await userEvent.setup().press(screen.getAllByRole("checkbox", { name: "Select Row" })[0])
  await act(() => {})
  expect(screen.getByTestId("table-selection")).toHaveTextContent(/^\[\]$/)
  expect(screen.getByTestId("table-selection-requests")).toHaveTextContent(/a/)
  await press("Toggle selection veto")
  await userEvent.setup().press(screen.getAllByRole("checkbox", { name: "Select Row" })[0])
  await act(() => {})
  expect(screen.getByTestId("table-selection")).toHaveTextContent('["a"]')
  expect(screen.getByTestId("table-actions")).toHaveTextContent(/^\[\]$/)
  await userEvent.setup().press(screen.getByTestId("table-editor"))
  await act(() => {})
  expect(screen.getByTestId("table-actions")).toHaveTextContent(/^\[\]$/)
  expect(editor.current).toBe(original)
  expect(write).not.toHaveBeenCalled()
})

it("retains the held editor while the owner vetoes then echoes sort and page requests", async () => {
  const editor = createRef<TextInput>()
  await render(<TableFixture editorRef={editor} />)
  const original = editor.current!
  const write = jest.spyOn(original, "setNativeProps")
  await press("Toggle query veto")
  await press("Person")
  await press("Person")
  await press("Next Page")
  await press("Next Page")
  expect(screen.getByTestId("table-sorts")).toHaveTextContent(/^\[\]$/)
  expect(screen.getByTestId("table-sort-requests")).toHaveTextContent(/Ascending.*Ascending/)
  expect(screen.getByTestId("table-page")).toHaveTextContent(/^1$/)
  expect(screen.getByTestId("table-page-requests")).toHaveTextContent("[2,2]")
  await press("Toggle query veto")
  await press("Person")
  await press("Next Page")
  expect(screen.getByTestId("table-sorts")).toHaveTextContent(/Ascending/)
  expect(screen.getByTestId("table-page")).toHaveTextContent(/^2$/)
  expect(screen.getByTestId("table-editor").props.value).toBe("held")
  expect(editor.current).toBe(original)
  expect(write).not.toHaveBeenCalled()
})
