import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type ComponentProps, type RefObject } from "react"
import { Animated, type View } from "react-native"

import { nativeKeyTokens } from "../../input/keyScope"
import { observeNativeMotionGeometry } from "../../input/motionGeometry"
import { NativeDialogEntryOwnerContext, useNativeDialogFocusOwner } from "../../input/NativeDialogFocusScope"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyPolicy, useNativeKeyScope } from "../../input/NativeKeyboardScope"

import { NativePanelFocusIntentContext, useNativePanelInitialFocus } from "./focus"
import type { TPanelBorderBox } from "./radii"
import type { TNativePanelProps } from "./types"

// Animated may replace its callback ref as styles change. Keep the owned host's
// ref stable so a paint update cannot retire its native geometry observer.
const PanelFocusHost = forwardRef<View, ComponentProps<typeof NativeFocusHost>>((props, ref) => {
  const target = useRef<View>(null)
  useImperativeHandle(ref, () => target.current!)
  return <NativeFocusHost {...props} ref={target} />
})
PanelFocusHost.displayName = "PanelFocusHost"
const AnimatedFocusView = Animated.createAnimatedComponent(PanelFocusHost)
const escapeTokens = nativeKeyTokens("Escape")
export const NativePanelSurface = forwardRef<
  View,
  ComponentProps<typeof AnimatedFocusView> & {
    open: boolean
    ready: boolean
    isActive: () => boolean
    systemClose: () => void
    keyboardDisabled: boolean
    observeContentBox: boolean
    onContentBox: (bounds: { width: number; height: number } | null) => void
    observeRadii: boolean
    onBorderBox: (bounds: TPanelBorderBox | null) => void
    appearanceHost: RefObject<View | null>
    appearanceScope: RefObject<(() => boolean) | null>
    initialFocusRef?: TNativePanelProps["initialFocusRef"]
  }
>(
  (
    {
      open,
      ready,
      isActive,
      systemClose,
      keyboardDisabled,
      observeContentBox,
      onContentBox,
      observeRadii,
      onBorderBox,
      appearanceHost,
      appearanceScope,
      initialFocusRef,
      ...props
    },
    ref,
  ) => {
    const root = useRef<View>(null)
    const scope = useNativeKeyScope()
    useImperativeHandle(ref, () => root.current!)
    useImperativeHandle(appearanceHost, () => root.current!)
    useImperativeHandle(appearanceScope, () => () => !!scope?.acknowledgedSession().windowId)
    useLayoutEffect(() => {
      if (!observeContentBox) onContentBox(null)
      if (!observeRadii) onBorderBox(null)
      if (!observeContentBox && !observeRadii) return
      const release = observeNativeMotionGeometry(root.current, (record) => {
        const content = record?.snapshot?.contentBox
        if (observeContentBox) onContentBox(content ? { width: content[2], height: content[3] } : null)
        if (observeRadii) {
          const snapshot = record?.snapshot
          onBorderBox(
            snapshot
              ? {
                  width: snapshot.layout[2],
                  height: snapshot.layout[3],
                  direction: snapshot.ancestors[0]?.layoutDirection,
                  platform: snapshot.platform,
                }
              : null,
          )
        }
      })
      return () => {
        release()
        if (observeContentBox) onContentBox(null)
        if (observeRadii) onBorderBox(null)
      }
    }, [observeContentBox, onContentBox, observeRadii, onBorderBox])
    const reservedEntry = useNativePanelInitialFocus(open, ready, isActive, root, initialFocusRef)
    const dialogOwner = useNativeDialogFocusOwner(root, () => open && ready && isActive(), reservedEntry)
    useNativeKeyPolicy({
      tokens: escapeTokens,
      targetTag: 0,
      excludeEditable: false,
      excludeComposing: true,
      isEnabled: open && !keyboardDisabled,
      lifetimeKey: JSON.stringify([open, keyboardDisabled]),
      canAct: isActive,
      onKey: (event) => {
        if (event.nativeEvent.phase === "down" && !event.nativeEvent.repeat && !event.nativeEvent.cancelled)
          systemClose()
      },
    })
    return (
      <NativePanelFocusIntentContext.Provider value={undefined}>
        <NativeDialogEntryOwnerContext.Provider value={dialogOwner}>
          <AnimatedFocusView
            {...props}
            nativeMotionGeometryObservation={observeContentBox || observeRadii}
            nativeMotionColorObservation
            nativeTabStop={false}
            ref={root}
          />
        </NativeDialogEntryOwnerContext.Provider>
      </NativePanelFocusIntentContext.Provider>
    )
  },
)
NativePanelSurface.displayName = "NativePanelSurface"
