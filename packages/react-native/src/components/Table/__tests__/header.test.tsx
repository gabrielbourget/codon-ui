import "../../../collection/__tests__/nativeReceipts"

import { act as rawAct, cleanup } from "@testing-library/react-native"
import { createRef, useContext, type ReactNode } from "react"
import { AccessibilityInfo, TextInput, View, type MouseEvent, type PointerEvent } from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { createNativeCollectionBranch } from "../../../collection/CollectionBuilder"
import { NativeCollectionRendererContext } from "../../../collection/renderer"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeThemeProvider } from "../../../theme"
import { useNativeTable } from "../context"
import { Table } from "../Table"
import { TableHeader } from "../TableHeader"
import { TableRow } from "../TableRow"
import type { TNativeTableHeaderProps, TNativeTableProps, TNativeTableRowProps } from "../types"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
beforeEach(() => jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true))
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
})
const Body = createNativeCollectionBranch<object, { children?: ReactNode }, View>(
  "body",
  (_props, ref, parent) => {
    const table = useNativeTable(),
      renderer = useContext(NativeCollectionRendererContext)
    return (
      <View ref={ref}>
        <renderer.CollectionBranch collection={table.collection} parent={parent} />
      </View>
    )
  },
  (props) => props.children,
)
const columns = [{ id: "name", name: "Name", isRowHeader: true }]
const tree = (
  header: Partial<TNativeTableHeaderProps<object>> = {},
  row: Partial<TNativeTableRowProps<{ name: string }>> = {},
  table: TNativeTableProps = {},
  active = true,
) => (
  <NativeThemeProvider>
    <NativeFloatingWindowContext.Provider value={() => active}>
      <Table hoverColor="#abcdef" {...table}>
        <TableHeader testID="header" columns={columns} {...header} />
        <Body>
          <TableRow id="a" testID="row" columns={columns} item={{ name: "Alpha" }} {...row} />
        </Body>
      </Table>
    </NativeFloatingWindowContext.Provider>
  </NativeThemeProvider>
)
const pointer = (pointerType = "mouse") => {
  let prevented = false
  return {
    nativeEvent: { pointerType, pageX: 20, pageY: 30 },
    persist: jest.fn(),
    preventDefault: () => {
      prevented = true
    },
    isDefaultPrevented: () => prevented,
  } as unknown as PointerEvent
}
const enter = async (id: string, event = pointer()) => act(() => screen.getByTestId(id).props.onPointerEnter(event))
const leave = async (id: string, event = pointer()) => act(() => screen.getByTestId(id).props.onPointerLeave(event))

it.each(["mouse", "pen"])(
  "renders live header %s hover and preserves original refs, events, columns and editor",
  async (type) => {
    const headerRef = createRef<View>(),
      editor = createRef<TextInput>()
    const order: string[] = []
    const start = jest.fn((event: MouseEvent) => {
      order.push("start")
      expect(event).toBe(original)
    })
    const end = jest.fn((event: MouseEvent) => {
      order.push("end")
      expect(event).toBe(original)
    })
    const original = pointer(type)
    const renderer: NonNullable<TNativeTableHeaderProps<object>["render"]> = (props, state) => (
      <View {...props} style={[props.style, { opacity: state.isHovered ? 0.5 : 1 }]}>
        {props.children}
        <TextInput ref={editor} testID="header-editor" value="held" />
      </View>
    )
    await render(
      <NativeThemeProvider>
        <Table>
          <TableHeader
            ref={headerRef}
            testID="header"
            columns={columns}
            render={renderer}
            onPointerEnter={(event) => {
              order.push("pointer-enter")
              event.preventDefault()
            }}
            onPointerLeave={() => order.push("pointer-leave")}
            onHoverStart={start}
            onHoverEnd={end}
            onHoverChange={(value) => order.push(`change:${value}`)}
            customStyles={{ padding: 7 }}
            style={{ padding: 9 }}
          />
        </Table>
      </NativeThemeProvider>,
    )
    const originalHeader = headerRef.current,
      originalEditor = editor.current!
    const write = jest.spyOn(originalEditor, "setNativeProps")
    expect(originalHeader).not.toBeNull()
    expect(screen.getByTestId("header")).toHaveStyle({ padding: 9, opacity: 1 })
    await enter("header", original)
    await enter("header", original)
    expect(screen.getByTestId("header")).toHaveStyle({ padding: 9, opacity: 0.5 })
    await leave("header", original)
    expect(screen.getByTestId("header")).toHaveStyle({ opacity: 1 })
    expect(order).toEqual([
      "pointer-enter",
      "start",
      "change:true",
      "pointer-enter",
      "pointer-leave",
      "end",
      "change:false",
    ])
    expect(headerRef.current).toBe(originalHeader)
    expect(editor.current).toBe(originalEditor)
    expect(write).not.toHaveBeenCalled()
    expect(screen.getByTestId("header-editor").props.value).toBe("held")
    expect(screen.getByText("Name")).toBeOnTheScreen()
    for (const prop of ["render", "onHoverStart", "onHoverEnd", "onHoverChange"])
      expect(screen.getByTestId("header").props[prop]).toBeUndefined()
  },
)

it("ignores touch entry/leave without cancelling an existing mouse hover", async () => {
  const start = jest.fn(),
    end = jest.fn(),
    change = jest.fn()
  await render(tree({ onHoverStart: start, onHoverEnd: end, onHoverChange: change }))
  await enter("header", pointer("touch"))
  expect(start).not.toHaveBeenCalled()
  await enter("header")
  await leave("header", pointer("touch"))
  expect(end).not.toHaveBeenCalled()
  await leave("header")
  await leave("header")
  expect(start).toHaveBeenCalledTimes(1)
  expect(end).toHaveBeenCalledTimes(1)
  expect(change.mock.calls).toEqual([[true], [false]])
})

it("uses current callbacks for window retirement and admits no stale hover after unmount", async () => {
  const start = jest.fn(),
    oldEnd = jest.fn(),
    currentEnd = jest.fn(),
    change = jest.fn()
  const original = pointer()
  const view = await render(tree({ onHoverStart: start, onHoverEnd: oldEnd, onHoverChange: change }))
  await enter("header", original)
  const retained = screen.getByTestId("header").props.onPointerEnter
  await view.rerender(tree({ onHoverStart: start, onHoverEnd: currentEnd, onHoverChange: change }))
  await view.rerender(tree({ onHoverStart: start, onHoverEnd: currentEnd, onHoverChange: change }, {}, {}, false))
  expect(oldEnd).not.toHaveBeenCalled()
  expect(currentEnd).toHaveBeenCalledTimes(1)
  expect(currentEnd).toHaveBeenCalledWith(original)
  expect(change.mock.calls).toEqual([[true], [false]])
  await view.unmount()
  await rawAct(() => retained(original))
  expect(start).toHaveBeenCalledTimes(1)
  expect(currentEnd).toHaveBeenCalledTimes(1)
})
