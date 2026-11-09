import { encodeCollectionKey, validateCollectionKey } from "../collection"

import type { TNativeCompactTypeaheadEntry, TNativeCompactTypeaheadSearchProps } from "./types"

export const getCompactTypeaheadEntries = <T extends object>(
  props: TNativeCompactTypeaheadSearchProps<T>,
  query: string,
  entryCache?: WeakMap<T, TNativeCompactTypeaheadEntry<T>>,
) => {
  if (query.trim().length < (props.minimumInputLength ?? 0)) return []
  const keys = new Set<string>()
  const items = Array.from(props.items ?? [])
  return items.map((item): TNativeCompactTypeaheadEntry<T> => {
    const cached = entryCache?.get(item)
    const key = cached
      ? cached.key
      : props.getItemKey
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
    const text = cached
      ? cached.text
      : props.getItemTextValue
        ? props.getItemTextValue(item)
        : "name" in item && typeof item.name === "string"
          ? item.name
          : "label" in item && typeof item.label === "string"
            ? item.label
            : ""
    if (typeof text !== "string") throw new TypeError("CompactTypeaheadSearch: item text must be a string")
    const entry = cached ?? { item, key, encodedKey, text }
    entryCache?.set(item, entry)
    return entry
  })
}
