import type { CSSProperties, ReactNode } from "react"
import type { Key as RACKey, TableBodyProps } from "react-aria-components"

import type { TCornerGeometry } from "../../../../tokens/geometry"
import type { TCellRenderer, TTableColumnMetadata } from "../../helpers"

export type TTableBodyProps<T extends object> = Omit<
  TableBodyProps<T>,
  "children" | "className" | "items" | "style"
> & {
  items?: T[]
  columns: TTableColumnMetadata<T>[]
  isLoading?: boolean
  geometry?: TCornerGeometry
  rowKey?: (row: T) => RACKey
  renderEmptyState?: () => ReactNode
  renderLoadingState?: () => ReactNode
  renderCell?: TCellRenderer<T> // <- explicit fallback renderer
  className?: string
  style?: CSSProperties
  customClassName?: string
  customStyles?: CSSProperties
  customRowClassName?: string
  customRowStyles?: CSSProperties
}
