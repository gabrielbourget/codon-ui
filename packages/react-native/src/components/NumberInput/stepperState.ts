/*
 * Copyright 2020 Adobe. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied. See STEPPER_UPSTREAM.json.
 */
import { useContext, useLayoutEffect, useMemo, useRef, useState } from "react"

import { useControlledState } from "../../collection/state/useControlledState"
import { NativeFormBehaviorContext } from "../../form/context"
import { useFormValidationState } from "../ComboBox/state/useFormValidationState"

import { createStepperNumberModel, nativeStepperValidity } from "./stepperNumber"
import type { TNativeStepperNumberFieldProps } from "./stepperTypes"

export const useNativeStepperNumberFieldState = (props: TNativeStepperNumberFieldProps) => {
  const { value, defaultValue, isDisabled = false, isReadOnly = false, isRequired = false } = props
  const optionKind =
    props.formatOptions === null ? "null" : Array.isArray(props.formatOptions) ? "array" : typeof props.formatOptions
  const optionsSignature = JSON.stringify(
    Object.entries(props.formatOptions ?? {}).sort(([a], [b]) => a.localeCompare(b)),
  )
  const model = useMemo(
    () => createStepperNumberModel(props),
    [props.locale, props.minValue, props.maxValue, props.step, props.commitBehavior, optionKind, optionsSignature],
  )
  for (const [name, supplied] of [
    ["value", value],
    ["defaultValue", defaultValue],
  ] as const)
    if (
      supplied !== undefined &&
      supplied !== null &&
      !Number.isFinite(supplied) &&
      !(name === "defaultValue" && Number.isNaN(supplied))
    )
      throw new TypeError(`Stepper: invalid ${name}`)
  const controlled = useRef(value !== undefined)
  if (controlled.current !== (value !== undefined))
    throw new TypeError("Stepper: changing controlled mode is unsupported")
  const initialDefault =
    defaultValue == null || Number.isNaN(defaultValue)
      ? null
      : props.commitBehavior === "validate"
        ? defaultValue
        : model.snap(defaultValue)
  // Native authoritative ingress remains unclamped; snapping occurs on user commit.
  const [authoritative, setValue] = useControlledState<number | null>(value, initialDefault, props.onChange)
  const [initialValue] = useState(authoritative)
  const resetTarget = defaultValue === undefined || Number.isNaN(defaultValue) ? initialValue : initialDefault
  const [draft, setDraft] = useState(() => model.format(authoritative))
  const [resetRevision, setResetRevision] = useState(0)
  const [isInputFocused, setFocused] = useState(false)
  const formatted = model.format(authoritative, draft)
  const edit = useRef({ draft, consumed: false })
  const press = useRef({ pending: false, cancelled: false })
  const previous = useRef({ value: authoritative, key: model.key, isDisabled, isReadOnly })
  const active = useRef(false)
  useLayoutEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const replaceDraft = (text: string) => {
    edit.current.draft = text
    setDraft(text)
  }
  useLayoutEffect(() => {
    const old = previous.current
    if (
      !Object.is(old.value, authoritative) ||
      old.key !== model.key ||
      old.isDisabled !== isDisabled ||
      old.isReadOnly !== isReadOnly
    ) {
      edit.current.consumed = true
      if (press.current.pending) press.current.cancelled = true
      replaceDraft(formatted)
    }
    previous.current = { value: authoritative, key: model.key, isDisabled, isReadOnly }
    if (isDisabled) setFocused(false)
  }, [authoritative, model.key, isDisabled, isReadOnly, formatted])
  const formValue = model.parse(draft)
  const behavior = useContext(NativeFormBehaviorContext)
  const validationBehavior = props.validationBehavior ?? behavior
  const builtinValidation = nativeStepperValidity(props, draft, formValue)
  const validation = useFormValidationState<number | null>({
    isInvalid: props.isInvalid ?? (props.errorState ? true : undefined),
    validationState: props.validationState,
    validate: props.validate,
    name: props.name,
    value: authoritative,
    validationBehavior,
    builtinValidation,
  })
  const publish = (next: number | null, validate = true) => {
    if (!active.current) return
    edit.current.consumed = true
    const normalized = next === 0 ? 0 : next
    replaceDraft(model.format(controlled.current ? authoritative : normalized, edit.current.draft))
    setValue(normalized)
    if (validate && !Object.is(normalized, authoritative)) validation.commitValidation()
  }
  const blocked = isDisabled || isReadOnly
  return {
    ...validation,
    // A controlled aria-invalid=false does not remove the original control's native numeric constraints.
    formValidation: validation.realtimeValidation.isInvalid ? validation.realtimeValidation : builtinValidation,
    value: authoritative === 0 ? 0 : authoritative,
    inputValue: draft,
    formValue,
    defaultValue: resetTarget,
    configurationKey: `${model.key}:reset:${resetRevision}`,
    minValue: props.minValue,
    maxValue: props.maxValue,
    stepValue: props.step,
    commitBehavior: props.commitBehavior ?? "snap",
    isDisabled,
    isReadOnly,
    isRequired,
    validationBehavior,
    isInputFocused,
    setFocused,
    formatValue: (number: number | null) => model.format(number, edit.current.draft),
    validateDraft: model.validate,
    canIncrement: !blocked && model.step(draft, 1) !== undefined,
    canDecrement: !blocked && model.step(draft, -1) !== undefined,
    begin: () => {
      if (!active.current || blocked) return
      edit.current.consumed = false
      press.current = { pending: false, cancelled: false }
    },
    change: (text: string) => {
      if (!active.current || blocked) return
      edit.current.consumed = false
      press.current = { pending: false, cancelled: false }
      replaceDraft(text)
      props.onChangeText?.(text)
    },
    commit: (text?: string) => {
      if (!active.current || blocked || edit.current.consumed) return
      if (press.current.pending) {
        if (text !== undefined) edit.current.draft = text
        return
      }
      const result = model.commit(text ?? edit.current.draft)
      publish(result ? result.value : authoritative)
    },
    pressStart: () => {
      press.current = { pending: true, cancelled: blocked || !active.current }
    },
    pressEnd: () => {
      press.current.pending = false
    },
    endpoint: (direction: -1 | 1) => {
      if (!active.current || blocked) return
      const next = model.endpoint(direction)
      if (next !== undefined) {
        press.current = { pending: false, cancelled: false }
        publish(next)
        validation.commitValidation()
      }
    },
    step: (direction: -1 | 1, fromPress = false) => {
      const cancelled = fromPress && press.current.cancelled
      press.current = { pending: false, cancelled: false }
      if (!active.current || blocked || cancelled) return
      const next = model.step(edit.current.draft, direction)
      if (next !== undefined) {
        publish(next)
        validation.commitValidation()
      }
    },
    resetValue: () => {
      if (!active.current) return
      edit.current.consumed = true
      press.current = { pending: false, cancelled: true }
      setResetRevision((revision) => revision + 1)
      publish(resetTarget, false)
    },
  }
}
