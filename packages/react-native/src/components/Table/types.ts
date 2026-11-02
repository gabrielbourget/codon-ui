import type { ReactElement, ReactNode, RefAttributes } from "react"
import type {
  ColorValue,
  NativeSyntheticEvent,
  PointerEvent,
  ScrollViewProps,
  StyleProp,
  TextStyle,
  View,
  ViewProps,
} from "react-native"
import type { TableStateProps } from "react-stately/useTableState"
import type { ColumnSize, ColumnStaticSize } from "react-stately/useTableState"

import type { TNativeSlotProps } from "../../collection/context"
import type { TNativeDragAndDropHooks } from "../../collection/dragAndDrop/hooks"
import type { TNativeCollectionKey } from "../../collection/snapshot"
import type { MultipleSelectionStateProps } from "../../collection/state/useMultipleSelectionState"
import type { TNativeFocusViewProps } from "../../input/types"
import type { TCornerGeometry } from "../../tokens/geometry"
import type { TNativeButtonProps } from "../Button/types"
import type { TNativeLinkProps } from "../Link/types"
import type { TNativePaginationProps } from "../Pagination/types"

import type { TPartialNativeTableFilteringLabels } from "./filterLabels"
import type { TAvailableListItem } from "./filterMetadata"
import type { TPartialNativeTableLabels } from "./labels"
import type {
  TTableSortInstruction,
  TTableFilterGroup,
  TTableFilterArgumentDataType,
  TTableFilterOperationCode,
} from "./queryTypes"
import type { TNativeTableState } from "./state/useTableState"
import type { TNativeTableStickyOffset } from "./stickyStyles"
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
export type TNativeTableColumnResizeDetails = { columnID: string; width: number }
export type TNativeTableColumnResizingControls = {
  enabled?: boolean
  minWidth?: number
  maxWidth?: number
  onColumnResize: (details: TNativeTableColumnResizeDetails) => void
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

type TNativeTableTouchCaptureProps = {
  onTouchStartCapture?: ViewProps["onTouchStart"]
  onTouchMoveCapture?: ViewProps["onTouchMove"]
  onTouchCancelCapture?: ViewProps["onTouchCancel"]
}
type TNativeTablePointerEventProps = {
  onPointerOver?: ViewProps["onPointerDown"]
  onPointerOverCapture?: ViewProps["onPointerDown"]
  onPointerOut?: ViewProps["onPointerDown"]
  onPointerOutCapture?: ViewProps["onPointerDown"]
  onGotPointerCapture?: ViewProps["onPointerDown"]
  onGotPointerCaptureCapture?: ViewProps["onPointerDown"]
  onLostPointerCapture?: ViewProps["onPointerDown"]
  onLostPointerCaptureCapture?: ViewProps["onPointerDown"]
}
type TNativeTableUnsupportedHostProps = {
  translate?: never
  inert?: never
  onAuxClick?: never
  onAuxClickCapture?: never
  onContextMenu?: never
  onContextMenuCapture?: never
  onDoubleClick?: never
  onDoubleClickCapture?: never
  onWheel?: never
  onWheelCapture?: never
  onScroll?: never
  onScrollCapture?: never
  onScrollEnd?: never
  onScrollEndCapture?: never
  defaultChecked?: never
  defaultValue?: never
  autoCapitalize?: never
  contentEditable?: never
  enterKeyHint?: never
  spellCheck?: never
  autoCorrect?: never
  unselectable?: never
  inputMode?: never
  onCopy?: never
  onCopyCapture?: never
  onCut?: never
  onCutCapture?: never
  onPaste?: never
  onPasteCapture?: never
  onCompositionEnd?: never
  onCompositionEndCapture?: never
  onCompositionStart?: never
  onCompositionStartCapture?: never
  onCompositionUpdate?: never
  onCompositionUpdateCapture?: never
  onChange?: never
  onChangeCapture?: never
  onBeforeInput?: never
  onBeforeInputCapture?: never
  onInput?: never
  onInputCapture?: never
  onReset?: never
  onResetCapture?: never
  onSubmit?: never
  onSubmitCapture?: never
  onInvalid?: never
  onInvalidCapture?: never
  onLoad?: never
  onLoadCapture?: never
  onError?: never
  onErrorCapture?: never
  onAbort?: never
  onAbortCapture?: never
  onCanPlay?: never
  onCanPlayCapture?: never
  onCanPlayThrough?: never
  onCanPlayThroughCapture?: never
  onDurationChange?: never
  onDurationChangeCapture?: never
  onEmptied?: never
  onEmptiedCapture?: never
  onEncrypted?: never
  onEncryptedCapture?: never
  onEnded?: never
  onEndedCapture?: never
  onLoadedData?: never
  onLoadedDataCapture?: never
  onLoadedMetadata?: never
  onLoadedMetadataCapture?: never
  onLoadStart?: never
  onLoadStartCapture?: never
  onPause?: never
  onPauseCapture?: never
  onPlay?: never
  onPlayCapture?: never
  onPlaying?: never
  onPlayingCapture?: never
  onProgress?: never
  onProgressCapture?: never
  onRateChange?: never
  onRateChangeCapture?: never
  onSeeked?: never
  onSeekedCapture?: never
  onSeeking?: never
  onSeekingCapture?: never
  onStalled?: never
  onStalledCapture?: never
  onSuspend?: never
  onSuspendCapture?: never
  onTimeUpdate?: never
  onTimeUpdateCapture?: never
  onVolumeChange?: never
  onVolumeChangeCapture?: never
  onWaiting?: never
  onWaitingCapture?: never
  onSelect?: never
  onSelectCapture?: never
  "aria-activedescendant"?: never
  "aria-atomic"?: never
  "aria-autocomplete"?: never
  "aria-braillelabel"?: never
  "aria-brailleroledescription"?: never
  "aria-colcount"?: never
  "aria-colindex"?: never
  "aria-colindextext"?: never
  "aria-colspan"?: never
  "aria-controls"?: never
  "aria-current"?: never
  "aria-description"?: never
  "aria-errormessage"?: never
  "aria-flowto"?: never
  "aria-haspopup"?: never
  "aria-invalid"?: never
  "aria-keyshortcuts"?: never
  "aria-level"?: never
  "aria-multiline"?: never
  "aria-multiselectable"?: never
  "aria-orientation"?: never
  "aria-owns"?: never
  "aria-placeholder"?: never
  "aria-posinset"?: never
  "aria-pressed"?: never
  "aria-readonly"?: never
  "aria-relevant"?: never
  "aria-required"?: never
  "aria-roledescription"?: never
  "aria-rowcount"?: never
  "aria-rowindex"?: never
  "aria-rowindextext"?: never
  "aria-rowspan"?: never
  "aria-setsize"?: never
  "aria-sort"?: never
  contextMenu?: never
  popover?: never
  popoverTargetAction?: never
  popoverTarget?: never
  onAnimationStart?: never
  onAnimationStartCapture?: never
  onAnimationEnd?: never
  onAnimationEndCapture?: never
  onAnimationIteration?: never
  onAnimationIterationCapture?: never
  onToggle?: never
  onBeforeToggle?: never
  onTransitionCancel?: never
  onTransitionCancelCapture?: never
  onTransitionEnd?: never
  onTransitionEndCapture?: never
  onTransitionRun?: never
  onTransitionRunCapture?: never
  onTransitionStart?: never
  onTransitionStartCapture?: never
  suppressContentEditableWarning?: never
  suppressHydrationWarning?: never
  nonce?: never
  slot?: never
  radioGroup?: never
  about?: never
  content?: never
  datatype?: never
  inlist?: never
  prefix?: never
  property?: never
  rel?: never
  resource?: never
  rev?: never
  typeof?: never
  vocab?: never
  autoSave?: never
  color?: never
  itemProp?: never
  itemScope?: never
  itemType?: never
  itemID?: never
  itemRef?: never
  results?: never
  security?: never
  is?: never
  exportparts?: never
  part?: never
  dir?: never
  hidden?: never
  lang?: never
  title?: never
  accessKey?: never
  autoFocus?: never
  onKeyPress?: never
  onKeyPressCapture?: never
  dangerouslySetInnerHTML?: never
}
type TNativeTableClickProps = {
  onClick?: (event: PointerEvent | NativeSyntheticEvent<Record<never, never>>) => void
  onClickCapture?: (event: PointerEvent | NativeSyntheticEvent<Record<never, never>>) => void
}
type TNativeTableHostEventProps = TNativeTableTouchCaptureProps & TNativeTablePointerEventProps & TNativeTableClickProps
type TNativeTableViewHostProps = Omit<ViewProps, keyof TNativeTableUnsupportedHostProps> &
  TNativeTableUnsupportedHostProps &
  TNativeTableHostEventProps
type TNativeTableFocusHostProps = Omit<TNativeFocusViewProps, keyof TNativeTableUnsupportedHostProps> &
  TNativeTableUnsupportedHostProps &
  TNativeTableHostEventProps
type TNativeTableRootAccessibilityProps = {
  accessible?: false
  role?: "grid"
  accessibilityRole?: never
}
type TNativeTableRootHostProps = Omit<TNativeTableFocusHostProps, keyof TNativeTableRootAccessibilityProps> &
  TNativeTableRootAccessibilityProps
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
  truncate?: boolean
  maxLines?: number
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
export type TNativeTableRenderState = Readonly<{
  isFocused: boolean
  isFocusVisible: boolean
  isDropTarget: boolean
  state: TNativeTableState<object>
}>
export type TNativeTableRenderStyle =
  | StyleProp<TextStyle>
  | ((values: TNativeTableRenderState & { defaultStyle: TextStyle }) => StyleProp<TextStyle>)
export type TNativeTableInheritedProps = Omit<
  TNativeTableViewHostProps,
  "children" | "style" | "onFocus" | "onBlur" | "slot" | "onScroll" | keyof TNativeTableRootAccessibilityProps
> &
  TNativeTableRootAccessibilityProps &
  Pick<TNativeFocusViewProps, "onFocus" | "onBlur"> &
  RefAttributes<View> &
  MultipleSelectionStateProps &
  TNativeSlotProps &
  Pick<
    TableStateProps<object>,
    "expandedKeys" | "defaultExpandedKeys" | "onExpandedChange" | "treeColumn" | "sortDescriptor" | "onSortChange"
  > & {
    children?: ReactNode
    ariaDescribedBy?: string | readonly string[]
    ariaDetails?: string | readonly string[]
    "aria-describedby"?: string
    "aria-details"?: string
    "data-testid"?: string
    style?: TNativeTableRenderStyle
    render?: (props: TNativeTableRootHostProps & RefAttributes<View>, state: TNativeTableRenderState) => ReactElement
    onRowAction?: (key: TNativeCollectionKey) => void
    disallowSelectAll?: boolean
    escapeKeyBehavior?: "clearSelection" | "none"
    shouldFocusWrap?: boolean
    onScroll?: ScrollViewProps["onScroll"]
  }
export type TNativeTableProps<T extends object = object> = Omit<
  TNativeTableInheritedProps,
  "style" | "sortDescriptor" | "onSortChange"
> &
  TStyleProps & {
    dragAndDropHooks?: TNativeDragAndDropHooks<T>
    geometry?: TCornerGeometry
    hoverColor?: ColorValue
    zebra?: boolean
    zebraColor?: ColorValue
    labels?: TPartialNativeTableLabels
    clickableRows?: boolean
    columns?: TNativeTableColumnMetadata<T>[]
    queryControls?: TNativeTableQueryControls
    filteringLabels?: TPartialNativeTableFilteringLabels
    columnResizing?: TNativeTableColumnResizingControls
    stickyHeader?: boolean
    stickyHeaderOffset?: TNativeTableStickyOffset
    stickyHeaderBackgroundColor?: ColorValue
  }
export type TNativeTableReceivedProps<T extends object> = Omit<TNativeTableProps<T>, "style"> &
  Pick<TNativeTableInheritedProps, "style" | "sortDescriptor" | "onSortChange">
export type TNativeTableHeaderProps<T extends object> = Omit<TNativeTableViewHostProps, "children" | "style"> &
  TStyleProps & {
    columns: TNativeTableColumnMetadata<T>[]
    render?: (
      props: TNativeTableViewHostProps & RefAttributes<View>,
      state: TNativeTableHeaderRenderState,
    ) => ReactElement
  } & TNativeTableHoverEvents
export type TNativeTableHeaderRenderState = Readonly<{ isHovered: boolean }>
export type TNativeTableColumnRenderState = Readonly<{
  isHovered: boolean
  isPressed: boolean
  isFocused: boolean
  isFocusVisible: boolean
  allowsSorting: boolean | undefined
  sortDirection: "ascending" | "descending" | undefined
  isResizing: boolean
  sort: (direction: "ascending" | "descending") => void
  startResize: () => void
}>
export type TNativeTableColumnProps = Omit<TNativeTableFocusHostProps, "id" | "style" | "children"> & {
  customStyles?: StyleProp<TextStyle>
  style?:
    | StyleProp<TextStyle>
    | ((state: TNativeTableColumnRenderState & { defaultStyle: TextStyle }) => StyleProp<TextStyle>)
  children?: ReactNode | ((state: TNativeTableColumnRenderState & { defaultChildren: undefined }) => ReactNode)
  render?: (
    props: TNativeTableFocusHostProps & RefAttributes<View>,
    state: TNativeTableColumnRenderState,
  ) => ReactElement
  width?: ColumnSize | null
  defaultWidth?: ColumnSize | null
  minWidth?: ColumnStaticSize | null
  maxWidth?: ColumnStaticSize | null
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
export type TNativeTableCellProps = Omit<TNativeTableViewHostProps, "id" | "style" | "children"> &
  TStyleProps & {
    children?: ReactNode | ((state: TNativeTableCellRenderState) => ReactNode)
    render?: (
      props: TNativeTableFocusHostProps & RefAttributes<View>,
      state: TNativeTableCellRenderValues,
    ) => ReactElement
    textValue?: string
    id?: TNativeCollectionKey
    colSpan?: number
    columnID: string
    alignment?: TNativeTableColumnMetadata<object>["alignment"]
    truncate?: boolean
    maxLines?: number
  }
type TNativeTableRowNavigationBoundaryProps = {
  target?: never
  download?: never
  ping?: never
  referrerPolicy?: never
  rel?: never
  hrefLang?: never
  routerOptions?: never
}
export type TNativeTableRowProps<T extends object> = Omit<TNativeTableFocusHostProps, "id" | "children" | "style"> &
  TNativeTableRowNavigationBoundaryProps &
  Partial<Pick<TNativeLinkProps, "href" | "onNavigationError">> &
  TNativeTableHoverEvents &
  Pick<TNativeButtonProps, "onPress" | "onPressStart" | "onPressEnd" | "onPressUp" | "onPressChange"> &
  TStyleProps & {
    children?: never
    render?: (
      props: TNativeTableFocusHostProps & TNativeTableRowNavigationBoundaryProps & RefAttributes<View>,
      state: TNativeTableRowRenderState,
    ) => ReactElement
    textValue?: string
    id?: TNativeCollectionKey
    hasChildItems?: boolean
    iconColor?: ColorValue
    item: T
    value?: T
    columns: TNativeTableColumnMetadata<T>[]
    geometry?: TCornerGeometry
    renderCell?: (context: { row: T; column: TNativeTableColumnMetadata<T> }) => ReactNode
    dependencies?: readonly unknown[]
    isDisabled?: boolean
    onAction?: () => void
    "data-testid"?: string
    "aria-describedby"?: string
    "aria-details"?: string
    ariaDescribedBy?: string | readonly string[]
    ariaDetails?: string | readonly string[]
  }
export type TNativeTableRowRenderState = Readonly<{
  isPressed: boolean
  isSelected: boolean
  isFocused: boolean
  isDisabled: boolean
  allowsSelection: boolean
  hasAction: boolean
  isHovered: boolean
  isFocusVisible: boolean
  selectionMode: "none" | "single" | "multiple"
  selectionBehavior: "toggle" | "replace"
  isDragging: boolean | undefined
  isDropTarget: boolean | undefined
  isFocusVisibleWithin: boolean
  id: TNativeCollectionKey
  hasChildItems: boolean
  isExpanded: boolean
  level: number
}>
export type TNativeTableBodyProps<T extends object> = Omit<TNativeTableViewHostProps, "children" | "style"> &
  TStyleProps & {
    render?: (
      props: TNativeTableViewHostProps & RefAttributes<View>,
      state: TNativeTableBodyRenderState,
    ) => ReactElement
    items?: T[]
    columns: TNativeTableColumnMetadata<T>[]
    geometry?: TCornerGeometry
    rowKey?: (row: T) => TNativeCollectionKey
    renderCell?: TNativeTableRowProps<T>["renderCell"]
    customRowStyles?: StyleProp<TextStyle>
    isLoading?: boolean
    renderLoadingState?: () => ReactNode
    renderEmptyState?: (state?: TNativeTableBodyRenderState) => ReactNode
    dependencies?: readonly unknown[]
  }
export type TNativeTableBodyRenderState = Readonly<{ isEmpty: boolean; isDropTarget: boolean }>
export type TNativeTableHeaderComponent = <T extends object>(
  props: TNativeTableHeaderProps<T> & RefAttributes<View>,
) => ReactNode
export type TNativeTableBodyComponent = <T extends object>(
  props: TNativeTableBodyProps<T> & RefAttributes<View>,
) => ReactNode
export type TNativeTableRowComponent = <T extends object>(
  props: TNativeTableRowProps<T> & RefAttributes<View>,
) => ReactNode
