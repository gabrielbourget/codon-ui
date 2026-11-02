import { createContext } from "react"

import type { TNativeContextValue } from "../../collection/context"

import type { TNativeSliderProps, TNativeSliderRef, TNativeSliderState } from "./types"

export const NativeSliderStateContext = createContext<TNativeSliderState | null>(null)

export const NativeSliderContext =
  createContext<TNativeContextValue<Partial<TNativeSliderProps>, TNativeSliderRef>>(null)
