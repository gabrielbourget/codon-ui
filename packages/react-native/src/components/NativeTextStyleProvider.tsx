import { createContext, useContext, type ReactNode } from "react"
import type { TextStyle } from "react-native"

import { NativeFloatingScopeContext } from "../overlays/floating/scope"

const NativeInheritedTextStyleContext = createContext<
  Readonly<{ style: TextStyle; windowId: string | null; nativeInheritance: boolean }> | undefined
>(undefined)

const useNativeTextStyleContext = () => {
  const inherited = useContext(NativeInheritedTextStyleContext)
  const windowId = useContext(NativeFloatingScopeContext)?.id ?? null
  return inherited?.windowId === windowId ? inherited : undefined
}

export const useNativeInheritedTextStyle = () => useNativeTextStyleContext()?.style

export const useNativeRawTextStyle = () => {
  const inherited = useNativeTextStyleContext()
  return inherited?.nativeInheritance ? inherited.style : undefined
}

// Style inheritance survives component-local typography providers, but not a new native window.
export const NativeTextStyleProvider = ({
  style,
  children,
  reset = false,
  nativeInheritance,
}: {
  style: TextStyle
  children?: ReactNode
  reset?: boolean
  nativeInheritance?: boolean
}) => {
  const inherited = useNativeTextStyleContext()
  const windowId = useContext(NativeFloatingScopeContext)?.id ?? null
  const authored = Object.fromEntries(Object.entries(style).filter(([, value]) => value != null))
  return (
    <NativeInheritedTextStyleContext.Provider
      value={{
        style: { ...(reset ? undefined : inherited?.style), ...authored },
        windowId,
        // Migrated owners keep explicit text styles while remaining owners retain their native scope.
        nativeInheritance: nativeInheritance ?? inherited?.nativeInheritance ?? true,
      }}
    >
      {children}
    </NativeInheritedTextStyleContext.Provider>
  )
}
