import type { TNativeTableColumnMetadata, TNativeTableColumnResizingControls } from "./types"

export const resizeNativeTableColumn = <T extends object>(
  column: TNativeTableColumnMetadata<T>,
  controls: TNativeTableColumnResizingControls,
  width: number,
) => {
  const minimum = typeof column.minWidth === "number" ? column.minWidth : (controls.minWidth ?? 52)
  const maximum =
    typeof column.maxWidth === "number" ? column.maxWidth : (controls.maxWidth ?? Number.POSITIVE_INFINITY)
  controls.onColumnResize({ columnID: column.id, width: Math.round(Math.min(Math.max(width, minimum), maximum)) })
}
