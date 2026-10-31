import type { ColorValue } from "react-native"
import Svg, { Path, Polyline } from "react-native-svg"

import { useNativeTheme } from "../../theme"
import { useNativeContentContext } from "../NativeContentContext"

export const NativeBreadcrumbChevron = ({ color }: { color?: ColorValue }) => {
  const inherited = useNativeContentContext()
  const theme = useNativeTheme()
  return (
    <Svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? inherited?.foregroundColor ?? theme.colors.foreground}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Polyline points="9 18 15 12 9 6" />
    </Svg>
  )
}
export const NativeBreadcrumbOverflowGlyph = ({ color }: { color: ColorValue }) => (
  <Svg
    width={15}
    height={15}
    viewBox="0 0 24 24"
    fill={color}
    accessible={false}
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
  >
    <Path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
  </Svg>
)
