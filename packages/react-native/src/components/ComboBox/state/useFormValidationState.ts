/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { Context } from "react"
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"

import type { Validation, ValidationErrors, ValidationFunction, ValidationResult, ValidityState } from "./types"

export const VALID_VALIDITY_STATE: ValidityState = {
  badInput: false,
  customError: false,
  patternMismatch: false,
  rangeOverflow: false,
  rangeUnderflow: false,
  stepMismatch: false,
  tooLong: false,
  tooShort: false,
  typeMismatch: false,
  valueMissing: false,
  valid: true,
}

const CUSTOM_VALIDITY_STATE: ValidityState = {
  ...VALID_VALIDITY_STATE,
  customError: true,
  valid: false,
}

export const DEFAULT_VALIDATION_RESULT: ValidationResult = {
  isInvalid: false,
  validationDetails: VALID_VALIDITY_STATE,
  validationErrors: [],
}

export const FormValidationContext: Context<ValidationErrors> = createContext<ValidationErrors>({})

// Private props that we pass from useFormValidationState to children.
// Ideally we'd use a Symbol for this, but React doesn't support them: https://github.com/facebook/react/issues/7552
// This needs to be stable across server and client module evaluation for SSR hydration.
export const privateValidationStateProp: string = "__reactAriaFormValidationState"

interface FormValidationProps<T> extends Validation<T> {
  [privateProp: string]: unknown
  builtinValidation?: ValidationResult
  name?: string | string[]
  value: T | null
}

export interface FormValidationState {
  /** Realtime validation results, updated as the user edits the value. */
  realtimeValidation: ValidationResult
  /** Currently displayed validation results, updated when the user commits their changes. */
  displayValidation: ValidationResult
  /** Updates the current validation result. Not displayed to the user until `commitValidation` is called. */
  updateValidation(result: ValidationResult): void
  /** Resets the displayed validation state to valid when the user resets the form. */
  resetValidation(): void
  /** Commits the realtime validation so it is displayed to the user. */
  commitValidation(): void
}

export function useFormValidationState<T>(props: FormValidationProps<T>): FormValidationState {
  // Private prop for parent components to pass state to children.
  if (props[privateValidationStateProp]) {
    const { realtimeValidation, displayValidation, updateValidation, resetValidation, commitValidation } = props[
      privateValidationStateProp
    ] as FormValidationState
    return { realtimeValidation, displayValidation, updateValidation, resetValidation, commitValidation }
  }

  return useFormValidationStateImpl(props)
}

