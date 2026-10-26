import { useContext } from "react"

import { NativeTableStateContext } from "../context"
import { Table } from "../Table"

export const tableStateCalls = [
  <Table expandedKeys={new Set([0, ""])} treeColumn="name" onExpandedChange={(keys) => keys.has(0)} />,
  <Table defaultExpandedKeys={["a"]} slot={null} />,
  // @ts-expect-error Expansion remains an iterable of source keys, never a scalar mirror.
  <Table expandedKeys={true} />,
  // @ts-expect-error Native state keys retain their source string/number shape.
  <Table treeColumn={{ id: "name" }} />,
  // @ts-expect-error A complete real state is required, rather than a selection-only DTO.
  <NativeTableStateContext.Provider value={{ selectionManager: {} }} />,
]
export const StateConsumer = () => {
  const state = useContext(NativeTableStateContext)
  if (!state) return null
  state.sort(0, "descending")
  state.toggleKey("")
  state.setKeyboardNavigationDisabled(false)
  state.selectionManager.setFocusedKey(state.collection.getFirstKey())
  const column = state.collection.columns[0]
  const _legacySpan: number | undefined = column.colspan
  const _columnKey = state.collection.getItem("cell")?.column?.key
  void [_legacySpan, _columnKey]
  // @ts-expect-error The native state retains all source sort directions and rejects invented ones.
  state.sort("name", "up")
  // @ts-expect-error Keyboard navigation state is Boolean.
  state.setKeyboardNavigationDisabled("false")
  // @ts-expect-error Original keys are not normalized from object IDs.
  state.toggleKey({ id: "a" })
  return null
}
