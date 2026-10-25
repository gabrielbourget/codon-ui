import "../../../collection/__tests__/nativeReceipts"

import { act as rawAct, cleanup } from "@testing-library/react-native"
import { createRef } from "react"
import type { Ref } from "react"
import { findNodeHandle, TextInput, type View } from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { nativeKeyTokens } from "../../../input/keyScope"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeThemeProvider } from "../../../theme"
import { Table } from "../Table"
import { TableCell } from "../TableCell"
import { TableHeader } from "../TableHeader"
import { TableRow } from "../TableRow"
import type { TNativeTableCellProps, TNativeTableCellRenderState } from "../types"

import { CellFixtureBody, CellFixtureRow } from "./fixtures/TableCellFixture"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
afterEach(cleanup)
const columns = [{ id: "value", name: "Value", isRowHeader: true }]
type TOptions = {
  ref?: Ref<View>
  editor?: Ref<TextInput>
  render?: TNativeTableCellProps["render"]
  children?: TNativeTableCellProps["children"]
  selected?: boolean
  disabled?: boolean
  active?: boolean
}
const tree = (options: TOptions = {}) => (
  <NativeThemeProvider>
    <NativeFloatingWindowContext.Provider value={() => options.active !== false}>
      <Table
        selectionMode="multiple"
        selectionBehavior="replace"
        selectedKeys={new Set(options.selected ? [0] : [])}
        disabledKeys={options.disabled ? [0] : []}
      >
        <TableHeader columns={columns} />
        <CellFixtureBody>
          <CellFixtureRow id={0}>
            <TableCell
              ref={options.ref}
              id="cell"
              columnID="value"
              testID="cell"
              customStyles={{ padding: 7 }}
              style={{ padding: 9 }}
              render={options.render}
            >
              {options.children ?? (
                <TextInput ref={options.editor} testID="held" value="" selection={{ start: 0, end: 0 }} />
              )}
            </TableCell>
          </CellFixtureRow>
        </CellFixtureBody>
      </Table>
    </NativeFloatingWindowContext.Provider>
  </NativeThemeProvider>
)
const packet = (type: "mouse" | "touch" = "mouse") => ({ nativeEvent: { pointerType: type }, persist: jest.fn() })

it("provides live raw cell render values while retaining defaultChildren only for the children function", async () => {
  const ref = createRef<View>()
  const child = jest.fn((state: TNativeTableCellRenderState) => `Selected ${state.isSelected}`)
  const receiver = jest.fn<
    ReturnType<NonNullable<TNativeTableCellProps["render"]>>,
    Parameters<NonNullable<TNativeTableCellProps["render"]>>
  >((props, state) => <NativeFocusView {...props} style={[props.style, { opacity: state.isSelected ? 1 : 0.5 }]} />)
  const view = await render(tree({ ref, children: child, render: receiver, selected: true }))
  const values = () => receiver.mock.calls.at(-1)![1]
  expect(values()).toEqual({
    isPressed: false,
    isFocused: false,
    isFocusVisible: false,
    isHovered: false,
    isSelected: true,
    isDisabled: false,
    id: "cell",
    columnIndex: 0,
    isTreeColumn: false,
    isExpanded: false,
    hasChildItems: false,
    level: 1,
  })
  expect(child.mock.calls.at(-1)![0].defaultChildren).toBeUndefined()
  expect(Object.hasOwn(values(), "defaultChildren")).toBe(false)
  expect(screen.getByTestId("cell")).toHaveStyle({ padding: 9, opacity: 1 })
  const original = ref.current
  await act(() => screen.getByTestId("cell").props.onPointerEnter(packet()))
  expect(values().isHovered).toBe(true)
  const host = screen.getByTestId("cell")
  await act(() =>
    host.props.onNativeFocusChange({
      nativeEvent: {
        ownerId: host.props.ownerId,
        target: findNodeHandle(original),
        isFocused: true,
        isFocusVisible: true,
      },
    }),
  )
  expect(values()).toMatchObject({ isFocused: true, isFocusVisible: true })
  await view.rerender(tree({ ref, children: child, render: receiver, disabled: true }))
  expect(values()).toMatchObject({ isSelected: false, isDisabled: true })
  expect(ref.current).toBe(original)
  const semantics = JSON.parse(screen.getByTestId("cell").props.nativeCollectionSemantics)
  expect(semantics).toMatchObject({ kind: "cell", rowIndex: 1, columnIndex: 0, columnSpan: 1, selected: false })
  expect(semantics.columnHeaderTargets).toHaveLength(1)
  expect(screen.getByTestId("cell").props.nativeCollectionBinding).not.toBe("")
  expect(screen.getByTestId("cell").props.render).toBeUndefined()
})

