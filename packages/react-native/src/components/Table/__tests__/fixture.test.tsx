import "../../../collection/__tests__/nativeReceipts"

import { cleanup, userEvent } from "@testing-library/react-native"
import { createRef } from "react"
import type { TextInput } from "react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"

import { TableFixture } from "./fixtures/TableFixture"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
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
  await render(<TableFixture editorRef={editor} />)
  const original = editor.current!
  const write = jest.spyOn(original, "setNativeProps")
  await press("Reverse rows")
  await press("Toggle theme")
  await fireEvent.changeText(screen.getByTestId("table-editor"), "requested")
  expect(screen.getByTestId("table-requests")).toHaveTextContent('["requested"]')
  expect(screen.getByTestId("table-editor").props.value).toBe("held")
  expect(editor.current).toBe(original)
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
