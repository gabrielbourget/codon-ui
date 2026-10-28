import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { createRef, useContext } from "react"
import { findNodeHandle, ScrollView, type View } from "react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionCellFocusContext,
  NativeCollectionRendererContext,
  type TNativeCollectionRootProps,
} from "../../../collection/renderer"
import { NativeThemeProvider } from "../../../theme"
import {
  NativeResizableTableContainer,
  NativeResizableTableContainerContext,
  NativeTableColumnResizeStateContext,
} from "../NativeResizableTableContainer"
import { Table } from "../Table"
import { TableCell } from "../TableCell"
import { TableColumn } from "../TableColumn"
import { TableRow } from "../TableRow"

import { CellFixtureBody, CellFixtureRow } from "./fixtures/TableCellFixture"
import { ColumnFixtureHeader } from "./fixtures/TableColumnFixture"
import { TableVirtualizedFixture } from "./fixtures/TableVirtualizedFixture"

let received: TNativeCollectionRootProps
let layout: React.ContextType<typeof NativeTableColumnResizeStateContext>
let container: React.ContextType<typeof NativeResizableTableContainerContext>
const Probe = () => {
  layout = useContext(NativeTableColumnResizeStateContext)
  container = useContext(NativeResizableTableContainerContext)
  return null
}
const Root = (props: TNativeCollectionRootProps) => {
  received = props
  return (
    <ScrollView
      testID="renderer-scroll"
      ref={(view) => {
        if (props.scrollRef) props.scrollRef.current = view
      }}
      onLayout={props.onLayout}
      onScroll={props.onScroll}
    >
      <DefaultNativeCollectionRenderer.CollectionRoot {...props} />
    </ScrollView>
  )
}
const OtherRoot = (props: TNativeCollectionRootProps) => <Root {...props} />
const columns = [
  { id: "name", name: "Name", isRowHeader: true },
  { id: "other", name: "Other" },
]
const tree = (
  virtual = true,
  root = Root,
  onScroll = jest.fn(),
  refs = { row: createRef<View>(), column: createRef<View>(), cell: createRef<View>() },
) => (
  <NativeThemeProvider>
    <NativeCollectionRendererContext.Provider
      value={{ ...DefaultNativeCollectionRenderer, isVirtualized: virtual, CollectionRoot: root }}
    >
      <NativeResizableTableContainer testID="container">
        <Table testID="grid" style={{ width: 444 }} onScroll={onScroll}>
          <ColumnFixtureHeader>
            <TableColumn ref={refs.column} id="name" columnID="name" isRowHeader width={200}>
              Name
              <Probe />
            </TableColumn>
            <TableColumn id="other" columnID="other">
              Other
            </TableColumn>
          </ColumnFixtureHeader>
          <CellFixtureBody>
            <TableRow ref={refs.row} id="row" testID="row" item={{ name: "Alpha", other: "Beta" }} columns={columns} />
            <CellFixtureRow id="raw-row">
              <TableCell ref={refs.cell} id="raw-name" columnID="name" testID="cell">
                Explicit cell
              </TableCell>
              <TableCell id="raw-other" columnID="other">
                Other cell
              </TableCell>
            </CellFixtureRow>
          </CellFixtureBody>
        </Table>
      </NativeResizableTableContainer>
    </NativeCollectionRendererContext.Provider>
  </NativeThemeProvider>
)
const measure = async (id: string, width: number) =>
  fireEvent(screen.getByTestId(id), "layout", { nativeEvent: { layout: { x: 0, y: 0, width, height: 120 } } })

