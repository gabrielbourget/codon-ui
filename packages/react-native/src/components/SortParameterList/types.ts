import type { StyleProp, TextStyle } from "react-native"

import type { TNativeFocusViewProps } from "../../input/types"
import type { TTableSortDirection } from "../Table/queryTypes"

export type TNativeSortParameter = {
  ID: string
  name: string
  sortDirection: TTableSortDirection
}
export type TNativeSortParameterListProps = Omit<TNativeFocusViewProps, "children" | "style"> & {
  "data-testid"?: string
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  ariaDetails?: string
  "aria-label"?: string
  "aria-labelledby"?: string
  "aria-describedby"?: string
  "aria-details"?: string
  sortParameterList: TNativeSortParameter[]
  onSortParameterListChange?: (sortParameterList: TNativeSortParameter[]) => void
  customStyles?: StyleProp<TextStyle>
  style?: StyleProp<TextStyle>
  customItemStyles?: StyleProp<TextStyle>
  customItemIconStyles?: StyleProp<TextStyle>
  customItemTextStyles?: StyleProp<TextStyle>
}
