import { useEffect, useRef, useState } from "react"

import { encodeCollectionKey, normalizeCollection, validateCollectionKey } from "../collection"

import type { TNativeComboBoxKey, TNativeComboBoxProps } from "./types"

export const useComboBoxState = <T>(props: TNativeComboBoxProps<T>) => {
  const {
    value,
    defaultValue = null,
    inputValue,
    defaultInputValue,
    isOpen,
    defaultOpen = false,
    isDisabled = false,
    isReadOnly = false,
  } = props
  if (value != null) validateCollectionKey(value, "value", "ComboBox")
  if (defaultValue !== null) validateCollectionKey(defaultValue, "defaultValue", "ComboBox")
  for (const [field, text] of [
    ["inputValue", inputValue],
    ["defaultInputValue", defaultInputValue],
  ] as const)
    if (text !== undefined && typeof text !== "string") throw new TypeError(`ComboBox: ${field} must be a string`)
  const entries = normalizeCollection(props.items, props.getKey, props.getTextValue, "ComboBox")
  const disabledKeys = new Set(
    Array.from(props.disabledKeys ?? [], (key) => {
      validateCollectionKey(key, "disabledKeys", "ComboBox")
      return encodeCollectionKey(key)
    }),
  )
  const modes = [value !== undefined, inputValue !== undefined, isOpen !== undefined]
  const initialModes = useRef(modes)
  if (modes.some((mode, index) => mode !== initialModes.current[index]))
    throw new TypeError("ComboBox: changing controlled/uncontrolled ownership is unsupported")
  const [localValue, setLocalValue] = useState(defaultValue)
  const [localInput, setLocalInput] = useState(
    () =>
      defaultInputValue ??
      entries.find((entry) => entry.key === (value === undefined ? defaultValue : value))?.text ??
      "",
  )
  const [localOpen, setLocalOpen] = useState(() => defaultOpen && !isDisabled)
  const selectedKey = value === undefined ? localValue : value
  const query = inputValue === undefined ? localInput : inputValue
  const open = isOpen ?? localOpen
  const requestOpen = (next: boolean) => {
    if ((next && isDisabled) || next === open) return
    if (isOpen === undefined) setLocalOpen(next)
    props.onOpenChange?.(next)
  }
  const requestInput = (text: string) => {
    if (!open || isDisabled || isReadOnly || text === query) return
    if (inputValue === undefined) setLocalInput(text)
    props.onInputChange?.(text)
  }
  const requestedDisabledClose = useRef(false)
  useEffect(() => {
    if (!isDisabled || !open) {
      requestedDisabledClose.current = false
      return
    }
    if (requestedDisabledClose.current) return
    requestedDisabledClose.current = true
    if (isOpen === undefined) setLocalOpen(false)
    props.onOpenChange?.(false)
  }, [isDisabled, open, isOpen, props.onOpenChange])
  const activate = (key: TNativeComboBoxKey) => {
    if (!open || isDisabled || isReadOnly || disabledKeys.has(encodeCollectionKey(key))) return
    const entry = entries.find((item) => item.key === key)
    if (!entry) return
    if (selectedKey !== key) {
      if (value === undefined) setLocalValue(key)
      props.onChange?.(key)
    }
    requestInput(entry.text)
    requestOpen(false)
  }
  return { entries, selectedKey, disabledKeys, query, open, requestOpen, requestInput, activate }
}
