import { createRef } from "react"
import type { Text as RNText, View } from "react-native"

import {
  Button,
  NativeThemeProvider,
  Text,
  useNativeTheme,
  type NativeThemeMode,
  type NativeThemeOverrides,
} from "../src"

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
export const ResetTextTypography = (
  <Text
    variant="h1"
    fontWeight="bold"
    fontStyle="italic"
    customStyles={{ fontSize: 17, fontWeight: "400" }}
    style={{ fontSize: undefined, fontWeight: undefined }}
  >
    Heading
  </Text>
)

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

export const ValidButton = (
  <Button
    focusable={false}
    tabIndex={-1}
    ref={createRef<View>()}
    order="tertiary"
    colorMode="outline"
    geometry="round"
    isPending
    accessibilityState={{ selected: true }}
    onPressStart={(event) => {
      if ("kind" in event.nativeEvent) {
        // @ts-expect-error Native keyboard events do not fabricate touch coordinates.
        void event.nativeEvent.pageX
        return event.nativeEvent.nativeCode
      }
      return event.nativeEvent.pageX
    }}
    onHoverStart={(event) => event.nativeEvent.clientX}
    style={(state) => [state.defaultStyle, { color: state.isPressed ? "red" : "blue" }]}
  >
    {(state) => <Text color={state.foregroundColor}>{state.isPending ? "Waiting" : "Continue"}</Text>}
  </Button>
)
export const TypographyButton = (
  <Button
    customStyles={{ fontFamily: "Body", fontSize: 18, fontWeight: "600", textTransform: "uppercase" }}
    style={(state) => [
      state.defaultStyle,
      { fontSize: state.isPressed ? 22 : 20, letterSpacing: 0, textDecorationLine: "underline" },
    ]}
  >
    Save
  </Button>
)
// @ts-expect-error Native button typography uses logical numeric units.
export const InvalidButtonFontUnit = <Button customStyles={{ fontSize: "1.4rem" }} />
// @ts-expect-error Native text decoration uses the native field/value contract.
export const InvalidButtonTextDecoration = <Button style={{ textDecorationLine: "overline" }} />
// @ts-expect-error Button owns disabled state through isDisabled.
export const InvalidButtonDisabled = <Button disabled />
// @ts-expect-error Button owns busy/disabled accessibility semantics.
export const InvalidButtonBusy = <Button accessibilityState={{ busy: false }} />
// @ts-expect-error Native Button has no DOM class plumbing.
export const InvalidButtonClass = <Button className="web" />
// @ts-expect-error Native Button has no HTML form semantics.
export const InvalidButtonForm = <Button type="submit" />
// @ts-expect-error Activation carries an RN event, not a DOM click.
export const InvalidButtonClick = <Button onClick={() => undefined} />
// @ts-expect-error Native press-out is not a browser press-up contract.
export const InvalidButtonPressUp = <Button onPressUp={() => undefined} />
// @ts-expect-error Native dimensions do not accept CSS length units.
export const InvalidButtonDimension = <Button width="2rem" />
// @ts-expect-error A browser node is not an RN View instance.
export const InvalidButtonRef = <Button ref={createRef<{ tagName: string }>()} />
// @ts-expect-error Focus visibility needs a future native modality contract.
export const InvalidButtonFocusVisible = <Button>{(state) => (state.isFocusVisible ? "Visible" : "Hidden")}</Button>
