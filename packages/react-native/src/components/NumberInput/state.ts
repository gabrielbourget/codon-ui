import { useLayoutEffect, useMemo, useRef, useState } from "react"

import { createNumberModel } from "./model"
import type { TNativeNumberInputProps } from "./types"

export const useNumberInputState = (props: TNativeNumberInputProps) => {
  const { value, defaultValue, onChange, onChangeText, isDisabled = false, isReadOnly = false } = props
  const model = useMemo(
    () => createNumberModel(props),
    [props.locale, props.formatOptions, props.minValue, props.maxValue, props.step],
  )
  model.validateValue(value, "value")
  model.validateValue(defaultValue, "defaultValue")
  const controlled = useRef(value !== undefined)
  if (controlled.current !== (value !== undefined))
    throw new TypeError("NumberInput: changing controlled mode is unsupported")
  const [stored, setStored] = useState(defaultValue ?? null)
  const authoritative = controlled.current ? value! : stored
  model.validateValue(authoritative, "value")
  const formatted = model.format(authoritative)
  const [draft, setDraft] = useState(formatted)
  const edit = useRef({ draft: formatted, consumed: false })
  const press = useRef({ pending: false, cancelled: false })
  const previous = useRef({ value: authoritative, key: model.key, isDisabled, isReadOnly })
  const blocked = isDisabled || isReadOnly
  const replaceDraft = (text: string) => {
    edit.current.draft = text
    setDraft(text)
  }
  useLayoutEffect(() => {
    const old = previous.current
    if (
      old.value !== authoritative ||
      old.key !== model.key ||
      old.isDisabled !== isDisabled ||
      old.isReadOnly !== isReadOnly
    ) {
      edit.current.consumed = true
      if (press.current.pending) press.current.cancelled = true
      replaceDraft(formatted)
    }
    previous.current = { value: authoritative, key: model.key, isDisabled, isReadOnly }
  }, [authoritative, model.key, isDisabled, isReadOnly, formatted])

  const publish = (next: number | null) => {
    edit.current.consumed = true
    replaceDraft(controlled.current ? formatted : model.format(next))
    if (next === authoritative) return
    if (!controlled.current) setStored(next)
    onChange?.(next)
  }
  const increment = model.step(draft, 1)
  const decrement = model.step(draft, -1)
  return {
    value: authoritative === 0 ? 0 : authoritative,
    inputValue: draft,
    canIncrement: increment !== undefined,
    canDecrement: decrement !== undefined,
    begin: () => {
      if (blocked) return
      edit.current.consumed = false
      press.current = { pending: false, cancelled: false }
    },
    change: (text: string) => {
      if (blocked) return
      edit.current.consumed = false
      press.current = { pending: false, cancelled: false }
      replaceDraft(text)
      onChangeText?.(text)
    },
    commit: (text?: string) => {
      if (blocked || edit.current.consumed) return
      if (press.current.pending) {
        if (text !== undefined) edit.current.draft = text
        return
      }
      const result = model.commit(text ?? edit.current.draft)
      publish(result ? result.value : authoritative)
    },
    pressStart: () => {
      press.current = { pending: true, cancelled: blocked }
    },
    step: (direction: -1 | 1, fromPress = false) => {
      const cancelled = fromPress && press.current.cancelled
      press.current.pending = false
      press.current.cancelled = false
      if (blocked || cancelled) return
      const next = model.step(edit.current.draft, direction)
      if (next !== undefined) publish(next)
    },
  }
}
