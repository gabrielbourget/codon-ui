import { forwardRef, useContext, type ReactNode } from "react"
import type { StyleProp, TextStyle, View } from "react-native"

import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativePressEvent } from "../../input/types"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { Button } from "../Button/Button"
import type { TNativeButtonProps } from "../Button/types"

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
  target: number
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
      target,
      testID,
      onRequest,
    },
    ref,
  ) => {
    const general = props.customGeneralButtonProps ?? {}
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
        customStyles={[{ minWidth: target, height: target }, textStyle, general.customStyles, customStyles]}
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
