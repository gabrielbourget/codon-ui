import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useSyncExternalStore,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from "react"
import { findNodeHandle, type GestureResponderEvent, type StyleProp, type TextStyle, type View } from "react-native"
import type { ColumnSize } from "react-stately/useTableState"

import { useNativeCollectionRefs } from "../../collection/context"
import type { TNativeCollectionKey } from "../../collection/snapshot"
import { nativeKeyTokens } from "../../input/keyScope"
import { NativeFocusHost, NativeFocusView } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeFocusViewProps, TNativeKeyboardEvent } from "../../input/types"
import { useNativeLocale } from "../../locale/NativeLocaleProvider"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"

import {
  NativeResizableTableContainerContext,
  NativeTableColumnResizeStateContext,
} from "./NativeResizableTableContainer"
import { nativeTableResizeMessages } from "./resizeMessages"
import { TableKeyPolicy } from "./TableCellKeys"
import { NativeTableColumnContext } from "./TableColumn"
import { useTableAction } from "./useTableAction"
import { useTableHover, type TNativeTableHoverEvents } from "./useTableHover"

export type TNativeColumnResizerRenderState = Readonly<{
  isHovered: boolean
  isFocused: boolean
  isFocusVisible: boolean
  isResizing: boolean
  resizableDirection: "left" | "right" | "both"
}>
export type TNativeColumnResizerProps = Omit<TNativeFocusViewProps, "style" | "children"> &
  TNativeTableHoverEvents & {
    children?: ReactNode | ((values: TNativeColumnResizerRenderState & { defaultChildren: undefined }) => ReactNode)
    style?:
      | StyleProp<TextStyle>
      | ((values: TNativeColumnResizerRenderState & { defaultStyle: TextStyle }) => StyleProp<TextStyle>)
    render?: (
      props: TNativeFocusViewProps & RefAttributes<View>,
      values: TNativeColumnResizerRenderState,
    ) => ReactElement
  }
