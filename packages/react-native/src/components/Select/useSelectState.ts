import { useCallback, useEffect, useRef } from "react"

import { useControlledState } from "../../collection/state/useControlledState"

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
  const [selectedKey, setSelectedKey] = useControlledState<TNativeSelectKey | null>(
    value,
    defaultValue,
    value === undefined ? onChange : undefined,
  )
  const [open, setOpen] = useControlledState(
    isOpen,
    defaultOpen && !isDisabled,
    isOpen === undefined ? onOpenChange : undefined,
  )
  const selectedEntry = entries.find((entry) => entry.key === selectedKey)
  const requestedDisabledClose = useRef(false)
  const requestOpen = useCallback(
    (next: boolean) => {
      if ((next && isDisabled) || next === open) return
      setOpen(next)
      if (isOpen !== undefined) onOpenChange?.(next)
    },
    [isDisabled, open, setOpen, isOpen, onOpenChange],
  )
  useEffect(() => {
    if (!isDisabled || !open) {
      requestedDisabledClose.current = false
      return
    }
    if (requestedDisabledClose.current) return
    requestedDisabledClose.current = true
    requestOpen(false)
  }, [isDisabled, open, requestOpen])
  const activate = (key: TNativeSelectKey) => {
    if (!open || isDisabled || isReadOnly || disabledKeys.has(encodeSelectKey(key))) return
    if (!entries.some((entry) => entry.key === key)) return
    if (selectedKey !== key) {
      setSelectedKey(key)
      if (value !== undefined) onChange?.(key)
    }
    requestOpen(false)
  }
  return { entries, disabledKeys, selectedKey, selectedEntry, open, requestOpen, activate }
}
