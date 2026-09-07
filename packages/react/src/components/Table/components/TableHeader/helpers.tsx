import type { CSSProperties, ReactNode } from "react"
import type { TableHeaderProps } from "react-aria-components"

import type { TTableColumnMetadata, TTableFilteringControls, TTableSortingControls } from "../../helpers"

import {
  TableHeaderDefaultFilterIcon,
  TableHeaderDefaultSortAscendingIcon,
  TableHeaderDefaultSortDescendingIcon,
} from "./DefaultTableHeaderIcons"

export type TTableHeaderProps<T extends object> = Omit<
  TableHeaderProps<T>,
  "className" | "columns" | "children" | "style"
> & {
  columns: TTableColumnMetadata<T>[]
  className?: string
  style?: CSSProperties
  customStyles?: CSSProperties
  customClassName?: string
}

export const calibrateSortIcons = (
  iconOverrides?: TTableSortingControls["icons"],
): { ascendingIcon: ReactNode; descendingIcon: ReactNode } => ({
  ascendingIcon: iconOverrides?.ascending ?? (
    <TableHeaderDefaultSortAscendingIcon size={14} data-testid="table-header-default-sort-ascending-icon" />
  ),
  descendingIcon: iconOverrides?.descending ?? (
    <TableHeaderDefaultSortDescendingIcon size={14} data-testid="table-header-default-sort-descending-icon" />
  ),
})

export const calibrateFilterIcons = (
  iconOverrides?: TTableFilteringControls["icons"],
): { inactiveFilterIcon: ReactNode; activeFilterIcon: ReactNode } => ({
  inactiveFilterIcon: iconOverrides?.inactive ?? (
    <TableHeaderDefaultFilterIcon size={14} data-testid="table-header-default-inactive-filter-icon" />
  ),
  activeFilterIcon: iconOverrides?.active ?? (
    <TableHeaderDefaultFilterIcon size={14} data-testid="table-header-default-active-filter-icon" />
  ),
})
