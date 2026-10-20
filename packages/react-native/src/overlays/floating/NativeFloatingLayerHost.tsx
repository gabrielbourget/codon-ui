import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react"
import {
  BackHandler,
  Platform,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type ViewProps,
} from "react-native"
import { Portal, PortalHost, PortalProvider } from "react-native-teleport"

import { nativeKeyTokens } from "../../input/keyScope"
import { NativeKeyboardScope, useNativeKeyPolicy } from "../../input/NativeKeyboardScope"

import { createNativeFloatingFocusReturns } from "./focusReturn"
import { createNativeFloatingInteractions } from "./interaction"
import {
  createNativeFloatingLayerRegistry,
  type TNativeFloatingDismissReason,
  type TNativeFloatingLayerRegistry,
} from "./registry"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "./scope"
import { createNativeTooltipTiming } from "./tooltipTiming"

export type TNativeFloatingLayerHostRef = View
// Both pinned native base configs register these phases; RN0.86 ViewProps omits their capture spellings.
type TNativeTouchCaptureProps = {
  onTouchStartCapture?: NonNullable<ViewProps["onTouchStart"]>
  onTouchEndCapture?: NonNullable<ViewProps["onTouchEnd"]>
  onTouchCancelCapture?: NonNullable<ViewProps["onTouchCancel"]>
  onFocusCapture?: NonNullable<ViewProps["onFocus"]>
}
export type TNativeFloatingLayerHostProps = Omit<ViewProps, "pointerEvents" | "collapsable"> & TNativeTouchCaptureProps

type TNativeFloatingHost = {
  name: string
  root: RefObject<View | null>
  generation: RefObject<number>
  live: RefObject<boolean>
  layers: TNativeFloatingLayerRegistry
  interactions: ReturnType<typeof createNativeFloatingInteractions>
  tooltipTiming: ReturnType<typeof createNativeTooltipTiming>
  focusReturns: ReturnType<typeof createNativeFloatingFocusReturns>
  layout: Readonly<{ width: number; height: number }> | null
}

const FloatingHostContext = createContext<TNativeFloatingHost | null>(null)
const escapeTokens = nativeKeyTokens("Escape")
const NativeFloatingKeyboard = ({ host }: { host: TNativeFloatingHost }) => {
  const windowActive = useContext(NativeFloatingWindowContext)
  const lease = host.layers.captureKeyboard()
  useNativeKeyPolicy({
    tokens: escapeTokens,
    targetTag: 0,
    excludeEditable: false,
    excludeComposing: true,
    isEnabled: lease !== null,
    lifetimeKey: lease?.key ?? "closed",
    canAct: () => host.live.current && windowActive?.() !== false && lease?.isCurrent() === true,
    onKey: (event) => {
      if (event.nativeEvent.phase === "down" && !event.nativeEvent.repeat && !event.nativeEvent.cancelled)
        lease?.invoke()
    },
  })
  return null
}

export const useNativeFloatingHost = () => {
  const host = useContext(FloatingHostContext)
  if (!host) throw new Error("Floating layers require NativeFloatingLayerHost in the same native window")
  return host
}

const layerHostName = (host: string, layer: string) => `${host}-layer-${layer}`
export const NativeFloatingPortal = ({ children, layerId }: { children: ReactNode; layerId?: string }) => {
  const host = useNativeFloatingHost()
  return (
    <Portal
      hostName={layerId === undefined ? host.name : layerHostName(host.name, layerId)}
      style={StyleSheet.absoluteFill}
    >
      {children}
    </Portal>
  )
}

