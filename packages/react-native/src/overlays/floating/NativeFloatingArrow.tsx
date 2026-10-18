import { View, type LayoutChangeEvent, type ViewStyle } from "react-native"
import Svg, { Path, type PathProps, type SvgProps } from "react-native-svg"

import type { getNativeFloatingPlacement } from "./placement"

type TSide = "top" | "bottom" | "left" | "right"
export const NativeFloatingArrow = ({
  position,
  side,
  layout,
  style,
  graphicStyle,
  paint,
  color,
  testID,
  onLayout,
}: {
  position: ReturnType<typeof getNativeFloatingPlacement>
  side: TSide
  layout: { width: number; height: number } | null
  style: ViewStyle
  graphicStyle?: ViewStyle
  paint: PathProps
  color?: SvgProps["color"]
  testID: string
  onLayout: (event: LayoutChangeEvent) => void
}) => {
  const placement = position?.placement ?? side
  const vertical = placement === "top" || placement === "bottom"
  const center = position ? position.arrowCrossOffset + position.arrowSize / 2 : 0
  const width = layout?.width ?? 10,
    height = layout?.height ?? 10
  const crossPosition = vertical
    ? { left: center, transform: [{ translateX: -width / 2 }] }
    : { top: center, transform: [{ translateY: -height / 2 }] }
  const rotation = ({ top: "0deg", bottom: "180deg", right: "90deg", left: "270deg" } as const)[placement]
  return (
    <View
      testID={testID}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ position: "absolute", width: 10, height: 10, [placement]: "100%", ...crossPosition }, style]}
      onLayout={onLayout}
    >
      <View style={[{ width: 10, height: 10, transform: [{ rotate: rotation }] }, graphicStyle]}>
        <Svg width={10} height={10} viewBox="0 0 10 10" color={color}>
          <Path {...paint} d="M0 0 L5 5 L10 0" />
        </Svg>
      </View>
    </View>
  )
}
