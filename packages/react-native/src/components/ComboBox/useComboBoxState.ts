import { useContext, useEffect, useInsertionEffect, useMemo, useRef, useState } from "react"

import { NativeFormBehaviorContext } from "../../form/context"
import { nativeSimpleComboBoxValidity } from "../../form/simpleComboBox"
import { encodeCollectionKey, normalizeCollection, validateCollectionKey } from "../collection"

import { useFormValidationState } from "./state/useFormValidationState"
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
  if (props.formValue !== undefined && props.formValue !== "key" && props.formValue !== "text")
    throw new TypeError("ComboBox: unsupported formValue")
  const inheritedBehavior = useContext(NativeFormBehaviorContext)
  const validationBehavior = props.validationBehavior ?? inheritedBehavior
  const validationValue = useMemo(() => ({ inputValue: query, value: selectedKey, selectedKey }), [query, selectedKey])
  const builtinValidation = nativeSimpleComboBoxValidity({ ...props, validationBehavior }, query)
  const validation = useFormValidationState({
    name: props.name,
    value: validationValue,
    isInvalid: props.isInvalid ?? (props.errorState ? true : undefined),
    validationState: props.validationState,
    validate: props.validate,
    validationBehavior,
    builtinValidation,
  })
  const [initialValue] = useState(selectedKey)
  const [initialInput] = useState(localInput)
  const resetValue = props.defaultValue ?? initialValue
  const resetQuery = props.defaultInputValue ?? entries.find((entry) => entry.key === resetValue)?.text ?? initialInput
  const focusStrategy = useRef<"first" | "last" | "selected">("selected")
  const owner = useRef({ props, entries, disabledKeys, selectedKey, query, open, resetValue, resetQuery })
  const live = useRef(false)
  useInsertionEffect(() => {
    owner.current = { props, entries, disabledKeys, selectedKey, query, open, resetValue, resetQuery }
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const requestOpen = (next: boolean, strategy: "first" | "last" | "selected" = "selected") => {
    const current = owner.current
    if (!live.current || (next && current.props.isDisabled) || next === current.open) return
    if (next) focusStrategy.current = strategy
    if (current.props.isOpen === undefined) setLocalOpen(next)
    current.props.onOpenChange?.(next)
  }
  const requestInput = (text: string) => {
    const current = owner.current
    if (
      !live.current ||
      !current.open ||
      current.props.isDisabled ||
      current.props.isReadOnly ||
      text === current.query
    )
      return
    if (current.props.inputValue === undefined) setLocalInput(text)
    current.props.onInputChange?.(text)
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
    const current = owner.current
    if (
      !live.current ||
      !current.open ||
      current.props.isDisabled ||
      current.props.isReadOnly ||
      current.disabledKeys.has(encodeCollectionKey(key))
    )
      return
    const entry = current.entries.find((item) => item.key === key)
    if (!entry) return
    if (current.selectedKey !== key) {
      if (current.props.value === undefined) setLocalValue(key)
      current.props.onChange?.(key)
    }
    if (current.selectedKey === key || current.props.value === undefined || current.props.inputValue === undefined)
      requestInput(entry.text)
    requestOpen(false)
  }
  const revert = () => {
    const current = owner.current
    requestInput(current.entries.find((entry) => entry.key === current.selectedKey)?.text ?? "")
    requestOpen(false)
  }
  const resetInput = () => {
    const current = owner.current
    if (!live.current || current.query === current.resetQuery) return
    if (current.props.inputValue === undefined) setLocalInput(current.resetQuery)
    current.props.onInputChange?.(current.resetQuery)
  }
  const resetKey = () => {
    const current = owner.current
    if (!live.current || current.selectedKey === current.resetValue) return
    if (current.props.value === undefined) setLocalValue(current.resetValue)
    current.props.onChange?.(current.resetValue)
  }
  return {
    entries,
    selectedKey,
    disabledKeys,
    query,
    open,
    requestOpen,
    requestInput,
    activate,
    revert,
    focusStrategy,
    ...validation,
    validationBehavior,
    formValidation: validation.realtimeValidation.isInvalid ? validation.realtimeValidation : builtinValidation,
    resetInput,
    resetKey,
  }
}
