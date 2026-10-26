import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { Children, createRef, isValidElement, useContext, type ReactNode, type RefObject } from "react"
import { findNodeHandle, type View } from "react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeSelectableCollectionContext } from "../../../collection/context"
import { NativeFocusHost, NativeFocusView } from "../../../input/NativeFocusView"
import { NativeLocaleProvider } from "../../../locale/NativeLocaleProvider"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeThemeProvider } from "../../../theme"
import { NativeTablePropsContext, NativeTableStateContext } from "../context"
import { NativeColumnResizer, type TNativeColumnResizerProps } from "../NativeColumnResizer"
import {
  NativeResizableTableContainer,
  NativeTableColumnResizeStateContext,
  type TNativeResizableTableContainerProps,
} from "../NativeResizableTableContainer"
import { Table } from "../Table"
import { TableCell } from "../TableCell"
import { TableColumn } from "../TableColumn"
import type { TNativeTableColumnProps, TNativeTableProps } from "../types"

import { CellFixtureBody, CellFixtureRow } from "./fixtures/TableCellFixture"
import { ColumnFixtureHeader } from "./fixtures/TableColumnFixture"

beforeEach(() => jest.useFakeTimers())
afterEach(async () => {
  await cleanup()
  jest.clearAllTimers()
  jest.useRealTimers()
})
let state: NonNullable<React.ContextType<typeof NativeTableStateContext>>
let layout: React.ContextType<typeof NativeTableColumnResizeStateContext>
let field: RefObject<View | null>
const captureField = (children: ReactNode) => {
  Children.forEach(children, (child) => {
    if (!isValidElement<{ ref?: RefObject<View | null>; children?: ReactNode }>(child)) return
    if (child.type === NativeFocusHost) field = child.props.ref!
    else captureField(child.props.children)
  })
}
const Probe = () => {
  state = useContext(NativeTableStateContext)!
  layout = useContext(NativeTableColumnResizeStateContext)
  return null
}
type TOptions = {
  locale?: string
  active?: boolean
  handleProps?: TNativeColumnResizerProps & React.RefAttributes<View>
  table?: TNativeTableProps
  column?: Partial<TNativeTableColumnProps> & React.RefAttributes<View>
  container?: TNativeResizableTableContainerProps
  handle?: boolean
  sort?: (value: unknown) => void
}
const tree = ({
  column = {},
  container,
  handle,
  handleProps,
  sort,
  table,
  locale = "en-US",
  active = true,
}: TOptions = {}) => {
  const content = (
    <NativeTablePropsContext.Provider
      value={sort ? { sortDescriptor: { column: "name", direction: "ascending" }, onSortChange: sort } : null}
    >
      <Table accessibilityLabel="Columns" {...table}>
        <ColumnFixtureHeader>
          <TableColumn id="name" columnID="name" isRowHeader testID="column" {...column}>
            {column.children ?? (
              <>
                Name
                <Probe />
                {handle && (
                  <NativeColumnResizer
                    testID="resizer"
                    {...handleProps}
                    render={(props, values) => {
                      captureField(props.children)
                      return handleProps?.render ? handleProps.render(props, values) : <NativeFocusView {...props} />
                    }}
                  />
                )}
              </>
            )}
          </TableColumn>
          <TableColumn id="other" columnID="other">
            Other
          </TableColumn>
        </ColumnFixtureHeader>
        <CellFixtureBody>
          <CellFixtureRow id="row">
            <TableCell columnID="name">Alpha</TableCell>
            <TableCell columnID="other">Beta</TableCell>
          </CellFixtureRow>
        </CellFixtureBody>
      </Table>
    </NativeTablePropsContext.Provider>
  )
  return (
    <NativeThemeProvider>
      <NativeLocaleProvider locale={locale}>
        <NativeFloatingWindowContext.Provider value={() => active}>
          {container ? (
            <NativeResizableTableContainer testID="container" {...container}>
              {content}
            </NativeResizableTableContainer>
          ) : (
            content
          )}
        </NativeFloatingWindowContext.Provider>
      </NativeLocaleProvider>
    </NativeThemeProvider>
  )
}
type TRender = NonNullable<TNativeTableColumnProps["render"]>
const receiver = () => jest.fn<ReturnType<TRender>, Parameters<TRender>>((host) => <NativeFocusView {...host} />)
const measure = async () =>
  fireEvent(screen.getByTestId("container"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 500, height: 100 } },
  })