export const NativeFloatingLayerHost = forwardRef<TNativeFloatingLayerHostRef, TNativeFloatingLayerHostProps>(
  (
    {
      children,
      style,
      onLayout,
      onAccessibilityEscape,
      onTouchStartCapture,
      onTouchEndCapture,
      onTouchCancelCapture,
      onFocusCapture,
      testID = "native-floating-layer-host",
      ...rest
    },
    ref,
  ) => {
    const id = useId()
    const name = `codon-floating-${id}`
    const root = useRef<View>(null)
    const generation = useRef(0)
    const live = useRef(false)
    const [layers] = useState(createNativeFloatingLayerRegistry)
    const [interactions] = useState(() => createNativeFloatingInteractions(layers.captureOutside))
    const [tooltipTiming] = useState(createNativeTooltipTiming)
    useInsertionEffect(
      () => () => {
        interactions.dispose()
        tooltipTiming.dispose()
      },
      [interactions, tooltipTiming],
    )
    useSyncExternalStore(layers.subscribe, layers.snapshot, layers.snapshot)
    const windowActive = useContext(NativeFloatingWindowContext)
    const current = useRef({
      windowActive,
      onLayout,
      onAccessibilityEscape,
      onTouchStartCapture,
      onTouchEndCapture,
      onTouchCancelCapture,
      onFocusCapture,
    })
    current.current = {
      windowActive,
      onLayout,
      onAccessibilityEscape,
      onTouchStartCapture,
      onTouchEndCapture,
      onTouchCancelCapture,
      onFocusCapture,
    }
    const [focusReturns] = useState(() =>
      createNativeFloatingFocusReturns({
        layers,
        live: () => live.current,
        windowActive: () => current.current.windowActive?.() !== false,
      }),
    )
    useInsertionEffect(() => () => focusReturns.dispose(), [focusReturns])
    const [layout, setLayout] = useState<TNativeFloatingHost["layout"]>(null)
    useImperativeHandle(ref, () => root.current!)
    useLayoutEffect(() => {
      live.current = true
      return () => {
        live.current = false
        generation.current++
      }
    }, [])
    useEffect(() => {
      if (Platform.OS !== "android") return
      const subscription = BackHandler.addEventListener("hardwareBackPress", () =>
        live.current && current.current.windowActive?.() !== false ? layers.requestDismiss("keyboard") : false,
      )
      return () => subscription.remove()
    }, [layers])
    const host = useMemo(
      () => ({ name, root, generation, live, layers, interactions, tooltipTiming, focusReturns, layout }),
      [name, layers, interactions, tooltipTiming, focusReturns, layout],
    )
    const scope = useMemo(
      () => ({
        id: null,
        canAct: () => live.current && current.current.windowActive?.() !== false && !layers.hasModal(),
      }),
      [layers],
    )
    const modal = layers.hasModal()
    const handleLayout = (event: LayoutChangeEvent) => {
      if (!live.current) return
      generation.current++
      const { width, height } = event.nativeEvent.layout
      setLayout({ width, height })
      current.current.onLayout?.(event)
    }
    const captureHandlers: TNativeTouchCaptureProps = {
      onFocusCapture: (event) => {
        if (!live.current || current.current.windowActive?.() === false) return
        interactions.focus(event)
        current.current.onFocusCapture?.(event)
      },
      onTouchStartCapture: (event: GestureResponderEvent) => {
        if (!live.current || current.current.windowActive?.() === false) return
        interactions.start(event)
        current.current.onTouchStartCapture?.(event)
      },
      onTouchEndCapture: (event: GestureResponderEvent) => {
        if (!live.current) return
        if (current.current.windowActive?.() === false) {
          interactions.cancel(event)
          return
        }
        interactions.end(event)
        current.current.onTouchEndCapture?.(event)
      },
      onTouchCancelCapture: (event: GestureResponderEvent) => {
        if (!live.current) return
        interactions.cancel(event)
        current.current.onTouchCancelCapture?.(event)
      },
    }
    return (
      <PortalProvider>
        <FloatingHostContext.Provider value={host}>
          <NativeKeyboardScope
            {...rest}
            ref={root}
            captureEnabled={windowActive?.() !== false}
            testID={testID}
            collapsable={false}
            pointerEvents="box-none"
            style={[{ flex: 1 }, style]}
            onLayout={handleLayout}
            {...captureHandlers}
            onAccessibilityEscape={() => {
              if (!live.current || current.current.windowActive?.() === false) return
              if (!layers.requestDismiss("accessibilityEscape")) current.current.onAccessibilityEscape?.()
            }}
          >
            <NativeFloatingKeyboard host={host} />
            <View
              testID={`${testID}-background`}
              style={{ flex: 1 }}
              pointerEvents={modal ? "none" : "box-none"}
              accessibilityElementsHidden={modal}
              importantForAccessibility={modal ? "no-hide-descendants" : "auto"}
            >
              <NativeFloatingScopeContext.Provider value={scope}>{children}</NativeFloatingScopeContext.Provider>
            </View>
            <PortalHost name={name} style={StyleSheet.absoluteFill} />
            {layers.presentationOrder().map((layerId) => (
              <PortalHost key={layerId} name={layerHostName(name, layerId)} style={StyleSheet.absoluteFill} />
            ))}
          </NativeKeyboardScope>
        </FloatingHostContext.Provider>
      </PortalProvider>
    )
  },
)
NativeFloatingLayerHost.displayName = "NativeFloatingLayerHost"

export type TNativeFloatingWindowDismiss = (reason: TNativeFloatingDismissReason) => boolean
const NativeFloatingWindowBridge = ({ dismissRef }: { dismissRef: RefObject<TNativeFloatingWindowDismiss | null> }) => {
  const host = useNativeFloatingHost()
  const windowActive = useContext(NativeFloatingWindowContext)
  const current = useRef(windowActive)
  current.current = windowActive
  useLayoutEffect(() => {
    const dismiss: TNativeFloatingWindowDismiss = (reason) =>
      host.live.current && current.current?.() !== false ? host.layers.requestDismiss(reason) : false
    dismissRef.current = dismiss
    return () => {
      if (dismissRef.current === dismiss) dismissRef.current = null
    }
  }, [dismissRef, host.live, host.layers])
  return null
}

export const NativeFloatingWindowHost = ({
  children,
  isWindowActive,
  dismissRef,
  ...props
}: TNativeFloatingLayerHostProps & {
  isWindowActive: () => boolean
  dismissRef: RefObject<TNativeFloatingWindowDismiss | null>
}) => (
  <NativeFloatingWindowContext.Provider value={isWindowActive}>
    <NativeFloatingLayerHost {...props}>
      <NativeFloatingWindowBridge dismissRef={dismissRef} />
      {children}
    </NativeFloatingLayerHost>
  </NativeFloatingWindowContext.Provider>
)
