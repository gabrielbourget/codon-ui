import classNames from "classnames"
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

type TTableHeaderCalibration = {
  tableHeaderStyles: string
  tableHeaderStyle: CSSProperties
}

export const calibrateComponent = <T extends object>(props: TTableHeaderProps<T>): TTableHeaderCalibration => {
  const { className, customClassName, customStyles, style } = props

  const tableHeaderStyles = classNames(customClassName, className)
  const tableHeaderStyle = Object.assign({}, { ...customStyles }, { ...style })

  return { tableHeaderStyles, tableHeaderStyle }
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
