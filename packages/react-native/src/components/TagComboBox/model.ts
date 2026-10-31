import { validateCollectionKey } from "../collection"

import type { TNativeTagComboBoxChangeDetails, TNativeTagComboBoxProps, TNativeTagComboBoxLabels } from "./types"

export const nativeTagComboBoxKey = (key: string | number) => {
  validateCollectionKey(key, "item key", "TagComboBox")
  return String(key)
}
export const getNativeTagComboBoxAddRequest = <T extends object>(
  items: readonly T[],
  selected: readonly T[],
  key: string | number | null,
  getKey: (item: T) => string | number,
): { items: T[]; details: TNativeTagComboBoxChangeDetails<T> } | null => {
  if (key === null) return null
  const normalized = nativeTagComboBoxKey(key)
  if (selected.some((item) => nativeTagComboBoxKey(getKey(item)) === normalized)) return null
  const item = items.find((value) => nativeTagComboBoxKey(getKey(value)) === normalized)
  return item
    ? { items: [...selected, item], details: { action: "add", changedItems: [item], changedKeys: [getKey(item)] } }
    : null
}
export const getNativeTagComboBoxRemoveRequest = <T extends object>(
  selected: readonly T[],
  keys: ReadonlySet<string | number>,
  getKey: (item: T) => string | number,
): { items: T[]; details: TNativeTagComboBoxChangeDetails<T> } | null => {
  const normalized = new Set([...keys].map(nativeTagComboBoxKey))
  const removed = selected.filter((item) => normalized.has(nativeTagComboBoxKey(getKey(item))))
  return removed.length
    ? {
        items: selected.filter((item) => !normalized.has(nativeTagComboBoxKey(getKey(item)))),
        details: { action: "remove", changedItems: removed, changedKeys: removed.map(getKey) },
      }
    : null
}
export const getNativeTagComboBoxLabels = <T extends object>(
  props: TNativeTagComboBoxProps<T>,
): TNativeTagComboBoxLabels => ({
  groupAriaLabel: props.labels?.groupAriaLabel ?? "TagComboBox TagGroup ComboBox Group",
  tagGroupAriaLabel: props.labels?.tagGroupAriaLabel ?? "Tag Group",
  comboBox: {
    inputButtonGroupAriaLabel: "ComboBox Input Button Group",
    triggerButtonAriaLabel: "Show suggestions",
    emptyListMessage:
      props.emptyListMessage ?? props.customComboBoxProps?.emptyListMessage ?? "No items remaining to select",
    inputLabel:
      props.inputLabel ??
      props.customComboBoxProps?.inputLabel ??
      props.accessibilityLabel ??
      props["aria-label"] ??
      "Search choices",
    closeLabel: props.closeLabel ?? props.customComboBoxProps?.closeLabel ?? "Close choices",
    ...props.labels?.comboBox,
    ...props.customComboBoxProps?.labels,
  },
})
