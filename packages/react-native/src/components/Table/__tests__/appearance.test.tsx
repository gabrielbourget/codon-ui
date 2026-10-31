import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { useContext, type ReactNode } from "react"
import { AccessibilityInfo, Animated, StyleSheet, View, processColor } from "react-native"
import type { PointerEvent } from "react-native"

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
import type { TNativeTableProps, TNativeTableRowProps } from "../types"

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
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(async () => {
  await cleanup()
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})
const flush = async (duration: number) => act(() => jest.advanceTimersByTime(duration))
const appearanceColumns = [{ id: "name", name: "Name", isRowHeader: true }]
const appearanceTree = (
  table: TNativeTableProps = {},
  row: Partial<TNativeTableRowProps<{ name: string }>> = {},
  active = true,
) => (
  <NativeThemeProvider>
    <NativeFloatingWindowContext.Provider value={() => active}>
      <Table {...table}>
        <TableHeader columns={appearanceColumns} />
        <Body>
          <TableRow id="a" testID="first" item={{ name: "Alpha" }} columns={appearanceColumns} {...row} />
          <TableRow id="b" testID="second" item={{ name: "Beta" }} columns={appearanceColumns} />
        </Body>
      </Table>
    </NativeFloatingWindowContext.Provider>
  </NativeThemeProvider>
)
const background = (id = "first") =>
  processColor(StyleSheet.flatten(screen.getByTestId(id).props.style).backgroundColor)
const pointer = (pointerType = "mouse") =>
  ({ nativeEvent: { pointerType, pageX: 20, pageY: 30 }, persist: jest.fn() }) as unknown as PointerEvent
const hover = async (inside: boolean, id = "first", event = pointer()) => {
  await act(() => screen.getByTestId(id).props[inside ? "onPointerEnter" : "onPointerLeave"](event))
}

it("animates passive row hover over 250ms and reverses immediately on leave even while pressed", async () => {
  const enter = jest.fn(),
    leave = jest.fn(),
    original = pointer()
  await render(appearanceTree({ hoverColor: "#204060" }, { onPointerEnter: enter, onPointerLeave: leave }))
  expect(screen.getByTestId("table").props.hoverColor).toBeUndefined()
  expect(background()).toBe(processColor("transparent"))
  await hover(true, "first", original)
  await flush(0)
  await flush(125)
  expect(background()).not.toBe(processColor("transparent"))
  expect(background()).not.toBe(processColor("#204060"))
  await flush(130)
  expect(background()).toBe(processColor("#204060"))
  await act(() => screen.getByTestId("first").props.onPointerDown?.(original))
  await hover(false, "first", original)
  await flush(130)
  await flush(300)
  expect(background()).toBe(processColor("transparent"))
  expect(enter).toHaveBeenCalledWith(original)
  expect(leave).toHaveBeenCalledWith(original)
})

it("preserves canonical even-row zebra specificity and custom/final inline row precedence", async () => {
  await render(
    appearanceTree(
      { hoverColor: "#204060", zebra: true, zebraColor: "#8090a0" },
      { customStyles: { backgroundColor: "#aabbcc" }, style: { backgroundColor: "#112233" } },
    ),
  )
  await hover(true)
  await hover(true, "second")
  await flush(0)
  await flush(300)
  expect(background()).toBe(processColor("#112233"))
  expect(background("second")).toBe(processColor("#8090a0"))
})

it("ignores touch hover, retains disabled row hover and follows a current root color update", async () => {
  const tree = (color: string) => appearanceTree({ hoverColor: color, disabledKeys: ["a"] })
  const view = await render(tree("#204060"))
  await hover(true, "first", pointer("touch"))
  await flush(0)
  await flush(300)
  expect(background()).toBe(processColor("transparent"))
  await hover(true)
  await flush(300)
  await flush(300)
  expect(background()).toBe(processColor("#204060"))
  await view.rerender(tree("#aabbcc"))
  await flush(300)
  await flush(300)
  expect(background()).toBe(processColor("#aabbcc"))
})

it("retires hover when the row window becomes inactive and requires a new pointer entry", async () => {
  const view = await render(appearanceTree({ hoverColor: "#204060" }))
  await hover(true)
  await flush(0)
  await flush(300)
  expect(background()).toBe(processColor("#204060"))
  await view.rerender(appearanceTree({ hoverColor: "#204060" }, {}, false))
  await flush(300)
  await flush(300)
  expect(background()).toBe(processColor("transparent"))
  await view.rerender(appearanceTree({ hoverColor: "#204060" }))
  await flush(300)
  expect(background()).toBe(processColor("transparent"))
})

it("uses source paint timings and applies Reduce Motion without starting a color animation", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const view = await render(appearanceTree({ hoverColor: "#204060" }, { style: { color: "#112233" } }))
  timing.mockClear()
  await hover(true)
  expect(timing).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ duration: 250, delay: 0, useNativeDriver: false, isInteraction: false }),
  )
  await view.rerender(appearanceTree({ hoverColor: "#204060" }, { style: { color: "#aabbcc" } }))
  expect(timing).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ duration: 350, delay: 0, useNativeDriver: false, isInteraction: false }),
  )
  await cleanup()
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true)
  await render(appearanceTree({ hoverColor: "#204060" }))
  timing.mockClear()
  await hover(true)
  expect(background()).toBe(processColor("#204060"))
  expect(timing).not.toHaveBeenCalled()
})
