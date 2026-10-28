import { createRef } from "react"
import type { Text as RNText, View } from "react-native"

import {
  Button,
  NativeFocusView,
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
        return event.nativeEvent.kind === "keyboard" ? event.nativeEvent.nativeCode : event.nativeEvent.observedAt
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
// @ts-expect-error Button's role adapter is private to owned native component compositions.
export const InvalidButtonNativeRole = <Button nativeRole="menuitem" />
// @ts-expect-error Passive receiver composition remains private to native component owners.
export const InvalidButtonNativeInteraction = <Button nativeInteraction={false} />
// @ts-expect-error Native component style resolution does not extend the public Button API.
export const InvalidButtonNativeStyle = <Button nativeStyle={() => ({})} />
// @ts-expect-error Button owns busy/disabled accessibility semantics.
export const InvalidButtonBusy = <Button accessibilityState={{ busy: false }} />
// @ts-expect-error Native Button has no DOM class plumbing.
export const InvalidButtonClass = <Button className="web" />
// @ts-expect-error Native Button has no HTML form semantics.
export const InvalidButtonForm = <Button type="submit" />
// @ts-expect-error Activation carries an RN event, not a DOM click.
export const InvalidButtonClick = <Button onClick={() => undefined} />
export const NativeButtonPressUp = (
  <Button
    onPressUp={(event) => {
      if ("kind" in event.nativeEvent)
        return event.nativeEvent.kind === "keyboard" ? event.nativeEvent.nativeCode : event.nativeEvent.observedAt
      return event.nativeEvent.pageX
    }}
    onPressIn={(event) => {
      if ("kind" in event.nativeEvent) {
        const kind: "keyboard" = event.nativeEvent.kind
        return kind
      }
      return event.nativeEvent.pageX
    }}
  />
)
// @ts-expect-error Native dimensions do not accept CSS length units.
export const InvalidButtonDimension = <Button width="2rem" />
// @ts-expect-error A browser node is not an RN View instance.
export const InvalidButtonRef = <Button ref={createRef<{ tagName: string }>()} />
// @ts-expect-error Focus visibility needs a future native modality contract.
export const InvalidButtonFocusVisible = <Button>{(state) => (state.isFocusVisible ? "Visible" : "Hidden")}</Button>

type TPublicNativeExports = typeof import("../src")
// @ts-expect-error The private kernel is not a public animation API.
export type TPrivateCardAnimationKernel = TPublicNativeExports["JSAnimation"]
export type TPendingNativeCard = TPublicNativeExports["Card"]
export type TPendingNativeMotionConfig = TPublicNativeExports["NativeMotionConfig"]
export type TPendingNativeAnimatePresence = TPublicNativeExports["NativeAnimatePresence"]
export type TPendingNativeLayoutGroup = TPublicNativeExports["NativeLayoutGroup"]
// @ts-expect-error The visual receiver stays private until the complete Card renderer exists.
export type TPrivateNativeMotionVisualHost = TPublicNativeExports["NativeMotionVisualHost"]
export type TPrivateNativeAnimationControls = TPublicNativeExports["nativeAnimationControls"]
export type TPrivateNativeAnimationControlsHook = TPublicNativeExports["useNativeAnimationControls"]
export type TPrivateNativeMotionValueFactory = TPublicNativeExports["nativeMotionValue"]
export type TPrivateNativeMotionValueHook = TPublicNativeExports["useNativeMotionValue"]
export type TPrivateNativeMotionValueEventHook = TPublicNativeExports["useNativeMotionValueEvent"]
// @ts-expect-error Actual-view color queries stay private until the complete native motion contract is delivered.
export type TPrivateNativeColorSampler = TPublicNativeExports["sampleNativeMotionColors"]
// @ts-expect-error The value/keyframe backend is private until the complete native renderer is delivered.
export type TPrivateNativeValueAnimation = TPublicNativeExports["NativeValueAnimation"]
// @ts-expect-error Native keyframe providers remain private implementation contracts.
export type TPrivateNativeValueContext = TPublicNativeExports["createNativeMotionValueContext"]

// @ts-expect-error Actual geometry queries remain private until the complete native motion renderer is delivered.
export type TPrivateNativeGeometry = TPublicNativeExports["readNativeMotionGeometry"]
// @ts-expect-error Motion mount observers do not widen the public input API.
export type TPrivateNativeMountObserver = TPublicNativeExports["observeNativeMotionMountPairs"]
// @ts-expect-error Native geometry opt-in is private to its actual owned motion host.
export const InvalidPublicGeometryObservation = <NativeFocusView nativeMotionGeometryObservation />
// @ts-expect-error Native measurement transactions remain private until the actual native atomic backend and full renderer exist.
export type TPrivateNativeMeasurementState = TPublicNativeExports["NativeMotionMeasurementState"]
// @ts-expect-error Measurement state is private to the motion visual host.
export const InvalidPublicMeasurement = <NativeFocusView measurement={{}} />
// @ts-expect-error Fabric input capture is private until the full motion renderer is delivered.
export type TPrivateNativeFabricInput = TPublicNativeExports["captureNativeMotionFabricInput"]