it("retains the original cell, owner and held editor when adding and replacing its render callback", async () => {
  const ref = createRef<View>(),
    editor = createRef<TextInput>()
  const first: NonNullable<TNativeTableCellProps["render"]> = (props) => (
    <NativeFocusView {...props} style={[props.style, { opacity: 0.8 }]} />
  )
  const second: NonNullable<TNativeTableCellProps["render"]> = (props) => (
    <NativeFocusView {...props} style={[props.style, { opacity: 0 }]} />
  )
  const view = await render(tree({ ref, editor }))
  const original = ref.current,
    originalEditor = editor.current!,
    owner = screen.getByTestId("cell").props.ownerId
  const write = jest.spyOn(originalEditor, "setNativeProps")
  await view.rerender(tree({ ref, editor, render: first }))
  expect(ref.current).toBe(original)
  expect(editor.current).toBe(originalEditor)
  await view.rerender(tree({ ref, editor, render: second }))
  expect(screen.getByTestId("cell")).toHaveStyle({ opacity: 0 })
  expect(screen.getByTestId("cell").props.ownerId).toBe(owner)
  expect(ref.current).toBe(original)
  expect(editor.current).toBe(originalEditor)
  expect(screen.getByTestId("held").props).toMatchObject({ value: "", selection: { start: 0, end: 0 } })
  expect(write).not.toHaveBeenCalled()
  expect(screen.getByTestId("cell").props.capturedKeys).toContain(nativeKeyTokens("ArrowUp")[0])
})

it("retains callback-ref cleanup and retires renderer hover on window loss and unmount", async () => {
  const cleanupRef = jest.fn(),
    ref = jest.fn((_target: View | null) => cleanupRef)
  const receiver = jest.fn<
    ReturnType<NonNullable<TNativeTableCellProps["render"]>>,
    Parameters<NonNullable<TNativeTableCellProps["render"]>>
  >((props) => <NativeFocusView {...props} />)
  const view = await render(tree({ ref, render: receiver }))
  await act(() => screen.getByTestId("cell").props.onPointerEnter(packet()))
  expect(receiver.mock.calls.at(-1)![1].isHovered).toBe(true)
  const stale = screen.getByTestId("cell").props.onPointerEnter
  await view.rerender(tree({ ref, render: receiver, active: false }))
  expect(receiver.mock.calls.at(-1)![1].isHovered).toBe(false)
  await view.unmount()
  expect(cleanupRef).toHaveBeenCalledTimes(1)
  const calls = receiver.mock.calls.length
  await rawAct(() => stale(packet()))
  expect(receiver).toHaveBeenCalledTimes(calls)
})

it("forwards the original native key event through a custom cell root and ignores it after teardown", async () => {
  const ref = createRef<View>(),
    observed = jest.fn()
  const receiver: NonNullable<TNativeTableCellProps["render"]> = (props) => (
    <NativeFocusView
      {...props}
      onKeyDown={(event) => {
        observed(event)
        props.onKeyDown?.(event)
      }}
    />
  )
  const view = await render(tree({ ref, render: receiver }))
  const host = screen.getByTestId("cell")
  const event = {
    nativeEvent: {
      kind: "keyboard",
      ownerId: host.props.ownerId,
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
  await act(() => host.props.onNativeKey(event))
  expect(observed).toHaveBeenCalledTimes(1)
  expect(observed).toHaveBeenCalledWith(event)
  const retained = host.props.onNativeKey
  await view.unmount()
  await rawAct(() => retained(event))
  expect(observed).toHaveBeenCalledTimes(1)
})

it("keeps the same consumer row ref attached while its metadata and cell content update", async () => {
  const cleanupRef = jest.fn(),
    rowRef = jest.fn((_target: View | null) => cleanupRef)
  const item = { value: "Original" }
  const content = (label: string) => (
    <NativeThemeProvider>
      <Table>
        <TableHeader columns={columns} />
        <CellFixtureBody>
          <TableRow ref={rowRef} id="row" item={item} columns={columns} renderCell={() => label} />
        </CellFixtureBody>
      </Table>
    </NativeThemeProvider>
  )
  const view = await render(content("Original"))
  const original = rowRef.mock.calls[0][0]
  await view.rerender(content("Changed"))
  expect(screen.getByText("Changed")).toBeOnTheScreen()
  expect(rowRef).toHaveBeenCalledTimes(1)
  expect(rowRef).toHaveBeenCalledWith(original)
  expect(cleanupRef).not.toHaveBeenCalled()
  await view.unmount()
  expect(cleanupRef).toHaveBeenCalledTimes(1)
})