beforeEach(() => {
  jest.useFakeTimers()
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const original = jest.mocked(native.findNodeHandle).getMockImplementation()!
  const tags = new WeakMap<object, number>()
  let next = 500
  jest.mocked(native.findNodeHandle).mockImplementation((view) => {
    if (!view || typeof view !== "object") return original(view)
    const previous = original(view)
    if (previous) return previous
    if (!tags.has(view)) tags.set(view, ++next)
    return tags.get(view)!
  })
})
afterEach(async () => {
  await cleanup()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("provides the original renderer scroll ref and preserves authored virtual width", async () => {
  await render(tree())
  await measure("container", 700)
  await measure("renderer-scroll", 350)
  expect(received.scrollRef).toBe(container!.scrollRef)
  expect(received.scrollRef!.current).not.toBeNull()
  expect(layout!.getColumnWidth("name")).toBe(200)
  expect(layout!.getColumnWidth("other")).toBe(150)
  expect(screen.getByTestId("grid")).toHaveStyle({ width: 444 })
})
it("retains nonvirtual measured sizing and routes an original scroll event exactly once", async () => {
  const onScroll = jest.fn()
  await render(tree(false, Root, onScroll))
  await measure("container", 500)
  await measure("renderer-scroll", 350)
  expect(screen.getByTestId("grid")).toHaveStyle({ width: 500 })
  expect(layout!.getColumnWidth("other")).toBe(300)
  const event = { nativeEvent: { contentOffset: { x: 0, y: 20 } } }
  await act(() => received.onScroll?.(event as never))
  expect(onScroll).toHaveBeenCalledTimes(1)
  expect(onScroll.mock.calls[0]![0]).toBe(event)
  expect(screen.getByTestId("grid").props.onScroll).toBeUndefined()
})
it("rejects layout callbacks from a replaced renderer, including when its component is reused", async () => {
  const view = await render(tree())
  await measure("renderer-scroll", 350)
  const original = received.onLayout!
  await view.rerender(tree(true, OtherRoot))
  await measure("renderer-scroll", 420)
  const changed = layout!.getColumnWidth("other")
  await act(() => original({ nativeEvent: { layout: { width: 900 } } } as never))
  expect(layout!.getColumnWidth("other")).toBe(changed)
  await view.rerender(tree())
  await measure("renderer-scroll", 360)
  await act(() => original({ nativeEvent: { layout: { width: 950 } } } as never))
  expect(layout!.getColumnWidth("other")).toBe(160)
})
it("retains the measured scroll owner through a layout-mode change without requiring another layout event", async () => {
  const view = await render(tree(false))
  await measure("container", 500)
  await measure("renderer-scroll", 350)
  expect(layout!.getColumnWidth("other")).toBe(300)
  await view.rerender(tree(true))
  expect(layout!.getColumnWidth("other")).toBe(150)
  await measure("renderer-scroll", -1)
  expect(layout!.getColumnWidth("other")).toBe(150)
})
it("forwards original row, cell and column focus events to the collection cell owner", async () => {
  const focus = jest.fn()
  const refs = { row: createRef<View>(), column: createRef<View>(), cell: createRef<View>() }
  await render(
    <NativeCollectionCellFocusContext.Provider value={focus}>
      {tree(true, Root, jest.fn(), refs)}
    </NativeCollectionCellFocusContext.Provider>,
  )
  const targets = [
    [screen.getByTestId("row"), refs.row],
    [screen.getByTestId("cell"), refs.cell],
    [screen.getByText("Name").parent!, refs.column],
  ] as const
  for (const [target, ref] of targets) {
    const event = {
      nativeEvent: {
        ownerId: target.props.ownerId,
        target: findNodeHandle(ref.current),
        isFocused: true,
        isFocusVisible: true,
      },
    }
    await act(() => target.props.onNativeFocusChange(event))
    expect(focus.mock.calls.at(-1)![0]).toBe(event)
  }
})
it("renders the complete logical table behind an actual partial VirtualizedList", async () => {
  const editor = createRef<import("react-native").TextInput>()
  await render(
    <NativeThemeProvider>
      <TableVirtualizedFixture editorRef={editor} />
    </NativeThemeProvider>,
  )
  await act(() => {})
  expect(screen.getByTestId("table-virtual-list")).toBeTruthy()
  expect(screen.getByTestId("table-virtual-count")).toHaveTextContent("48")
  expect(screen.getByTestId("table-virtual-editor").props.value).toBe("")
  expect(screen.getAllByText(/^Virtual row \d+$/).length).toBeLessThan(48)
  const original = editor.current
  await fireEvent.changeText(screen.getByTestId("table-virtual-editor"), "pending")
  expect(editor.current).toBe(original)
  expect(JSON.parse(screen.getByTestId("table-virtual-requests").props.children)).toEqual({
    drafts: ["pending"],
    scrolls: 0,
  })
  expect(screen.getByTestId("table-virtual-editor").props.value).toBe("")
})
