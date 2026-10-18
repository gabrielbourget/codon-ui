import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react"
import { BackHandler, Platform, StyleSheet, View, type LayoutChangeEvent, type ViewProps } from "react-native"
import { Portal, PortalHost, PortalProvider } from "react-native-teleport"

import {
  createNativeFloatingLayerRegistry,
  type TNativeFloatingDismissReason,
  type TNativeFloatingLayerRegistry,
} from "./registry"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "./scope"

export type TNativeFloatingLayerHostRef = View
export type TNativeFloatingLayerHostProps = Omit<ViewProps, "pointerEvents" | "collapsable">

type TNativeFloatingHost = {
  name: string
  root: RefObject<View | null>
  generation: RefObject<number>
  live: RefObject<boolean>
  layers: TNativeFloatingLayerRegistry
  layout: Readonly<{ width: number; height: number }> | null
}

const FloatingHostContext = createContext<TNativeFloatingHost | null>(null)

export const useNativeFloatingHost = () => {
  const host = useContext(FloatingHostContext)
  if (!host) throw new Error("Floating layers require NativeFloatingLayerHost in the same native window")
  return host
}

export const NativeFloatingPortal = ({ children }: { children: ReactNode }) => {
  const host = useNativeFloatingHost()
  return (
    <Portal hostName={host.name} style={StyleSheet.absoluteFill}>
      {children}
    </Portal>
  )
}

export const NativeFloatingLayerHost = forwardRef<TNativeFloatingLayerHostRef, TNativeFloatingLayerHostProps>(
  ({ children, style, onLayout, onAccessibilityEscape, testID = "native-floating-layer-host", ...rest }, ref) => {
    const id = useId()
    const name = `codon-floating-${id}`
    const root = useRef<View>(null)
    const generation = useRef(0)
    const live = useRef(false)
    const [layers] = useState(createNativeFloatingLayerRegistry)
    useSyncExternalStore(layers.subscribe, layers.snapshot, layers.snapshot)
    const windowActive = useContext(NativeFloatingWindowContext)
    const current = useRef({ windowActive, onLayout, onAccessibilityEscape })
    current.current = { windowActive, onLayout, onAccessibilityEscape }
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
    const host = useMemo(() => ({ name, root, generation, live, layers, layout }), [name, layers, layout])
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
    return (
      <PortalProvider>
        <FloatingHostContext.Provider value={host}>
          <View
            {...rest}
            ref={root}
            testID={testID}
            collapsable={false}
            pointerEvents="box-none"
            style={[{ flex: 1 }, style]}
            onLayout={handleLayout}
            onAccessibilityEscape={() => {
              if (!live.current || current.current.windowActive?.() === false) return
              if (!layers.requestDismiss("accessibilityEscape")) current.current.onAccessibilityEscape?.()
            }}
          >
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
          </View>
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
