import { useCallback, useContext, useId, useRef, type ForwardedRef } from "react"
import { Platform, type PointerEvent, type View } from "react-native"

import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { createNativeCollectionBranch } from "../../collection/CollectionBuilder"
import { useNativeCollectionRefs } from "../../collection/context"
import { NativeCollectionRendererContext } from "../../collection/renderer"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import { nativeKeyTokens } from "../../input/keyScope"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { nativeViewProps } from "../../input/nativeViewProps"
import type { TNativePressEvent } from "../../input/types"
import { useNativeTheme } from "../../theme"
import { NativeButton } from "../Button/Button"
import { encodeCollectionKey } from "../collection"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"
import {
  getNativeTagGroupActionState,
  getNativeTagGroupPressIntent,
  getNativeTagGroupSelectionOperation,
  NATIVE_TAG_GROUP_POINTER_TYPES,
} from "../TagGroup/intent"

import { NativeTableOptionsContext, useNativeTable } from "./context"
import { getNativeTableColumns, renderNativeTableValue } from "./rendering"
import { TableSelectionCheckbox } from "./SelectionCheckbox"
import { TableCell } from "./TableCell"
import type { TNativeTableRowComponent, TNativeTableRowProps } from "./types"
import { useTableAction } from "./useTableAction"

