import { NativeThemeProvider, useNativeTheme, type NativeThemeMode, type NativeThemeOverrides } from "../src"

const mode: NativeThemeMode = "dark"
const overrides: NativeThemeOverrides = {
  colors: { foreground: "#123456" },
  actions: { primary: { background: "tomato" } },
  typography: { fontSizes: { b10: 18 } },
}
export const ValidProvider = () => (
  <NativeThemeProvider mode={mode} overrides={overrides}>
    Content
  </NativeThemeProvider>
)
export const ThemeConsumer = () => {
  const theme = useNativeTheme()
  // @ts-expect-error Public theme values are read-only.
  theme.colors.background = "#ffffff"
  return null
}

// @ts-expect-error The lab supports exactly two explicit theme modes.
export const InvalidMode = <NativeThemeProvider mode="system" />
// @ts-expect-error Web CSS class plumbing is not a provider API.
export const InvalidClass = <NativeThemeProvider className="theme" />
// @ts-expect-error Native font sizes are logical numeric units.
export const InvalidUnit = <NativeThemeProvider overrides={{ typography: { fontSizes: { b10: "1.4rem" } } }} />
// @ts-expect-error Product colors are not implicit theme roles.
export const InvalidRole = <NativeThemeProvider overrides={{ colors: { mapRoad: "#ffffff" } }} />
