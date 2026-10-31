import {
  forwardRef,
  useContext,
  useLayoutEffect,
  type ForwardRefExoticComponent,
  type ReactElement,
  type RefAttributes,
} from "react"
import { Easing, Text as RNText, type TextProps, type TextStyle } from "react-native"

import { useNativeContextProps } from "../../collection/context"
import { NativeFloatingScopeContext } from "../../overlays/floating/scope"
import { useNativeTheme } from "../../theme"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { useNativeLinkColor } from "../Link/motion"
import { NativeContentContext, NativeTextLayoutContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"
import { useNativeInheritedTextStyle } from "../NativeTextStyleProvider"

import { NativeHeadingBindingContext, NativeHeadingContext } from "./context"
import type { TNativeTextProps, TNativeTextRef } from "./types"

export type TNativeTextRender = (props: TextProps & RefAttributes<TNativeTextRef>) => ReactElement
const textColorEasing = Easing.bezier(0.42, 0, 0.58, 1)
export const NativeText = forwardRef<
  TNativeTextRef,
  TNativeTextProps & { nativeRender?: TNativeTextRender; nativeColorIsAnimated?: boolean }
>(
  (
    {
      children,
      slot: _slot,
      nativeRender,
      nativeColorIsAnimated = false,
      variant = "b10",
      fontWeight = "regular",
      fontStyle,
      elementType = "p",
      composedInLink = false,
      color,
      customStyles,
      style,
      selectable,
      role,
      accessibilityRole,
      accessibilityLabel,
      testID,
      "data-testid": aliasTestID,
      "aria-label": aliasLabel,
      ...rest
    },
    ref,
  ) => {
    const theme = useNativeTheme()
    const content = useNativeContentContext()
    const inherited = useNativeInheritedTextStyle()
    const textLayout = useContext(NativeTextLayoutContext)
    const windowId = useContext(NativeFloatingScopeContext)?.id ?? null
    const currentTextLayout = textLayout?.windowId === windowId ? textLayout : undefined
    const foreground = color ?? content?.foregroundColor ?? theme.colors.foreground
    validateNativeColor(foreground, "Text", "color")
    const family = variant.startsWith("d") ? "display" : variant.startsWith("h") ? "heading" : "body"
    const custom = resolveNativeStyle(customStyles, "Text", "customStyles")
    const final = resolveNativeStyle(style, "Text", "style")
    const defaultStyle: TextStyle = {
      color: foreground,
      fontSize: theme.typography.fontSizes[variant],
      fontWeight: theme.typography.fontWeights[fontWeight],
      fontStyle: fontStyle ?? content?.textStyle?.fontStyle ?? inherited?.fontStyle ?? "normal",
      fontFamily:
        theme.typography.fontFamilies[family] ??
        (family === "display" ? theme.typography.fontFamilies.heading : undefined) ??
        theme.typography.fontFamilies.body,
      lineHeight: theme.typography.lineHeight,
    }
    const computed = { ...inherited, ...defaultStyle }
    const merged = resolveNativeStyle([computed, custom, final], "Text", "resolvedStyle")
    const resolved: TextStyle = {
      ...merged,
      ...Object.fromEntries(Object.entries(computed).filter(([key]) => merged[key as keyof TextStyle] === undefined)),
    }
    const authoredColor = resolveNativeStyle([custom, final], "Text", "authoredStyle").color ?? color
    // Content providers carry the current parent paint, including each animated frame.
    const inheritedAnimation = authoredColor === undefined && content !== undefined
    const renderedColor = useNativeLinkColor(
      resolved.color ?? foreground,
      250,
      textColorEasing,
      !nativeColorIsAnimated && !inheritedAnimation,
    )
    const semanticRole: TextProps["role"] =
      role ??
      (accessibilityRole !== undefined
        ? undefined
        : composedInLink
          ? "link"
          : /^h[1-6]$/.test(elementType)
            ? "heading"
            : undefined)

    const nativeProps: TextProps & RefAttributes<TNativeTextRef> = {
      ...rest,
      numberOfLines: rest.numberOfLines ?? currentTextLayout?.numberOfLines,
      ellipsizeMode: rest.ellipsizeMode ?? currentTextLayout?.ellipsizeMode,
      ref,
      role: semanticRole,
      accessibilityRole,
      accessibilityLabel: accessibilityLabel ?? aliasLabel,
      testID: testID ?? aliasTestID ?? "text",
      selectable: selectable ?? (elementType !== "label" && !content?.isButton),
      style: { ...resolved, color: renderedColor },
      children,
    }
    return (
      <NativeContentContext.Provider
        value={{
          foregroundColor: renderedColor,
          isButton: content?.isButton ?? false,
          textStyle: splitNativeTextStyle(resolved).text,
        }}
      >
        {nativeRender ? nativeRender(nativeProps) : <RNText {...nativeProps} />}
      </NativeContentContext.Provider>
    )
  },
)

NativeText.displayName = "Text"
export const Text: ForwardRefExoticComponent<TNativeTextProps & RefAttributes<TNativeTextRef>> = forwardRef(
  (authored, ref) => {
    const [props, mergedRef] = useNativeContextProps(authored, ref, NativeHeadingContext)
    const bindTitle = useContext(NativeHeadingBindingContext)
    const nativeID = props.id ?? props.nativeID
    useLayoutEffect(
      () => (props.slot === "title" && nativeID ? bindTitle?.(nativeID) : undefined),
      [props.slot, nativeID, bindTitle],
    )
    return <NativeText {...props} ref={mergedRef} />
  },
)
