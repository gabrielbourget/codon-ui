import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { createRef, type RefAttributes } from "react"
import { StyleSheet, TextInput, View } from "react-native"

import { renderWithNativeCollections as render, screen } from "../../../collection/__tests__/nativeReceipts"
import { NativeThemeProvider } from "../../../theme"
import { createNativeTableStickyBinding } from "../stickyBinding"
import { Table } from "../Table"
import { TableColumn } from "../TableColumn"
import { TableRow } from "../TableRow"
import type { TNativeTableColumnProps, TNativeTableProps } from "../types"

import { CellFixtureBody } from "./fixtures/TableCellFixture"
import { ColumnFixtureHeader } from "./fixtures/TableColumnFixture"

jest.unmock("react-native/Libraries/Components/View/View")
jest.unmock("react-native/Libraries/Components/View/ViewNativeComponent")
jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("../stickyBinding", () => ({ createNativeTableStickyBinding: jest.fn() }))
type TController = ReturnType<typeof createNativeTableStickyBinding> & {
  target: () => View | null
  root: () => View | null
  isCurrent: () => boolean
}
let controllers: TController[]
beforeEach(() => {
  controllers = []
  jest.mocked(createNativeTableStickyBinding).mockImplementation((target, root, isCurrent) => {
    const controller = {
      target,
      root,
      isCurrent,
      synchronize: jest.fn(),
      retireIfChanged: jest.fn(),
      dispose: jest.fn(),
    }
    controllers.push(controller)
    return controller
  })
})
afterEach(async () => {
  await cleanup()
  jest.clearAllMocks()
})
const row = (id: string) => screen.getByTestId(id)
const setup = async (props: TNativeTableProps = {}, column: Partial<TNativeTableColumnProps> = {}) => {
  const root = createRef<View>(),
    header = createRef<View>(),
    editor = createRef<TextInput>(),
    change = jest.fn()
  const columns = [{ id: "value", name: "Value" }]
  const node = (
    tableProps: TNativeTableProps = props,
    columnProps: Partial<TNativeTableColumnProps> & RefAttributes<View> = column,
  ) => (
    <NativeThemeProvider>
      <Table ref={root} accessibilityLabel="Sticky source" testID="sticky-source" {...tableProps}>
        <ColumnFixtureHeader>
          <TableColumn ref={header} id="value" columnID="value" isRowHeader testID="sticky-column" {...columnProps}>
            Value
          </TableColumn>
        </ColumnFixtureHeader>
        <CellFixtureBody>
          <TableRow
            id="one"
            item={{}}
            columns={columns}
            renderCell={() => <TextInput ref={editor} testID="sticky-held" value="" onChangeText={change} />}
          />
        </CellFixtureBody>
      </Table>
    </NativeThemeProvider>
  )
  const view = await render(node())
  return { ...view, node, root, header, editor, change }
}

it("consumes sticky props and binds the original column/Table/editor without JS positioning", async () => {
  const f = await setup({ stickyHeader: true, stickyHeaderOffset: "10%", stickyHeaderBackgroundColor: "plum" })
  expect(f.header.current).not.toBeNull()
  expect(f.root.current).not.toBeNull()
  const original = { header: f.header.current, root: f.root.current, editor: f.editor.current }
  expect(controllers.at(-1)!.target()).toBe(original.header)
  expect(controllers.at(-1)!.root()).toBe(original.root)
  expect(controllers.at(-1)!.synchronize).toHaveBeenLastCalledWith(true, { top: "10%" }, false)
  expect(StyleSheet.flatten(row("sticky-column").props.style)).toMatchObject({ backgroundColor: "plum", zIndex: 3 })
  expect(StyleSheet.flatten(row("sticky-column").props.style).transform).toBeUndefined()
  for (const key of ["stickyHeader", "stickyHeaderOffset", "stickyHeaderBackgroundColor"])
    expect(row("sticky-source").props).not.toHaveProperty(key)
  await f.rerender(f.node({ stickyHeader: false }))
  expect(controllers.at(-1)!.synchronize).toHaveBeenLastCalledWith(false, { top: 0 }, false)
  expect(f.header.current).toBe(original.header)
  expect(f.root.current).toBe(original.root)
  expect(f.editor.current).toBe(original.editor)
  expect(row("sticky-held").props.value).toBe("")
  expect(f.change).not.toHaveBeenCalled()
})

it("retains final column paint/insets and the current width while a plain position override disables registration", async () => {
  const f = await setup(
    { stickyHeader: true, stickyHeaderOffset: -12, stickyHeaderBackgroundColor: "plum" },
    { style: { top: 0, backgroundColor: "transparent", zIndex: 0 } },
  )
  expect(controllers.at(-1)!.synchronize).toHaveBeenLastCalledWith(true, { top: 0 }, false)
  expect(StyleSheet.flatten(row("sticky-column").props.style)).toMatchObject({
    backgroundColor: "transparent",
    zIndex: 0,
  })
  expect(StyleSheet.flatten(row("sticky-column").props.style).top).toBeUndefined()
  const original = f.header.current
  await f.rerender(
    f.node({ stickyHeader: true }, { style: { position: "relative", top: 12, backgroundColor: "blue" } }),
  )
  expect(controllers.at(-1)!.synchronize).toHaveBeenLastCalledWith(false, { top: 0 }, false)
  expect(StyleSheet.flatten(row("sticky-column").props.style)).toMatchObject({
    position: "relative",
    top: 12,
    backgroundColor: "blue",
    zIndex: 3,
  })
  expect(f.header.current).toBe(original)
})

it("retains an original forwarded core View renderer target and requests actual authored-style authority", async () => {
  const core = (props: Parameters<NonNullable<TNativeTableColumnProps["render"]>>[0]) => {
    // This ref/style probe leaves richer CUI focus packets to the renderer's separate input adapter.
    const { onFocus: _focus, onBlur: _blur, ...native } = props
    return <View {...native} />
  }
  const f = await setup({ stickyHeader: true }, { render: core })
  const original = f.header.current
  expect(controllers.at(-1)!.target()).toBe(original)
  expect(controllers.at(-1)!.synchronize).toHaveBeenLastCalledWith(true, { top: 0 }, true)
  await f.rerender(f.node({ stickyHeader: true, stickyHeaderOffset: 20 }, { render: core }))
  expect(f.header.current).toBe(original)
  expect(controllers.at(-1)!.synchronize).toHaveBeenLastCalledWith(true, { top: 20 }, true)
  await f.unmount()
  expect(controllers.at(-1)!.dispose).toHaveBeenCalledTimes(1)
})
