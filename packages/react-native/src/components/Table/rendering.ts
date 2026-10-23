import type { ReactNode } from "react"

import type { TNativeTableColumnMetadata } from "./types"

export const getNativeTableColumns = <T extends object>(columns: TNativeTableColumnMetadata<T>[]) => {
  const visible = columns.filter((column) => !column.isHidden)
  return [
    ...visible.filter((column) => column.role === "structural" && column.structuralPosition === "left"),
    ...visible.filter((column) => column.role !== "structural"),
    ...visible.filter((column) => column.role === "structural" && column.structuralPosition === "right"),
  ]
}
export const renderNativeTableValue = <T extends object>({
  row,
  column,
}: {
  row: T
  column: TNativeTableColumnMetadata<T>
}): ReactNode => {
  if (column.accessor) return column.accessor(row)
  const value = (row as Record<string, unknown>)[column.id]
  if (value == null) return null
  if (typeof value === "boolean") return value ? "True" : "False"
  if (typeof value === "string" || typeof value === "number") return value
  return typeof value === "object" ? JSON.stringify(value) : String(value)
}
