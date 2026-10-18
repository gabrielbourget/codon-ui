import { forwardRef, useContext, useInsertionEffect, useRef, useState } from "react"
import { Linking } from "react-native"

import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { NativePressable } from "../../input/NativePressable"
import type { TNativePressEvent } from "../../input/types"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { useNativeControlHitSlop } from "../selection"

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
  const scope = useContext(NativeFloatingScopeContext)
  const window = useContext(NativeFloatingWindowContext)
  const input = useNativeKeyScope()
  const canNavigate = () => scope?.canAct() !== false && window?.() !== false && input?.isWindowActive() !== false
  const navigationAdmission = useRef(canNavigate)
  useInsertionEffect(() => {
    latest.current = props
    navigationAdmission.current = canNavigate
  })
  const mounted = useRef(true)
  useInsertionEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const activate = (event: TNativePressEvent) => {
    if (!mounted.current || latest.current.isDisabled || !navigationAdmission.current()) return
    const { href: destination, onPress, onNavigationError } = latest.current
    onPress?.(event)
    if (
      !mounted.current ||
      latest.current.isDisabled ||
      !navigationAdmission.current() ||
      event.defaultPrevented ||
      event.isDefaultPrevented?.()
    )
      return
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
  const [pressed, setPressed] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [focusVisible, setFocusVisible] = useState(false)
  const keyboardFocusable = !isDisabled && focusable && rest.tabIndex !== -1
  const flags = {
    isPressed: pressed && !isDisabled,
    isHovered: hovered && !isDisabled,
    isFocused: focused && keyboardFocusable,
    isDisabled,
    isVisited,
  }
  const theme = useNativeTheme()
  const context = useNativeContentContext()
  const resolved = getNativeLinkStyle(
    theme,
    props,
    flags,
    context?.foregroundColor ?? theme.colors.foreground,
    focusVisible,
  )
  const foreground = useNativeLinkColor(resolved.foregroundColor)
  const target = useNativeControlHitSlop(onLayout, hitSlop)
  return (
    <NativeContentContext.Provider value={{ foregroundColor: foreground, isButton: true }}>
      <NativePressable
        {...rest}
        {...target}
        ref={ref}
        accessible
        role="link"
        accessibilityRole="link"
        disabled={isDisabled}
        focusable={keyboardFocusable}
        aria-disabled={isDisabled}
        accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
        accessibilityLabel={accessibilityLabel ?? nativeLabel ?? ariaLabel}
        accessibilityLabelledBy={accessibilityLabelledBy ?? nativeLabelledBy ?? ariaLabelledBy}
        testID={testID ?? aliasID ?? "link"}
        style={resolved.view}
        onPress={activate}
        onPressIn={(event) => {
          setPressed(true)
          onPressIn?.(event)
        }}
        onPressOut={(event) => {
          setPressed(false)
          onPressOut?.(event)
        }}
        onPressCancel={() => setPressed(false)}
        onLongPress={onLongPress}
        onHoverIn={(event) => {
          setHovered(true)
          onHoverIn?.(event)
        }}
        onHoverOut={(event) => {
          setHovered(false)
          onHoverOut?.(event)
        }}
        onHoverCancel={() => setHovered(false)}
        onFocusVisibilityChange={setFocusVisible}
        onFocus={(event) => {
          setFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          onBlur?.(event)
        }}
      >
        {getNativeButtonContent(children, { ...resolved.text, color: foreground })}
      </NativePressable>
    </NativeContentContext.Provider>
  )
})

Link.displayName = "Link"
