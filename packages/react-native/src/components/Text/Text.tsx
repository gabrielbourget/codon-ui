import { forwardRef } from "react"
import { Text as NativeText, type TextProps, type TextStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"

import type { TNativeTextProps, TNativeTextRef } from "./types"

export const Text = forwardRef<TNativeTextRef, TNativeTextProps>(
  (
    {
      children,
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
    const foreground = color ?? content?.foregroundColor ?? theme.colors.foreground
    validateNativeColor(foreground, "Text", "color")
    const family = variant.startsWith("d") ? "display" : variant.startsWith("h") ? "heading" : "body"
    const custom = resolveNativeStyle(customStyles, "Text", "customStyles")
    const final = resolveNativeStyle(style, "Text", "style")
    const defaultStyle: TextStyle = {
      color: foreground,
      fontSize: theme.typography.fontSizes[variant],
      fontWeight: theme.typography.fontWeights[fontWeight],
      fontStyle: fontStyle ?? "normal",
      fontFamily: theme.typography.fontFamilies[family] ?? theme.typography.fontFamilies.body,
      lineHeight: theme.typography.lineHeight,
    }
    const merged = resolveNativeStyle([defaultStyle, custom, final], "Text", "resolvedStyle")
    const resolved: TextStyle = {
      ...merged,
      ...Object.fromEntries(
        Object.entries(defaultStyle).filter(([key]) => merged[key as keyof TextStyle] === undefined),
      ),
    }
    const semanticRole: TextProps["role"] =
      role ??
      (accessibilityRole !== undefined
        ? undefined
        : composedInLink
          ? "link"
          : /^h[1-6]$/.test(elementType)
            ? "heading"
            : undefined)

    return (
      <NativeContentContext.Provider
        value={{ foregroundColor: resolved.color ?? foreground, isButton: content?.isButton ?? false }}
      >
        <NativeText
          {...rest}
          ref={ref}
          role={semanticRole}
          accessibilityRole={accessibilityRole}
          accessibilityLabel={accessibilityLabel ?? aliasLabel}
          testID={testID ?? aliasTestID ?? "text"}
          selectable={selectable ?? (elementType !== "label" && !content?.isButton)}
          style={{ ...resolved, color: resolved.color ?? foreground }}
        >
          {children}
        </NativeText>
      </NativeContentContext.Provider>
    )
  },
)

Text.displayName = "Text"
