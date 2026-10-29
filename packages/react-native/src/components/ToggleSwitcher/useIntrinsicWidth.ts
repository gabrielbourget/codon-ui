import { useInsertionEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"
import type { View } from "react-native"

import { observeNativeMotionGeometry } from "../../input/motionGeometry"
import { resolveNativeMotionIsolatedLayout } from "../../motion/measurement/isolatedGeometry"
import type { TNativeMotionResolutionToken } from "../../motion/value/types"

export const useNativeSwitcherIntrinsicWidth = (
  original: RefObject<View | null>,
  signature: object,
  authoredWidth: unknown,
  defaultMinimum: number | undefined,
  measured: (width: number) => void,
) => {
  const latest = useRef(measured)
  useInsertionEffect(() => {
    latest.current = measured
  })
  const [failure, setFailure] = useState<Error>()
  useLayoutEffect(() => {
    const target = original.current
    if (!target) return
    let live = true,
      generation = 0
    let cancel = () => {}
    const stop = observeNativeMotionGeometry(target, (record) => {
      if (!record || record.kind === "mount-before" || record.kind === "detached") {
        generation++
        cancel()
        return
      }
      if (record.kind !== "mount-after" && !(record.kind === "sample" && record.requestId === "")) return
      const current = ++generation
      cancel()
      let cancelled = false
      const listeners = new Set<() => void>()
      cancel = () => {
        cancelled = true
        for (const listener of listeners) listener()
        listeners.clear()
      }
      const token: TNativeMotionResolutionToken = {
        isCurrent: () => live && !cancelled && generation === current && original.current === target,
        onCancel: (listener) => {
          if (!token.isCurrent()) {
            listener()
            return () => {}
          }
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
      }
      // The existing evaluator lays out immutable original input. No label copy or temporary native style is mounted.
      const implicit =
        authoredWidth === undefined ||
        authoredWidth === null ||
        authoredWidth === "auto" ||
        (typeof authoredWidth === "string" && authoredWidth.endsWith("%"))
      const nativeView = implicit
        ? {
            width: "max-content",
            flexShrink: 0,
            flexGrow: 0,
            ...(defaultMinimum === undefined ? {} : { minWidth: defaultMinimum }),
          }
        : {}
      void resolveNativeMotionIsolatedLayout(target, [{ index: 0, nativeView }], ["width"], token).then(
        (result) => {
          if (!token.isCurrent()) return
          const width = result.results[0]?.metrics.width
          if (typeof width !== "number" || !Number.isFinite(width) || width < 0) {
            setFailure(new Error("ToggleSwitcher: finite original intrinsic width required"))
            return
          }
          latest.current(width)
        },
        (error: unknown) => {
          if (!token.isCurrent()) return
          // A newer Fabric commit supplies its own mount receipt; never retry or apply the retired proposal.
          if (error instanceof Error && /Fabric input retired/.test(error.message)) return
          setFailure(
            error instanceof Error ? error : new Error("ToggleSwitcher: original intrinsic measurement failed"),
          )
        },
      )
    })
    return () => {
      live = false
      generation++
      cancel()
      stop()
    }
  }, [original, signature, authoredWidth, defaultMinimum])
  if (failure) throw failure
}
