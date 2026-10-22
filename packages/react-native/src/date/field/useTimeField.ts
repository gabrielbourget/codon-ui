/* Adapted from pinned RAC TimeField; Apache-2.0. See ../entry/UPSTREAM.json. */
import { useContext, type Ref } from "react"
import type { View } from "react-native"

import { useNativeContextProps } from "../../collection/context"
import { NativeFormBehaviorContext } from "../../form/context"
import { useNativeLocale } from "../../locale/NativeLocaleProvider"
import type { TimeValue } from "../state/types"
import { useTimeFieldState } from "../state/useTimeFieldState"

import { NativeTimeFieldContext } from "./context"
import type { TNativeTimeFieldProps, TNativeTimeFieldRenderState } from "./types"

export const useNativeTimeField = <T extends TimeValue>(
  authored: TNativeTimeFieldProps<T>,
  ref: Ref<View> | undefined,
) => {
  const [props, mergedRef] = useNativeContextProps(authored, ref, NativeTimeFieldContext)
  const formValidationBehavior = useContext(NativeFormBehaviorContext)
  const validationBehavior = props.validationBehavior ?? formValidationBehavior ?? "native"
  const { locale, direction } = useNativeLocale()
  const {
    onFocus: _focus,
    onBlur: _blur,
    onFocusChange: _focusChange,
    onKeyDown: _keyDown,
    onKeyUp: _keyUp,
    ...stateProps
  } = props
  const options = { ...stateProps, locale, validationBehavior }
  const state = useTimeFieldState<T>(options)
  const renderState: TNativeTimeFieldRenderState = {
    state,
    isInvalid: state.isInvalid,
    isDisabled: state.isDisabled,
    isReadOnly: state.isReadOnly,
    isRequired: props.isRequired || false,
  }
  return { props, ref: mergedRef, state, renderState, validationBehavior, locale, direction }
}
