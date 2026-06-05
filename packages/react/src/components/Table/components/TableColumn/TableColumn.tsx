"use client"

import type { FC } from "react"
import { type ColumnProps, Column as AdobeColumn } from "react-aria-components"

const TableColumn: FC<ColumnProps> = (props) => <AdobeColumn {...props} />

export default TableColumn
