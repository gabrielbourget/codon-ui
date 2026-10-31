import { createContext } from "react"
import type { View } from "react-native"

import type { TNativeContextValue } from "../../collection/context"
import type { TimeFieldState } from "../state/useTimeFieldState"

import type { TNativeTimeFieldContextProps } from "./types"

export const NativeTimeFieldContext = createContext<TNativeContextValue<TNativeTimeFieldContextProps, View>>(null)
export const NativeTimeFieldStateContext = createContext<TimeFieldState | null>(null)
