import { encodeCollectionKey } from "../collection"

import type { TNativeTypeaheadSearchProps, TTypeaheadEntry } from "./types"

export const getTypeaheadEntries = <T extends object>(
  items: readonly T[],
  props: Pick<TNativeTypeaheadSearchProps<T>, "getItemKey" | "getItemTextValue">,
): readonly TTypeaheadEntry<T>[] => {
  const keys = new Set<string>()
  return items.map((item) => {
    const key = props.getItemKey
      ? props.getItemKey(item)
      : "id" in item
        ? String(item.id)
        : "ID" in item
          ? String(item.ID)
          : String(Math.max(items.indexOf(item), 0))
    if (typeof key !== "string" && typeof key !== "number")
      throw new TypeError("TypeaheadSearch: item keys must be strings or numbers")
    const encodedKey = encodeCollectionKey(key)
    if (keys.has(encodedKey)) throw new TypeError(`TypeaheadSearch: duplicate key ${encodedKey}`)
    keys.add(encodedKey)
    const text = props.getItemTextValue
      ? props.getItemTextValue(item)
      : "name" in item && typeof item.name === "string"
        ? item.name
        : "label" in item && typeof item.label === "string"
          ? item.label
          : ""
    if (typeof text !== "string") throw new TypeError("TypeaheadSearch: item text must be a string")
    return { item, key, encodedKey, text }
  })
}
