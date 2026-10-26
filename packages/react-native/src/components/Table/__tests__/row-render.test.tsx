import "../../../collection/__tests__/nativeReceipts"

import { act as rawAct, cleanup, userEvent } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, findNodeHandle, TextInput, type View } from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeThemeProvider } from "../../../theme"
import { Table } from "../Table"
import { TableHeader } from "../TableHeader"
import { TableRow } from "../TableRow"
import type { TNativeTableProps, TNativeTableRowProps } from "../types"

import { CellFixtureBody } from "./fixtures/TableCellFixture"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(async () => {
  await cleanup()
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})
const item = { id: "a", name: "Alpha" }
const columns = [{ id: "name", name: "Name", isRowHeader: true }]
type TRow = TNativeTableRowProps<typeof item> & React.RefAttributes<View>
type TRender = NonNullable<TRow["render"]>
const receiver = () => jest.fn<ReturnType<TRender>, Parameters<TRender>>((props) => <NativeFocusView {...props} />)
const tree = (row: Partial<TRow> = {}, table: TNativeTableProps = {}, active = true) => (
  <NativeThemeProvider>
    <NativeFloatingWindowContext.Provider value={() => active}>
      <Table accessibilityLabel="Rows" {...table}>
        <TableHeader columns={columns} />
        <CellFixtureBody>
          <TableRow testID="row" id="a" item={item} columns={columns} {...row} />
        </CellFixtureBody>
      </Table>
    </NativeFloatingWindowContext.Provider>
  </NativeThemeProvider>
)
const pointer = { nativeEvent: { pointerType: "mouse" }, persist: jest.fn() }

