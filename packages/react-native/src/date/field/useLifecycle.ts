/* Adapted from pinned react-aria useDateField/useFocusWithin; Apache-2.0. */
import { useCallback, useInsertionEffect, useLayoutEffect, useRef } from "react"

import { readNativeFocusWithin, type TNativeFocusWithinEvent } from "../../input/focusWithin"
import type { DateFieldState } from "../state/useDateFieldState"

export type TNativeDateFieldFocusProps = Readonly<{
  onFocus?: (event: TNativeFocusWithinEvent) => void
  onBlur?: (event: TNativeFocusWithinEvent) => void
  onFocusChange?: (focused: boolean) => void
}>

// Called only with the original NativeFocusView within observation. Its existing
// session admits target/window/scope/sequence; canAct retains the field's owner.
export const useNativeDateFieldLifecycle = (
  state: Pick<DateFieldState, "isDisabled" | "confirmPlaceholder" | "commitValidation"> & { value: unknown },
  props: TNativeDateFieldFocusProps,
  canAct: (event: TNativeFocusWithinEvent) => boolean,
) => {
  const current = useRef({ state, props, canAct })
  const active = useRef(false)
  const within = useRef(false)
  const valueOnFocus = useRef<unknown>(null)
  useInsertionEffect(() => {
    current.current = { state, props, canAct }
  })
  const retire = useCallback(() => {
    within.current = false
    valueOnFocus.current = null
  }, [])
  useLayoutEffect(() => {
    active.current = true
    return () => {
      active.current = false
      retire()
    }
  }, [retire])
  const receive = useCallback((event: TNativeFocusWithinEvent) => {
    const data = readNativeFocusWithin(event.nativeEvent)
    const { state, props, canAct } = current.current
    if (!active.current || !data || state.isDisabled || !canAct(event) || data.within === within.current) return
    if (data.within) {
      valueOnFocus.current = state.value
      props.onFocus?.(event)
      props.onFocusChange?.(true)
      within.current = true
    } else {
      within.current = false
      state.confirmPlaceholder()
      if (state.value !== valueOnFocus.current) state.commitValidation()
      props.onBlur?.(event)
      props.onFocusChange?.(false)
    }
  }, [])
  return { receive, retire }
}
