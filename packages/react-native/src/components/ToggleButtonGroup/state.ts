/* Copyright 2024 Adobe. Licensed under Apache-2.0; see ../../collection/LICENSE.react-aria.md. */
import { useMemo } from "react"

import { useControlledState } from "../../collection/state/useControlledState"

export const NATIVE_TOGGLE_GROUP_SELECTION_MODES = ["single", "multiple"] as const
export type TNativeToggleGroupKey = string | number
export type TNativeToggleGroupSelectionMode = (typeof NATIVE_TOGGLE_GROUP_SELECTION_MODES)[number]
export type TNativeToggleGroupStateOptions = {
  selectionMode?: TNativeToggleGroupSelectionMode
  disallowEmptySelection?: boolean
  selectedKeys?: Iterable<TNativeToggleGroupKey>
  defaultSelectedKeys?: Iterable<TNativeToggleGroupKey>
  onSelectionChange?: (keys: Set<TNativeToggleGroupKey>) => void
  isDisabled?: boolean
}
export type TNativeToggleGroupState = Readonly<{
  selectionMode: TNativeToggleGroupSelectionMode
  isDisabled: boolean
  selectedKeys: Set<TNativeToggleGroupKey>
  toggleKey: (key: TNativeToggleGroupKey) => void
  setSelected: (key: TNativeToggleGroupKey, isSelected: boolean) => void
  setSelectedKeys: (keys: Set<TNativeToggleGroupKey>) => void
}>

// Pinned react-stately3.46.0 useToggleGroupState with native controlled-state commit ownership.
export const useNativeToggleGroupState = (props: TNativeToggleGroupStateOptions): TNativeToggleGroupState => {
  const { selectionMode = "single", disallowEmptySelection, isDisabled = false } = props
  const [selectedKeys, setSelectedKeys] = useControlledState(
    useMemo(() => (props.selectedKeys ? new Set(props.selectedKeys) : undefined), [props.selectedKeys]),
    useMemo(() => new Set(props.defaultSelectedKeys), [props.defaultSelectedKeys]),
    props.onSelectionChange,
  )
  const toggleKey = (key: TNativeToggleGroupKey) => {
    let keys: Set<TNativeToggleGroupKey>
    if (selectionMode === "multiple") {
      keys = new Set(selectedKeys)
      if (keys.has(key) && (!disallowEmptySelection || keys.size > 1)) keys.delete(key)
      else keys.add(key)
    } else keys = new Set(selectedKeys.has(key) && !disallowEmptySelection ? [] : [key])
    setSelectedKeys(keys)
  }
  return {
    selectionMode,
    isDisabled,
    selectedKeys,
    setSelectedKeys,
    toggleKey,
    setSelected: (key, isSelected) => {
      if (isSelected !== selectedKeys.has(key)) toggleKey(key)
    },
  }
}
