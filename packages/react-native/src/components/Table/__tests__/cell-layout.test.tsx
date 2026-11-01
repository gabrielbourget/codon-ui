import "../../../collection/__tests__/nativeReceipts"

import { act as rawAct, cleanup } from "@testing-library/react-native"
import { createRef, type ReactNode, type RefAttributes } from "react"
import { TextInput, type View } from "react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeThemeProvider } from "../../../theme"
import { Button } from "../../Button/Button"
import { Text } from "../../Text/Text"
import { Table } from "../Table"
import { TableBody } from "../TableBody"
import { TableCell } from "../TableCell"
import { TableHeader } from "../TableHeader"
import type { TNativeTableCellProps, TNativeTableColumnMetadata } from "../types"

import { CellFixtureBody, CellFixtureRow } from "./fixtures/TableCellFixture"

const columns = [{ id: "value", name: "Value", isRowHeader: true }]
const rootWindow = { id: "table-window", canAct: () => true }
const popupWindow = { id: "popup-window", canAct: () => true }
const tree = (
  props: Partial<TNativeTableCellProps> & RefAttributes<View> = {},
  children: ReactNode = "Long cell content",
) => (
  <NativeThemeProvider>
    <NativeFloatingScopeContext.Provider value={rootWindow}>
      <Table accessibilityLabel="Cell layout">
        <TableHeader columns={columns} />
        <CellFixtureBody>
          <CellFixtureRow id="row">
            <TableCell id="row-value" columnID="value" testID="layout-cell" {...props}>
              {children}
            </TableCell>
          </CellFixtureRow>
        </CellFixtureBody>
      </Table>
    </NativeFloatingScopeContext.Provider>
  </NativeThemeProvider>
)

afterEach(cleanup)

// The approved phone contract limits owned text, not arbitrary mixed native content.
it.each([
  [{}, undefined],
  [{ truncate: true }, 1],
  [{ maxLines: 3 }, 3],
  [{ truncate: true, maxLines: 3 }, 1],
  [{ truncate: false, maxLines: 0 }, undefined],
  [{ maxLines: -1 }, undefined],
  [{ maxLines: 1.5 }, undefined],
  [{ maxLines: Infinity }, undefined],
  [{ maxLines: NaN }, undefined],
  [{ maxLines: Number.MAX_SAFE_INTEGER }, 2147483647],
] as const)("limits owned text with stock props for %j without leaking cell props", async (props, lines) => {
  await render(tree(props))
  expect(screen.container.queryAll((host) => host.type === "CUIClampHost")).toHaveLength(0)
  const text = screen.getByText("Long cell content")
  expect(text.props.numberOfLines).toBe(lines)
  expect(text.props.ellipsizeMode).toBe(lines === undefined ? undefined : "tail")
  const cell = screen.getByTestId("layout-cell")
  expect(cell).toHaveStyle({ overflow: "visible" })
  expect(cell.props.truncate).toBeUndefined()
  expect(cell.props.maxLines).toBeUndefined()
  expect(screen.queryByRole("button", { name: "Show full value" }) !== null).toBe(lines !== undefined)
})

it("passes column metadata to its cell and retains the caller's original renderer arguments", async () => {
  const column: TNativeTableColumnMetadata<{ value: string }> = {
    ...columns[0]!,
    truncate: true,
    maxLines: 2,
    cellRenderer: jest.fn(({ row }) => row.value),
  }
  const row = { value: "Column-owned content" }
  await render(
    <NativeThemeProvider>
      <Table>
        <TableHeader columns={[column]} />
        <TableBody columns={[column]} items={[row]} rowKey={() => "row"} />
      </Table>
    </NativeThemeProvider>,
  )
  expect(screen.getByText(row.value).props.numberOfLines).toBe(1)
  expect(screen.getByRole("button", { name: "Show full value" })).toBeOnTheScreen()
  expect(column.cellRenderer).toHaveBeenLastCalledWith({ row, column })
})

it("leaves authored text and interactive components on their original separate layouts", async () => {
  await render(
    tree(
      { maxLines: 2 },
      <>
        <Text testID="authored">Authored text</Text>
        <Button>Nested button text</Button>
        <Text testID="unlimited" numberOfLines={0} ellipsizeMode="clip">
          Unbounded authored text
        </Text>
      </>,
    ),
  )
  expect(screen.container.queryAll((host) => host.type === "CUIClampHost")).toHaveLength(0)
  expect(screen.queryByRole("button", { name: "Show full value" })).toBeNull()
  expect(screen.getByTestId("authored").props.numberOfLines).toBeUndefined()
  expect(screen.getByText("Nested button text").props.numberOfLines).toBeUndefined()
  expect(screen.getByTestId("unlimited").props.numberOfLines).toBe(0)
  expect(screen.getByTestId("unlimited").props.ellipsizeMode).toBe("clip")
})

