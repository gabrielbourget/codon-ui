import {
  forwardRef,
  useCallback,
  useContext,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { findNodeHandle, type View } from "react-native"

import { NativeBackdropAdapterContext, NativeBackdropSourceContext } from "./context"
import type { TNativeBackdropHostProps } from "./types"

export const NativeBackdropHost = forwardRef<View, TNativeBackdropHostProps>((props, forwardedRef) => {
  const adapter = useContext(NativeBackdropAdapterContext)
  if (!adapter) throw new Error("NativeBackdropHost requires NativeOverlayProvider.backdropAdapter")
  const target = useRef<View>(null)
  const revision = useRef(0)
  const live = useRef(true)
  const committedAdapter = useRef(adapter)
  const [generation, setGeneration] = useState(0)
  const releaseRef = useRef<(() => void) | undefined>(undefined)
  useLayoutEffect(() => {
    if (!target.current) throw new TypeError("Native backdrop Target must forward an actual native View ref")
  }, [adapter.Target])
  useInsertionEffect(() => {
    committedAdapter.current = adapter
  })
  useInsertionEffect(
    () => () => {
      live.current = false
      revision.current++
      target.current = null
    },
    [],
  )
  const setRef = useCallback(
    (value: View | null) => {
      if (value) {
        const tag = findNodeHandle(value)
        if (typeof tag !== "number" || tag <= 0 || typeof value.measureInWindow !== "function")
          throw new TypeError("Native backdrop Target must forward an actual native View ref")
      }
      target.current = value
      revision.current++
      releaseRef.current?.()
      releaseRef.current = undefined
      if (typeof forwardedRef === "function") {
        if (value) {
          const release = forwardedRef(value)
          releaseRef.current = typeof release === "function" ? release : () => forwardedRef(null)
        }
      } else if (forwardedRef) forwardedRef.current = value
      if (live.current) setGeneration(revision.current)
    },
    [forwardedRef],
  )
  const source = useMemo(() => {
    const captured = target.current
    return {
      targetRef: target,
      generation,
      isCurrent: () =>
        live.current &&
        captured !== null &&
        target.current === captured &&
        revision.current === generation &&
        committedAdapter.current.Target === adapter.Target,
    }
  }, [generation, adapter.Target])
  const Target = adapter.Target
  return (
    <NativeBackdropSourceContext.Provider value={source}>
      <Target {...props} ref={setRef} collapsable={false} />
    </NativeBackdropSourceContext.Provider>
  )
})
NativeBackdropHost.displayName = "NativeBackdropHost"
