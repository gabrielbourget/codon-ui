import { useContext, useInsertionEffect, useRef } from "react"

import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"

export type TFilterAvailability = { canAct?: () => boolean }

// Child Select/TagComboBox callbacks have already passed their own native-window admission.
export const useFilterRequest = <T extends TFilterAvailability>(props: T, delegated = true) => {
  const scope = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const input = useNativeKeyScope()
  const latest = useRef({ props, scope, windowActive, input })
  const mounted = useRef(false)
  useInsertionEffect(() => {
    latest.current = { props, scope, windowActive, input }
  })
  useInsertionEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  return <A extends unknown[]>(callback: (current: T, ...args: A) => void) =>
    (...args: A) => {
      const current = latest.current
      if (
        !mounted.current ||
        current.props.canAct?.() === false ||
        (!delegated &&
          (current.scope?.canAct() === false ||
            current.windowActive?.() === false ||
            current.input?.isWindowActive() === false))
      )
        return
      callback(current.props, ...args)
    }
}
