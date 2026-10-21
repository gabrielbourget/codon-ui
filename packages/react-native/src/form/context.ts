import { createContext } from "react"
import type { View } from "react-native"

import type { TNativeContextValue } from "../collection/context"

import { nativeFormRegistry } from "./registry"
import type { TNativeFormProps } from "./types"

export const NativeFormContext = createContext<TNativeContextValue<TNativeFormProps, View>>(null)
export const NativeFormRegistryContext = createContext(nativeFormRegistry)
export const NativeFormBehaviorContext = createContext<"native" | "aria">("native")
