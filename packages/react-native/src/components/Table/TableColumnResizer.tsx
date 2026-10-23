import { useContext, useInsertionEffect, useRef } from "react"
import { findNodeHandle, View, type GestureResponderEvent } from "react-native"

import { nativeKeyTokens } from "../../input/keyScope"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeKeyboardEvent } from "../../input/types"
import { useNativeTheme } from "../../theme"
import { NativeButton } from "../Button/Button"

import { NativeTableCellContext, useNativeTable } from "./context"
import { resizeNativeTableColumn } from "./resizing"
import { TableKeyPolicy } from "./TableCellKeys"
import type { TNativeTableColumnMetadata, TNativeTableColumnResizingControls } from "./types"
import { useTableAction } from "./useTableAction"

const arrowKeys = [...nativeKeyTokens("ArrowLeft"), ...nativeKeyTokens("ArrowRight")]
const activationKeys = [...nativeKeyTokens("Enter"), ...nativeKeyTokens(" ")]
type TResizeCycle = {
  startX: number
  width: number
  column: TNativeTableColumnMetadata<object>
  controls: TNativeTableColumnResizingControls
  header: View
  handle: View
  cancelled: boolean
}
export const TableColumnResizer = ({ column }: { column: TNativeTableColumnMetadata<object> }) => {
  const table = useNativeTable()
  const scope = useNativeKeyScope()
  const cell = useContext(NativeTableCellContext)!
  const action = useTableAction(cell.node, cell.target)
  const handle = useRef<View | null>(null)
  const cycles = useRef(new Map<string, TResizeCycle>())
  const current = useRef({ column, table, cell, action })
  useInsertionEffect(() => {
    current.current = { column, table, cell, action }
  })
  const retire = () => {
    for (const cycle of cycles.current.values()) cycle.cancelled = true
    cycles.current.clear()
  }
  useInsertionEffect(() => retire, [])
  const theme = useNativeTheme()
  const points = (event: GestureResponderEvent) =>
    event.nativeEvent.changedTouches?.length ? event.nativeEvent.changedTouches : [event.nativeEvent]
  const start = (event: GestureResponderEvent) => {
    const owner = current.current
    const controls = owner.table.columnResizing
    if (!controls?.enabled || !owner.action.isActive() || !owner.cell.target.current || !handle.current) return
    event.preventDefault()
    event.stopPropagation()
    for (const point of points(event)) {
      if (!Number.isFinite(point.pageX)) continue
      if (Number(point.target ?? event.nativeEvent.target) !== findNodeHandle(handle.current)) continue
      const id = String(point.identifier ?? 0)
      if (cycles.current.has(id)) continue
      cycles.current.set(id, {
        startX: point.pageX,
        width: owner.cell.width.current ?? (typeof owner.column.width === "number" ? owner.column.width : 0),
        column: owner.column,
        controls,
        header: owner.cell.target.current,
        handle: handle.current,
        cancelled: false,
      })
    }
  }
  const move = (event: GestureResponderEvent) => {
    const owner = current.current
    if (!owner.action.isActive()) {
      retire()
      return
    }
    for (const point of points(event)) {
      if (!Number.isFinite(point.pageX)) continue
      for (const cycle of cycles.current.values()) {
        if (cycle.header !== owner.cell.target.current || cycle.handle !== handle.current) {
          cycle.cancelled = true
          continue
        }
        owner.action.request(
          () => {
            if (
              !cycle.cancelled &&
              cycle.header === current.current.cell.target.current &&
              cycle.handle === handle.current
            )
              resizeNativeTableColumn(cycle.column, cycle.controls, cycle.width + point.pageX - cycle.startX)
          },
          () => {
            cycle.cancelled = true
            retire()
          },
        )
      }
    }
  }
  const onResizeKey = (event: TNativeKeyboardEvent) => {
    const data = event.nativeEvent
    const target = "focusedTarget" in data ? data.focusedTarget : data.target
    if (
      data.phase !== "down" ||
      !data.nativeDefaultHandled ||
      data.cancelled ||
      !current.current.action.isActive() ||
      target !== findNodeHandle(handle.current)
    )
      return
    if (
      (data.key !== "ArrowLeft" && data.key !== "ArrowRight") ||
      !current.current.table.canResizeWithKeyboard(current.current.column.id)
    )
      return
    event.preventDefault()
    event.stopPropagation()
    const width = current.current.cell.width.current
    current.current.action.request((next) =>
      next.resizeWithKeyboard(current.current.column.id, width, data.key === "ArrowLeft" ? -16 : 16),
    )
  }
  return (
    <NativeButton
      ref={handle}
      nativeTabStop
      testID={`table-column-resizer-${column.id}`}
      accessibilityLabel={`Resize ${column.name ?? column.id} column`}
      onKeyDown={onResizeKey}
      onPress={(event) => {
        if (!("kind" in event.nativeEvent) || event.nativeEvent.kind !== "keyboard") return
        current.current.action.request((next, node) => {
          if (node.props.allowsSorting) next.sortColumn(current.current.column.id)
        })
      }}
      nativeRender={(props) => (
        <NativeFocusHost
          {...props}
          capturedKeys={
            !scope && table.canResizeWithKeyboard(column.id) ? [...activationKeys, ...arrowKeys] : activationKeys
          }
          onStartShouldSetResponder={() =>
            current.current.action.isActive() && !!current.current.table.columnResizing?.enabled
          }
          onResponderGrant={start}
          onResponderStart={start}
          onResponderMove={move}
          onResponderEnd={() => cycles.current.clear()}
          onResponderRelease={() => cycles.current.clear()}
          onResponderTerminate={retire}
          onResponderTerminationRequest={() => cycles.current.size === 0}
        />
      )}
      nativeStyle={(flags, visible) => ({
        viewStyle: {
          position: "absolute",
          top: 5,
          bottom: 5,
          end: -4,
          width: 8,
          padding: 0,
          borderWidth: 0,
          borderRadius: 9999,
          backgroundColor: "transparent",
          zIndex: 2,
          ...(flags.isFocused && visible
            ? { outlineWidth: 2, outlineOffset: 2, outlineColor: theme.colors.focusRing }
            : {}),
        },
        textStyle: {},
        foregroundColor: theme.colors.controlForeground,
        target: 0,
      })}
    >
      {(state) => (
        <>
          <TableKeyPolicy
            target={handle}
            lifetimeKey={action.binding}
            tokens={arrowKeys}
            isEnabled={table.canResizeWithKeyboard(column.id)}
            excludeEditable
            excludeComposing
            canAct={action.isActive}
            onKey={onResizeKey}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              start: "50%",
              width: 1,
              backgroundColor: theme.colors.controlForeground,
              opacity: state.isHovered || state.isFocusVisible ? 0.4 : 0,
            }}
          />
        </>
      )}
    </NativeButton>
  )
}
