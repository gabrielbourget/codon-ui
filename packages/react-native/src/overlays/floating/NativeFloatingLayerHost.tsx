import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import { StyleSheet, View, type LayoutChangeEvent, type ViewProps } from "react-native"
import { Portal, PortalHost, PortalProvider } from "react-native-teleport"

export type TNativeFloatingLayerHostRef = View
export type TNativeFloatingLayerHostProps = Omit<ViewProps, "pointerEvents" | "collapsable">

type TNativeFloatingHost = {
  name: string
  root: RefObject<View | null>
  generation: RefObject<number>
  live: RefObject<boolean>
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
  ({ children, style, onLayout, testID = "native-floating-layer-host", ...rest }, ref) => {
    const id = useId()
    const name = `codon-floating-${id}`
    const root = useRef<View>(null)
    const generation = useRef(0)
    const live = useRef(false)
    const [layout, setLayout] = useState<TNativeFloatingHost["layout"]>(null)
    useImperativeHandle(ref, () => root.current!)
    useLayoutEffect(() => {
      live.current = true
      return () => {
        live.current = false
        generation.current++
      }
    }, [])
    const host = useMemo(() => ({ name, root, generation, live, layout }), [name, layout])
    const handleLayout = (event: LayoutChangeEvent) => {
      if (!live.current) return
      generation.current++
      const { width, height } = event.nativeEvent.layout
      setLayout({ width, height })
      onLayout?.(event)
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
          >
            {children}
            <PortalHost name={name} style={StyleSheet.absoluteFill} />
          </View>
        </FloatingHostContext.Provider>
      </PortalProvider>
    )
  },
)
NativeFloatingLayerHost.displayName = "NativeFloatingLayerHost"
