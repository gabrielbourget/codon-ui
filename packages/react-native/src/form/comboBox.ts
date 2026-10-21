import type { ValidationResult } from "../components/ComboBox/state/types"
import { VALID_VALIDITY_STATE } from "../components/ComboBox/state/useFormValidationState"

import type { TNativeFormFieldData } from "./registry"

export type TNativeComboBoxFieldOptions = Readonly<{
  name?: string
  form?: string
  formValue?: "key" | "text"
  allowsCustomValue?: boolean
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  validationBehavior?: "native" | "aria"
}>

export const nativeComboBoxFieldData = (
  props: TNativeComboBoxFieldOptions,
  state: Readonly<{ value: string | number | null; inputValue: string; realtimeValidation: ValidationResult }>,
): TNativeFormFieldData => {
  const behavior = props.validationBehavior ?? "native"
  const validation = state.realtimeValidation
  const missing = behavior === "native" && !!props.isRequired && state.inputValue.length === 0
  const invalid = validation.isInvalid || missing
  return {
    entries: props.name
      ? [
          [
            props.name,
            props.allowsCustomValue || props.formValue === "text" ? state.inputValue : String(state.value ?? ""),
          ],
        ]
      : [],
    isDisabled: !!props.isDisabled,
    isReadOnly: !!props.isReadOnly,
    validationBehavior: behavior,
    validation: {
      isInvalid: invalid,
      validationDetails: {
        ...(validation.isInvalid ? validation.validationDetails : VALID_VALIDITY_STATE),
        valueMissing: missing,
        valid: !invalid,
      },
      validationErrors: validation.isInvalid ? validation.validationErrors : [],
    },
  }
}
