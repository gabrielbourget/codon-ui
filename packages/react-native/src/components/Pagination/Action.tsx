import { forwardRef, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { StyleProp, TextStyle, View } from "react-native"

import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativePressEvent } from "../../input/types"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { Button } from "../Button/Button"
import type { TNativeButtonRootStyle } from "../Button/types"
import { resolveNativeStyle } from "../colors"

import type { TNativePaginationProps } from "./types"

type TProps = {
  props: TNativePaginationProps
  label: string
  children: ReactNode
  disabled?: boolean
  selected?: boolean
  currentPageValue?: string
  expanded?: boolean
  nativeID?: string
  overflow?: boolean
  pageHeight?: number
  onPageHeight?: (height: number) => void
  customStyles?: StyleProp<TextStyle>
  textStyle?: TextStyle
  testID: string
  onRequest: (event: TNativePressEvent) => void
}
export const NativePaginationAction = forwardRef<View, TProps>(
  (
    {
      props,
      label,
      children,
      disabled,
      selected,
      currentPageValue,
      expanded,
      nativeID,
      overflow = false,
      pageHeight,
      onPageHeight,
      customStyles,
      textStyle,
      testID,
      onRequest,
    },
    ref,
  ) => {
    const general = props.customGeneralButtonProps ?? {}
    const pageStripAction = selected !== undefined || overflow
    const square = pageStripAction && props.pageButtonSizing !== "content"
    // Reserve the same border space in all default strip buttons so selection does not move the row.
    const stripStyle =
      pageStripAction && general.colorMode === undefined && !general.transparent
        ? { borderWidth: 2, ...(selected ? {} : { borderColor: "transparent" }) }
        : undefined
    const [measuredHeight, setMeasuredHeight] = useState<number>()
    const owner = useMemo(() => ({}), [props, selected, overflow, onPageHeight, customStyles, textStyle])
    const currentOwner = useRef<object | null>(null)
    useLayoutEffect(() => {
      currentOwner.current = owner
      return () => {
        if (currentOwner.current === owner) currentOwner.current = null
      }
    }, [owner])
    const valueText = general["aria-valuetext"] ?? general.accessibilityValue?.text
    // Removing a value map clears Android's unchanged label; keep numeric buttons' empty text maps stable.
    const currentValue =
      selected === undefined && currentPageValue === undefined
        ? {}
        : {
            "aria-valuetext": undefined,
            accessibilityValue: {
              ...general.accessibilityValue,
              text: !valueText
                ? (currentPageValue ?? "")
                : !currentPageValue
                  ? valueText
                  : `${valueText}, ${currentPageValue}`,
            },
          }
    const scope = useContext(NativeFloatingScopeContext),
      window = useContext(NativeFloatingWindowContext),
      input = useNativeKeyScope()
    return (
      <Button
        ref={ref}
        color={props.color}
        order={props.order}
        geometry={props.geometry ?? "rounded"}
        colorMode={pageStripAction ? "fill" : (props.buttonColorMode ?? "fill")}
        raised
        {...general}
        {...currentValue}
        nativeID={nativeID ?? general.nativeID}
        testID={general.testID ?? general["data-testid"] ?? testID}
        accessibilityLabel={general.accessibilityLabel ?? general["aria-label"] ?? label}
        isDisabled={props.isDisabled || disabled || general.isDisabled}
        accessibilityState={{
          ...general.accessibilityState,
          ...(selected !== undefined ? { selected } : {}),
          ...(expanded !== undefined ? { expanded } : {}),
        }}
        aria-selected={selected ?? general["aria-selected"]}
        aria-expanded={expanded ?? general["aria-expanded"]}
        customStyles={[textStyle, stripStyle, general.customStyles, customStyles]}
        style={
          square
            ? (state) => {
                const final = resolveNativeStyle<TNativeButtonRootStyle>(
                  typeof general.style === "function" ? general.style(state) : general.style,
                  "Pagination",
                  "customGeneralButtonProps.style",
                )
                const hasAuthoredDimension = (keys: readonly (keyof TNativeButtonRootStyle)[]) =>
                  keys.some((key) => final[key] !== undefined || state.defaultStyle[key] !== undefined)
                const squareMinimum = overflow ? pageHeight : measuredHeight
                return {
                  ...final,
                  ...(squareMinimum !== undefined && !hasAuthoredDimension(["width", "minWidth", "maxWidth"])
                    ? { minWidth: squareMinimum }
                    : {}),
                  ...(overflow &&
                  pageHeight !== undefined &&
                  !hasAuthoredDimension(["height", "minHeight", "maxHeight"])
                    ? { minHeight: pageHeight }
                    : {}),
                }
              }
            : general.style
        }
        onLayout={
          pageStripAction
            ? (event) => {
                if (currentOwner.current !== owner) return
                const height = event.nativeEvent.layout.height
                if (!overflow && Number.isFinite(height) && height >= 0) {
                  setMeasuredHeight((previous) => (previous === height ? previous : height))
                  onPageHeight?.(height)
                }
                general.onLayout?.(event)
              }
            : general.onLayout
        }
        onPress={(event) => {
          general.onPress?.(event)
          if (
            scope?.canAct() === false ||
            window?.() === false ||
            input?.isWindowActive() === false ||
            event.defaultPrevented ||
            event.isDefaultPrevented?.()
          )
            return
          onRequest(event)
        }}
      >
        {children}
      </Button>
    )
  },
)
NativePaginationAction.displayName = "NativePaginationAction"