function useFormValidationStateImpl<T>(props: FormValidationProps<T>): FormValidationState {
  let { isInvalid } = props
  const { validationState, name, value } = props
  let { builtinValidation } = props
  const { validate, validationBehavior = "aria" } = props

  // backward compatibility.
  if (validationState) {
    isInvalid ||= validationState === "invalid"
  }

  // If the isInvalid prop is controlled, update validation result in realtime.
  const controlledError: ValidationResult | null =
    isInvalid !== undefined
      ? {
          isInvalid,
          validationErrors: [],
          validationDetails: CUSTOM_VALIDITY_STATE,
        }
      : null

  // Perform custom client side validation.
  const clientError: ValidationResult | null = useMemo(() => {
    if (!validate || value == null) {
      return null
    }
    const validateErrors = runValidate(validate, value)
    return getValidationResult(validateErrors)
  }, [validate, value])

  if (builtinValidation?.validationDetails.valid) {
    builtinValidation = undefined
  }

  // Get relevant server errors from the form.
  const serverErrors = useContext(FormValidationContext)
  const serverErrorMessages = useMemo(() => {
    if (name) {
      return Array.isArray(name) ? name.flatMap((name) => asArray(serverErrors[name])) : asArray(serverErrors[name])
    }
    return []
  }, [serverErrors, name])

  // Show server errors when the form gets a new value, and clear when the user changes the value.
  const [lastServerErrors, setLastServerErrors] = useState(serverErrors)
  const [isServerErrorCleared, setServerErrorCleared] = useState(false)
  if (serverErrors !== lastServerErrors) {
    setLastServerErrors(serverErrors)
    setServerErrorCleared(false)
  }

  const serverError: ValidationResult | null = useMemo(
    () => getValidationResult(isServerErrorCleared ? [] : serverErrorMessages),
    [isServerErrorCleared, serverErrorMessages],
  )

  // Track the next validation state in a ref until commitValidation is called.
  const nextValidation = useRef(DEFAULT_VALIDATION_RESULT)
  const [currentValidity, setCurrentValidity] = useState(DEFAULT_VALIDATION_RESULT)

  const lastError = useRef(DEFAULT_VALIDATION_RESULT)
  const commitValidation = () => {
    if (!commitQueued) {
      return
    }

    setCommitQueued(false)
    const error = clientError || builtinValidation || nextValidation.current
    if (!isEqualValidation(error, lastError.current)) {
      lastError.current = error
      setCurrentValidity(error)
    }
  }

  const [commitQueued, setCommitQueued] = useState(false)
  useEffect(commitValidation)

  // realtimeValidation is used to update the native input element's state based on custom validation logic.
  // displayValidation is the currently displayed validation state that the user sees (e.g. on input change/form submit).
  // With validationBehavior="aria", all errors are displayed in realtime rather than on submit.
  const realtimeValidation =
    controlledError || serverError || clientError || builtinValidation || DEFAULT_VALIDATION_RESULT
  const displayValidation =
    validationBehavior === "native"
      ? controlledError || serverError || currentValidity
      : controlledError || serverError || clientError || builtinValidation || currentValidity

  return {
    realtimeValidation,
    displayValidation,
    updateValidation(value) {
      // If validationBehavior is 'aria', update in realtime. Otherwise, store in a ref until commit.
      if (validationBehavior === "aria" && !isEqualValidation(currentValidity, value)) {
        setCurrentValidity(value)
      } else {
        nextValidation.current = value
      }
    },
    resetValidation() {
      // Update the currently displayed validation state to valid on form reset,
      // even if the native validity says it isn't. It'll show again on the next form submit.
      const error = DEFAULT_VALIDATION_RESULT
      if (!isEqualValidation(error, lastError.current)) {
        lastError.current = error
        setCurrentValidity(error)
      }

      // Do not commit validation after the next render. This avoids a condition where
      // useSelect calls commitValidation inside an onReset handler.
      if (validationBehavior === "native") {
        setCommitQueued(false)
      }

      setServerErrorCleared(true)
    },
    commitValidation() {
      // Commit validation state so the user sees it on blur/change/submit. Also clear any server errors.
      // Wait until after the next render to commit so that the latest value has been validated.
      if (validationBehavior === "native") {
        setCommitQueued(true)
      }
      setServerErrorCleared(true)
    },
  }
}

function asArray<T>(v: T | T[]): T[] {
  if (!v) {
    return []
  }

  return Array.isArray(v) ? v : [v]
}

function runValidate<T>(validate: ValidationFunction<T>, value: T): string[] {
  if (typeof validate === "function") {
    const e = validate(value)
    if (e && typeof e !== "boolean") {
      return asArray(e)
    }
  }

  return []
}

function getValidationResult(errors: string[]): ValidationResult | null {
  return errors.length
    ? {
        isInvalid: true,
        validationErrors: errors,
        validationDetails: CUSTOM_VALIDITY_STATE,
      }
    : null
}

function isEqualValidation(a: ValidationResult | null, b: ValidationResult | null): boolean {
  if (a === b) {
    return true
  }

  return (
    !!a &&
    !!b &&
    a.isInvalid === b.isInvalid &&
    a.validationErrors.length === b.validationErrors.length &&
    a.validationErrors.every((a, i) => a === b.validationErrors[i]) &&
    Object.entries(a.validationDetails).every(([k, v]) => b.validationDetails[k as keyof ValidityState] === v)
  )
}

export function mergeValidation(...results: ValidationResult[]): ValidationResult {
  const errors = new Set<string>()
  let isInvalid = false
  const validationDetails = {
    ...VALID_VALIDITY_STATE,
  }

  for (const v of results) {
    for (const e of v.validationErrors) {
      errors.add(e)
    }

    // Only these properties apply for checkboxes.
    isInvalid ||= v.isInvalid
    for (const key in validationDetails) {
      const flag = key as keyof ValidityState
      validationDetails[flag] ||= v.validationDetails[flag]
    }
  }

  validationDetails.valid = !isInvalid
  return {
    isInvalid,
    validationErrors: [...errors],
    validationDetails,
  }
}
