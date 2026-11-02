import { createContext, useContext } from "react"
import type { ColorValue, TextStyle } from "react-native"

type TNativeContentContext = Readonly<{ foregroundColor: ColorValue; isButton: boolean; textStyle?: TextStyle }>

export const NativeContentContext = createContext<TNativeContentContext | undefined>(undefined)
export const useNativeContentContext = () => useContext(NativeContentContext)
