import { forwardRef, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { StyleProp, TextStyle, View } from "react-native"

import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativePressEvent } from "../../input/types"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { Button } from "../Button/Button"
import type { TNativeButtonProps, TNativeButtonRootStyle } from "../Button/types"
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
  colorMode?: TNativeButtonProps["colorMode"]
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
      colorMode,
      customStyles,
      textStyle,
      testID,
      onRequest,
    },
    ref,
  ) => {
    const general = props.customGeneralButtonProps ?? {}
    const square = selected !== undefined && props.pageButtonSizing !== "content"
    const [measuredHeight, setMeasuredHeight] = useState<number>()
    const owner = useMemo(() => ({}), [props, selected, customStyles, textStyle])
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
        colorMode={colorMode ?? props.buttonColorMode ?? "fill"}
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
        customStyles={[textStyle, general.customStyles, customStyles]}
        style={
          square
            ? (state) => {
                const final = resolveNativeStyle<TNativeButtonRootStyle>(
                  typeof general.style === "function" ? general.style(state) : general.style,
                  "Pagination",
                  "customGeneralButtonProps.style",
                )
                const authoredWidth = ["width", "minWidth", "maxWidth"].some(
                  (key) =>
                    final[key as keyof TNativeButtonRootStyle] !== undefined ||
                    state.defaultStyle[key as keyof TNativeButtonRootStyle] !== undefined,
                )
                return {
                  ...final,
                  ...(!authoredWidth && measuredHeight !== undefined ? { minWidth: measuredHeight } : {}),
                }
              }
            : general.style
        }
        onLayout={
          square
            ? (event) => {
                if (currentOwner.current !== owner) return
                const height = event.nativeEvent.layout.height
                if (Number.isFinite(height) && height >= 0)
                  setMeasuredHeight((previous) => (previous === height ? previous : height))
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
