import { createContext } from "react"

import type { TNativeContextValue } from "../../collection/context"

import type { TNativeButtonProps, TNativeButtonRef } from "./types"

export const NativeButtonContext =
  createContext<TNativeContextValue<Partial<TNativeButtonProps>, TNativeButtonRef>>(null)
