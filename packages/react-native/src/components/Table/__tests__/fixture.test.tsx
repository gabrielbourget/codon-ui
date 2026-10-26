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
import { NativeThemeProvider } from "../../../theme"

import { TableCellFixture } from "./fixtures/TableCellFixture"
import { TableColumnFixture } from "./fixtures/TableColumnFixture"
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
it("keeps the complete row renderer, layout owner and held editor connected in the maintained scene", async () => {
  await render(<TableFixture />)
  const row = screen.getByTestId("table-custom-row"),
    input = screen.getByTestId("table-custom-row-editor")
  const owner = row.props.ownerId
  await press("Toggle row renderer")
  await press("Toggle row layout offset")
  await fireEvent.changeText(input, "pending")
  await press("Inspect row render values")
  expect(screen.getByTestId("table-custom-row")).toBe(row)
  expect(row.props.ownerId).toBe(owner)
  expect(row.props.nativeMotionGeometryBinding).not.toBe("")
  expect(screen.getByTestId("table-custom-row-editor")).toBe(input)
  expect(input.props.value).toBe("")
  expect(JSON.parse(screen.getByTestId("table-custom-row-values").props.children)).toMatchObject({
    flags: { selectionMode: "multiple" },
  })
  expect(JSON.parse(screen.getByTestId("table-custom-row-requests").props.children)).toContain("draft:pending")
})
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
  await fireEvent(screen.getByTestId("table-header"), "pointerEnter", {
    nativeEvent: { pointerType: "mouse", pageX: 20, pageY: 30 },
    persist: jest.fn(),
  })
  expect(screen.getByTestId("table-header-hover")).toHaveTextContent("true")
  expect(screen.getByTestId("table-header")).toHaveStyle({ opacity: 0.85 })
  await fireEvent(screen.getByTestId("table-row-string:a"), "pointerEnter", {
    nativeEvent: { pointerType: "mouse", pageX: 20, pageY: 30 },
    persist: jest.fn(),
  })
  await press("Toggle theme")
  await fireEvent(screen.getByTestId("table-header"), "pointerLeave", {
    nativeEvent: { pointerType: "mouse", pageX: 20, pageY: 30 },
    persist: jest.fn(),
  })
  expect(screen.getByTestId("table-header-hover")).toHaveTextContent("false")
  await fireEvent(screen.getByTestId("table-row-string:a"), "pointerLeave", {
    nativeEvent: { pointerType: "mouse", pageX: 20, pageY: 30 },
    persist: jest.fn(),
  })
  expect(editor.current).toBe(original)
  expect(screen.getByTestId("table-editor").props.value).toBe("held")
  expect(write).not.toHaveBeenCalled()
  expect(screen.getByTestId("table-requests")).toHaveTextContent(/^\[\]$/)
})

it("adds and removes the Cell renderer without replacing its original held editor", async () => {
  const editor = createRef<TextInput>()
  await render(
    <NativeThemeProvider>
      <TableCellFixture editorRef={editor} />
    </NativeThemeProvider>,
  )
  const input = editor.current!
  const write = jest.spyOn(input, "setNativeProps")
  await press("Toggle cell renderer")
  expect(editor.current).toBe(input)
  await press("Toggle cell line limit")
  expect(screen.getByTestId("table-custom-cell-text").props.numberOfLines).toBe(2)
  await press("Toggle cell truncation")
  expect(screen.getByTestId("table-custom-cell-text").props.numberOfLines).toBe(1)
  expect(editor.current).toBe(input)
  await fireEvent(screen.getByTestId("table-custom-cell"), "pointerEnter", {
    nativeEvent: { pointerType: "mouse" },
    persist: jest.fn(),
  })
  expect(screen.getByTestId("table-custom-cell")).toHaveStyle({ opacity: 0.85 })
  await press("Toggle cell renderer")
  expect(editor.current).toBe(input)
  expect(screen.getByTestId("table-custom-cell-editor").props.value).toBe("")
  expect(screen.getByTestId("table-custom-cell-requests")).toHaveTextContent(/^\[\]$/)
  expect(write).not.toHaveBeenCalled()
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

it("exercises actual state-context selection veto and echo while retaining the held editor", async () => {
  const editor = createRef<TextInput>()
  await render(<TableFixture editorRef={editor} />)
  const original = editor.current!
  const write = jest.spyOn(original, "setNativeProps")
  await press("Toggle selection veto")
  await press("Programmatic select all")
  await press("Programmatic select all")
  await press("Inspect Table state")
  expect(screen.getByTestId("table-selection-requests")).toHaveTextContent('["all","all"]')
  expect(JSON.parse(screen.getByTestId("table-state-proof").props.children)).toMatchObject({
    rows: ["a", "b"],
    selected: [],
    first: "a",
    treeColumn: "name",
  })
  await press("Toggle selection veto")
  await press("Programmatic select all")
  await press("Inspect Table state")
  expect(JSON.parse(screen.getByTestId("table-state-proof").props.children).selected).toEqual(["a", "b"])
  expect(editor.current === original).toBe(true)
  expect(write).not.toHaveBeenCalled()
})

it("exercises state expansion, source sorting and navigation controls through the maintained owner", async () => {
  await render(<TableFixture />)
  await press("Toggle query veto")
  await press("Toggle Alpha expansion")
  await press("Toggle Alpha expansion")
  expect(screen.getByTestId("table-expansion-requests")).toHaveTextContent('[["a"],["a"]]')
  await press("Toggle query veto")
  await press("Toggle Alpha expansion")
  await press("Programmatic Person sort")
  await press("Toggle table navigation")
  await press("Inspect Table state")
  expect(JSON.parse(screen.getByTestId("table-state-proof").props.children)).toMatchObject({
    expanded: ["a"],
    navigationDisabled: true,
  })
  expect(screen.getByTestId("table-sorts")).toHaveTextContent(/Ascending/)
  expect(screen.getByTestId("table-editor").props.value).toBe("held")
})

it("retains the original table and held editor through root rendering and typography controls", async () => {
  const editor = createRef<TextInput>()
  const table = createRef<View>()
  await render(<TableFixture editorRef={editor} tableRef={table} />)
  const original = { table: table.current, editor: editor.current }
  const write = jest.spyOn(original.editor!, "setNativeProps")
  await press("Toggle root renderer")
  await press("Toggle table typography")
  expect(table.current === original.table).toBe(true)
  expect(editor.current === original.editor).toBe(true)
  expect(screen.getByTestId("table-editor").props.value).toBe("held")
  expect(write.mock.calls.some(([props]) => props && ("text" in props || "value" in props))).toBe(false)
})

it("keeps raw column resizing and the original held editor connected in the maintained scene", async () => {
  await render(
    <NativeThemeProvider>
      <TableColumnFixture />
    </NativeThemeProvider>,
  )
  const editor = screen.getByTestId("raw-column-editor"),
    header = screen.getByTestId("raw-column")
  await fireEvent(screen.getByTestId("raw-resize-container"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 500, height: 100 } },
  })
  await press("Toggle column renderer")
  await press("Start raw column resizing")
  expect(screen.getByRole("slider").props.accessibilityValue.now).toBe(180)
  await fireEvent.changeText(editor, "pending")
  expect(screen.getByTestId("raw-column-editor")).toBe(editor)
  expect(screen.getByTestId("raw-column")).toBe(header)
  expect(editor.props.value).toBe("")
  expect(JSON.parse(screen.getByTestId("raw-column-requests").props.children)).toContain("draft:pending")
})
