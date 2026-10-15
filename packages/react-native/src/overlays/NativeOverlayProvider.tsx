import { createContext, useContext, useState, type PropsWithChildren } from "react"

import { createOverlayRegistry, type TOverlayRegistry } from "./registry"

export const OverlayRegistryContext = createContext<TOverlayRegistry | null>(null)
export const OverlayParentContext = createContext<string | null>(null)
export type TNativeOverlayProviderProps = PropsWithChildren

export const NativeOverlayProvider = ({ children }: TNativeOverlayProviderProps) => {
  const outer = useContext(OverlayRegistryContext)
  const [registry] = useState(createOverlayRegistry)
  if (outer) throw new Error("NativeOverlayProvider: nested providers are unsupported")
  return <OverlayRegistryContext.Provider value={registry}>{children}</OverlayRegistryContext.Provider>
}
