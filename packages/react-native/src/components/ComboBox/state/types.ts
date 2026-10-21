import type {
  ComboBoxState as TSourceComboBoxState,
  ComboBoxStateOptions as TSourceComboBoxStateOptions,
  MenuTriggerAction,
  SelectionMode,
} from "react-stately/useComboBoxState"

import type { TNativeCollectionSnapshot } from "../../../collection/snapshot"
import type { TNativeListState } from "../../../collection/state"
import type { Key } from "../../../collection/state/types"

import type { FormValidationState } from "./useFormValidationState"

export type { MenuTriggerAction, SelectionMode }
export type ValueType<M extends SelectionMode> = M extends "single" ? Key | null : Key[]
export type ChangeValueType<M extends SelectionMode> = ValueType<M>
export type Collection<T> = TNativeCollectionSnapshot<T>
export type ComboBoxStateOptions<T, M extends SelectionMode = "single"> = Omit<
  TSourceComboBoxStateOptions<T, M>,
  "collection" | "children"
> & { collection: TNativeCollectionSnapshot<T>; isOpen?: boolean; defaultOpen?: boolean }
export type ComboBoxState<T, M extends SelectionMode = "single"> = Omit<
  TSourceComboBoxState<T, M>,
  "selectionManager" | "collection" | keyof FormValidationState
> &
  FormValidationState & {
    selectionManager: TNativeListState<T>["selectionManager"]
    collection: TNativeCollectionSnapshot<T>
  }
export type ValidityState = Readonly<{
  badInput: boolean
  customError: boolean
  patternMismatch: boolean
  rangeOverflow: boolean
  rangeUnderflow: boolean
  stepMismatch: boolean
  tooLong: boolean
  tooShort: boolean
  typeMismatch: boolean
  valueMissing: boolean
  valid: boolean
}>
export type ValidationResult = Readonly<{
  isInvalid: boolean
  validationDetails: ValidityState
  validationErrors: string[]
}>
export type ValidationErrors = Record<string, string | string[]>
export type ValidationFunction<T> = (
  value: T,
) => ReturnType<NonNullable<TSourceComboBoxStateOptions<object>["validate"]>>
export type Validation<T> = Pick<
  TSourceComboBoxStateOptions<object>,
  "isInvalid" | "validationState" | "validationBehavior"
> & { validate?: ValidationFunction<T> }
