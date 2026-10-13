import { createRef } from "react"
import type { Text as RNText } from "react-native"

import { NativeThemeProvider, Text, useNativeTheme, type NativeThemeMode, type NativeThemeOverrides } from "../src"

export const ValidText = (
  <Text
    ref={createRef<RNText>()}
    variant="h1-sm"
    elementType="h2"
    aria-label="Heading"
    selectable
    style={[undefined, { color: "tomato" }]}
  >
    Native text
  </Text>
)
// @ts-expect-error DOM class plumbing is not a native Text API.
export const InvalidTextClass = <Text className="web" />
// @ts-expect-error DOM label associations are not native Text semantics.
export const InvalidTextLabel = <Text htmlFor="input" />
// @ts-expect-error Native Text events use onPress rather than onClick.
export const InvalidTextClick = <Text onClick={() => undefined} />
// @ts-expect-error Native font sizes are numeric logical units.
export const InvalidTextUnit = <Text style={{ fontSize: "1.4rem" }} />
// @ts-expect-error Only reviewed variant names are public.
export const InvalidTextVariant = <Text variant="caption" />
// @ts-expect-error A browser-shaped node is not an RN Text instance.
export const InvalidTextRef = <Text ref={createRef<{ tagName: string; focus: () => void }>()} />

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
