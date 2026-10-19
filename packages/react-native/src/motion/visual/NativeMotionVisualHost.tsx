import { forwardRef, useCallback, useLayoutEffect, useState, useSyncExternalStore } from "react"

import { getNativeButtonContent } from "../../components/Button/content"
import { NativeContentContext, useNativeContentContext } from "../../components/NativeContentContext"
import { NativeFocusHost } from "../../input/NativeFocusView"
import type { TNativeFocusViewRef } from "../../input/types"
import { useNativeTheme } from "../../theme"

import { NativeMotionVisualState } from "./state"
import { resolveNativeMotionVisualStyle } from "./styles"
import type { TNativeMotionVisualHostProps } from "./types"

export const NativeMotionVisualHost = forwardRef<TNativeFocusViewRef, TNativeMotionVisualHostProps>(
  (
    { computedStyles, customStyles, style, bindings, transformTemplate, onUpdate, children, ...props },
    forwardedRef,
  ) => {
    const [visual] = useState(() => new NativeMotionVisualState(bindings, onUpdate))
    const values = useSyncExternalStore(visual.subscribe, visual.getSnapshot, visual.getSnapshot)
    const theme = useNativeTheme()
    const inherited = useNativeContentContext()
    useLayoutEffect(() => visual.configure(bindings, onUpdate), [visual, bindings, onUpdate])
    const setRef = useCallback(
      (target: TNativeFocusViewRef | null) => {
        if (!target) {
          visual.detach()
          if (forwardedRef && typeof forwardedRef !== "function") forwardedRef.current = null
          return
        }
        const retire = visual.attach()
        let cleanup: void | (() => void)
        if (typeof forwardedRef === "function") cleanup = forwardedRef(target)
        else if (forwardedRef) forwardedRef.current = target
        return () => {
          retire()
          if (typeof cleanup === "function") cleanup()
          else if (typeof forwardedRef === "function") forwardedRef(null)
          else if (forwardedRef) forwardedRef.current = null
        }
      },
      [visual, forwardedRef],
    )
    const resolved = resolveNativeMotionVisualStyle(computedStyles, customStyles, style, values, transformTemplate)
    return (
      <NativeContentContext.Provider
        value={{
          foregroundColor: resolved.text.color ?? inherited?.foregroundColor ?? theme.colors.foreground,
          isButton: inherited?.isButton ?? false,
        }}
      >
        <NativeFocusHost
          {...props}
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
