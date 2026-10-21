import type { ReactNode } from "react"
import type { View, ViewProps } from "react-native"

import type { TNativeSlotProps } from "../collection/context"
import type { ValidationErrors, ValidationResult } from "../components/ComboBox/state/types"
import type { TNativePressEvent } from "../input/types"

export type TNativeFormValidation = Readonly<
  Omit<ValidationResult, "validationErrors"> & { validationErrors: readonly string[] }
>
export type TNativeFormEntry = readonly [name: string, value: string]
export const NATIVE_FORM_ACTIONS = ["submit", "reset"] as const
export type TNativeFormAction = (typeof NATIVE_FORM_ACTIONS)[number]
export type TNativeFormOrigin = "native" | "programmatic"
export type TNativeFormRequest = Readonly<{
  form: View
  action: TNativeFormAction
  entries: readonly TNativeFormEntry[]
  origin: TNativeFormOrigin
  sourceEvent?: TNativePressEvent
  defaultPrevented: boolean
  preventDefault: () => void
}>
export type TNativeFormFocusResult = Readonly<{
  descriptorId: string
  target: number
  requested: boolean
  observed: boolean
}>
export type TNativeFormResult = Readonly<{
  status: "submitted" | "reset" | "invalid" | "cancelled" | "retired"
  request?: TNativeFormRequest
  invalidFields?: readonly Readonly<{ descriptorId: string; validation: TNativeFormValidation }>[]
  focus?: TNativeFormFocusResult
  requestedFields?: readonly string[]
  reason?: string
}>
export type TNativeFormProps = Omit<ViewProps, "children"> &
  TNativeSlotProps & {
    children?: ReactNode
    id?: string
    validationBehavior?: "native" | "aria"
    validationErrors?: ValidationErrors
    onSubmit?: (request: TNativeFormRequest) => void
    onReset?: (request: TNativeFormRequest) => void
  }
