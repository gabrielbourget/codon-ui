// Adapted from react-aria3.48.0 TableKeyboardDelegate/useTypeSelect.
// Copyright 2020, 2022 Adobe. Apache-2.0; see ../../collection/LICENSE.react-aria.md.
import type { TNativeCollectionKey } from "../../collection/snapshot"

import { getNativeTableNavigationKey } from "./keyboard"

type TTable = Parameters<typeof getNativeTableNavigationKey>[0] & { rowHeaderColumns: ReadonlySet<string> }
export const nativeTableKeyCharacter = (key: string) => (key.length === 1 || !/^[A-Z]/i.test(key) ? key : "")
export const getNativeTableSearchKey = (
  table: TTable,
  search: string,
  from?: TNativeCollectionKey | null,
): TNativeCollectionKey | null => {
  const collator = new Intl.Collator(undefined, { usage: "search", sensitivity: "base" })
  let key = from ?? getNativeTableNavigationKey(table, null, "Home", false)
  const start = key == null ? null : table.collection.getItem(key)
  if (start?.type === "cell") key = start.parentKey
  const matches = (text: string) => !!text && collator.compare(text.slice(0, search.length), search) === 0
  let wrapped = false
  while (key != null) {
    const item = table.collection.getItem(key)
    if (!item) return null
    if (matches(item.textValue)) return item.key
    for (const cell of table.collection.getChildren(item.key)) {
      if (table.rowHeaderColumns.has(cell.props.columnID) && matches(cell.textValue))
        return start?.type === "cell" ? cell.key : item.key
    }
    key = getNativeTableNavigationKey(table, key, "ArrowDown", false)
    if (key == null && !wrapped) {
      key = getNativeTableNavigationKey(table, null, "Home", false)
      wrapped = true
    }
  }
  return null
}
