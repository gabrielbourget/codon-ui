import type { ReactElement, ReactNode, RefAttributes } from "react"
import type { ColorValue, StyleProp, TextStyle, View, ViewProps } from "react-native"

import type { TNativeCollectionKey } from "../../collection/snapshot"
import type { MultipleSelectionStateProps } from "../../collection/state/useMultipleSelectionState"
import type { TNativeFocusViewProps } from "../../input/types"
import type { TCornerGeometry } from "../../tokens/geometry"
import type { TNativeLinkProps } from "../Link/types"
import type { TNativePaginationProps } from "../Pagination/types"

import type { TPartialNativeTableFilteringLabels } from "./filterLabels"
import type { TAvailableListItem } from "./filterMetadata"
import type {
  TTableSortInstruction,
  TTableFilterGroup,
  TTableFilterArgumentDataType,
  TTableFilterOperationCode,
} from "./queryTypes"
import type { TNativeTableHoverEvents } from "./useTableHover"

export type TNativeTableColumnFilterMetadata = {
  enabled?: boolean
  criteriaID: string
  queryKey?: string
  dataType?: TTableFilterArgumentDataType
  allowedOperationCodes?: readonly TTableFilterOperationCode[]
  usesTypeAheadInput?: boolean
  typeAheadInputOnChange?: (value: string) => void
  usesSelectInput?: boolean
  usesComboBoxInput?: boolean
  availableCriteriaArguments?: TAvailableListItem[]
}
export type TNativeTableFilterIconPressArgs = { columnID: string; columnName: string; filterGroup?: TTableFilterGroup }
export type TNativeTableFilteringControls = {
  activeFilters: TTableFilterGroup[]
  icons?: { inactive?: ReactNode; active?: ReactNode }
} & (
  | { mode?: undefined; onFiltersChange?: undefined; onFilterIconPress?: undefined }
  | {
      mode?: "external"
      onFiltersChange?: undefined
      onFilterIconPress: (args: TNativeTableFilterIconPressArgs) => void
    }
  | { mode: "popover"; onFiltersChange: (next: TTableFilterGroup[]) => void; onFilterIconPress?: undefined }
)

export type TNativeTableColumnSortMetadata = { enabled?: boolean; criteriaID: string; queryKey?: string }
export type TNativeTableColumnResizingControls = {
  enabled?: boolean
  minWidth?: number
  maxWidth?: number
  onColumnResize: (details: { columnID: string; width: number }) => void
}
export type TNativeTableSortingControls = {
  activeSorts: TTableSortInstruction[]
  mode?: "single" | "multiple"
  icons?: { ascending?: ReactNode; descending?: ReactNode }
  onSortChange: (nextSorts: TTableSortInstruction[]) => void
}
export type TNativeTableQueryControls = {
  sorting?: TNativeTableSortingControls
  pagination?: TNativePaginationProps
  filtering?: TNativeTableFilteringControls
}

type TStyleProps = { customStyles?: StyleProp<TextStyle>; style?: StyleProp<TextStyle> }
type TColumnMetadataBase<T extends object> = {
  id: string
  name?: string
  headerAriaLabel?: string
  headerVisuallyHidden?: boolean
  isHidden?: boolean
  width?: TextStyle["width"]
  minWidth?: TextStyle["minWidth"]
  maxWidth?: TextStyle["maxWidth"]
  alignment?: "Left" | "Center" | "Right"
  headerAlignment?: "Left" | "Center" | "Right"
  cellRenderer?: (context: { row: T; column: TNativeTableColumnMetadata<T> }) => ReactNode
  customHeaderColumnStyles?: StyleProp<TextStyle>
  customHeaderCellStyles?: StyleProp<TextStyle>
  customBodyCellStyles?: StyleProp<TextStyle>
}
export type TNativeTableColumnMetadata<T extends object> = TColumnMetadataBase<T> &
  (
    | {
        role?: "data"
        accessor?: (row: T) => ReactNode
        isRowHeader?: boolean
        sort?: TNativeTableColumnSortMetadata
        filter?: TNativeTableColumnFilterMetadata
        structuralPosition?: never
        structuralKind?: never
      }
    | {
        role: "structural"
        width: number
        structuralPosition: "left" | "right"
        structuralKind: "action" | "drag" | "selection"
        accessor?: never
        isRowHeader?: never
        sort?: never
        filter?: never
      }
  )
