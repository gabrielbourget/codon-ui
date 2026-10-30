import { createContext } from "react"

import type { TNativeContextValue } from "../../collection/context"

import type { TNativeTextProps, TNativeTextRef } from "./types"

export const NativeHeadingContext = createContext<TNativeContextValue<Partial<TNativeTextProps>, TNativeTextRef>>(null)
export const NativeHeadingBindingContext = createContext<((nativeID: string) => () => void) | null>(null)
