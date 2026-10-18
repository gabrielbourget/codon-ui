import Svg, { Path, Polyline } from "react-native-svg"

import { useNativeTheme } from "../../theme"
import { useNativeContentContext } from "../NativeContentContext"

export const NativeCarouselControlIcon = ({ kind }: { kind: "close" | "previous" | "next" }) => {
  const theme = useNativeTheme()
  const color = useNativeContentContext()?.foregroundColor ?? theme.colors.controlForeground
  return (
    <Svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      color={color}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={`carousel-${kind}-icon`}
    >
      {kind === "close" ? (
        <Path
          fill="currentColor"
          d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
        />
      ) : (
        <Polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={kind === "previous" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"}
        />
      )}
    </Svg>
  )
}