const noSubscription = () => () => {}
const keys = ["Enter", " ", "Escape", "Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].flatMap(nativeKeyTokens)

export const NativeColumnResizer = forwardRef<View, TNativeColumnResizerProps>((props, ref) => {
  const layout = useContext(NativeTableColumnResizeStateContext)
  const container = useContext(NativeResizableTableContainerContext)
  const column = useContext(NativeTableColumnContext)
  if (!layout || !container)
    throw new Error("Wrap your <Table> in a <ResizableTableContainer> to enable column resizing")
  if (!column) throw new Error("ColumnResizer must be inside a TableColumn")
  const {
    children,
    style,
    render,
    onKeyDown,
    onHoverStart,
    onHoverEnd,
    onHoverChange,
    onFocus: outerFocus,
    onBlur: outerBlur,
    ...native
  } = props
  const { locale, direction } = useNativeLocale(),
    theme = useNativeTheme()
  const messages = nativeTableResizeMessages(locale)
  const input = useRef<View | null>(null),
    root = useRef<View | null>(null)
  const bindRoot = useCallback((view: View | null) => {
    root.current = view
  }, [])
  const mergedRef = useNativeCollectionRefs(bindRoot, ref)
  const id = `codon-resizer-${useId()}`
  const [focused, setFocused] = useState(false),
    [visible, setVisible] = useState(false)
  const scope = useNativeKeyScope()
  useSyncExternalStore(
    scope?.subscribe ?? noSubscription,
    () => `${scope?.lastInput()?.origin ?? ""}:${scope?.isWindowActive() !== false}`,
    () => ":true",
  )
  const action = useTableAction(column.node, column.target)
  const hover = useTableHover(root, action.isActive, { ...native, onHoverStart, onHoverEnd, onHoverChange })
  const current = useRef({ layout, container, column, action, direction, focused })
  const resizing = useRef(layout.resizingColumn === column.node.key)
  const lastSize = useRef<Map<TNativeCollectionKey, ColumnSize> | null>(null)
  const wasFocused = useRef(false)
  const pointer = useRef<{
    x: number
    width: number
    type: string
    target: View
    columnKey: TNativeCollectionKey
    header: View | null
  } | null>(null)
  const pointerType = useRef("touch")
  const modifiedPointer = useRef(false)
  const live = useRef(false)
  useInsertionEffect(() => {
    current.current = { layout, container, column, action, direction, focused }
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      pointer.current = null
    }
  }, [])
  const focusInput = () => {
    if (live.current && current.current.action.isActive()) input.current?.focus()
  }
  const start = () => {
    const owner = current.current
    owner.action.request(() => {
      if (!resizing.current) {
        lastSize.current = owner.layout.updateResizedColumns(
          owner.column.node.key,
          owner.layout.getColumnWidth(owner.column.node.key),
        )
        owner.layout.startResize(owner.column.node.key)
        owner.layout.tableState.setKeyboardNavigationDisabled(true)
        owner.container.onResizeStart?.(lastSize.current)
      }
      resizing.current = true
    })
  }
  const resize = (width: number) => {
    const owner = current.current
    owner.action.request(() => {
      const sizes = owner.layout.updateResizedColumns(owner.column.node.key, width)
      owner.container.onResize?.(sizes)
      lastSize.current = sizes
    })
  }
  const finish = () => {
    const owner = current.current
    owner.action.request(() => {
      if (resizing.current) {
        const sizes =
          lastSize.current ??
          owner.layout.updateResizedColumns(owner.column.node.key, owner.layout.getColumnWidth(owner.column.node.key))
        owner.layout.endResize()
        owner.layout.tableState.setKeyboardNavigationDisabled(false)
        owner.container.onResizeEnd?.(sizes)
        resizing.current = false
        if (!wasFocused.current && live.current && owner.action.isActive()) owner.column.target.current?.focus()
      }
      lastSize.current = null
    })
  }
  const previous = useRef<TNativeCollectionKey | null>(null)
  useEffect(() => {
    const key = layout.resizingColumn
    if (key !== previous.current && key != null && key === column.node.key) {
      wasFocused.current = focused
      start()
      const first = setTimeout(focusInput, 0),
        voiceOver = setTimeout(focusInput, 400)
      return () => {
        clearTimeout(first)
        clearTimeout(voiceOver)
      }
    }
    previous.current = key
  }, [layout.resizingColumn, column.node.key])
  useEffect(
    () => () => {
      if (resizing.current) {
        current.current.layout.endResize()
        current.current.layout.tableState.setKeyboardNavigationDisabled(false)
        resizing.current = false
      }
    },
    [],
  )
  const keyboard = (event: TNativeKeyboardEvent) => {
    const data = event.nativeEvent,
      owner = current.current
    if (
      data.phase !== "down" ||
      data.cancelled ||
      !data.nativeDefaultHandled ||
      !owner.action.isActive() ||
      data.target !== findNodeHandle(input.current)
    )
      return
    onKeyDown?.(event)
    if (owner.layout.tableState.isKeyboardNavigationDisabled) {
      if (["Escape", "Enter", " ", "Tab"].includes(data.key)) {
        event.preventDefault()
        finish()
        return
      }
      const delta =
        data.key === "ArrowUp"
          ? 10
          : data.key === "ArrowDown"
            ? -10
            : data.key === "ArrowRight"
              ? owner.direction === "rtl"
                ? -10
                : 10
              : data.key === "ArrowLeft"
                ? owner.direction === "rtl"
                  ? 10
                  : -10
                : 0
      if (delta) {
        event.preventDefault()
        resize(owner.layout.getColumnWidth(owner.column.node.key) + delta)
      }
    } else if (data.key === "Enter") start()
  }
  const beginPointer = (event: GestureResponderEvent) => {
    const owner = current.current,
      view = root.current
    if (
      !view ||
      modifiedPointer.current ||
      event.defaultPrevented ||
      event.isDefaultPrevented?.() ||
      !owner.action.isActive() ||
      !Number.isFinite(event.nativeEvent.pageX) ||
      Number(event.currentTarget ?? event.nativeEvent.target) !== findNodeHandle(view)
    )
      return
    event.preventDefault()
    event.stopPropagation()
    wasFocused.current = focused
    pointer.current = {
      x: event.nativeEvent.pageX,
      width: owner.layout.getColumnWidth(owner.column.node.key),
      type: pointerType.current,
      target: view,
      columnKey: owner.column.node.key,
      header: owner.column.target.current,
    }
    focusInput()
    start()
  }
  const movePointer = (event: GestureResponderEvent) => {
    const cycle = pointer.current,
      owner = current.current
    if (
      !cycle ||
      cycle.target !== root.current ||
      cycle.columnKey !== owner.column.node.key ||
      cycle.header !== owner.column.target.current ||
      !owner.action.isActive() ||
      !Number.isFinite(event.nativeEvent.pageX)
    )
      return
    resize(cycle.width + (event.nativeEvent.pageX - cycle.x) * (owner.direction === "rtl" ? -1 : 1))
  }
  const endPointer = () => {
    const cycle = pointer.current
    pointer.current = null
    if (cycle && (cycle.type === "mouse" || (cycle.type === "touch" && wasFocused.current))) finish()
  }
  useLayoutEffect(() => {
    if (!action.isActive() && resizing.current) {
      pointer.current = null
      resizing.current = false
      lastSize.current = null
      layout.endResize()
      layout.tableState.setKeyboardNavigationDisabled(false)
      setFocused(false)
      setVisible(false)
    }
  })
  const minimum = Math.floor(layout.getColumnMinWidth(column.node.key)),
    maximum = Math.floor(layout.getColumnMaxWidth(column.node.key)),
    value = Math.floor(layout.getColumnWidth(column.node.key))
  const isResizing = layout.resizingColumn === column.node.key
  const flags: TNativeColumnResizerRenderState = {
    isHovered: hover.isHovered,
    isFocused: focused,
    isFocusVisible: focused && (scope?.lastInput()?.origin ? scope.lastInput()?.origin !== "pointer" : visible),
    isResizing,
    resizableDirection:
      minimum >= value
        ? direction === "rtl"
          ? "right"
          : "left"
        : maximum <= value
          ? direction === "rtl"
            ? "left"
            : "right"
          : "both",
  }
  const styles = splitNativeTextStyle(
    resolveNativeStyle<TextStyle>(
      typeof style === "function" ? style({ ...flags, defaultStyle: {} }) : style,
      "ColumnResizer",
      "style",
    ),
  )
  const caption = messages.columnSize.replace("{value}", new Intl.NumberFormat(locale).format(value))
  const description =
    !column.target.current && !isResizing && ["keyboard", "virtual"].includes(scope?.lastInput()?.origin ?? "")
      ? messages.resizerDescription
      : undefined
  const field = (
    <NativeFocusHost
      key="input"
      ref={input}
      testID={`${native.testID ?? "column-resizer"}-input`}
      nativeID={id}
      role="slider"
      accessibilityRole="adjustable"
      accessible
      focusable
      nativeTabStop
      accessibilityLabel={(native.accessibilityLabel ?? native["aria-label"]) || messages.tableResizer}
      accessibilityHint={description}
      nativeLabelledBy={[id, column.nativeID]}
      accessibilityValue={{
        min: minimum,
        max: maximum === Infinity ? Number.MAX_SAFE_INTEGER : maximum,
        now: value,
        text: caption,
      }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onNativeActivation={() => {
        if (current.current.layout.resizingColumn != null) finish()
        else focusInput()
      }}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment" || event.nativeEvent.actionName === "decrement")
          resize(layout.getColumnWidth(column.node.key) + (event.nativeEvent.actionName === "increment" ? 10 : -10))
      }}
      capturedKeys={scope ? [] : keys}
      onKeyDown={keyboard}
      onFocus={(event) => {
        if (event.nativeEvent.target === findNodeHandle(input.current)) {
          setFocused(true)
          setVisible(event.nativeEvent.isFocusVisible)
          outerFocus?.(event)
        }
      }}
      onBlur={(event) => {
        if (event.nativeEvent.target === findNodeHandle(input.current)) {
          setFocused(false)
          setVisible(false)
          finish()
          outerBlur?.(event)
        }
      }}
      style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}
    />
  )
  const host = {
    ...native,
    ref: mergedRef,
    accessible: false,
    focusable: false,
    style: styles.view,
    onKeyDown: keyboard,
    onFocus: outerFocus,
    onBlur: outerBlur,
    onPointerEnter: hover.onPointerEnter,
    onPointerLeave: hover.onPointerLeave,
    onPointerDown: (event: Parameters<NonNullable<TNativeFocusViewProps["onPointerDown"]>>[0]) => {
      pointerType.current = event.nativeEvent.pointerType
      modifiedPointer.current =
        event.nativeEvent.ctrlKey || event.nativeEvent.altKey || event.nativeEvent.metaKey || event.nativeEvent.shiftKey
      native.onPointerDown?.(event)
    },
    onStartShouldSetResponder: () => action.isActive(),
    onResponderGrant: beginPointer,
    onResponderMove: movePointer,
    onResponderEnd: endPointer,
    onResponderRelease: endPointer,
    onResponderTerminate: () => {
      pointer.current = null
      finish()
    },
    onResponderTerminationRequest: () => !pointer.current,
    children: (
      <NativeContentContext.Provider
        value={{
          foregroundColor: styles.text.color ?? theme.colors.foreground,
          isButton: false,
          textStyle: styles.text,
        }}
      >
        <TableKeyPolicy
          target={input}
          lifetimeKey={action.binding}
          tokens={keys}
          isEnabled
          excludeEditable={false}
          excludeComposing
          canAct={action.isActive}
          onKey={keyboard}
        />
        {getNativeButtonContent(
          typeof children === "function" ? children({ ...flags, defaultChildren: undefined }) : children,
          styles.text,
        )}
        {field}
      </NativeContentContext.Provider>
    ),
  }
  return render ? render(host, flags) : <NativeFocusView {...host} />
})
NativeColumnResizer.displayName = "NativeColumnResizer"
