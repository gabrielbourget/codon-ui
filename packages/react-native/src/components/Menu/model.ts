export const NATIVE_MENU_SELECTION_MODES = ["none", "single", "multiple"] as const
export type TNativeMenuSelectionMode = (typeof NATIVE_MENU_SELECTION_MODES)[number]
export type TNativeMenuKey = string | number
export type TNativeMenuSelectionSet = ReadonlySet<TNativeMenuKey> & {
  readonly anchorKey?: TNativeMenuKey
  readonly currentKey?: TNativeMenuKey
}
export type TNativeMenuSelection = "all" | TNativeMenuSelectionSet
export type TNativeMenuSelectionRequest = Set<TNativeMenuKey> & {
  anchorKey?: TNativeMenuKey
  currentKey?: TNativeMenuKey
}
export type TNativeMenuRow = Readonly<{
  id: TNativeMenuKey
  text: string
  disabled: boolean
  selectionDisabled?: boolean
  href?: string
}>

export const validateNativeMenuKey = (key: TNativeMenuKey) => {
  if (typeof key !== "string" && (typeof key !== "number" || !Number.isFinite(key)))
    throw new TypeError("Menu: keys must be strings or finite numbers")
}
export const encodeNativeMenuKey = (key: TNativeMenuKey) => `${typeof key}:${String(key)}`
export const normalizeNativeMenuKeys = (keys: Iterable<TNativeMenuKey>): TNativeMenuSelectionRequest => {
  const result: TNativeMenuSelectionRequest = new Set()
  for (const key of keys) {
    validateNativeMenuKey(key)
    result.add(key)
  }
  const metadata = keys as Iterable<TNativeMenuKey> & { anchorKey?: TNativeMenuKey; currentKey?: TNativeMenuKey }
  for (const field of ["anchorKey", "currentKey"] as const) {
    if (metadata[field] != null) {
      const key = metadata[field]
      validateNativeMenuKey(key)
      result[field] = key
    }
  }
  return result
}
export const nativeMenuCanSelect = (row: TNativeMenuRow) => !row.disabled && !row.selectionDisabled
export const nativeMenuSelected = (selection: TNativeMenuSelection, row: TNativeMenuRow) =>
  selection === "all" ? nativeMenuCanSelect(row) : selection.has(row.id)
export const nativeMenuSelectionKeys = (selection: TNativeMenuSelection, rows: readonly TNativeMenuRow[]) =>
  selection === "all"
    ? new Set(rows.filter(nativeMenuCanSelect).map((row) => row.id))
    : normalizeNativeMenuKeys(selection)
export const getNativeMenuSelectionRequest = (
  mode: TNativeMenuSelectionMode,
  selection: TNativeMenuSelection,
  rows: readonly TNativeMenuRow[],
  key: TNativeMenuKey,
  extend = false,
): TNativeMenuSelectionRequest | null => {
  const row = rows.find((item) => item.id === key)
  if (mode === "none" || !row || row.disabled || row.href) return null
  const current: TNativeMenuSelectionRequest = nativeMenuSelectionKeys(selection, rows)
  const single = (): TNativeMenuSelectionRequest => {
    const result: TNativeMenuSelectionRequest = new Set(nativeMenuCanSelect(row) ? [key] : [])
    if (result.size) result.anchorKey = result.currentKey = key
    return result
  }
  if (mode === "single") {
    if (!current.has(key)) return single()
    current.delete(key)
    return current
  }
  if (extend) {
    if (selection === "all") return single()
    const anchor = current.anchorKey ?? key
    const prior = current.currentKey ?? key
    const range = (from: TNativeMenuKey, to: TNativeMenuKey) => {
      const start = rows.findIndex((item) => item.id === from),
        end = rows.findIndex((item) => item.id === to)
      return start < 0 || end < 0 ? [] : rows.slice(Math.min(start, end), Math.max(start, end) + 1)
    }
    for (const item of range(anchor, prior)) current.delete(item.id)
    for (const item of range(key, anchor)) if (nativeMenuCanSelect(item)) current.add(item.id)
    current.anchorKey = anchor
    current.currentKey = key
    return current
  }
  if (current.has(key)) current.delete(key)
  else if (nativeMenuCanSelect(row)) {
    current.add(key)
    current.anchorKey = current.currentKey = key
  }
  return current
}
export const equalNativeMenuSelection = (a: TNativeMenuSelection, b: TNativeMenuSelection) => {
  if (a === "all" || b === "all") return a === b
  return a.size === b.size && [...a].every((key) => b.has(key))
}

export const getNativeMenuRecoveryKey = (
  previousOrder: readonly TNativeMenuKey[],
  currentRows: readonly TNativeMenuRow[],
  focusedKey: TNativeMenuKey | null,
) => {
  if (focusedKey === null) return undefined
  const index = previousOrder.indexOf(focusedKey)
  if (index < 0) return undefined
  const enabled = new Set(currentRows.filter((row) => !row.disabled).map((row) => row.id))
  return [...previousOrder.slice(index + 1), ...previousOrder.slice(0, index).reverse()].find((key) => enabled.has(key))
}
