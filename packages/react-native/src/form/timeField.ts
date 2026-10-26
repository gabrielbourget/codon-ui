import { VALID_VALIDITY_STATE } from "../components/ComboBox/state/useFormValidationState"
import type { TimeFieldState } from "../date/state/useTimeFieldState"

import type { TNativeFormFieldData } from "./registry"
import type { TNativeFormEntry } from "./types"

export type TNativeTimeFieldFormOptions = Readonly<{
  name?: string
  form?: string
  validationBehavior?: "native" | "aria"
  requiredErrorMessage?: string
}>

export const nativeTimeFieldData = (
  props: TNativeTimeFieldFormOptions,
  state: Pick<TimeFieldState, "timeValue" | "isDisabled" | "isReadOnly" | "isRequired" | "realtimeValidation">,
): TNativeFormFieldData =>
  nativeDateFieldFormData(
    props,
    state,
    props.name ? [[props.name, state.timeValue?.toString() ?? ""]] : [],
    state.timeValue == null,
  )

export const nativeDateFieldFormData = (
  props: TNativeTimeFieldFormOptions,
  state: Pick<TimeFieldState, "isDisabled" | "isReadOnly" | "isRequired" | "realtimeValidation">,
  entries: readonly TNativeFormEntry[],
  isValueMissing: boolean,
): TNativeFormFieldData => {
  const behavior = props.validationBehavior ?? "native"
  const validation = state.realtimeValidation
  const missing = behavior === "native" && !state.isDisabled && state.isRequired && isValueMissing
  const invalid = validation.isInvalid || missing
  return {
    entries,
    isDisabled: state.isDisabled,
    // This describes the source form control, whose hidden text input is not
    // readonly. The visible original segments retain their own readonly state.
    isReadOnly: false,
    validationBehavior: behavior,
    validation: {
      isInvalid: invalid,
      validationDetails: {
        ...(validation.isInvalid ? validation.validationDetails : VALID_VALIDITY_STATE),
        valueMissing: missing,
        valid: !invalid,
      },
      validationErrors: validation.isInvalid
        ? validation.validationErrors
        : missing
          ? [props.requiredErrorMessage ?? "Required"]
          : [],
    },
  }
}
