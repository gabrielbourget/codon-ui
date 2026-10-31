import { createContext, useContext, type ReactNode } from "react"
import type { TextStyle } from "react-native"

import { NativeFloatingScopeContext } from "../overlays/floating/scope"

const NativeInheritedTextStyleContext = createContext<
  Readonly<{ style: TextStyle; windowId: string | null }> | undefined
>(undefined)

export const useNativeInheritedTextStyle = () => {
  const inherited = useContext(NativeInheritedTextStyleContext)
  const windowId = useContext(NativeFloatingScopeContext)?.id ?? null
  return inherited?.windowId === windowId ? inherited.style : undefined
}

// Style inheritance survives component-local typography providers, but not a new native window.
export const NativeTextStyleProvider = ({
  style,
  children,
  reset = false,
}: {
  style: TextStyle
  children?: ReactNode
  reset?: boolean
}) => {
  const inherited = useNativeInheritedTextStyle()
  const windowId = useContext(NativeFloatingScopeContext)?.id ?? null
  const authored = Object.fromEntries(Object.entries(style).filter(([, value]) => value != null))
  return (
    <NativeInheritedTextStyleContext.Provider
      value={{ style: { ...(reset ? undefined : inherited), ...authored }, windowId }}
    >
      {children}
    </NativeInheritedTextStyleContext.Provider>
  )
}
