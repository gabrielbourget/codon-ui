import classNames from "classnames"
import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { type SortDescriptor, type TableProps } from "react-aria-components"

import type { TAvailableAlignments } from "../../tokens/alignment"
import type { TCornerGeometry } from "../../tokens/geometry"
import type { TScreenSizeType } from "../../tokens/responsive"
import type { TPartialTableFilteringLabels } from "../Filtering/labels"
import type { TPaginationProps } from "../Pagination/helpers"

import type { TAvailableListItem } from "./filterMetadata"
import type { TPartialTableLabels } from "./labels"
import {
  TABLE_SORT_DIRECTION__ASCENDING,
  TABLE_SORT_DIRECTION__DESCENDING,
  type TTableFilterArgumentDataType,
  type TTableFilterGroup,
  type TTableFilterOperationCode,
  type TTableSortInstruction,
} from "./queryTypes"
import styles from "./TableStyles.module.css"

export type TCellRenderer<T> = (ctx: { row: T; column: TTableColumnMetadata<T> }) => React.ReactNode

export const TABLE_COLUMN_ROLE__DATA = "data"
export const TABLE_COLUMN_ROLE__STRUCTURAL = "structural"
export const AVAILABLE_TABLE_COLUMN_ROLES = [TABLE_COLUMN_ROLE__DATA, TABLE_COLUMN_ROLE__STRUCTURAL] as const

export type TTableColumnRole = (typeof AVAILABLE_TABLE_COLUMN_ROLES)[number]

export const TABLE_STRUCTURAL_COLUMN_KIND__ACTION = "action"
export const TABLE_STRUCTURAL_COLUMN_KIND__DRAG = "drag"
export const TABLE_STRUCTURAL_COLUMN_KIND__SELECTION = "selection"
export const AVAILABLE_TABLE_STRUCTURAL_COLUMN_KINDS = [
  TABLE_STRUCTURAL_COLUMN_KIND__ACTION,
  TABLE_STRUCTURAL_COLUMN_KIND__DRAG,
  TABLE_STRUCTURAL_COLUMN_KIND__SELECTION,
] as const

export type TTableStructuralColumnKind = (typeof AVAILABLE_TABLE_STRUCTURAL_COLUMN_KINDS)[number]

export const TABLE_STRUCTURAL_COLUMN_POSITION__LEFT = "left"
export const TABLE_STRUCTURAL_COLUMN_POSITION__RIGHT = "right"
export const AVAILABLE_TABLE_STRUCTURAL_COLUMN_POSITIONS = [
  TABLE_STRUCTURAL_COLUMN_POSITION__LEFT,
  TABLE_STRUCTURAL_COLUMN_POSITION__RIGHT,
] as const

export type TTableStructuralColumnPosition = (typeof AVAILABLE_TABLE_STRUCTURAL_COLUMN_POSITIONS)[number]

export type TTableColumnSortMetadata = {
  enabled?: boolean
  criteriaID: string
  queryKey?: string
}

