import { createContext } from "react"
import type { View } from "react-native"

import type { TNativeContextValue } from "../../collection/context"

import type { TNativeToggleButtonProps } from "./types"

export const NativeToggleButtonContext = createContext<TNativeContextValue<TNativeToggleButtonProps, View>>(null)
