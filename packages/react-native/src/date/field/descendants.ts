import { createContext, type Ref } from "react"
import type { View } from "react-native"

import type { TNativeContextValue } from "../../collection/context"
import type { TNativeTextProps, TNativeTextRef } from "../../components/Text/types"
import type { TNativeDateSegmentFormTarget } from "../../form/dateSegments"
import type { TNativeFocusViewProps } from "../../input/types"
import type { TimeFieldState } from "../state/useTimeFieldState"

export type TNativeTimeFieldGroupContext = TNativeFocusViewProps & {
  isDisabled: boolean
  isReadOnly: boolean
  isInvalid: boolean
}
export const NativeTimeFieldGroupContext = createContext<TNativeContextValue<TNativeTimeFieldGroupContext, View>>(null)
export const NativeTimeFieldInputContext = createContext<Readonly<{
  name?: string
  form?: string
  autoComplete?: string
  value: string
  isDisabled: boolean
  isRequired: boolean
  segments: readonly TNativeDateSegmentFormTarget[]
}> | null>(null)
export const NativeTimeFieldLabelContext = createContext<
  TNativeContextValue<
    Partial<TNativeTextProps> & {
      ref?: Ref<TNativeTextRef>
      focusField: () => boolean
    },
    TNativeTextRef
  >
>(null)
export const NativeTimeFieldTextContext =
  createContext<TNativeContextValue<Partial<TNativeTextProps>, TNativeTextRef>>(null)
export const NativeTimeFieldErrorContext = createContext<TimeFieldState["displayValidation"] | null>(null)
