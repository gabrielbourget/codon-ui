import type { ColorValue } from "react-native"
import Svg, { Path, Rect } from "react-native-svg"

const filterPath =
  "M18,28H14a2,2,0,0,1-2-2V18.41L4.59,11A2,2,0,0,1,4,9.59V6A2,2,0,0,1,6,4H26a2,2,0,0,1,2,2V9.59A2,2,0,0,1,27.41,11L20,18.41V26A2,2,0,0,1,18,28Z"
export const TableFilterGlyph = ({ active, color }: { active: boolean; color: ColorValue }) => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 32 32"
    accessible={false}
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    testID={`table-header-default-${active ? "active" : "inactive"}-filter-icon`}
  >
    <Path d={filterPath} fill={active ? color : "none"} />
    <Path d={filterPath} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    <Rect width={32} height={32} fill="none" />
  </Svg>
)
export const TableAddConditionGlyph = ({ color }: { color: ColorValue }) => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    accessible={false}
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    testID="table-filter-popover-default-add-condition-icon"
  >
    <Path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z" fill={color} />
  </Svg>
)