it("keeps constraints inside the originating window and clears them at a nested cell boundary", async () => {
  await render(
    tree(
      { truncate: true },
      <>
        <Text testID="current-window">Cell window</Text>
        <NativeFloatingScopeContext.Provider value={popupWindow}>
          <Text testID="popup-text">Popup content</Text>
        </NativeFloatingScopeContext.Provider>
        <Table>
          <TableHeader columns={columns} />
          <TableBody columns={columns} items={[{ value: "Nested table content" }]} rowKey={() => "nested-row"} />
        </Table>
      </>,
    ),
  )
  await act(() => {})
  expect(screen.container.queryAll((host) => host.type === "CUIClampHost")).toHaveLength(0)
  expect(screen.getByTestId("current-window").props.numberOfLines).toBeUndefined()
  expect(screen.getByTestId("popup-text").props.numberOfLines).toBeUndefined()
  await act(() => {})
  expect(screen.getByText("Nested table content").props.numberOfLines).toBeUndefined()
})

it("retains the original cell and held editor through layout and custom-renderer updates", async () => {
  const cell = createRef<View>(),
    editor = createRef<TextInput>()
  const children = <TextInput ref={editor} testID="held-layout-editor" value="" selection={{ start: 0, end: 0 }} />
  const view = await render(tree({ ref: cell }, children))
  const originalCell = cell.current,
    originalEditor = editor.current
  expect(originalCell).not.toBeNull()
  expect(originalEditor).not.toBeNull()
  for (const props of [
    { truncate: true },
    { maxLines: 3, render: (host) => <NativeFocusView {...host} /> },
    { maxLines: 0 },
  ] satisfies Partial<TNativeTableCellProps>[]) {
    await view.rerender(tree({ ref: cell, ...props }, children))
    expect(cell.current).toBe(originalCell)
    expect(editor.current).toBe(originalEditor)
    expect(screen.container.queryAll((host) => host.type === "CUIClampHost")).toHaveLength(0)
    expect(screen.getByTestId("held-layout-editor").props.value).toBe("")
    expect(screen.getByTestId("held-layout-editor").props.selection).toEqual({ start: 0, end: 0 })
  }
})

it("retains complete mixed native content under the original Cell and separate authored overflow", async () => {
  await render(
    tree(
      { maxLines: 2, truncate: true, style: { overflow: "visible" } },
      <>
        Raw prefix
        <Text testID="block-one">Complete block one</Text>
        <Text testID="block-two">Complete block two</Text>
        <TextInput testID="mixed-editor" value="held dirty value" selection={{ start: 3, end: 3 }} />
        <Button>Original control</Button>
      </>,
    ),
  )
  expect(screen.getByTestId("layout-cell")).toHaveStyle({ overflow: "visible" })
  expect(screen.container.queryAll((host) => host.type === "CUIClampHost")).toHaveLength(0)
  expect(screen.queryByRole("button", { name: "Show full value" })).toBeNull()
  expect(screen.getByText("Raw prefix").props.numberOfLines).toBeUndefined()
  expect(screen.getByText("Raw prefix")).toBeOnTheScreen()
  expect(screen.getByTestId("block-one").props.children).toBe("Complete block one")
  expect(screen.getByTestId("block-two").props.children).toBe("Complete block two")
  expect(screen.getByTestId("mixed-editor").props).toMatchObject({
    value: "held dirty value",
    selection: { start: 3, end: 3 },
  })
  expect(screen.getByText("Original control")).toBeOnTheScreen()
})

it("expands and collapses the original owned text through an ordinary button without changing the cell ref", async () => {
  const cell = createRef<View>()
  const view = await render(tree({ ref: cell, maxLines: 2 }))
  const originalCell = cell.current
  const originalText = screen.getByText("Long cell content")
  expect(originalCell).not.toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Show full value" }))
  expect(screen.getByText("Long cell content")).toBe(originalText)
  expect(originalText.props.numberOfLines).toBe(0)
  expect(cell.current).toBe(originalCell)
  expect(screen.getByRole("button", { name: "Show less" }).props.accessibilityState.expanded).toBe(true)
  await view.rerender(tree({ ref: cell, maxLines: 3 }, "Current complete value"))
  expect(screen.getByText("Current complete value")).toBe(originalText)
  expect(originalText.props.numberOfLines).toBe(0)
  await fireEvent.press(screen.getByRole("button", { name: "Show less" }))
  expect(originalText.props.numberOfLines).toBe(3)
  expect(cell.current).toBe(originalCell)
})

