import { forwardRef } from "react"
import type { GestureResponderEvent, StyleProp, TextStyle, View } from "react-native"

import { nativeAccessibilityIDs } from "../../input/accessibilityReferences"
import { NativeFocusHost } from "../../input/NativeFocusView"
import type { TNativeFocusViewProps } from "../../input/types"
import { useNativeTheme } from "../../theme"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"

import { renderFilterArgumentInput, type TFilterArgumentContext } from "./renderArgument"

export type TNativeDynamicFilterArgumentInputProps = Omit<TNativeFocusViewProps, "children" | "style"> &
  TFilterArgumentContext & {
    children?: never
    customStyles?: StyleProp<TextStyle>
    style?: StyleProp<TextStyle>
    ariaLabel?: string
    ariaLabelledBy?: string
    ariaDescribedBy?: string
    ariaDetails?: string
    "aria-describedby"?: string
    "aria-details"?: string
    "data-testid"?: string
    onClick?: (event: GestureResponderEvent) => void
  }

// Private source wrapper shared by Table and SortAndFilterPanel.
export const DynamicFilterArgumentInput = forwardRef<View, TNativeDynamicFilterArgumentInputProps>((props, ref) => {
  const theme = useNativeTheme()
  const inherited = useNativeContentContext()
  const {
    dataType,
    argument,
    filterArgumentType,
    filterArgumentAccessibleLabel,
    filterArgumentSelectedKey,
    availableFilterArguments,
    booleanArgumentComponent,
    labels,
    nativeLabels,
    onArgumentChange,
    canAct,
    customFieldStyles,
    customInputStyles,
    customRowStyles,
    customActionButtonStyles,
    customPlaceholderStyles,
    customStyles,
    style,
    ariaLabel,
    ariaLabelledBy,
    ariaDescribedBy,
    ariaDetails,
    "aria-label": nativeLabel,
    "aria-labelledby": nativeLabelledBy,
    "aria-describedby": nativeDescribedBy,
    "aria-details": nativeDetails,
    accessibilityLabel,
    accessibilityLabelledBy,
    testID,
    "data-testid": aliasID,
    accessible,
    focusable,
    tabIndex,
    ...root
  } = props
  const child = renderFilterArgumentInput({
    dataType,
    argument,
    filterArgumentType,
    filterArgumentAccessibleLabel,
    filterArgumentSelectedKey,
    availableFilterArguments,
    booleanArgumentComponent,
    labels,
    nativeLabels,
    onArgumentChange,
    canAct,
    customFieldStyles,
    customInputStyles,
    customRowStyles,
    customActionButtonStyles,
    customPlaceholderStyles,
  })
  if (!child) return null
  const resolved = splitNativeTextStyle(
    resolveNativeStyle<TextStyle>(
      [{ width: "100%", height: "auto" }, customStyles, style],
      "DynamicFilterArgumentInput",
      "style",
    ),
  )
  const labelledBy = accessibilityLabelledBy ?? nativeLabelledBy ?? ariaLabelledBy
  return (
    <NativeContentContext.Provider
      value={{
        foregroundColor: resolved.text.color ?? inherited?.foregroundColor ?? theme.colors.foreground,
        isButton: inherited?.isButton ?? false,
        textStyle: { ...inherited?.textStyle, ...resolved.text },
      }}
    >
      <NativeFocusHost
        {...root}
        ref={ref}
        testID={testID ?? aliasID ?? "dynamic-filter-argument-input"}
        accessible={accessible ?? false}
        focusable={tabIndex === undefined ? (focusable ?? false) : !tabIndex}
        tabIndex={tabIndex}
        accessibilityLabel={accessibilityLabel ?? nativeLabel ?? ariaLabel}
        accessibilityLabelledBy={labelledBy}
        nativeLabelledBy={nativeAccessibilityIDs(labelledBy)}
        nativeDescribedBy={nativeAccessibilityIDs(nativeDescribedBy ?? ariaDescribedBy)}
        nativeDetailsBy={nativeAccessibilityIDs(nativeDetails ?? ariaDetails)}
        style={resolved.view}
      >
        {child}
      </NativeFocusHost>
    </NativeContentContext.Provider>
  )
})
DynamicFilterArgumentInput.displayName = "DynamicFilterArgumentInput"