export type TNativeTableProps<T extends object = object> = Omit<ViewProps, "children" | "style"> &
  RefAttributes<View> &
  TStyleProps &
  MultipleSelectionStateProps & {
    children?: ReactNode
    geometry?: TCornerGeometry
    hoverColor?: ColorValue
    zebra?: boolean
    zebraColor?: ColorValue
    labels?: { selection?: Partial<{ selectAllRowsAriaLabel: string; selectRowAriaLabel: string }> }
    clickableRows?: boolean
    onRowAction?: (key: TNativeCollectionKey) => void
    columns?: TNativeTableColumnMetadata<T>[]
    queryControls?: TNativeTableQueryControls
    filteringLabels?: TPartialNativeTableFilteringLabels
    columnResizing?: TNativeTableColumnResizingControls
    disallowSelectAll?: boolean
    escapeKeyBehavior?: "clearSelection" | "none"
    shouldFocusWrap?: boolean
  }
export type TNativeTableHeaderProps<T extends object> = Omit<ViewProps, "children" | "style"> &
  TStyleProps & {
    columns: TNativeTableColumnMetadata<T>[]
    render?: (props: ViewProps & RefAttributes<View>, state: TNativeTableHeaderRenderState) => ReactElement
  } & TNativeTableHoverEvents
export type TNativeTableHeaderRenderState = Readonly<{ isHovered: boolean }>
export type TNativeTableColumnProps = Omit<ViewProps, "id" | "style"> &
  TStyleProps & {
    textValue?: string
    id?: TNativeCollectionKey
    columnID: string
    isRowHeader?: boolean
    allowsSorting?: boolean
    alignment?: TNativeTableColumnMetadata<object>["alignment"]
  }
export type TNativeTableCellRenderState = Readonly<{
  isPressed: boolean
  isFocused: boolean
  isFocusVisible: boolean
  isHovered: boolean
  isSelected: boolean
  isDisabled: boolean
  id?: TNativeCollectionKey
  columnIndex?: number | null
  isTreeColumn: boolean
  isExpanded: boolean
  hasChildItems: boolean
  level: number
  defaultChildren: undefined
}>
export type TNativeTableCellRenderValues = Omit<TNativeTableCellRenderState, "defaultChildren">
export type TNativeTableCellProps = Omit<ViewProps, "id" | "style" | "children"> &
  TStyleProps & {
    children?: ReactNode | ((state: TNativeTableCellRenderState) => ReactNode)
    render?: (props: TNativeFocusViewProps & RefAttributes<View>, state: TNativeTableCellRenderValues) => ReactElement
    textValue?: string
    id?: TNativeCollectionKey
    columnID: string
    alignment?: TNativeTableColumnMetadata<object>["alignment"]
  }
export type TNativeTableRowProps<T extends object> = Omit<ViewProps, "id" | "children" | "style"> &
  Partial<Pick<TNativeLinkProps, "href" | "onNavigationError">> &
  TStyleProps & {
    textValue?: string
    id?: TNativeCollectionKey
    item: T
    columns: TNativeTableColumnMetadata<T>[]
    geometry?: TCornerGeometry
    renderCell?: (context: { row: T; column: TNativeTableColumnMetadata<T> }) => ReactNode
    dependencies?: readonly unknown[]
    isDisabled?: boolean
    onAction?: () => void
  }
export type TNativeTableBodyProps<T extends object> = Omit<ViewProps, "children" | "style"> &
  TStyleProps & {
    items?: T[]
    columns: TNativeTableColumnMetadata<T>[]
    geometry?: TCornerGeometry
    rowKey?: (row: T) => TNativeCollectionKey
    renderCell?: TNativeTableRowProps<T>["renderCell"]
    customRowStyles?: StyleProp<TextStyle>
    isLoading?: boolean
    renderLoadingState?: () => ReactNode
    renderEmptyState?: () => ReactNode
    dependencies?: readonly unknown[]
  }
export type TNativeTableHeaderComponent = <T extends object>(
  props: TNativeTableHeaderProps<T> & RefAttributes<View>,
) => ReactNode
export type TNativeTableBodyComponent = <T extends object>(
  props: TNativeTableBodyProps<T> & RefAttributes<View>,
) => ReactNode
export type TNativeTableRowComponent = <T extends object>(
  props: TNativeTableRowProps<T> & RefAttributes<View>,
) => ReactNode