it("composes full-value accessibility actions with the caller's original action and event", async () => {
  const onAccessibilityAction = jest.fn()
  await render(
    tree({ maxLines: 2, accessibilityActions: [{ name: "inspect", label: "Inspect" }], onAccessibilityAction }),
  )
  const cell = screen.getByTestId("layout-cell")
  expect(cell.props.accessibilityActions).toEqual([
    { name: "inspect", label: "Inspect" },
    { name: "expandCellValue", label: "Show full value" },
  ])
  const original = { nativeEvent: { actionName: "expandCellValue" }, isDefaultPrevented: () => false }
  const expand = cell.props.onAccessibilityAction
  await act(() => expand(original))
  expect(onAccessibilityAction).toHaveBeenCalledTimes(1)
  expect(onAccessibilityAction).toHaveBeenCalledWith(original)
  expect(screen.getByText("Long cell content").props.numberOfLines).toBe(0)
  expect(cell.props.accessibilityActions[1]).toEqual({ name: "collapseCellValue", label: "Show less" })
  await act(() => expand(original))
  expect(screen.getByText("Long cell content").props.numberOfLines).toBe(0)
  await act(() =>
    cell.props.onAccessibilityAction({ nativeEvent: { actionName: "inspect" }, isDefaultPrevented: () => false }),
  )
  expect(screen.getByText("Long cell content").props.numberOfLines).toBe(0)
  await act(() =>
    cell.props.onAccessibilityAction({
      nativeEvent: { actionName: "collapseCellValue" },
      isDefaultPrevented: () => false,
    }),
  )
  expect(screen.getByText("Long cell content").props.numberOfLines).toBe(2)
})

it("preserves same-event caller prevention and rejects retained disclosure after window loss", async () => {
  const onAccessibilityAction = jest.fn()
  const content = (active: boolean) => (
    <NativeFloatingWindowContext.Provider value={() => active}>
      {tree({ maxLines: 2, onAccessibilityAction })}
    </NativeFloatingWindowContext.Provider>
  )
  const view = await render(content(true))
  const cell = screen.getByTestId("layout-cell")
  const saved = cell.props.onAccessibilityAction
  await act(() => saved({ nativeEvent: { actionName: "expandCellValue" }, isDefaultPrevented: () => true }))
  expect(screen.getByText("Long cell content").props.numberOfLines).toBe(2)
  await view.rerender(content(false))
  await act(() => saved({ nativeEvent: { actionName: "expandCellValue" }, isDefaultPrevented: () => false }))
  expect(screen.getByText("Long cell content").props.numberOfLines).toBe(2)
  await view.unmount()
  await rawAct(() => saved({ nativeEvent: { actionName: "expandCellValue" }, isDefaultPrevented: () => false }))
})

it("keeps primitive arrays and fragments in one owned phrase with complete content", async () => {
  await render(
    tree(
      { maxLines: 2 },
      <>
        Prefix {0}
        {[" middle ", <>{9n} suffix</>]}
      </>,
    ),
  )
  const text = screen.getByText("Prefix 0 middle 9 suffix")
  expect(text.props.numberOfLines).toBe(2)
  await fireEvent.press(screen.getByRole("button", { name: "Show full value" }))
  expect(text.props.numberOfLines).toBe(0)
  expect(text.props.children).toEqual(["Prefix ", 0, " middle ", 9n, " suffix"])
})

it("preserves caller-owned clipping without applying it as a truncation default", async () => {
  await render(tree({ truncate: true, style: { overflow: "hidden" } }))
  expect(screen.getByTestId("layout-cell")).toHaveStyle({ overflow: "hidden" })
  expect(screen.getByText("Long cell content").props.numberOfLines).toBe(1)
})

it("reveals a controlled row value without selection or row-action requests", async () => {
  const onSelectionChange = jest.fn()
  const onRowAction = jest.fn()
  const metadata = [{ ...columns[0]!, maxLines: 2 }]
  await render(
    <NativeThemeProvider>
      <Table
        selectionMode="single"
        selectedKeys={["row"]}
        onSelectionChange={onSelectionChange}
        onRowAction={onRowAction}
      >
        <TableHeader columns={metadata} />
        <TableBody columns={metadata} items={[{ value: "Complete controlled value" }]} rowKey={() => "row"} />
      </Table>
    </NativeThemeProvider>,
  )
  const button = screen.getByRole("button", { name: "Show full value" })
  expect(button).toHaveStyle({ minHeight: 44, minWidth: 44 })
  await fireEvent.press(button)
  expect(screen.getByText("Complete controlled value").props.numberOfLines).toBe(0)
  expect(onSelectionChange).not.toHaveBeenCalled()
  expect(onRowAction).not.toHaveBeenCalled()
  expect(screen.getByTestId("table-row-string:row").props.accessibilityState.selected).toBe(true)
})

it.each([
  ["empty string", ""],
  ["whitespace", "   "],
  ["null", null],
  ["false", false],
  ["empty fragment", <></>],
] as const)("does not add a disclosure control for %s content", async (_name, children) => {
  await render(tree({ maxLines: 2 }, children))
  expect(screen.queryByRole("button", { name: "Show full value" })).toBeNull()
  expect(screen.getByTestId("layout-cell").props.accessibilityActions).toEqual([])
})

it.each([0, 0n])("keeps a meaningful zero value %s eligible for full-value disclosure", async (children) => {
  await render(tree({ truncate: true }, children))
  expect(screen.getByText("0").props.numberOfLines).toBe(1)
  await fireEvent.press(screen.getByRole("button", { name: "Show full value" }))
  expect(screen.getByText("0").props.numberOfLines).toBe(0)
})
