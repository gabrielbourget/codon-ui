import {
  forwardRef,
  useCallback,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { Easing } from "react-native"

import { getNativeButtonContent } from "../../components/Button/content"
import { useNativeLinkColor } from "../../components/Link/motion"
import { NativeContentContext, useNativeContentContext } from "../../components/NativeContentContext"
import { NativeTextStyleProvider } from "../../components/NativeTextStyleProvider"
import { NativeFocusHost } from "../../input/NativeFocusView"
import type { TNativeFocusViewRef } from "../../input/types"
import { useNativeTheme } from "../../theme"
import type { NativeProjectionStyle } from "../projection/types"

import { NativeMotionVisualState } from "./state"
import { resolveNativeMotionVisualStyle } from "./styles"
import type { TNativeMotionVisualHostProps, TNativeMotionVisualValues } from "./types"

const NO_MEASUREMENT = Object.freeze({ values: null, revision: undefined })
const emptyMeasurement = () => NO_MEASUREMENT
const noMeasurementSubscription = () => () => {}
const NO_PROJECTION: Readonly<{ style: NativeProjectionStyle; visible: boolean; radii: string }> = Object.freeze({
  style: Object.freeze({}),
  visible: true,
  radii: "",
})
const emptyProjection = () => NO_PROJECTION
const textColorEasing = Easing.bezier(0.42, 0, 0.58, 1)

export const NativeMotionVisualHost = forwardRef<TNativeFocusViewRef, TNativeMotionVisualHostProps>(
  (
    {
      computedStyles,
      customStyles,
      style,
      bindings,
      transformTemplate,
      onUpdate,
      children,
      measurement,
      motionOwner,
      projection,
      nativeRender,
      ...props
    },
    forwardedRef,
  ) => {
    const committedOwner = useRef(motionOwner)
    useInsertionEffect(() => {
      committedOwner.current = motionOwner
    }, [motionOwner])
    const [visual] = useState(
      () =>
        new NativeMotionVisualState(
          bindings,
          onUpdate,
          () => committedOwner.current?.captureVisualLease() ?? (() => true),
        ),
    )
    const values = useSyncExternalStore(visual.subscribe, visual.getSnapshot, visual.getSnapshot)
    const projected = useSyncExternalStore(
      projection?.subscribe ?? noMeasurementSubscription,
      projection?.getSnapshot ?? emptyProjection,
      emptyProjection,
    )
    const measured = useSyncExternalStore(
      measurement?.subscribe ?? noMeasurementSubscription,
      measurement?.getSnapshot ?? emptyMeasurement,
      emptyMeasurement,
    )
    const actual = useRef<TNativeFocusViewRef | null>(null)
    const committedStyle = useRef({ computedStyles, customStyles, style, transformTemplate })
    useInsertionEffect(() => {
      committedStyle.current = { computedStyles, customStyles, style, transformTemplate }
    })
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
          projection?.detach()
          motionOwner?.detach()
          measurement?.detach()
          releaseCaller()
          return
        }
        actual.current = target
        const retireOwner = motionOwner?.attach(target)
        const retireProjection = projection?.attach(target)
        let previousProjectionFields = new Set<string>()
        const retireWriter = projection?.attachWriter((snapshot) => {
          const current = motionOwner?.captureVisualLease()
          if (actual.current !== target || current?.() === false) return
          const authored = committedStyle.current
          const latest = resolveNativeMotionVisualStyle(
            authored.computedStyles,
            authored.customStyles,
            authored.style,
            { ...visual.getSnapshot(), ...measurement?.getSnapshot().values } as TNativeMotionVisualValues,
            authored.transformTemplate,
          )
          const nextStyle: Record<string, unknown> = { ...latest.view, ...snapshot.style }
          const currentFields = new Set(Object.keys(nextStyle))
          for (const key of previousProjectionFields) if (!currentFields.has(key)) nextStyle[key] = null
          previousProjectionFields = currentFields
          target.setNativeProps({
            style: nextStyle,
            nativeMotionVisible: snapshot.visible,
            nativeMotionProjectionRadii: snapshot.radii,
          })
        })
        const retire = visual.attach()
        const retireMeasurement = measurement?.attach(target)
        publishCaller(target)
        return () => {
          retire()
          retireWriter?.()
          retireProjection?.()
          retireOwner?.()
          retireMeasurement?.()
          if (actual.current === target) {
            actual.current = null
            releaseCaller()
          }
        }
      },
      [visual, measurement, motionOwner, projection, publishCaller, releaseCaller],
    )
    const resolved = resolveNativeMotionVisualStyle(
      computedStyles,
      customStyles,
      style,
      { ...values, ...measured.values } as TNativeMotionVisualValues,
      transformTemplate,
    )
    const host = {
      ...props,
      nativeMotionGeometryRevision: measured.revision ?? props.nativeMotionGeometryRevision,
      nativeMotionGeometryObservation: true,
      nativeMotionColorObservation: true,
      nativeMotionDrawingOwner: true,
      nativeMotionProjectionRadii: projected.radii,
      nativeMotionVisible: projected.visible,
      focusable: props.tabIndex === undefined ? (props.focusable ?? false) : !props.tabIndex,
      ref: setRef,
      style: [resolved.view, projected.style],
      children: getNativeButtonContent(children, resolved.text),
    }
    const foreground = resolved.text.color ?? inherited?.foregroundColor ?? theme.colors.foreground
    const currentForeground = useNativeLinkColor(
      foreground,
      250,
      textColorEasing,
      bindings?.color === undefined && (resolved.text.color !== undefined || inherited === undefined),
    )
    const content = (
      <NativeContentContext.Provider
        value={{
          foregroundColor: currentForeground,
          isButton: inherited?.isButton ?? false,
        }}
      >
        {nativeRender ? nativeRender(host) : <NativeFocusHost {...host} />}
      </NativeContentContext.Provider>
    )
    return <NativeTextStyleProvider style={resolved.text}>{content}</NativeTextStyleProvider>
  },
)
NativeMotionVisualHost.displayName = "NativeMotionVisualHost"
