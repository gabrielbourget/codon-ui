import type { ValidationResult } from "../ComboBox/state/types"

import type { TNativeNumberInputProps } from "./types"

type TBase<T> = T extends unknown ? Omit<T, "formatOptions"> : never

export type TNativeStepperNumberFieldProps = TBase<TNativeNumberInputProps> & {
  formatOptions?: Intl.NumberFormatOptions
  commitBehavior?: "snap" | "validate"
  isRequired?: boolean
  isInvalid?: boolean
  validationState?: "valid" | "invalid"
  validate?: (value: number | null) => true | string | string[] | null | undefined
  name?: string
  formFieldId?: string
  form?: string
  validationBehavior?: "native" | "aria"
  requiredErrorMessage?: string
}

export type TNativeStepperValidation = ValidationResult
