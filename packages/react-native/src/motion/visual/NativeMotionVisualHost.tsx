import {
  forwardRef,
  useCallback,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import { getNativeButtonContent } from "../../components/Button/content"
import { NativeContentContext, useNativeContentContext } from "../../components/NativeContentContext"
import { NativeFocusHost } from "../../input/NativeFocusView"
import type { TNativeFocusViewRef } from "../../input/types"
import { useNativeTheme } from "../../theme"

import { NativeMotionVisualState } from "./state"
import { resolveNativeMotionVisualStyle } from "./styles"
import type { TNativeMotionVisualHostProps, TNativeMotionVisualValues } from "./types"

const NO_MEASUREMENT = Object.freeze({ values: null, revision: undefined })
const emptyMeasurement = () => NO_MEASUREMENT
const noMeasurementSubscription = () => () => {}

export const NativeMotionVisualHost = forwardRef<TNativeFocusViewRef, TNativeMotionVisualHostProps>(
  (
    { computedStyles, customStyles, style, bindings, transformTemplate, onUpdate, children, measurement, ...props },
    forwardedRef,
  ) => {
    const [visual] = useState(() => new NativeMotionVisualState(bindings, onUpdate))
    const values = useSyncExternalStore(visual.subscribe, visual.getSnapshot, visual.getSnapshot)
    const measured = useSyncExternalStore(
      measurement?.subscribe ?? noMeasurementSubscription,
      measurement?.getSnapshot ?? emptyMeasurement,
      emptyMeasurement,
    )
    const actual = useRef<TNativeFocusViewRef | null>(null)
    const latestRef = useRef(forwardedRef)
    const publishedRef = useRef<{ ref: typeof forwardedRef; cleanup: void | (() => void) } | null>(null)
    useInsertionEffect(() => {
      latestRef.current = forwardedRef
    }, [forwardedRef])
    const releaseCaller = useCallback(() => {
      const previous = publishedRef.current
      publishedRef.current = null
      if (!previous) return
      if (typeof previous.cleanup === "function") previous.cleanup()
      else if (typeof previous.ref === "function") previous.ref(null)
      else if (previous.ref) previous.ref.current = null
    }, [])
    const publishCaller = useCallback(
      (target: TNativeFocusViewRef) => {
        const ref = latestRef.current
        if (publishedRef.current?.ref === ref) return
        releaseCaller()
        let cleanup: void | (() => void) = undefined
        if (typeof ref === "function") cleanup = ref(target)
        else if (ref) ref.current = target
        publishedRef.current = { ref, cleanup }
      },
      [releaseCaller],
    )
    useLayoutEffect(() => {
      if (actual.current) publishCaller(actual.current)
    }, [forwardedRef, publishCaller])
    const theme = useNativeTheme()
    const inherited = useNativeContentContext()
    useLayoutEffect(() => visual.configure(bindings, onUpdate), [visual, bindings, onUpdate])
    const setRef = useCallback(
      (target: TNativeFocusViewRef | null) => {
        if (!target) {
          actual.current = null
          visual.detach()
          measurement?.detach()
          releaseCaller()
          return
        }
        actual.current = target
        const retire = visual.attach()
        const retireMeasurement = measurement?.attach(target)
        publishCaller(target)
        return () => {
          retire()
          retireMeasurement?.()
          if (actual.current === target) {
            actual.current = null
            releaseCaller()
          }
        }
      },
      [visual, measurement, publishCaller, releaseCaller],
    )
    const resolved = resolveNativeMotionVisualStyle(
      computedStyles,
      customStyles,
      style,
      { ...values, ...measured.values } as TNativeMotionVisualValues,
      transformTemplate,
    )
    return (
      <NativeContentContext.Provider
        value={{
          foregroundColor: resolved.text.color ?? inherited?.foregroundColor ?? theme.colors.foreground,
          isButton: inherited?.isButton ?? false,
        }}
      >
        <NativeFocusHost
          {...props}
          nativeMotionGeometryRevision={measured.revision ?? props.nativeMotionGeometryRevision}
          nativeMotionGeometryObservation
          nativeMotionColorObservation
          focusable={props.tabIndex === undefined ? (props.focusable ?? false) : !props.tabIndex}
          ref={setRef}
          style={resolved.view}
        >
          {getNativeButtonContent(children, resolved.text)}
        </NativeFocusHost>
      </NativeContentContext.Provider>
    )
  },
)
NativeMotionVisualHost.displayName = "NativeMotionVisualHost"
