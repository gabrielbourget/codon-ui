import { createContext, useContext, useState, useSyncExternalStore, type PropsWithChildren } from "react"

import { NativeBackdropAdapterContext } from "./backdrop/context"
import type { TNativeBackdropAdapter } from "./backdrop/types"
import { NativeFloatingWindowContext } from "./floating/scope"
import { createOverlayRegistry, type TOverlayRegistry } from "./registry"

export const OverlayRegistryContext = createContext<TOverlayRegistry | null>(null)
export const OverlayParentContext = createContext<string | null>(null)
export type TNativeOverlayProviderProps = PropsWithChildren<{ backdropAdapter?: TNativeBackdropAdapter | null }>

export const NativeOverlayProvider = ({ children, backdropAdapter = null }: TNativeOverlayProviderProps) => {
  const outer = useContext(OverlayRegistryContext)
  const [registry] = useState(createOverlayRegistry)
  useSyncExternalStore(registry.subscribe, registry.snapshot, registry.snapshot)
  if (outer) throw new Error("NativeOverlayProvider: nested providers are unsupported")
  return (
    <OverlayRegistryContext.Provider value={registry}>
      <NativeFloatingWindowContext.Provider value={() => registry.canRestore(null)}>
        <NativeBackdropAdapterContext.Provider value={backdropAdapter}>
          {children}
        </NativeBackdropAdapterContext.Provider>
      </NativeFloatingWindowContext.Provider>
    </OverlayRegistryContext.Provider>
  )
}
