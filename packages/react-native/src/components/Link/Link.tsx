import { forwardRef, useEffect, useRef } from "react"
import { Linking, Pressable, type GestureResponderEvent } from "react-native"

import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { useNativeControlHitSlop, useNativeSelectionInteraction } from "../selection"

import { useNativeLinkColor } from "./motion"
import { getNativeLinkStyle } from "./styles"
import type { TNativeLinkProps, TNativeLinkRef } from "./types"

export const Link = forwardRef<TNativeLinkRef, TNativeLinkProps>((props, ref) => {
  const {
    href,
    children,
    color: _color,
    visitedColor: _visitedColor,
    order: _order,
    isVisited = false,
    isDisabled = false,
    textDecoration: _textDecoration,
    enableFocusStyle: _enableFocusStyle,
    offsetFocusRing: _offsetFocusRing,
    style: _style,
    customStyles: _customStyles,
    onNavigationError: _onNavigationError,
    onPress: _onPress,
    onPressIn,
    onPressOut,
    onLongPress,
    onHoverIn,
    onHoverOut,
    onFocus,
    onBlur,
    onLayout,
    hitSlop,
    focusable = true,
    accessibilityState,
    accessibilityLabel,
    "aria-label": nativeLabel,
    ariaLabel,
    accessibilityLabelledBy,
    "aria-labelledby": nativeLabelledBy,
    ariaLabelledBy,
    testID,
    "data-testid": aliasID,
    ...rest
  } = props
  if (typeof href !== "string") throw new TypeError("Link: href must be a string")
  const latest = useRef(props)
  latest.current = props
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const activate = (event: GestureResponderEvent) => {
    if (!mounted.current || latest.current.isDisabled) return
    const { href: destination, onPress, onNavigationError } = latest.current
    onPress?.(event)
    if (!mounted.current || latest.current.isDisabled || event.defaultPrevented || event.isDefaultPrevented?.()) return
    const report = (error: unknown) => {
      if (!mounted.current) return
      if (onNavigationError) onNavigationError(error, destination)
      else console.warn(`Link: unable to open ${JSON.stringify(destination)}`, error)
    }
    try {
      void Linking.openURL(destination).catch(report)
    } catch (error) {
      report(error)
    }
  }
  const interaction = useNativeSelectionInteraction(
    { onPress: activate, onPressIn, onPressOut, onLongPress, onHoverIn, onHoverOut, onFocus, onBlur },
    isDisabled,
    false,
    () => undefined,
  )
  const { isReadOnly: _readOnly, ...interactionFlags } = interaction.flags
  const flags = { ...interactionFlags, isVisited }
  const theme = useNativeTheme()
  const context = useNativeContentContext()
  const resolved = getNativeLinkStyle(theme, props, flags, context?.foregroundColor ?? theme.colors.foreground)
  const foreground = useNativeLinkColor(resolved.foregroundColor)
  const target = useNativeControlHitSlop(onLayout, hitSlop)
  return (
    <NativeContentContext.Provider value={{ foregroundColor: foreground, isButton: true }}>
      <Pressable
        {...rest}
        {...interaction.handlers}
        {...target}
        ref={ref}
        accessible
        role="link"
        accessibilityRole="link"
        disabled={isDisabled}
        focusable={!isDisabled && focusable}
        aria-disabled={isDisabled}
        accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
        accessibilityLabel={accessibilityLabel ?? nativeLabel ?? ariaLabel}
        accessibilityLabelledBy={accessibilityLabelledBy ?? nativeLabelledBy ?? ariaLabelledBy}
        testID={testID ?? aliasID ?? "link"}
        style={resolved.view}
      >
        {getNativeButtonContent(children, { ...resolved.text, color: foreground })}
      </Pressable>
    </NativeContentContext.Provider>
  )
})

Link.displayName = "Link"
