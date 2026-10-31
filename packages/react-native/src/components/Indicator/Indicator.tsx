import { forwardRef } from "react"
import { View } from "react-native"

import { useNativeTheme } from "../../theme"
import { useNativeContentContext } from "../NativeContentContext"

import { getNativeIndicatorStyle } from "./styles"
import type { TNativeIndicatorProps, TNativeIndicatorRef } from "./types"

export const Indicator = forwardRef<TNativeIndicatorRef, TNativeIndicatorProps>((props, ref) => {
  const {
    isActive: _isActive,
    size: _size,
    color: _color,
    inactiveColor: _inactiveColor,
    borderColor: _borderColor,
    borderWidth: _borderWidth,
    shape: _shape,
    customStyles: _customStyles,
    style: _style,
    accessible = false,
    accessibilityLabel,
    "aria-label": aliasLabel,
    testID,
    "data-testid": aliasTestID,
    ...rest
  } = props
  const theme = useNativeTheme()
  const content = useNativeContentContext()
  return (
    <View
      {...rest}
      ref={ref}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel ?? aliasLabel}
      testID={testID ?? aliasTestID ?? "indicator"}
      style={getNativeIndicatorStyle(theme, props, content?.foregroundColor ?? theme.colors.foreground)}
    />
  )
})
Indicator.displayName = "Indicator"
