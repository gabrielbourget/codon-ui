import { createContext, useContext } from "react"
import type { ColorValue, TextProps, TextStyle } from "react-native"

type TNativeContentContext = Readonly<{ foregroundColor: ColorValue; isButton: boolean; textStyle?: TextStyle }>

export const NativeContentContext = createContext<TNativeContentContext | undefined>(undefined)
export const useNativeContentContext = () => useContext(NativeContentContext)

// A portal's new window must not inherit its trigger cell's text constraints.
export const NativeTextLayoutContext = createContext<
  Readonly<Pick<TextProps, "numberOfLines" | "ellipsizeMode"> & { windowId: string | null }> | undefined
>(undefined)
