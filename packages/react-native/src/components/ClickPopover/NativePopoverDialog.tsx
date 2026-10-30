import { forwardRef, useCallback, useContext, useId, useState, type ReactNode } from "react"
import { Easing, type StyleProp, type TextStyle, type View } from "react-native"

import { NATIVE_DEFAULT_SLOT, useNativeContextProps } from "../../collection/context"
import { nativeAccessibilityIDs } from "../../input/accessibilityReferences"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { NativeButtonContext } from "../Button/context"
import { resolveNativeStyle } from "../colors"
import { useNativeLinkColor } from "../Link/motion"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"
import { NativeTextStyleProvider } from "../NativeTextStyleProvider"
import { NativeHeadingBindingContext, NativeHeadingContext } from "../Text/context"

import { NativeDialogContext, NativeOverlayTriggerStateContext, type TNativeDialogContextProps } from "./context"

const closeNothing = () => {}
const textColorEasing = Easing.bezier(0.42, 0, 0.58, 1)

export const NativePopoverDialog = forwardRef<
  View,
  TNativeDialogContextProps & {
    nativeBaselineStyle: StyleProp<TextStyle>
    nativeFocusable: boolean
    nativeFallbackLabel?: string
    children?: ReactNode
  }
>(({ nativeBaselineStyle, nativeFocusable, nativeFallbackLabel, ...authored }, ref) => {
  const [props, mergedRef] = useNativeContextProps(
    {
      ...authored,
      accessibilityLabel: authored.accessibilityLabel ?? authored["aria-label"],
      "aria-label": undefined,
      accessibilityLabelledBy: authored.accessibilityLabelledBy ?? authored["aria-labelledby"],
      "aria-labelledby": undefined,
    },
    ref,
    NativeDialogContext,
  )
  const {
    render,
    children,
    style,
    slot: _slot,
    "aria-describedby": describedBy,
    "aria-details": detailsBy,
    descriptionLabel = "Description",
    detailsLabel = "Details",
    ...native
  } = props
  const inherited = useNativeContentContext()
  const theme = useNativeTheme()
  const overlayState = useContext(NativeOverlayTriggerStateContext)
  const close = overlayState?.close ?? closeNothing
  const generatedTitleID = `codon-dialog-title-${useId()}`
  const [titleID, setTitleID] = useState<string | undefined>()
  const bindTitle = useCallback((nativeID: string) => {
    setTitleID(nativeID)
    return () => setTitleID((current) => (current === nativeID ? undefined : current))
  }, [])
  const ownLabelledBy = authored["aria-labelledby"] ?? authored.accessibilityLabelledBy
  const label = props.accessibilityLabel ?? props["aria-label"] ?? nativeFallbackLabel
  const labelledBy =
    ownLabelledBy ?? (!label && titleID ? titleID : (props["aria-labelledby"] ?? props.accessibilityLabelledBy))
  const resolved = splitNativeTextStyle(resolveNativeStyle([nativeBaselineStyle, style], "ClickPopover", "dialog"))
  const ownColor = resolveNativeStyle(style, "ClickPopover", "dialogStyle").color
  const currentForeground = useNativeLinkColor(
    ownColor ?? inherited?.foregroundColor ?? resolved.text.color ?? theme.colors.foreground,
    250,
    textColorEasing,
    ownColor !== undefined,
  )
  const content = typeof children === "function" ? children({ close }) : children
  const host = {
    ...native,
    ref: mergedRef,
    role: props.role ?? "dialog",
    accessible: props.accessible ?? false,
    focusable: nativeFocusable && props.focusable !== false,
    accessibilityLabel: label,
    "aria-label": undefined,
    "aria-labelledby": undefined,
    accessibilityLabelledBy: undefined,
    nativeLabelledBy: nativeAccessibilityIDs(labelledBy),
    nativeDescribedBy: nativeAccessibilityIDs(describedBy),
    nativeDetailsBy: nativeAccessibilityIDs(detailsBy),
    nativeDescriptionLabel: descriptionLabel,
    nativeDetailsLabel: detailsLabel,
    style: resolved.view,
    children: (
      <NativeHeadingContext.Provider
        value={{ slots: { [NATIVE_DEFAULT_SLOT]: {}, title: { nativeID: generatedTitleID, elementType: "h2" } } }}
      >
        <NativeHeadingBindingContext.Provider value={bindTitle}>
          <NativeButtonContext.Provider
            value={{ slots: { [NATIVE_DEFAULT_SLOT]: {}, close: { onPress: () => close() } } }}
          >
            <NativeTextStyleProvider style={resolved.text}>
              <NativeContentContext.Provider
                value={{
                  foregroundColor: currentForeground,
                  isButton: false,
                  textStyle: resolved.text,
                }}
              >
                {getNativeButtonContent(content, { ...resolved.text, color: currentForeground })}
              </NativeContentContext.Provider>
            </NativeTextStyleProvider>
          </NativeButtonContext.Provider>
        </NativeHeadingBindingContext.Provider>
      </NativeHeadingContext.Provider>
    ),
  }
  return render ? render(host, undefined) : <NativeFocusHost {...host} />
})
