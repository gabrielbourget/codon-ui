import { createContext } from "react"
import type { View } from "react-native"

import type { TNativeContextValue } from "../../collection/context"

import type { TNativeToggleGroupState } from "./state"
import type { TNativeToggleButtonGroupProps } from "./types"

export const NativeToggleButtonGroupContext =
  createContext<TNativeContextValue<TNativeToggleButtonGroupProps, View>>(null)
export const NativeToggleButtonGroupStateContext = createContext<TNativeToggleGroupState | null>(null)
