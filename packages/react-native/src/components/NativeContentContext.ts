import { createContext, useContext } from "react"
import type { ColorValue } from "react-native"

type TNativeContentContext = Readonly<{ foregroundColor: ColorValue; isButton: boolean }>

export const NativeContentContext = createContext<TNativeContentContext | undefined>(undefined)
export const useNativeContentContext = () => useContext(NativeContentContext)
