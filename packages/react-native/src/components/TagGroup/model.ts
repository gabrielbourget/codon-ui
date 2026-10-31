import { validateCollectionKey, type TNativeCollectionKey } from "../collection"

export const NATIVE_TAG_GROUP_SELECTION_MODES = ["none", "single", "multiple"] as const
export type TNativeTagGroupSelectionMode = (typeof NATIVE_TAG_GROUP_SELECTION_MODES)[number]
export const NATIVE_TAG_GROUP_SELECTION_BEHAVIORS = ["toggle", "replace"] as const
export type TNativeTagGroupSelectionBehavior = (typeof NATIVE_TAG_GROUP_SELECTION_BEHAVIORS)[number]
export type TNativeTagGroupKey = TNativeCollectionKey
export type TNativeTagGroupSelectionSet = ReadonlySet<TNativeTagGroupKey> & {
  readonly anchorKey?: TNativeTagGroupKey
  readonly currentKey?: TNativeTagGroupKey
}
export type TNativeTagGroupSelectionRequest = Set<TNativeTagGroupKey> & {
  anchorKey?: TNativeTagGroupKey
  currentKey?: TNativeTagGroupKey
}
export type TNativeTagGroupSelection = "all" | TNativeTagGroupSelectionSet
export type TNativeTagGroupRow = Readonly<{
  key: TNativeTagGroupKey
  textValue: string
  isDisabled: boolean
  hasAction: boolean
  href?: string
}>
export const NATIVE_TAG_GROUP_SELECTION_OPERATIONS = ["toggle", "replace", "extend"] as const
export type TNativeTagGroupSelectionOperation = (typeof NATIVE_TAG_GROUP_SELECTION_OPERATIONS)[number]

export const normalizeNativeTagGroupKeys = (keys: Iterable<TNativeTagGroupKey>): TNativeTagGroupSelectionRequest => {
  const result: TNativeTagGroupSelectionRequest = new Set()
  for (const key of keys) {
    validateCollectionKey(key, "selection key", "TagGroup")
    result.add(key)
  }
  const metadata = keys as Iterable<TNativeTagGroupKey> & {
    anchorKey?: TNativeTagGroupKey
    currentKey?: TNativeTagGroupKey
  }
  for (const field of ["anchorKey", "currentKey"] as const) {
    if (metadata[field] != null) {
      validateCollectionKey(metadata[field], field, "TagGroup")
      result[field] = metadata[field]
    }
  }
  return result
}
export const nativeTagGroupSelectionKeys = (
  selection: TNativeTagGroupSelection,
  rows: readonly TNativeTagGroupRow[],
): TNativeTagGroupSelectionRequest =>
  selection === "all"
    ? new Set(rows.filter((row) => !row.isDisabled).map((row) => row.key))
    : normalizeNativeTagGroupKeys(selection)
export const nativeTagGroupSelected = (
  mode: TNativeTagGroupSelectionMode,
  selection: TNativeTagGroupSelection,
  row: TNativeTagGroupRow,
) => mode !== "none" && (selection === "all" ? !row.isDisabled : selection.has(row.key))
export const equalNativeTagGroupSelection = (a: TNativeTagGroupSelection, b: TNativeTagGroupSelection) => {
  if (a === "all" || b === "all") return a === b
  return a.size === b.size && [...a].every((key) => b.has(key))
}

export const getNativeTagGroupSelectionRequest = (
  mode: TNativeTagGroupSelectionMode,
  selection: TNativeTagGroupSelection,
  rows: readonly TNativeTagGroupRow[],
  key: TNativeTagGroupKey,
  operation: TNativeTagGroupSelectionOperation,
  options: { disallowEmptySelection?: boolean; allowLinkSelection?: boolean } = {},
): TNativeTagGroupSelectionRequest | null => {
  const row = rows.find((item) => item.key === key)
  if (mode === "none" || !row || row.isDisabled || (row.href && !options.allowLinkSelection)) return null
  const current = nativeTagGroupSelectionKeys(selection, rows)
  const single = (): TNativeTagGroupSelectionRequest => {
    const result: TNativeTagGroupSelectionRequest = new Set([key])
    result.anchorKey = result.currentKey = key
    return result
  }
  if (
    operation === "replace" ||
    (operation === "extend" && mode === "single") ||
    (mode === "single" && !current.has(key))
  )
    return single()
  if (operation === "extend" && mode === "multiple") {
    if (selection === "all") return single()
    const anchor = current.anchorKey ?? key
    const prior = current.currentKey ?? key
    const range = (from: TNativeTagGroupKey, to: TNativeTagGroupKey) => {
      const start = rows.findIndex((item) => item.key === from),
        end = rows.findIndex((item) => item.key === to)
      return start < 0 || end < 0 ? [] : rows.slice(Math.min(start, end), Math.max(start, end) + 1)
    }
    for (const item of range(anchor, prior)) current.delete(item.key)
    for (const item of range(key, anchor)) if (!item.isDisabled) current.add(item.key)
    current.anchorKey = anchor
    current.currentKey = key
    return current
  }
  if (current.has(key)) current.delete(key)
  else {
    current.add(key)
    current.anchorKey = current.currentKey = key
  }
  return options.disallowEmptySelection && current.size === 0 ? null : current
}

export const getNativeTagGroupRemovalRequest = (
  mode: TNativeTagGroupSelectionMode,
  selection: TNativeTagGroupSelection,
  rows: readonly TNativeTagGroupRow[],
  key: TNativeTagGroupKey,
  source: "button" | "keyboard",
) => {
  const row = rows.find((item) => item.key === key)
  if (!row || row.isDisabled) return null
  return source === "keyboard" && nativeTagGroupSelected(mode, selection, row)
    ? nativeTagGroupSelectionKeys(selection, rows)
    : new Set([key])
}
export const getNativeTagGroupSelectAllRequest = (
  mode: TNativeTagGroupSelectionMode,
  selection: TNativeTagGroupSelection,
  rows: readonly TNativeTagGroupRow[],
): "all" | null => {
  if (mode !== "multiple") return null
  const enabled = rows.filter((row) => !row.isDisabled)
  const all = selection === "all" || (selection.size > 0 && enabled.every((row) => selection.has(row.key)))
  return all ? null : "all"
}
