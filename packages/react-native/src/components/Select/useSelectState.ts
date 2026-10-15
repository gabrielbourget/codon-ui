import { useEffect, useRef, useState } from "react"

import { encodeSelectKey, normalizeSelectCollection, validateSelectKey, type TNativeSelectKey } from "./collection"
import type { TNativeSelectProps } from "./types"

export const useSelectState = <T>(props: TNativeSelectProps<T>) => {
  const {
    value,
    defaultValue = null,
    onChange,
    isOpen,
    defaultOpen = false,
    onOpenChange,
    isDisabled = false,
    isReadOnly = false,
  } = props
  if (value != null) validateSelectKey(value, "value")
  if (defaultValue !== null) validateSelectKey(defaultValue, "defaultValue")
  const entries = normalizeSelectCollection(props.items, props.getKey, props.getTextValue)
  const disabledKeys = new Set(
    Array.from(props.disabledKeys ?? [], (key) => {
      validateSelectKey(key, "disabledKeys")
      return encodeSelectKey(key)
    }),
  )
  const [localValue, setLocalValue] = useState(defaultValue)
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const selectedKey = value === undefined ? localValue : value
  const open = isOpen ?? localOpen
  const selectedEntry = entries.find((entry) => entry.key === selectedKey)
  const requestedDisabledClose = useRef(false)
  const requestOpen = (next: boolean) => {
    if ((next && isDisabled) || next === open) return
    if (isOpen === undefined) setLocalOpen(next)
    onOpenChange?.(next)
  }
  useEffect(() => {
    if (!isDisabled || !open) {
      requestedDisabledClose.current = false
      return
    }
    if (requestedDisabledClose.current) return
    requestedDisabledClose.current = true
    if (isOpen === undefined) setLocalOpen(false)
    onOpenChange?.(false)
  }, [isDisabled, open, isOpen, onOpenChange])
  const activate = (key: TNativeSelectKey) => {
    if (!open || isDisabled || isReadOnly || disabledKeys.has(encodeSelectKey(key))) return
    if (!entries.some((entry) => entry.key === key)) return
    if (selectedKey !== key) {
      if (value === undefined) setLocalValue(key)
      onChange?.(key)
    }
    requestOpen(false)
  }
  return { entries, disabledKeys, selectedKey, selectedEntry, open, requestOpen, activate }
}
