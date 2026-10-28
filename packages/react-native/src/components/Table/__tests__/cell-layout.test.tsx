import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { createRef, type ReactNode, type RefAttributes } from "react"
import { TextInput, type View } from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeFloatingScopeContext } from "../../../overlays/floating/scope"
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

it.each([
  [{}, false, 0, false, "visible"],
  [{ truncate: true }, false, 0, true, "hidden"],
  [{ maxLines: 3 }, true, 3, false, "visible"],
  [{ truncate: true, maxLines: 3 }, true, 3, true, "hidden"],
  [{ truncate: false, maxLines: 0 }, false, 0, false, "visible"],
  [{ maxLines: -1 }, true, -1, false, "visible"],
  [{ maxLines: 1.5 }, true, 1.5, false, "visible"],
  [{ maxLines: Infinity }, true, 0, false, "visible"],
] as const)(
  "receives aggregate cell layout %j without leaking wrapper props",
  async (props, hasClamp, lines, noWrap, overflow) => {
    await render(tree(props))
    const host = screen.container.queryAll((host) => host.type === "CUIClampHost")[0]!
    expect(host.props.hasClamp).toBe(hasClamp)
    expect(host.props.maximumLines).toBe(lines)
    expect(host.props.noWrap).toBe(noWrap)
    expect(host).toHaveStyle({ overflow: hasClamp ? "hidden" : "visible" })
    const text = screen.getByText("Long cell content")
    expect(text.props.numberOfLines).toBeUndefined()
    expect(text.props.ellipsizeMode).toBeUndefined()
    const cell = screen.getByTestId("layout-cell")
    expect(cell).toHaveStyle({ overflow })
    expect(cell.props.truncate).toBeUndefined()
    expect(cell.props.maxLines).toBeUndefined()
  },
)

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
  expect(screen.container.queryAll((host) => host.type === "CUIClampHost")[0]!.props).toMatchObject({
    noWrap: true,
    maximumLines: 2,
    hasClamp: true,
  })
  expect(screen.getByText(row.value).props.numberOfLines).toBeUndefined()
  expect(column.cellRenderer).toHaveBeenLastCalledWith({ row, column })
})

it("owns one mixed-content budget while preserving explicit native text props", async () => {
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
  expect(screen.container.queryAll((host) => host.type === "CUIClampHost")[0]!.props.maximumLines).toBe(2)
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
  const hosts = screen.container.queryAll((host) => host.type === "CUIClampHost")
  expect(hosts.map((host) => host.props.noWrap)).toEqual([true, false])
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
  const originalContent = screen.container.queryAll((host) => host.type === "CUIClampHost")[0]!
  for (const props of [
    { truncate: true },
    { maxLines: 3, render: (host) => <NativeFocusView {...host} /> },
    { maxLines: 0 },
  ] satisfies Partial<TNativeTableCellProps>[]) {
    await view.rerender(tree({ ref: cell, ...props }, children))
    expect(cell.current).toBe(originalCell)
    expect(editor.current).toBe(originalEditor)
    expect(screen.container.queryAll((host) => host.type === "CUIClampHost")[0]!).toBe(originalContent)
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
  const host = screen.container.queryAll((host) => host.type === "CUIClampHost")[0]!
  expect(host).toHaveStyle({ overflow: "hidden" })
  expect(host.props).toMatchObject({ hasClamp: true, maximumLines: 2, noWrap: true })
  expect(screen.getByText("Raw prefix")).toBeOnTheScreen()
  expect(screen.getByTestId("block-one").props.children).toBe("Complete block one")
  expect(screen.getByTestId("block-two").props.children).toBe("Complete block two")
  expect(screen.getByTestId("mixed-editor").props).toMatchObject({
    value: "held dirty value",
    selection: { start: 3, end: 3 },
  })
  expect(screen.getByText("Original control")).toBeOnTheScreen()
})
