import { useEffect, useInsertionEffect, useMemo, useRef, useState } from "react"

import { encodeCollectionKey, validateCollectionKey } from "../collection"

import type {
  TNativeCompactTypeaheadEntry,
  TNativeCompactTypeaheadKey,
  TNativeCompactTypeaheadSearchProps,
} from "./types"

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

export const useCompactTypeaheadState = <T extends object>(
  props: TNativeCompactTypeaheadSearchProps<T>,
  options: { canAct: () => boolean; containsFocus: () => boolean; restoreAfterSelection: () => void },
) => {
  for (const text of [props.inputValue, props.defaultInputValue])
    if (text !== undefined && typeof text !== "string")
      throw new TypeError("CompactTypeaheadSearch: query must be a string")
  for (const key of [props.value, props.defaultValue])
    if (key != null) validateCollectionKey(key, "value", "CompactTypeaheadSearch")
  const [localQuery, setLocalQuery] = useState(() => props.defaultInputValue ?? "")
  const [localValue, setLocalValue] = useState<TNativeCompactTypeaheadKey | null>(() => props.defaultValue ?? null)
  const [localOpen, setLocalOpen] = useState(false)
  const [triggerOpen, setTriggerOpen] = useState(false)
  const [suppressed, setSuppressed] = useState(false)
  const [active, setActive] = useState<TNativeCompactTypeaheadKey | null>(null)
  const query = props.inputValue !== undefined ? props.inputValue : localQuery
  const value = props.value !== undefined ? props.value : localValue
  const open = props.isOpen ?? (localOpen || (props.inputValue !== undefined && query.trim().length > 0))
  const minimum = query.trim().length < (props.minimumInputLength ?? 0) && !suppressed
  const status = minimum || (props.isLoading ?? false)
  const eligible = query.trim().length >= (props.minimumInputLength ?? 0)
  const resolvedItems = useMemo(() => (eligible ? Array.from(props.items ?? []) : []), [props.items, eligible])
  const entries = useMemo(
    () => getCompactTypeaheadEntries({ ...props, items: resolvedItems }, query),
    [resolvedItems, props.getItemKey, props.getItemTextValue],
  )
  const disabled = useMemo(
    () => new Set(Array.from(props.disabledKeys ?? [], encodeCollectionKey)),
    [props.disabledKeys],
  )
  const current = useRef({ props, options, query, value, open, status, entries, disabled, triggerOpen, active })
  const synchronizedQuery = useRef<string | null>(null)
  useInsertionEffect(() => {
    current.current = { props, options, query, value, open, status, entries, disabled, triggerOpen, active }
  })
  const requestOpen = (next: boolean) => {
    const owner = current.current
    if (!owner.options.canAct() || (next && owner.props.isReadOnly)) return
    if (
      owner.status &&
      owner.props.inputValue !== undefined &&
      owner.query.trim().length > 0 &&
      !next &&
      owner.options.containsFocus()
    )
      return
    if (owner.props.isOpen === undefined) setLocalOpen(next)
    owner.props.onOpenChange?.(next)
  }
  const changeQuery = (text: string, user = true) => {
    const owner = current.current
    if (user && (!owner.options.canAct() || owner.props.isReadOnly)) return
    if (owner.props.inputValue === undefined) setLocalQuery(text)
    if (owner.props.isOpen === undefined) setLocalOpen(true)
    if (user) {
      synchronizedQuery.current = null
      setSuppressed(false)
    } else synchronizedQuery.current = text
    owner.props.onInputChange?.(text)
  }
  const admit = (next: boolean) => {
    if (
      !current.current.options.canAct() ||
      (next && current.current.props.isReadOnly) ||
      current.current.triggerOpen === next
    )
      return
    current.current.triggerOpen = next
    setTriggerOpen(next)
    requestOpen(next)
  }
  const select = (key: TNativeCompactTypeaheadKey | null, inputCommit = false) => {
    const owner = current.current
    if (!owner.options.canAct() || owner.props.isReadOnly || !owner.open || owner.status) return
    if (
      key !== null &&
      (!owner.entries.some((entry) => entry.key === key) || owner.disabled.has(encodeCollectionKey(key)))
    )
      return
    if (key !== null && key === owner.value && !inputCommit) {
      changeQuery(owner.entries.find((entry) => entry.key === key)?.text ?? "", false)
      admit(false)
      return
    }
    if (key !== null) {
      setSuppressed(true)
      if (owner.props.isOpen === undefined) setLocalOpen(false)
    }
    if (owner.props.value === undefined) setLocalValue(key)
    owner.props.onChange?.(key)
    if (key !== null) owner.options.restoreAfterSelection()
  }
  const previous = useRef({ query, value })
  const commitValue = () => {
    const owner = current.current
    if (!owner.options.canAct()) return
    const selectedText = owner.entries.find((entry) => entry.key === owner.value)?.text ?? ""
    if (owner.props.allowsCustomValue && owner.query !== selectedText) {
      if (owner.value !== null) {
        if (owner.props.value === undefined) setLocalValue(null)
        owner.props.onChange?.(null)
      }
    } else if (owner.props.value !== undefined) {
      if (owner.query !== selectedText) {
        owner.props.onChange?.(owner.value)
        if (owner.value !== null) owner.options.restoreAfterSelection()
      }
    } else changeQuery(selectedText, false)
    admit(false)
  }
  useEffect(() => {
    const old = previous.current
    previous.current = { query, value }
    const synchronized = synchronizedQuery.current === query
    synchronizedQuery.current = null
    if (query !== old.query) {
      setActive(null)
      if (query === "" && props.value === undefined && value !== null) {
        setLocalValue(null)
        props.onChange?.(null)
      }
      if (!synchronized && options.containsFocus() && props.menuTrigger !== "manual") admit(true)
    }
    if (value !== old.value && value !== null) admit(false)
    // The canonical wrapper always controls the underlying ComboBox query.
    if (value !== old.value && props.value === undefined)
      changeQuery(entries.find((entry) => entry.key === value)?.text ?? "", false)
  })
  return {
    query,
    value,
    open,
    triggerOpen,
    minimum,
    status,
    entries,
    disabled,
    active,
    changeQuery,
    requestOpen,
    select,
    blur: () => {
      const status = current.current.status
      commitValue()
      if (status) requestOpen(false)
    },
    revert: commitValue,
    toggle: () => admit(!current.current.triggerOpen),
    focus: () => {
      if (current.current.props.menuTrigger === "focus") admit(true)
    },
    finishSelection: () => {
      if (current.current.props.isOpen === undefined) setLocalOpen(false)
      current.current.props.onOpenChange?.(false)
    },
    clearHighlight: () => {
      current.current.active = null
      setActive(null)
    },
    focusEdge: (key: "Home" | "End", shiftKey: boolean) => {
      const owner = current.current
      if (
        !owner.options.canAct() ||
        owner.props.isReadOnly ||
        owner.status ||
        !owner.open ||
        (owner.active === null && shiftKey)
      )
        return
      const available = owner.entries.filter((entry) => !owner.disabled.has(entry.encodedKey))
      const next = (key === "Home" ? available[0] : available.at(-1))?.key ?? null
      owner.active = next
      setActive(next)
    },
    highlight: (delta: number) => {
      const owner = current.current
      const available = owner.entries.filter((entry) => !owner.disabled.has(entry.encodedKey))
      if (!available.length || !owner.options.canAct() || owner.props.isReadOnly || owner.status) return
      admit(true)
      const index = available.findIndex((entry) => entry.key === owner.active)
      const next = index < 0 ? (delta < 0 ? available.length - 1 : 0) : index + delta
      // The canonical wrapper applies shouldFocusWrap to its ListBox only.
      // Navigation from the original editor keeps the ComboBox's bounded default.
      if (next < 0 || next >= available.length) return
      const key = available[next].key
      owner.active = key
      setActive(key)
    },
  }
}
