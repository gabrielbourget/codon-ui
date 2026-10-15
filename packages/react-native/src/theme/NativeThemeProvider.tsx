import { createContext, useContext, useMemo, type PropsWithChildren } from "react"

import { resolveNativeTheme } from "./defaults"
import type { TNativeTheme, TNativeThemeMode, TNativeThemeOverrides } from "./types"

const NativeThemeContext = createContext<TNativeTheme>(resolveNativeTheme("light"))

export type TNativeThemeProviderProps = PropsWithChildren<{
  mode?: TNativeThemeMode
  overrides?: TNativeThemeOverrides
}>

export const NativeThemeProvider = ({ mode = "light", overrides, children }: TNativeThemeProviderProps) => {
  const theme = useMemo(() => resolveNativeTheme(mode, overrides), [mode, overrides])

  return <NativeThemeContext.Provider value={theme}>{children}</NativeThemeContext.Provider>
}

export const useNativeTheme = (): TNativeTheme => useContext(NativeThemeContext)
