import { useContext } from "react"

import { Checkbox } from "../Checkbox/Checkbox"

import { NativeTableCellContext, NativeTableOptionsContext, useNativeTable } from "./context"
import { useTableAction } from "./useTableAction"

export const TableSelectionCheckbox = ({ all = false }: { all?: boolean }) => {
  const table = useNativeTable()
  const options = useContext(NativeTableOptionsContext)
  const cell = useContext(NativeTableCellContext)!
  const action = useTableAction(cell.node, cell.target)
  const parent = cell.node.parentKey
  const disabled = all
    ? table.manager.selectionMode !== "multiple" || table.collection.size === 0
    : parent == null || !table.manager.canSelectItem(parent)
  const selected = all ? table.manager.isSelectAll : parent != null && table.manager.isSelected(parent)
  const request = () => {
    action.request((next, node) => {
      if (all) {
        if (next.manager.selectionMode === "multiple" && next.collection.size > 0) next.manager.toggleSelectAll()
      } else if (node.parentKey != null && next.manager.canSelectItem(node.parentKey)) {
        next.manager.toggleSelection(node.parentKey)
      }
    })
  }
  return (
    <Checkbox
      accessibilityLabel={all ? options.labels.selectAllRowsAriaLabel : options.labels.selectRowAriaLabel}
      showIcon={false}
      order={all ? "primary" : undefined}
      isSelected={selected}
      isDisabled={disabled}
      isIndeterminate={all && !table.manager.isEmpty && !table.manager.isSelectAll}
      onChange={request}
    />
  )
}
