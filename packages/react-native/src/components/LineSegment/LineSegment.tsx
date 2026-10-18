import { forwardRef } from "react"
import { View } from "react-native"

import { useNativeTheme } from "../../theme"

import { getNativeLineSegmentStyle } from "./styles"
import type { TNativeLineSegmentProps, TNativeLineSegmentRef } from "./types"

export const LineSegment = forwardRef<TNativeLineSegmentRef, TNativeLineSegmentProps>((props, ref) => {
  const {
    height: _height,
    width: _width,
    size: _size,
    color: _color,
    direction: _direction,
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
  return (
    <View
      {...rest}
      ref={ref}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel ?? aliasLabel}
      testID={testID ?? aliasTestID ?? "line-segment"}
      style={getNativeLineSegmentStyle(theme, props)}
    />
  )
})
LineSegment.displayName = "LineSegment"