const key = async (name: string) => {
  const host = screen.getByTestId("resizer-input").props
  await act(() =>
    host.onNativeKey({
      nativeEvent: {
        kind: "keyboard",
        ownerId: host.ownerId,
        target: findNodeHandle(field.current),
        key: name,
        nativeCode: 1,
        characters: "",
        phase: "down",
        repeat: false,
        cancelled: false,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        capsLock: false,
        nativeModifierData: "",
        nativeDefaultHandled: true,
        timestamp: 100,
      },
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      persist: jest.fn(),
      isDefaultPrevented: () => false,
    }),
  )
}

it("provides exactly the nine raw Column fields and the actual missing-container error", async () => {
  const renderColumn = receiver()
  await render(tree({ column: { render: renderColumn } }))
  const values = renderColumn.mock.calls.at(-1)![1]
  expect(Object.keys(values).sort()).toEqual(
    [
      "allowsSorting",
      "isFocusVisible",
      "isFocused",
      "isHovered",
      "isPressed",
      "isResizing",
      "sort",
      "sortDirection",
      "startResize",
    ].sort(),
  )
  expect(values).toMatchObject({
    allowsSorting: undefined,
    isHovered: false,
    isPressed: false,
    isFocused: false,
    isFocusVisible: false,
    isResizing: false,
    sortDirection: undefined,
  })
  expect(() => values.startResize()).toThrow("Wrap your <Table> in a <ResizableTableContainer>")
  expect(screen.getByTestId("column").props.nativeCollectionBinding).not.toBe("")
})
it("routes raw sorting through the current owner without requiring allowsSorting", async () => {
  const renderColumn = receiver(),
    changed = jest.fn()
  await render(tree({ column: { render: renderColumn }, sort: changed }))
  await act(() => {
    renderColumn.mock.calls.at(-1)![1].sort("descending")
    renderColumn.mock.calls.at(-1)![1].sort("descending")
  })
  expect(changed.mock.calls).toEqual([
    [{ column: "name", direction: "descending" }],
    [{ column: "name", direction: "descending" }],
  ])
  expect(renderColumn.mock.calls.at(-1)![1].sortDirection).toBe("ascending")
})
it("preserves header refs and routes current children/style values separately from raw values", async () => {
  const ref = createRef<View>(),
    renderColumn = receiver()
  const children = jest.fn((_values: unknown) => "Title"),
    style = jest.fn(({ defaultStyle }: { defaultStyle: object }) => ({ ...defaultStyle, padding: 9 }))
  const view = await render(tree({ column: { ref, children, style } }))
  const original = ref.current
  expect(children.mock.calls.at(-1)![0]).toHaveProperty("defaultChildren", undefined)
  expect(style.mock.calls.at(-1)![0].defaultStyle).toEqual({})
  for (const render of [renderColumn, receiver(), undefined]) {
    await view.rerender(tree({ column: { ref, children, style, render } }))
    expect(ref.current).toBe(original)
    expect(screen.getByTestId("column")).toHaveStyle({ padding: 9 })
  }
})
it("limits interactive hover to sortable headers", async () => {
  const renderColumn = receiver(),
    pointer = { nativeEvent: { pointerType: "mouse" }, persist: jest.fn() }
  const view = await render(tree({ column: { render: renderColumn } }))
  await act(() => screen.getByTestId("column").props.onPointerEnter(pointer))
  expect(renderColumn.mock.calls.at(-1)![1].isHovered).toBe(false)
  await view.rerender(tree({ column: { render: renderColumn, allowsSorting: true } }))
  await act(() => screen.getByTestId("column").props.onPointerEnter(pointer))
  expect(renderColumn.mock.calls.at(-1)![1].isHovered).toBe(true)
})
it("retains the complete sizing state, controlled widths and original Table identity", async () => {
  await render(tree({ column: { width: 200 }, container: {} }))
  await measure()
  expect(layout!.tableState).toBe(state)
  expect(Object.keys(layout!).sort()).toEqual(
    [
      "columnWidths",
      "endResize",
      "getColumnMaxWidth",
      "getColumnMinWidth",
      "getColumnWidth",
      "resizingColumn",
      "startResize",
      "tableState",
      "updateResizedColumns",
    ].sort(),
  )
  expect([...layout!.columnWidths]).toEqual([
    ["name", 200],
    ["other", 300],
  ])
  expect(screen.getByText("Alpha").parent).toHaveStyle({ width: 200 })
  expect(screen.getByText("Beta").parent).toHaveStyle({ width: 300 })
  expect(layout!.getColumnMinWidth("name")).toBe(75)
  expect(layout!.getColumnMaxWidth("name")).toBe(Number.MAX_SAFE_INTEGER)
  await act(() => layout!.updateResizedColumns("name", 240))
  expect(layout!.getColumnWidth("name")).toBe(200)
})
it("starts original resize state, emits ten-unit owner requests and restores navigation on Escape", async () => {
  const renderColumn = receiver(),
    started = jest.fn(),
    changed = jest.fn(),
    ended = jest.fn()
  await render(
    tree({
      column: { render: renderColumn, width: 200 },
      container: { onResizeStart: started, onResize: changed, onResizeEnd: ended },
      handle: true,
    }),
  )
  await measure()
  await act(() => renderColumn.mock.calls.at(-1)![1].startResize())
  await act(() => jest.advanceTimersByTime(401))
  expect(renderColumn.mock.calls.at(-1)![1].isResizing).toBe(true)
  expect(state.isKeyboardNavigationDisabled).toBe(true)
  expect(started).toHaveBeenCalledTimes(1)
  await key("ArrowRight")
  expect(changed.mock.calls.at(-1)![0].get("name")).toBe(210)
  expect(layout!.getColumnWidth("name")).toBe(200)
  await key("Escape")
  expect(ended.mock.calls.at(-1)![0].get("name")).toBe(210)
  expect(state.isKeyboardNavigationDisabled).toBe(false)
  expect(renderColumn.mock.calls.at(-1)![1].isResizing).toBe(false)
})