it("receives all seventeen source fields and retains non-DnD undefined values", async () => {
  const renderRow = receiver()
  await render(
    tree(
      { render: renderRow },
      { selectionMode: "multiple", selectionBehavior: "replace", selectedKeys: new Set(["a"]) },
    ),
  )
  const values = renderRow.mock.calls.at(-1)![1]
  expect(values).toEqual({
    isPressed: false,
    isSelected: true,
    isFocused: false,
    isDisabled: false,
    allowsSelection: true,
    hasAction: false,
    isHovered: false,
    isFocusVisible: false,
    selectionMode: "multiple",
    selectionBehavior: "replace",
    isDragging: undefined,
    isDropTarget: undefined,
    isFocusVisibleWithin: false,
    id: "a",
    hasChildItems: false,
    isExpanded: false,
    level: 1,
  })
  expect(Object.hasOwn(values, "defaultChildren")).toBe(false)
  const props = screen.getByTestId("row").props
  expect(props.nativeCollectionBinding).not.toBe("")
  expect(props.nativeMotionProjectionRevision).not.toBe("")
  expect(props.nativeMotionDrawingOwner).toBe(true)
  expect(props.render).toBeUndefined()
  expect(props.nativeRender).toBeUndefined()
})
it("updates selected, disabled, expansion and action values from the actual current table", async () => {
  const renderRow = receiver()
  const view = await render(
    tree(
      { render: renderRow, hasChildItems: true },
      { selectionMode: "multiple", selectedKeys: new Set(["a"]), expandedKeys: new Set(["a"]) },
    ),
  )
  expect(renderRow.mock.calls.at(-1)![1]).toMatchObject({ isSelected: true, isExpanded: true, hasChildItems: true })
  await view.rerender(
    tree(
      { render: renderRow, hasChildItems: true },
      { selectionMode: "multiple", disabledKeys: ["a"], selectedKeys: new Set(), expandedKeys: new Set() },
    ),
  )
  expect(renderRow.mock.calls.at(-1)![1]).toMatchObject({
    isSelected: false,
    isDisabled: true,
    allowsSelection: false,
    hasAction: false,
    isExpanded: false,
  })
})
it("separates inert CSS pointer paint from interactive hover state and current original-event callbacks", async () => {
  const renderRow = receiver(),
    changed = jest.fn(),
    entered = jest.fn(),
    left = jest.fn()
  const props = { render: renderRow, onHoverChange: changed, onHoverStart: entered, onHoverEnd: left }
  const view = await render(tree(props))
  await act(() => screen.getByTestId("row").props.onPointerEnter(pointer))
  expect(renderRow.mock.calls.at(-1)![1].isHovered).toBe(false)
  expect(changed).not.toHaveBeenCalled()
  await act(() => screen.getByTestId("row").props.onPointerLeave(pointer))
  await view.rerender(tree(props, { selectionMode: "single" }))
  await act(() => screen.getByTestId("row").props.onPointerEnter(pointer))
  expect(renderRow.mock.calls.at(-1)![1].isHovered).toBe(true)
  expect(entered).toHaveBeenLastCalledWith(pointer)
  expect(changed).toHaveBeenLastCalledWith(true)
  await act(() => screen.getByTestId("row").props.onPointerLeave(pointer))
  expect(left).toHaveBeenLastCalledWith(pointer)
  expect(renderRow.mock.calls.at(-1)![1].isHovered).toBe(false)
})
it("retains the original row, projection owner, held editor across renderer changes", async () => {
  const ref = createRef<View>(),
    editor = createRef<TextInput>(),
    changed = jest.fn()
  const ownedColumns = [
    { ...columns[0], cellRenderer: () => <TextInput ref={editor} testID="held" value="" onChangeText={changed} /> },
  ]
  const view = await render(tree({ ref, columns: ownedColumns }))
  const original = ref.current,
    input = editor.current,
    owner = screen.getByTestId("row").props.ownerId
  const write = jest.spyOn(input!, "setNativeProps")
  for (const renderRow of [receiver(), receiver(), undefined]) {
    await view.rerender(tree({ ref, columns: ownedColumns, render: renderRow }))
    expect(ref.current).toBe(original)
    expect(editor.current).toBe(input)
    expect(screen.getByTestId("row").props.ownerId).toBe(owner)
    expect(screen.getByTestId("row").props.nativeMotionGeometryBinding).not.toBe("")
  }
  expect(write).not.toHaveBeenCalled()
  expect(changed).not.toHaveBeenCalled()
})
it("uses original admitted focus-within observations and retires stale/foreign observations", async () => {
  const ref = createRef<View>(),
    renderRow = receiver()
  const view = await render(tree({ ref, render: renderRow }))
  let sequence = 0
  const within = (origin: string, focused: boolean, extra = {}) => {
    const host = screen.getByTestId("row").props
    return {
      nativeEvent: {
        ownerId: host.ownerId,
        bindingId: host.nativeFocusWithinBinding,
        target: findNodeHandle(ref.current),
        surfaceId: 1,
        windowId: "source-model",
        scopeOwnerId: "",
        scopeEpoch: 0,
        sequence: ++sequence,
        attached: true,
        active: true,
        within: focused,
        focusedTarget: focused ? 999 : 0,
        textInputFocused: focused,
        origin,
        observedAt: 100,
        ...extra,
      },
    }
  }
  const saved = screen.getByTestId("row").props.onNativeFocusWithin
  await act(() => saved(within("keyboard", true)))
  expect(renderRow.mock.calls.at(-1)![1]).toMatchObject({
    isFocused: false,
    isFocusVisible: false,
    isFocusVisibleWithin: true,
  })
  await act(() => saved(within("keyboard", false, { ownerId: "foreign" })))
  expect(renderRow.mock.calls.at(-1)![1].isFocusVisibleWithin).toBe(true)
  await act(() => saved(within("pointer", true)))
  expect(renderRow.mock.calls.at(-1)![1].isFocusVisibleWithin).toBe(false)
  await view.rerender(tree({ ref, render: renderRow }, {}, false))
  expect(renderRow.mock.calls.at(-1)![1].isFocusVisibleWithin).toBe(false)
  await view.unmount()
  renderRow.mockClear()
  saved({ nativeEvent: {} })
  expect(renderRow).not.toHaveBeenCalled()
})
it("preserves original press event objects and canonical callback/action order", async () => {
  const order: string[] = [],
    events: unknown[] = []
  const record = (name: string) => (event: unknown) => {
    order.push(name)
    events.push(event)
  }
  const renderRow = receiver()
  await render(
    tree({
      render: renderRow,
      onPressStart: record("start"),
      onPressUp: record("up"),
      onPressEnd: record("end"),
      onPress: record("press"),
      onPressChange: (value) => order.push(`change:${value}`),
      onAction: () => order.push("action"),
    }),
  )
  await userEvent.setup().press(screen.getByTestId("row"))
  await act(() => {})
  expect(order).toEqual(["start", "change:true", "up", "end", "change:false", "action", "press"])
  expect(events).toHaveLength(4)
  expect(events.every((event) => !!(event as { nativeEvent: unknown }).nativeEvent)).toBe(true)
  expect(renderRow.mock.calls.at(-1)![1].isPressed).toBe(false)
})

