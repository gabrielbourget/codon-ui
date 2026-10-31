import type { ColorValue } from "react-native"
import Svg, { Path, Polyline } from "react-native-svg"

import { useNativeContentContext } from "../../components/NativeContentContext"

export const NativeDatePickerCalendarIcon = ({ color }: { color: ColorValue }) => (
  <Svg accessible={false} width={15} height={15} viewBox="0 0 1024 1024" fill={color}>
    <Path d="M112 880c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V460H112v420zm768-696H712v-64c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v64H384v-64c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v64H144c-17.7 0-32 14.3-32 32v176h800V216c0-17.7-14.3-32-32-32z" />
  </Svg>
)
export const NativeDatePickerChevron = ({ next, color }: { next?: boolean; color?: ColorValue }) => {
  const content = useNativeContentContext()
  return (
    <Svg
      accessible={false}
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? content?.foregroundColor ?? "currentColor"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Polyline points={next ? "9 18 15 12 9 6" : "15 18 9 12 15 6"} />
    </Svg>
  )
}
