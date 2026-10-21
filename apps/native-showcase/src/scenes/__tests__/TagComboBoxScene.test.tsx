import "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"

import { NativeOverlayProvider, NativeThemeProvider } from "@codon-ui/react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
  userEvent,
} from "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"
import { TagComboBoxScene } from "../TagComboBoxScene"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
const hidden = { includeHiddenElements: true }
const scene = (mode: "light" | "dark" = "light") => (
  <NativeThemeProvider mode={mode}>
    <NativeOverlayProvider>
      <TagComboBoxScene />
    </NativeOverlayProvider>
  </NativeThemeProvider>
)
const press = (name: string) => fireEvent.press(screen.getByRole("button", { name, ...hidden }))
const choose = (name: string) => act(() => userEvent.setup().press(screen.getByRole("radio", { name })))
const show = () => fireEvent(screen.getByTestId("combo-box-window", hidden), "show")

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("keeps popup requests subject to owner veto and opens only after an owner echo", async () => {
  await render(scene())
  await press("Toggle tag-combo popup veto")
  await press("Show suggestions")
  expect(screen.getByTestId("tag-combo-owner-state")).toHaveTextContent(/Open: false.*Popup: veto/)
  expect(screen.getByTestId("tag-combo-owner-requests")).toHaveTextContent("Requests: open:true.")
  await press("Toggle tag-combo popup veto")
  await press("Show suggestions")
  await show()
  expect(screen.getByTestId("tag-combo-owner-state", hidden)).toHaveTextContent(/Open: true/)
  expect(screen.getByTestId("combo-box-input")).toBeOnTheScreen()
})

it("retains held selection and query across repeated add requests, then shows the owner echo", async () => {
  await render(scene())
  await press("Run two-veto tag-combo selection")
  await show()
  await choose("Empty key")
  await choose("Empty key")
  expect(screen.getByTestId("tag-combo-owner-state", hidden)).toHaveTextContent(/Selected: empty.*Query: "held query"/)
  expect(screen.getByTestId("tag-combo-owner-requests", hidden)).toHaveTextContent(
    'Requests: add:string:"" → input:"" → nested-input:"" → open:false → add:string:"" → input:"" → nested-input:"" → open:false.',
  )
  expect(screen.getByTestId("combo-box-input")).toHaveDisplayValue("held query")
  await choose("Empty key")
  expect(screen.getByTestId("tag-combo-owner-state", hidden)).toHaveTextContent(
    /Selected: string:"".*Query: "".*Open: false/,
  )
  expect(screen.queryByRole("radio", { name: "Empty key" })).toBeNull()
})

it("preserves the original draft and receiver refs through theme, styles and item updates", async () => {
  const view = await render(scene())
  await press("Toggle tag-combo owner open")
  await show()
  const editor = screen.getByTestId("tag-combo-owner-editor", hidden)
  await fireEvent.changeText(editor, "original owner draft")
  await press("Inspect tag-combo refs")
  expect(screen.getByTestId("tag-combo-owner-editor-state", hidden)).not.toHaveTextContent(/replaced/)
  await press("Toggle tag-combo styles")
  await press("Toggle tag-combo text size")
  await press("Reverse tag-combo items")
  await view.rerender(scene("dark"))
  await press("Inspect tag-combo refs")
  expect(editor).toHaveDisplayValue("original owner draft")
  expect(screen.getByTestId("tag-combo-owner-editor-state", hidden)).toHaveTextContent(/Text events: 1\./)
  expect(screen.getByTestId("tag-combo-owner-editor-state", hidden)).not.toHaveTextContent(/replaced/)
})

it("keeps the source string-key exclusion rule while preserving typed owner keys", async () => {
  await render(scene())
  await press("Set tag-combo number zero")
  await press("Toggle tag-combo owner open")
  await show()
  expect(screen.queryByRole("radio", { name: "Number zero" })).toBeNull()
  expect(screen.queryByRole("radio", { name: "String zero" })).toBeNull()
  expect(screen.getByRole("radio", { name: "Empty key" })).toBeOnTheScreen()
  await press("Set tag-combo string zero")
  expect(screen.getByTestId("tag-combo-owner-state", hidden)).toHaveTextContent(/Selected: string:"0"/)
  await press("Clear tag-combo items")
  expect(screen.getByTestId("combo-box-empty")).toBeOnTheScreen()
  await press("Restore tag-combo items")
  expect(screen.getByRole("radio", { name: "Empty key" })).toBeOnTheScreen()
})
