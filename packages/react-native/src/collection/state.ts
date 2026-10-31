import { createContext } from "react"

import type { ListState } from "./state/useListState"

export { useListState, UNSTABLE_useFilteredListState } from "./state/useListState"
export { useTreeState } from "./state/useTreeState"
export { useMultipleSelectionState } from "./state/useMultipleSelectionState"
export type { ListState as TNativeListState } from "./state/useListState"
export type { TreeState as TNativeTreeState } from "./state/useTreeState"

export const NativeListStateContext = createContext<ListState<object> | null>(null)