export type TTableColumnFilterMetadata = {
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

export type TTableColumnMetadataBase<T> = {
  id: string
  name?: string
  headerAriaLabel?: string // -> For a11y when header text is hidden.
  headerVisuallyHidden?: boolean
  cellRenderer?: (ctx: { row: T; column: TTableColumnMetadata<T> }) => React.ReactNode
  width?: number | string
  minWidth?: number | string
  maxWidth?: number | string
  hideBelow?: TScreenSizeType
  alignment?: TAvailableAlignments
  headerAlignment?: TAvailableAlignments // -> For header cells (optional, falls back to alignment)
  truncate?: boolean
  maxLines?: number
  isHidden?: boolean
  customHeaderRowStyles?: React.CSSProperties
  customHeaderRowClassname?: string
  customHeaderColumnStyles?: React.CSSProperties
  customHeaderColumnClassName?: string
  customHeaderCellStyles?: React.CSSProperties
  customHeaderCellClassName?: string
  customBodyCellStyles?: React.CSSProperties
  customBodyCellClassName?: string
  customBodyRowStyles?: React.CSSProperties
  customBodyRowClassName?: string
}

export type TTableDataColumnMetadata<T> = TTableColumnMetadataBase<T> & {
  role?: typeof TABLE_COLUMN_ROLE__DATA
  accessor?: (row: T) => ReactNode
  sort?: TTableColumnSortMetadata
  filter?: TTableColumnFilterMetadata
  isRowHeader?: boolean
  structuralKind?: never
  structuralPosition?: never
}

export type TTableStructuralColumnMetadata<T> = TTableColumnMetadataBase<T> & {
  role: typeof TABLE_COLUMN_ROLE__STRUCTURAL
  structuralKind: TTableStructuralColumnKind
  structuralPosition: TTableStructuralColumnPosition
  width: number
  accessor?: never
  sort?: never
  filter?: never
  isRowHeader?: never
}

export type TTableColumnMetadata<T> = TTableDataColumnMetadata<T> | TTableStructuralColumnMetadata<T>

export type TTableSortingControls = {
  activeSorts: TTableSortInstruction[]
  mode?: "single" | "multiple"
  icons?: {
    ascending?: ReactNode
    descending?: ReactNode
  }
  onSortChange: (nextSorts: TTableSortInstruction[]) => void
}

export type TTableFilterIconPressArgs = {
  columnID: string
  columnName: string
  filterGroup?: TTableFilterGroup
}

export const TABLE_FILTERING_CONTROL_MODE__EXTERNAL = "external"
export const TABLE_FILTERING_CONTROL_MODE__POPOVER = "popover"
export const AVAILABLE_TABLE_FILTERING_CONTROL_MODES = [
  TABLE_FILTERING_CONTROL_MODE__EXTERNAL,
  TABLE_FILTERING_CONTROL_MODE__POPOVER,
] as const

export type TTableFilteringControlMode = (typeof AVAILABLE_TABLE_FILTERING_CONTROL_MODES)[number]

export type TTableFilteringControlsBase = {
  activeFilters: TTableFilterGroup[]
  icons?: {
    inactive?: ReactNode
    active?: ReactNode
  }
}

export type TTableFilteringControls =
  | (TTableFilteringControlsBase & {
      mode?: undefined
      onFiltersChange?: undefined
      onFilterIconPress?: undefined
    })
  | (TTableFilteringControlsBase & {
      mode?: typeof TABLE_FILTERING_CONTROL_MODE__EXTERNAL
      onFiltersChange?: undefined
      onFilterIconPress: (args: TTableFilterIconPressArgs) => void
    })
  | (TTableFilteringControlsBase & {
      mode: typeof TABLE_FILTERING_CONTROL_MODE__POPOVER
      onFiltersChange: (nextFilters: TTableFilterGroup[]) => void
      onFilterIconPress?: undefined
    })

export type TTablePaginationControls = TPaginationProps

export type TTableQueryControls = {
  sorting?: TTableSortingControls
  filtering?: TTableFilteringControls
  pagination?: TTablePaginationControls
}

export type TTableColumnResizeDetails = {
  columnID: string
  width: number
}

export type TTableColumnResizingControls = {
  enabled?: boolean
  maxWidth?: number
  minWidth?: number
  onColumnResize: (details: TTableColumnResizeDetails) => void
}

export type TColumnKey<K extends string = string> = K
export type TAvailableBreakpointNames = TScreenSizeType

export type TColumnSizingInstructions = { kind: "fixed"; px: number } | { kind: "flex"; weight: number }

export type TBreakpointSizingInstructions<K extends string> = Partial<Record<TColumnKey<K>, TColumnSizingInstructions>>

export type TColumnSizingConstraints = {
  width?: number | string
  minWidth?: number
  maxWidth?: number
}

export type TColumnSizingReservation = {
  reservedFixedWidthPx?: number
  reservedColumnCount?: number
}

export type GetColumnsFn<T> = (bp: TAvailableBreakpointNames) => T[]

// sortDescriptor and onSortChange are omitted because the table owns those
// internally via useTableSortBridge. Callers drive sort state exclusively
// through queryControls.sorting.
export type TTableProps<TRow extends object = Record<string, unknown>> = Omit<
  TableProps,
  "sortDescriptor" | "onSortChange" | "className" | "style"
> & {
  stickyHeader?: boolean // Stub for now - ref. point Sept 01, 2025
  zebra?: boolean
  hoverColor?: string
  zebraColor?: string
  geometry?: TCornerGeometry
  clickableRows?: boolean
  onRowAction?: (key: string | number) => void
  customClassName?: string
  customStyles?: React.CSSProperties
  className?: string
  style?: React.CSSProperties
  // -> Both must be provided together. If omitted the table is sort/filter-inert.
  columns?: TTableColumnMetadata<TRow>[]
  queryControls?: TTableQueryControls
  columnResizing?: TTableColumnResizingControls
  filteringLabels?: TPartialTableFilteringLabels
  labels?: TPartialTableLabels
}

// Bridges TTableSortInstruction[] state into the single-column SortDescriptor
// that RAC Table requires for header arrow rendering and click events, and
// translates RAC click events back into a TTableSortInstruction[] update.
//
// The consumer owns activeSorts state and decides what to do with the emitted
// array — sort client-side rows directly, or pass it as query params for a
// server fetch. This hook only computes intent; it never touches data rows.
//
// Tri-state cycle per column: none → ascending → descending → none.
// RAC receives only one sortDescriptor, so secondary sorted columns cannot
// rely on RAC's emitted direction. The bridge computes each column's next
// state from activeSorts, which keeps stacked sorts cycling independently.
//
// mode "single" (default): each click replaces activeSorts with a one-item
// array. mode "multiple": clicks append or update in activation order — the
// first-clicked column stays primary and later columns act as tiebreakers.
// Removing a column in multiple mode splices only that entry; remaining sorts
// preserve their relative priority.
//
// queryKey on TTableSortInstruction carries the backend field path so a
// server-driven consumer can map activeSorts directly to query params without
// any column metadata lookups at request time.
export const computeNextTableSorts = <TRow extends object>(args: {
  activeSorts: TTableSortInstruction[]
  column: TTableColumnMetadata<TRow>
  mode?: TTableSortingControls["mode"]
}): TTableSortInstruction[] => {
  const { activeSorts, column, mode } = args
  if (!column.sort?.criteriaID) return activeSorts

  const currentSortIndex = activeSorts.findIndex((sort) => sort.criteriaID === column.sort!.criteriaID)
  const currentSort = currentSortIndex >= 0 ? activeSorts[currentSortIndex] : undefined

  const nextSortDirection =
    currentSort?.sortDirection === TABLE_SORT_DIRECTION__ASCENDING
      ? TABLE_SORT_DIRECTION__DESCENDING
      : currentSort?.sortDirection === TABLE_SORT_DIRECTION__DESCENDING
        ? undefined
        : TABLE_SORT_DIRECTION__ASCENDING

  if (!nextSortDirection) {
    return mode === "multiple" ? activeSorts.filter((sort) => sort.criteriaID !== column.sort!.criteriaID) : []
  }

  const nextInstruction: TTableSortInstruction = {
    id: `sort-${column.sort.criteriaID}`,
    criteriaID: column.sort.criteriaID,
    criteriaName: column.name ?? column.id,
    queryKey: column.sort.queryKey,
    sortDirection: nextSortDirection,
  }

  if (mode !== "multiple") return [nextInstruction]

  if (currentSortIndex < 0) return [...activeSorts, nextInstruction]

  return activeSorts.map((sort, index) => (index === currentSortIndex ? nextInstruction : sort))
}

export const useTableSortBridge = <TRow extends object>(
  sorting: TTableSortingControls | undefined,
  columns: TTableColumnMetadata<TRow>[] | undefined,
): { sortDescriptor: SortDescriptor | undefined; handleSortChange: (descriptor: SortDescriptor) => void } => {
  const sortDescriptor = useMemo((): SortDescriptor | undefined => {
    if (!sorting || !columns) return undefined
    const activeSort = sorting.activeSorts[0]
    if (!activeSort) return undefined
    const col = columns.find((c) => c.sort?.criteriaID === activeSort.criteriaID)
    if (!col) return undefined
    return {
      column: col.id,
      direction: activeSort.sortDirection === TABLE_SORT_DIRECTION__ASCENDING ? "ascending" : "descending",
    }
  }, [sorting, columns])

  const handleSortChange = useCallback(
    (descriptor: SortDescriptor) => {
      if (!sorting || !columns) return

      const col = columns.find((c) => c.id === descriptor.column)
      if (!col?.sort?.criteriaID) return

      sorting.onSortChange(
        computeNextTableSorts({
          activeSorts: sorting.activeSorts,
          column: col,
          mode: sorting.mode,
        }),
      )
    },
    [sorting, columns],
  )

  return { sortDescriptor, handleSortChange }
}

export type TNormalizedTableColumns<T> = {
  dataColumns: TTableDataColumnMetadata<T>[]
  structuralColumns: TTableStructuralColumnMetadata<T>[]
  leftStructuralColumns: TTableStructuralColumnMetadata<T>[]
  rightStructuralColumns: TTableStructuralColumnMetadata<T>[]
  visibleColumns: TTableColumnMetadata<T>[]
  reservedStructuralColumnWidthPx: number
  reservedStructuralColumnCount: number
}

export const isTableStructuralColumn = <T extends object>(
  column: TTableColumnMetadata<T>,
): column is TTableStructuralColumnMetadata<T> => column.role === TABLE_COLUMN_ROLE__STRUCTURAL

export const isTableDataColumn = <T extends object>(
  column: TTableColumnMetadata<T>,
): column is TTableDataColumnMetadata<T> => !isTableStructuralColumn(column)

export const getAllowedTableColumnFilterOperationCodes = <T extends object>(
  column: TTableColumnMetadata<T>,
): readonly TTableFilterOperationCode[] => {
  if (!isTableDataColumn(column)) return []

  return column.filter?.allowedOperationCodes ?? []
}

export const normalizeTableColumns = <T extends object>(
  columns: TTableColumnMetadata<T>[],
): TNormalizedTableColumns<T> => {
  const visibleSourceColumns = columns.filter((column) => !column.isHidden)
  const dataColumns = visibleSourceColumns.filter(isTableDataColumn)
  const structuralColumns = visibleSourceColumns.filter(isTableStructuralColumn)
  const leftStructuralColumns = structuralColumns.filter(
    (column) => column.structuralPosition === TABLE_STRUCTURAL_COLUMN_POSITION__LEFT,
  )
  const rightStructuralColumns = structuralColumns.filter(
    (column) => column.structuralPosition === TABLE_STRUCTURAL_COLUMN_POSITION__RIGHT,
  )
  const reservedStructuralColumnWidthPx = structuralColumns.reduce((sum, column) => sum + column.width, 0)

  return {
    dataColumns,
    structuralColumns,
    leftStructuralColumns,
    rightStructuralColumns,
    visibleColumns: [...leftStructuralColumns, ...dataColumns, ...rightStructuralColumns],
    reservedStructuralColumnWidthPx,
    reservedStructuralColumnCount: structuralColumns.length,
  }
}

export const defaultCellRenderer = <T extends object>({
  row,
  column,
}: {
  row: T
  column: TTableColumnMetadata<T>
}): ReactNode => {
  if (column.accessor) return column.accessor(row)

  const raw = (row as Record<string, unknown>)[column.id]

  if (raw == null) return null
  if (typeof raw === "boolean") return raw ? "True" : "False"
  if (typeof raw === "string" || typeof raw === "number") return raw
  return typeof raw === "object" ? JSON.stringify(raw) : String(raw)
}

// create a stable, comparable signature for the structure
const buildColumnsKey = <TRow extends object>(columns: TTableColumnMetadata<TRow>[]) =>
  normalizeTableColumns(columns)
    .visibleColumns.map((c) => c.id)
    .join("|")

export function useStableColumns<TRow extends object>(
  breakpoint: TAvailableBreakpointNames,
  getColumns: GetColumnsFn<TTableColumnMetadata<TRow>>,
) {
  // -> Last committed columns used by both header and rows.
  const [columns, setColumns] = useState<TTableColumnMetadata<TRow>[]>(() => getColumns(breakpoint))
  const rafRef = useRef<number | null>(null)

  const visibleColumns = useMemo(() => normalizeTableColumns(columns).visibleColumns, [columns])
  const columnsKey = useMemo(() => buildColumnsKey(columns), [columns])

  // -> When the breakpoint flips, schedule one atomic columns update.
  useEffect(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      setColumns(getColumns(breakpoint))
    })
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [breakpoint, getColumns])

  return { columns, visibleColumns, columnsKey }
}

