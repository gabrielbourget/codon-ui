import type { useNativeStepperNumberFieldState } from "../components/NumberInput/stepperState"
import type { TNativeStepperNumberFieldProps } from "../components/NumberInput/stepperTypes"

import type { TNativeFormFieldData } from "./registry"

export type TNativeNumberFieldOptions = Pick<
  TNativeStepperNumberFieldProps,
  "name" | "form" | "formFieldId" | "validationBehavior" | "requiredErrorMessage"
>

export const nativeNumberFieldData = (
  props: TNativeNumberFieldOptions,
  state: Pick<
    ReturnType<typeof useNativeStepperNumberFieldState>,
    "formValue" | "isDisabled" | "isReadOnly" | "formValidation" | "validationBehavior"
  >,
): TNativeFormFieldData => ({
  entries: props.name ? [[props.name, state.formValue === null ? "" : String(state.formValue)]] : [],
  isDisabled: state.isDisabled,
  // The canonical visible readonly text input is barred from native Form validation,
  // while its numeric submission value is still included.
  isReadOnly: state.isReadOnly,
  validationBehavior: state.validationBehavior,
  validation: state.formValidation,
})
