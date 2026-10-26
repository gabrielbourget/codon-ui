import {
  createContext,
  forwardRef,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from "react"
import type { StyleProp, TextStyle, View } from "react-native"
import type { ColumnSize } from "react-stately/useTableState"

import type { TNativeCollectionKey } from "../../collection/snapshot"
import { NativeFocusView } from "../../input/NativeFocusView"
import type { TNativeFocusViewProps } from "../../input/types"
import { useNativeTheme } from "../../theme"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"

import type { TNativeTableColumnResizeState } from "./state/useTableColumnResizeState"

export type TNativeTableResizeCallbacks = {
  onResizeStart?: (widths: Map<TNativeCollectionKey, ColumnSize>) => void
  onResize?: (widths: Map<TNativeCollectionKey, ColumnSize>) => void
  onResizeEnd?: (widths: Map<TNativeCollectionKey, ColumnSize>) => void
}
type TContainerContext = TNativeTableResizeCallbacks & {
  tableRef: React.RefObject<View | null>
  tableWidth: number
}
export const NativeResizableTableContainerContext = createContext<TContainerContext | null>(null)
export const NativeTableColumnResizeStateContext = createContext<TNativeTableColumnResizeState<object> | null>(null)
export type TNativeResizableTableContainerProps = Omit<TNativeFocusViewProps, "children" | "style"> &
  TNativeTableResizeCallbacks & {
    children?: ReactNode
    style?: StyleProp<TextStyle>
    render?: (props: TNativeFocusViewProps & RefAttributes<View>, state: undefined) => ReactElement
  }

export const NativeResizableTableContainer = forwardRef<View, TNativeResizableTableContainerProps>((props, ref) => {
  const { onResizeStart, onResize, onResizeEnd, onLayout, style, children, render, ...native } = props
  const tableRef = useRef<View | null>(null)
  const [tableWidth, setWidth] = useState(0)
  const context = useMemo(
    () => ({ tableRef, tableWidth, onResizeStart, onResize, onResizeEnd }),
    [tableWidth, onResizeStart, onResize, onResizeEnd],
  )
  const inherited = useNativeContentContext(),
    theme = useNativeTheme()
  const styles = splitNativeTextStyle(resolveNativeStyle(style, "ResizableTableContainer", "style"))
  const host = {
    ...native,
    ref,
    focusable: native.focusable ?? false,
    style: styles.view,
    onLayout: (event: Parameters<NonNullable<TNativeFocusViewProps["onLayout"]>>[0]) => {
      const width = event.nativeEvent.layout.width
      if (Number.isFinite(width) && width >= 0) setWidth(width)
      onLayout?.(event)
    },
    children: (
      <NativeResizableTableContainerContext.Provider value={context}>
        <NativeContentContext.Provider
          value={{
            foregroundColor: styles.text.color ?? inherited?.foregroundColor ?? theme.colors.foreground,
            isButton: inherited?.isButton ?? false,
            textStyle: { ...inherited?.textStyle, ...styles.text },
          }}
        >
          {children}
        </NativeContentContext.Provider>
      </NativeResizableTableContainerContext.Provider>
    ),
  }
  return render ? render(host, undefined) : <NativeFocusView {...host} />
})
NativeResizableTableContainer.displayName = "NativeResizableTableContainer"