// -> Dynamically computes sizing constraints for a table column, given current screen width.
export const computeColumnSizingConstraintsForBreakpoint = <K extends string>(
  activeColumn: TColumnKey<K>[],
  sizing: TBreakpointSizingInstructions<K>,
  cellGapPx: number,
  reservation: TColumnSizingReservation = {},
): Record<TColumnKey<K>, TColumnSizingConstraints> => {
  const reservedFixedWidthPx = reservation.reservedFixedWidthPx ?? 0
  const reservedColumnCount = reservation.reservedColumnCount ?? 0
  const fixedSumPx = activeColumn.reduce((sum, key) => {
    const sizingInstructions = sizing[key]
    return sizingInstructions?.kind === "fixed" ? sum + sizingInstructions.px : sum
  }, reservedFixedWidthPx)

  const flexColumns = activeColumn.filter((k) => sizing[k]?.kind === "flex")
  const flexTotalWeight = flexColumns.reduce((sum, key) => {
    const sizingInstructions = sizing[key]
    return sum + (sizingInstructions && sizingInstructions.kind === "flex" ? sizingInstructions.weight : 0)
  }, 0)

  const gapSumPx = Math.max(0, activeColumn.length + reservedColumnCount - 1) * cellGapPx
  // const remainderExpression = `calc(100% - ${fixedSumPx + gapSumPx}px)`

  const columnSizingConstraints = {} as Record<TColumnKey, TColumnSizingConstraints>

  for (const columnKey of activeColumn) {
    const sizingInstructions = sizing[columnKey]
    if (!sizingInstructions) continue

    if (sizingInstructions.kind === "fixed") {
      columnSizingConstraints[columnKey] = { width: sizingInstructions.px }
    } else {
      const share = sizingInstructions.weight / (flexTotalWeight || 1)
      columnSizingConstraints[columnKey] = {
        width: `calc(calc(100% - ${fixedSumPx + gapSumPx}px) * ${share})`,
      }
    }
  }

  return columnSizingConstraints
}

export const calibrateComponent = <TRow extends object>(props: TTableProps<TRow>) => {
  const { className, customClassName, customStyles, hoverColor, style, zebra, zebraColor } = props

  const zebraStyle = zebra ? styles["table--zebra"] : undefined

  const tableStyles = classNames(styles.table, zebraStyle, customClassName, className)
  const tableStyle = Object.assign(
    {
      "--hoverColor": hoverColor ?? "transparent",
      "--zebraColor": zebraColor ?? "transparent",
    },
    { ...customStyles },
    { ...style },
  ) as React.CSSProperties

  return { tableStyles, tableStyle }
}
