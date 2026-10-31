import Svg, { Circle, Polyline } from "react-native-svg"

import { useNativeContentContext } from "../NativeContentContext"

export const NativePaginationGlyph = ({
  direction = "right",
  double = false,
  overflow = false,
}: {
  direction?: "left" | "right"
  double?: boolean
  overflow?: boolean
}) => {
  const color = useNativeContentContext()?.foregroundColor ?? "currentColor"
  return (
    <Svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={
        overflow ? "pagination-default-overflow-icon" : `pagination-default-${double ? "double-" : ""}${direction}-icon`
      }
    >
      {overflow ? (
        [5, 12, 19].map((x) => <Circle key={x} cx={x} cy={12} r={2} fill={color} />)
      ) : (
        <>
          <Polyline
            points={
              direction === "left"
                ? double
                  ? "12 18 6 12 12 6"
                  : "15 18 9 12 15 6"
                : double
                  ? "12 18 18 12 12 6"
                  : "9 18 15 12 9 6"
            }
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {double && (
            <Polyline
              points={direction === "left" ? "20 18 14 12 20 6" : "4 18 10 12 4 6"}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </>
      )}
    </Svg>
  )
}
