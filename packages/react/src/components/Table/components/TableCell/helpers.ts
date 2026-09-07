import type { CSSProperties } from "react"
import type { CellProps } from "react-aria-components"

import type { TAvailableAlignments } from "../../../../tokens/alignment"

export type TCellProps = Omit<CellProps, "className" | "style"> & {
  alignment?: TAvailableAlignments
  truncate?: boolean
  maxLines?: number
  className?: string
  style?: CSSProperties
  customStyles?: CSSProperties
  customClassName?: string
}