it("preserves header identities while controlled expansion and filtering remain current", async () => {
  await render(
    <NativeSelectableCollectionContext.Provider value={{ filter: () => true }}>
      {tree({ table: { expandedKeys: new Set() }, container: {} })}
    </NativeSelectableCollectionContext.Provider>,
  )
  await measure()
  expect(layout!.tableState).toBe(state)
  expect(layout!.columnWidths.size).toBe(2)
})

it("supplies all five raw handle fields and retains its original ref through style/state updates", async () => {
  const ref = createRef<View>(),
    renderHandle = jest.fn<
      ReturnType<NonNullable<TNativeColumnResizerProps["render"]>>,
      Parameters<NonNullable<TNativeColumnResizerProps["render"]>>
    >((host) => <NativeFocusView {...host} />)
  const options = {
    column: { width: 200, minWidth: 100, maxWidth: 200 },
    container: {},
    handle: true,
    handleProps: { ref, render: renderHandle },
  }
  const view = await render(tree(options))
  await measure()
  expect(renderHandle.mock.calls.at(-1)![1]).toEqual({
    isHovered: false,
    isFocused: false,
    isFocusVisible: false,
    isResizing: false,
    resizableDirection: "right",
  })
  const original = ref.current
  await view.rerender(tree({ ...options, column: { width: 100, minWidth: 100, maxWidth: 200 } }))
  expect(ref.current).toBe(original)
  expect(renderHandle.mock.calls.at(-1)![1].resizableDirection).toBe("left")
})
it.each(["en-US", "ar-AE"])(
  "keeps original pointer width requests controlled in %s and survives an owner echo",
  async (locale) => {
    const ref = createRef<View>(),
      changed = jest.fn(),
      ended = jest.fn()
    const options = {
      locale,
      column: { width: 200 },
      container: { onResize: changed, onResizeEnd: ended },
      handle: true,
      handleProps: { ref },
    }
    const view = await render(tree(options))
    await measure()
    const tag = findNodeHandle(ref.current)
    await act(() =>
      screen.getByTestId("resizer").props.onPointerDown({
        nativeEvent: { pointerType: "mouse", ctrlKey: false, altKey: false, metaKey: false, shiftKey: false },
      }),
    )
    const event = (x: number) => ({
      target: tag,
      currentTarget: tag,
      nativeEvent: { target: tag, pageX: x, pageY: 0, identifier: 1 },
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      persist: jest.fn(),
      isDefaultPrevented: () => false,
    })
    await act(() => screen.getByTestId("resizer").props.onResponderGrant(event(100)))
    await act(() => screen.getByTestId("resizer").props.onResponderMove(event(120)))
    const next = locale === "ar-AE" ? 180 : 220
    expect(changed.mock.calls.at(-1)![0].get("name")).toBe(next)
    expect(layout!.getColumnWidth("name")).toBe(200)
    await view.rerender(tree({ ...options, column: { width: next } }))
    await act(() => screen.getByTestId("resizer").props.onResponderMove(event(130)))
    expect(changed.mock.calls.at(-1)![0].get("name")).toBe(locale === "ar-AE" ? 170 : 230)
    await act(() => screen.getByTestId("resizer").props.onResponderRelease(event(130)))
    expect(ended).toHaveBeenCalledTimes(1)
    expect(state.isKeyboardNavigationDisabled).toBe(false)
  },
)
it("retires resizing on window loss without owner callbacks or a stale width request", async () => {
  const renderColumn = receiver(),
    changed = jest.fn(),
    ended = jest.fn()
  const options = {
    column: { render: renderColumn, width: 200 },
    container: { onResize: changed, onResizeEnd: ended },
    handle: true,
  }
  const view = await render(tree(options))
  await measure()
  await act(() => renderColumn.mock.calls.at(-1)![1].startResize())
  const saved = screen.getByTestId("resizer-input").props.onAccessibilityAction
  await view.rerender(tree({ ...options, active: false }))
  expect(state.isKeyboardNavigationDisabled).toBe(false)
  expect(layout!.resizingColumn).toBeNull()
  await act(() => saved({ nativeEvent: { actionName: "increment" } }))
  expect(changed).not.toHaveBeenCalled()
  expect(ended).not.toHaveBeenCalled()
})
it("keeps the resize input when caller children and a custom renderer supply visible content", async () => {
  const children = jest.fn((_values: { defaultChildren: unknown }) => "Custom resize content")
  const view = await render(
    <NativeThemeProvider>
      <NativeResizableTableContainer>
        <Table accessibilityLabel="Custom resizer">
          <ColumnFixtureHeader>
            <TableColumn id="name" columnID="name" isRowHeader width={200}>
              Name
              <NativeColumnResizer testID="custom-resizer" render={(props) => <NativeFocusView {...props} />}>
                {children}
              </NativeColumnResizer>
            </TableColumn>
            <TableColumn id="other" columnID="other">
              Other
            </TableColumn>
          </ColumnFixtureHeader>
          <CellFixtureBody>
            <CellFixtureRow id="row">
              <TableCell columnID="name">Alpha</TableCell>
              <TableCell columnID="other">Beta</TableCell>
            </CellFixtureRow>
          </CellFixtureBody>
        </Table>
      </NativeResizableTableContainer>
    </NativeThemeProvider>,
  )
  expect(children.mock.calls.at(-1)![0]).toHaveProperty("defaultChildren", undefined)
  expect(screen.getByText("Custom resize content")).toBeTruthy()
  expect(screen.getByTestId("custom-resizer-input")).toBeTruthy()
  await view.unmount()
})