it("preserves one caller callback-ref lifetime, aliases and final authored styles", async () => {
  const retire = jest.fn(),
    ref = jest.fn((_view: View | null) => retire)
  const row = {
    ref,
    "data-testid": "alias",
    testID: undefined,
    ariaDescribedBy: "note-one note-two",
    ariaDetails: ["detail"],
    customStyles: { padding: 7 },
    style: { padding: 0 },
  }
  const view = await render(tree(row))
  const original = ref.mock.calls[0][0]
  expect(screen.getByTestId("alias")).toHaveStyle({ padding: 0 })
  expect(screen.getByTestId("alias").props.nativeDescribedBy).toEqual(["note-one", "note-two"])
  expect(screen.getByTestId("alias").props.nativeDetailsBy).toEqual(["detail"])
  await view.rerender(tree({ ...row, render: receiver(), "aria-describedby": "" }))
  expect(ref).toHaveBeenCalledTimes(1)
  expect(ref.mock.calls[0][0]).toBe(original)
  expect(screen.getByTestId("alias").props.nativeDescribedBy).toEqual([])
  expect(retire).not.toHaveBeenCalled()
  await view.unmount()
  expect(retire).toHaveBeenCalledTimes(1)
})

it("forwards original direct-focus and keyboard events through the custom row and retires handlers on unmount", async () => {
  const ref = createRef<View>(),
    focused = jest.fn(),
    keys = jest.fn(),
    renderRow = receiver()
  const view = await render(tree({ ref, render: renderRow, onFocus: focused, onKeyDown: keys }))
  const host = screen.getByTestId("row").props
  const focus = {
    nativeEvent: {
      ownerId: host.ownerId,
      target: findNodeHandle(ref.current),
      isFocused: true,
      isFocusVisible: true,
      origin: "keyboard",
      timestamp: 100,
    },
  }
  await act(() => host.onNativeFocusChange(focus))
  expect(focused).toHaveBeenLastCalledWith(focus)
  expect(renderRow.mock.calls.at(-1)![1]).toMatchObject({ isFocused: true, isFocusVisible: true })
  const event = {
    nativeEvent: {
      kind: "keyboard",
      ownerId: host.ownerId,
      target: findNodeHandle(ref.current),
      key: "ArrowUp",
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
      nativeDefaultHandled: false,
      timestamp: 100,
    },
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    persist: jest.fn(),
    isDefaultPrevented: () => false,
  }
  await act(() => host.onNativeKey(event))
  expect(keys).toHaveBeenCalledTimes(1)
  expect(keys).toHaveBeenCalledWith(event)
  await view.unmount()
  await rawAct(() => host.onNativeKey(event))
  expect(keys).toHaveBeenCalledTimes(1)
})
