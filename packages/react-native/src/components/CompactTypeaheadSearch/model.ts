import { encodeCollectionKey, validateCollectionKey } from "../collection"

import type { TNativeCompactTypeaheadEntry, TNativeCompactTypeaheadSearchProps } from "./types"

export const getCompactTypeaheadEntries = <T extends object>(
  props: TNativeCompactTypeaheadSearchProps<T>,
  query: string,
) => {
  if (query.trim().length < (props.minimumInputLength ?? 0)) return []
  const keys = new Set<string>()
  const items = Array.from(props.items ?? [])
  return items.map((item): TNativeCompactTypeaheadEntry<T> => {
    const key = props.getItemKey
      ? props.getItemKey(item)
      : "id" in item
        ? String(item.id)
        : "ID" in item
          ? String(item.ID)
          : String(items.indexOf(item))
    validateCollectionKey(key, "item key", "CompactTypeaheadSearch")
    const encodedKey = encodeCollectionKey(key)
    if (keys.has(encodedKey)) throw new TypeError(`CompactTypeaheadSearch: duplicate key ${encodedKey}`)
    keys.add(encodedKey)
    const text = props.getItemTextValue
      ? props.getItemTextValue(item)
      : "name" in item && typeof item.name === "string"
        ? item.name
        : "label" in item && typeof item.label === "string"
          ? item.label
          : ""
    if (typeof text !== "string") throw new TypeError("CompactTypeaheadSearch: item text must be a string")
    return { item, key, encodedKey, text }
  })
}
