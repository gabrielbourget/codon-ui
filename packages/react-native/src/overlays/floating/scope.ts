import { createContext } from "react"

export type TNativeFloatingScope = Readonly<{ id: string | null; canAct: () => boolean }>

export const NativeFloatingScopeContext = createContext<TNativeFloatingScope | null>(null)
export const NativeFloatingWindowContext = createContext<(() => boolean) | null>(null)
