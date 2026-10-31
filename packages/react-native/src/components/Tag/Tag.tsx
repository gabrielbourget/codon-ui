import { forwardRef, useState } from "react"
import { Animated, Pressable } from "react-native"

import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { useNativeControlHitSlop, useNativeSelectionInteraction } from "../selection"

import { resolveNativeTagTransition, useNativeTagColor, useNativeTagNumber, useNativeTagReducedMotion } from "./motion"
import { getNativeTagStyle } from "./styles"
import type { TNativeTagProps, TNativeTagRef } from "./types"

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
const COLOR_TIMING = resolveNativeTagTransition()
const SHADOW_TIMING = resolveNativeTagTransition(450)

export const Tag = forwardRef<TNativeTagRef, TNativeTagProps>((props, ref) => {
  const {
    children,
    id,
    pressable = false,
    width: _width,
    height: _height,
    geometry: _geometry,
    raised: _raised,
    raisedOnHover: _raisedOnHover,
    hoverCursor: _hoverCursor,
    backgroundColorTransition,
    focusOutline: _focusOutline,
    outlineOffset: _outlineOffset,
    customStyles: _customStyles,
    style: _style,
    testID,
    "data-testid": aliasID,
    accessibilityLabel,
    "aria-label": aliasLabel,
    nativeID,
    accessible = true,
    accessibilityLiveRegion,
    "aria-live": aliasLive,
    onPressIn,
    onPressOut,
    onLongPress,
    onHoverIn,
    onHoverOut,
    onFocus,
    onBlur,
    onLayout,
    hitSlop,
    onPointerEnter,
    onPointerLeave,
    accessibilityState,
    color: _color,
    border: _border,
    role: staticRole,
    accessibilityRole: staticAccessibilityRole,
    isPressed: _pressed,
    isDisabled: _disabled,
    onPress: _onPress,
    activeColor: _activeColor,
    inactiveColor: _inactiveColor,
    activeBorder: _activeBorder,
    inactiveBorder: _inactiveBorder,
    "aria-pressed": _ariaPressed,
    "aria-checked": nativeChecked,
    "aria-selected": nativeSelected,
    "aria-disabled": nativeDisabled,
    ...hostProps
  } = props
  if (props.pressable && (typeof props.isPressed !== "boolean" || typeof props.onPress !== "function"))
    throw new TypeError("Tag: pressable mode requires controlled isPressed and onPress")
  const isDisabled = props.pressable ? (props.isDisabled ?? false) : false
  const interaction = useNativeSelectionInteraction(
    { onPressIn, onPressOut, onLongPress, onHoverIn, onHoverOut, onFocus, onBlur },
    isDisabled,
    false,
    () => {
      if (props.pressable) props.onPress(id)
    },
  )
  const [staticHovered, setStaticHovered] = useState(false)
  const flags = {
    pressable,
    isPressed: props.pressable ? props.isPressed : false,
    isPressing: props.pressable === true && interaction.flags.isPressed,
    isHovered: props.pressable ? interaction.flags.isHovered : staticHovered,
    isFocused: interaction.flags.isFocused,
    isDisabled,
  }
  const theme = useNativeTheme()
  const content = useNativeContentContext()
  const resolved = getNativeTagStyle(theme, props, flags, content?.foregroundColor ?? theme.colors.foreground)
  const reduced = useNativeTagReducedMotion()
  const background = useNativeTagColor(
    resolved.view.backgroundColor,
    resolveNativeTagTransition(backgroundColorTransition),
    reduced,
  )
  const foreground = useNativeTagColor(resolved.foregroundColor, COLOR_TIMING, reduced, true)
  const border = useNativeTagColor(resolved.view.borderColor, COLOR_TIMING, reduced)
  const shadow = useNativeTagColor(resolved.view.shadowColor, SHADOW_TIMING, reduced)
  const shadowOpacity = useNativeTagNumber(
    typeof resolved.view.shadowOpacity === "number" ? resolved.view.shadowOpacity : undefined,
    SHADOW_TIMING,
    reduced,
  )
  const shadowRadius = useNativeTagNumber(resolved.view.shadowRadius, SHADOW_TIMING, reduced)
  const shadowX = useNativeTagNumber(resolved.view.shadowOffset?.width, SHADOW_TIMING, reduced)
  const shadowY = useNativeTagNumber(resolved.view.shadowOffset?.height, SHADOW_TIMING, reduced)
  const elevation = useNativeTagNumber(resolved.view.elevation, SHADOW_TIMING, reduced)
  const target = useNativeControlHitSlop(onLayout, hitSlop)
  const style = {
    ...resolved.view,
    backgroundColor: background.value,
    borderColor: border.value,
    shadowColor: shadow.value,
    shadowOpacity: typeof resolved.view.shadowOpacity === "number" ? shadowOpacity : resolved.view.shadowOpacity,
    shadowRadius,
    shadowOffset: resolved.view.shadowOffset
      ? { width: shadowX ?? resolved.view.shadowOffset.width, height: shadowY ?? resolved.view.shadowOffset.height }
      : undefined,
    elevation,
  }
  const { color: _textColor, ...ownedTextStyles } = resolved.text
  const body = (
    <NativeContentContext.Provider
      value={{
        foregroundColor: foreground.rendered ?? resolved.foregroundColor,
        isButton: props.pressable || content?.isButton === true,
      }}
    >
      {getNativeButtonContent(children, ownedTextStyles)}
    </NativeContentContext.Provider>
  )
  const liveRegion =
    accessibilityLiveRegion ?? (aliasLive === "off" ? "none" : aliasLive) ?? (pressable ? undefined : "none")
  const identity = {
    ref,
    accessible,
    nativeID: nativeID ?? (id === undefined ? undefined : String(id)),
    testID: testID ?? aliasID ?? "tag",
    accessibilityLabel: accessibilityLabel ?? aliasLabel,
    accessibilityLiveRegion: liveRegion,
  }
  if (props.pressable) {
    const alias = props["aria-pressed"]
    const checked =
      alias === "mixed" ? "mixed" : alias === undefined ? props.isPressed : alias === true || alias === "true"
    return (
      <AnimatedPressable
        {...hostProps}
        {...identity}
        {...interaction.handlers}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        role="button"
        disabled={isDisabled}
        aria-disabled={isDisabled}
        accessibilityState={{ ...accessibilityState, checked, disabled: isDisabled }}
        style={style}
        hitSlop={target.hitSlop}
        onLayout={target.onLayout}
      >
        {body}
      </AnimatedPressable>
    )
  }
  return (
    <Animated.View
      {...hostProps}
      {...identity}
      role={staticRole}
      accessibilityRole={staticAccessibilityRole ?? (staticRole === undefined ? "text" : undefined)}
      accessibilityState={accessibilityState}
      aria-checked={nativeChecked}
      aria-selected={nativeSelected}
      aria-disabled={nativeDisabled}
      onLayout={onLayout}
      onPointerEnter={(event) => {
        setStaticHovered(true)
        onPointerEnter?.(event)
        onHoverIn?.(event)
      }}
      onPointerLeave={(event) => {
        setStaticHovered(false)
        onPointerLeave?.(event)
        onHoverOut?.(event)
      }}
      onFocus={interaction.handlers.onFocus}
      onBlur={interaction.handlers.onBlur}
      style={style}
    >
      {body}
    </Animated.View>
  )
})
Tag.displayName = "Tag"