const Row = (props: TNativeTableRowProps<object>, ref: ForwardedRef<View>, node: TNativeCollectionNode<object>) => {
  const {
    id: _id,
    textValue: _textValue,
    item: _item,
    columns: _columns,
    renderCell: _render,
    geometry: _geometry,
    dependencies: _deps,
    style,
    customStyles,
    isDisabled: _disabled,
    onAction: _action,
    ...native
  } = props
  const table = useNativeTable()
  const content = useNativeContentContext()
  const theme = useNativeTheme()
  const renderer = useContext(NativeCollectionRendererContext)
  const ordinal = table.rows.findIndex((row) => row.key === node.key)
  const original = useRef<View | null>(null)
  const keyboardRef = useCallback(
    (view: View | null) => table.keyboard.register(node, view),
    [node, table.keyboard.register],
  )
  const keyboardTargetRef = useNativeCollectionRefs(original, keyboardRef)
  const boundRef = useNativeCollectionRefs(ref, keyboardTargetRef)
  const action = useTableAction(node, original)
  const state = getNativeTagGroupActionState({
    mode: table.manager.canSelectItem(node.key) ? table.manager.selectionMode : "none",
    behavior: table.manager.selectionBehavior,
    isEmpty: table.manager.isEmpty,
    isDisabled: table.manager.isDisabled(node.key),
    hasAction: !!(table.onRowAction || props.onAction),
    isLink: false,
  })
  type TPointer = (typeof NATIVE_TAG_GROUP_POINTER_TYPES)[number]
  type TMetadata = {
    pointerType: TPointer
    key?: string
    shiftKey: boolean
    selectionModifier: boolean
    nonContiguousModifier: boolean
    suppressed?: boolean
  }
  const pointer = useRef<TMetadata | null>(null)
  const cycle = useRef<{ binding: string; primary: boolean; long: boolean } | null>(null)
  const lastMouse = useRef<number | null>(null)
  const metadata = (event: TNativePressEvent): TMetadata => {
    const data = event.nativeEvent
    if ("kind" in data)
      return data.kind === "keyboard"
        ? {
            pointerType: "keyboard",
            key: data.key,
            shiftKey: data.shiftKey,
            selectionModifier: Platform.OS === "ios" ? data.metaKey : data.ctrlKey,
            nonContiguousModifier: Platform.OS === "ios" ? data.altKey : data.ctrlKey,
          }
        : { pointerType: "virtual", shiftKey: false, selectionModifier: false, nonContiguousModifier: false }
    return (
      pointer.current ?? {
        pointerType: "identifier" in data ? "touch" : "unknown",
        shiftKey: false,
        selectionModifier: false,
        nonContiguousModifier: false,
      }
    )
  }
  const press = (phase: "start" | "release" | "long" | "double", event: TNativePressEvent) => {
    const source = metadata(event)
    const origin = cycle.current
    if (origin?.binding !== action.binding || event.defaultPrevented || event.isDefaultPrevented?.()) return
    event.persist?.()
    action.request((current, row) => {
      if (event.defaultPrevented || event.isDefaultPrevented?.()) return
      const manager = current.manager
      const available = getNativeTagGroupActionState({
        mode: manager.canSelectItem(row.key) ? manager.selectionMode : "none",
        behavior: manager.selectionBehavior,
        isEmpty: manager.isEmpty,
        isDisabled: manager.isDisabled(row.key),
        hasAction: !!(current.onRowAction || row.props.onAction),
        isLink: false,
      })
      const intent = getNativeTagGroupPressIntent(available, {
        phase,
        pointerType: source.pointerType,
        key: source.key,
        shouldSelectOnPressUp: false,
        primaryAtStart: origin.primary,
        suppressed: source.suppressed || (phase === "release" && origin.long),
      })
      if (intent.select) {
        const operation = getNativeTagGroupSelectionOperation({
          mode: manager.selectionMode,
          behavior: manager.selectionBehavior,
          pointerType: source.pointerType,
          isSelected: manager.isSelected(row.key),
          disallowEmptySelection: manager.disallowEmptySelection,
          shiftKey: source.shiftKey,
          selectionModifier: source.selectionModifier,
          nonContiguousModifier: source.nonContiguousModifier,
        })
        if (operation === "toggle") manager.toggleSelection(row.key)
        else if (operation === "extend") manager.extendSelection(row.key)
        else manager.replaceSelection(row.key)
      }
      if (intent.enterToggle) manager.setSelectionBehavior("toggle")
      if (intent.action) {
        row.props.onAction?.()
        current.onRowAction?.(row.key)
      }
    })
  }
  const styles = splitNativeTextStyle(
    resolveNativeStyle(
      [
        { flexDirection: "row", backgroundColor: table.zebra && ordinal % 2 === 1 ? table.zebraColor : "transparent" },
        customStyles,
        style,
      ],
      "TableRow",
      "style",
    ),
  )
  return (
    <NativeCollectionItemBindingContext.Provider value={action.binding}>
      <NativeButton
        {...nativeViewProps(native)}
        ref={boundRef}
        testID={native.testID ?? `table-row-${encodeCollectionKey(node.key)}`}
        nativeRole="row"
        nativeAccessible={false}
        nativeInteraction={state.allowsSelection || state.hasAction}
        nativeProgrammaticFocusable
        onKeyDown={table.keyboard.captureTypeahead}
        nativeRender={(props) => (
          <NativeFocusHost
            {...props}
            capturedKeys={[
              ...table.keyboard.keysFor(node.key),
              ...(state.allowsSelection || state.hasAction ? ["Enter", " "].flatMap(nativeKeyTokens) : []),
            ]}
            onKeyDown={(event) => {
              props.onKeyDown?.(event)
              table.keyboard.onKeyDown(event)
            }}
          />
        )}
        nativeTabStop={table.manager.focusedKey === node.key}
        isDisabled={table.manager.isDisabled(node.key)}
        accessibilityState={{
          ...native.accessibilityState,
          selected: table.manager.selectionMode === "none" ? undefined : table.manager.isSelected(node.key),
        }}
        nativeStyle={(flags, visible) => ({
          viewStyle: {
            ...(flags.isFocused ? { outlineWidth: visible ? 2 : 1.5, outlineColor: theme.colors.focusRing } : {}),
            ...styles.view,
          },
          textStyle: styles.text,
          foregroundColor: styles.text.color ?? content!.foregroundColor,
          target: 0,
        })}
        onFocus={(event) => {
          table.keyboard.observe(node.key, event)
          native.onFocus?.(event)
        }}
        onPointerDown={(event: PointerEvent) => {
          native.onPointerDown?.(event)
          const data = event.nativeEvent
          pointer.current = {
            pointerType: NATIVE_TAG_GROUP_POINTER_TYPES.includes(data.pointerType as TPointer)
              ? (data.pointerType as TPointer)
              : "unknown",
            shiftKey: data.shiftKey,
            selectionModifier: Platform.OS === "ios" ? data.metaKey : data.ctrlKey,
            nonContiguousModifier: Platform.OS === "ios" ? data.altKey : data.ctrlKey,
            suppressed: event.defaultPrevented || event.isDefaultPrevented?.(),
          }
        }}
        onPressStart={(event) => {
          cycle.current = { binding: action.binding, primary: state.hasPrimaryAction, long: false }
          press("start", event)
        }}
        onPress={(event) => {
          press("release", event)
          const data = metadata(event)
          const time = "timestamp" in event.nativeEvent ? event.nativeEvent.timestamp : undefined
          if (data.pointerType === "mouse" && typeof time === "number") {
            if (lastMouse.current != null && time >= lastMouse.current && time - lastMouse.current <= 500) {
              press("double", event)
              lastMouse.current = null
            } else lastMouse.current = time
          }
        }}
        onLongPress={(event) => {
          if (cycle.current && metadata(event).pointerType === "touch" && state.longPressEnabled)
            cycle.current.long = true
          press("long", event)
        }}
      >
        <NativeContentContext.Provider
          value={{ foregroundColor: styles.text.color ?? content!.foregroundColor, isButton: false }}
        >
          <renderer.CollectionBranch collection={table.collection} parent={node} />
        </NativeContentContext.Provider>
      </NativeButton>
    </NativeCollectionItemBindingContext.Provider>
  )
}
export const TableRow = createNativeCollectionBranch<object, TNativeTableRowProps<object>, View>(
  "item",
  Row,
  (props) => {
    const generated = useId()
    const theme = useNativeTheme()
    const options = useContext(NativeTableOptionsContext)
    const columns = getNativeTableColumns(props.columns)
    const radius = props.geometry === "orthogonal" ? 0 : props.geometry === "round" ? 10000 : theme.radius.rounded
    return (
      <>
        {options.behavior === "toggle" && (
          <TableCell
            id={`${encodeCollectionKey(props.id ?? generated)}:__selection`}
            columnID="__selection"
            style={{ width: 30, padding: 0, borderTopLeftRadius: radius, borderBottomLeftRadius: radius }}
          >
            <TableSelectionCheckbox />
          </TableCell>
        )}
        {columns.map((column, index) => (
          <TableCell
            key={column.id}
            id={`${encodeCollectionKey(props.id ?? generated)}:${column.id}`}
            columnID={column.id}
            alignment={column.alignment}
            customStyles={[
              {
                width: column.width,
                minWidth: column.minWidth,
                maxWidth: column.maxWidth,
                borderTopLeftRadius: index === 0 && options.behavior !== "toggle" ? radius : 0,
                borderBottomLeftRadius: index === 0 && options.behavior !== "toggle" ? radius : 0,
                borderTopRightRadius: index === columns.length - 1 ? radius : 0,
                borderBottomRightRadius: index === columns.length - 1 ? radius : 0,
              },
              column.customBodyCellStyles,
            ]}
          >
            {column.cellRenderer
              ? column.cellRenderer({ row: props.item, column })
              : (props.renderCell ?? renderNativeTableValue)({ row: props.item, column })}
          </TableCell>
        ))}
      </>
    )
  },
) as TNativeTableRowComponent
