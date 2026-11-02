import type { Validation, ValidationResult } from "../components/ComboBox/state/types"
import { VALID_VALIDITY_STATE } from "../components/ComboBox/state/useFormValidationState"
import type { TNativeComboBoxKey } from "../components/ComboBox/types"

import { nativeComboBoxFieldData, type TNativeComboBoxFieldOptions } from "./comboBox"

export type TNativeSimpleComboBoxValidationValue = Readonly<{
  inputValue: string
  value: TNativeComboBoxKey | null
  selectedKey: TNativeComboBoxKey | null
}>
export type TNativeSimpleComboBoxFieldOptions = Omit<TNativeComboBoxFieldOptions, "allowsCustomValue"> &
  Validation<TNativeSimpleComboBoxValidationValue>
export type TNativeSimpleComboBoxFormState = Readonly<{
  selectedKey: TNativeComboBoxKey | null
  query: string
  validationBehavior: "native" | "aria"
  formValidation: ValidationResult
  displayValidation: ValidationResult
  resetInput: () => void
  resetKey: () => void
  commitValidation: () => void
  resetValidation: () => void
}>

export const nativeSimpleComboBoxValidity = (
  props: TNativeSimpleComboBoxFieldOptions,
  query: string,
): ValidationResult => {
  const missing =
    props.validationBehavior !== "aria" && !props.isDisabled && !props.isReadOnly && !!props.isRequired && !query.length
  return {
    isInvalid: missing,
    validationDetails: { ...VALID_VALIDITY_STATE, valueMissing: missing, valid: !missing },
    validationErrors: missing ? [props.requiredErrorMessage ?? "Required"] : [],
  }
}

export const nativeSimpleComboBoxFieldData = (
  props: TNativeSimpleComboBoxFieldOptions,
  state: Pick<TNativeSimpleComboBoxFormState, "selectedKey" | "query" | "validationBehavior" | "formValidation">,
) =>
  nativeComboBoxFieldData(
    { ...props, validationBehavior: state.validationBehavior },
    {
      value: state.selectedKey,
      inputValue: state.query,
      realtimeValidation: state.formValidation,
    },
  )
