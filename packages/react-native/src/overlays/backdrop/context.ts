import { createContext } from "react"

import type { TNativeBackdropAdapter, TNativeBackdropSource } from "./types"

export const NativeBackdropAdapterContext = createContext<TNativeBackdropAdapter | null>(null)
export const NativeBackdropSourceContext = createContext<TNativeBackdropSource | null>(null)
