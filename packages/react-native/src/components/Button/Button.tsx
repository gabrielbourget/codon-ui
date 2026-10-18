import { forwardRef, useEffect, useRef, useState } from "react"
import type { MouseEvent } from "react-native"

import { NativePressable } from "../../input/NativePressable"
import type { TNativePressEvent } from "../../input/types"
import { useNativeTheme } from "../../theme"
import { NativeContentContext } from "../NativeContentContext"

import { getNativeButtonContent } from "./content"
import { getNativeButtonStyle } from "./styles"
import type { TNativeButtonProps, TNativeButtonRef, TNativeButtonRenderState } from "./types"

type TPressCycle = {
  event: TNativePressEvent
  cancelled: boolean
  endDelivered: boolean
  activationDelivered?: boolean
  upDelivered?: boolean
  nativeEnd?: TNativePressEvent
}

export const Button = forwardRef<TNativeButtonRef, TNativeButtonProps>((props, ref) => {
  const {
    children,
    color,
    hoverColor,
    colorMode,
    geometry,
    order,
    width,
    height,
    transparent,
    raised,
    raisedOnHover,
    enableFocusStyle,
    offsetFocusRing,
    customStyles,
    style,
    isDisabled = false,
    isPending = false,
    testID,
    accessibilityLabel,
    accessibilityState,
    "data-testid": aliasTestID,
    "aria-label": aliasLabel,
    onPress,
    onPressIn,
    onPressOut,
    onLongPress,
    onPressStart,
    onPressEnd,
    onPressUp,
    onPressChange,
    onHoverIn,
    onHoverOut,
    onHoverStart,
    onHoverEnd,
    onHoverChange,
    onFocus,
    onBlur,
    onFocusChange,
    onLayout,
    hitSlop,
    focusable,
    ...rest
  } = props
  const theme = useNativeTheme()
  const blocked = isDisabled || isPending
  const [pressed, setPressed] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [focusVisible, setFocusVisible] = useState(false)
  const [bounds, setBounds] = useState<{ width: number; height: number }>()
  const pressCycle = useRef<TPressCycle | undefined>(undefined)
  const hoverEvent = useRef<MouseEvent | undefined>(undefined)
  const focusState = useRef(false)
  const finishPress = (event: TNativePressEvent) => {
    const cycle = pressCycle.current
    if (!cycle || cycle.endDelivered) return
    cycle.endDelivered = true
    setPressed(false)
    onPressEnd?.(event)
    onPressChange?.(false)
  }
  const finishHover = (event: MouseEvent) => {
    if (!hoverEvent.current) return
    hoverEvent.current = undefined
    setHovered(false)
    onHoverEnd?.(event)
    onHoverChange?.(false)
  }
  useEffect(() => {
    if (!blocked) return
    if (pressCycle.current && !pressCycle.current.endDelivered) {
      pressCycle.current.cancelled = true
      finishPress(pressCycle.current.event)
    }
    if (hoverEvent.current) finishHover(hoverEvent.current)
  })
  const keyboardFocusable = !isDisabled && focusable !== false && rest.tabIndex !== -1
  const flags = {
    isPressed: pressed && !blocked,
    isHovered: hovered && !blocked,
    isFocused: focused && keyboardFocusable,
    isDisabled,
    isPending,
  }
  const resolved = getNativeButtonStyle(theme, props, flags, focusVisible)
  const state: TNativeButtonRenderState = { ...flags, foregroundColor: resolved.foregroundColor }
  const rendered = typeof children === "function" ? children({ ...state, defaultChildren: undefined }) : children
  const content = getNativeButtonContent(rendered, resolved.textStyle)
  const automaticHitSlop = bounds
    ? {
        left: Math.max(0, (resolved.target - bounds.width) / 2),
        right: Math.max(0, (resolved.target - bounds.width) / 2),
        top: Math.max(0, (resolved.target - bounds.height) / 2),
        bottom: Math.max(0, (resolved.target - bounds.height) / 2),
      }
    : undefined

  return (
    <NativeContentContext.Provider value={{ foregroundColor: resolved.foregroundColor, isButton: true }}>
      <NativePressable
        {...rest}
        ref={ref}
        accessible
        role="button"
        disabled={isDisabled}
        activationBlocked={blocked}
        focusable={keyboardFocusable}
        aria-disabled={isDisabled}
        aria-busy={isPending}
        accessibilityState={{ ...accessibilityState, disabled: isDisabled, busy: isPending }}
        accessibilityLabel={accessibilityLabel ?? aliasLabel}
        testID={testID ?? aliasTestID ?? "button"}
        style={resolved.viewStyle}
        hitSlop={hitSlop ?? automaticHitSlop}
        onLayout={(event) => {
          const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout
          setBounds((current) =>
            current?.width === nextWidth && current.height === nextHeight
              ? current
              : { width: nextWidth, height: nextHeight },
          )
          onLayout?.(event)
        }}
        onPressIn={(event) => {
          if (blocked) return
          event.persist?.()
          pressCycle.current = { event, cancelled: false, endDelivered: false }
          setPressed(true)
          onPressStart?.(event)
          onPressChange?.(true)
          onPressIn?.(event)
        }}
        onPressUp={(event) => {
          const cycle = pressCycle.current
          if (!blocked && cycle && !cycle.cancelled && !cycle.upDelivered) {
            cycle.upDelivered = true
            onPressUp?.(event)
          }
        }}
        onActivation={(event) => {
          if (blocked) return
          let cycle = pressCycle.current
          if (cycle?.cancelled && !cycle.endDelivered) return
          if (!cycle || cycle.endDelivered) {
            cycle = { event, cancelled: false, endDelivered: false }
            pressCycle.current = cycle
            setPressed(true)
            onPressStart?.(event)
            onPressChange?.(true)
          }
          if (!cycle.upDelivered) {
            cycle.upDelivered = true
            onPressUp?.(event)
          }
          finishPress(event)
          if (pressCycle.current === cycle && cycle.event.nativeEvent === event.nativeEvent)
            pressCycle.current = undefined
        }}
        onPressCancel={(event) => {
          if (pressCycle.current) pressCycle.current.cancelled = true
          finishPress(event)
        }}
        onHoverCancel={finishHover}
        onPressOut={(event) => {
          const cycle = pressCycle.current
          if (cycle) {
            event.persist?.()
            cycle.nativeEnd = event
            finishPress(event)
            onPressOut?.(event)
            if (cycle.activationDelivered && pressCycle.current === cycle) pressCycle.current = undefined
          }
        }}
        onPress={(event) => {
          const cycle = pressCycle.current
          const cancelledGesture =
            cycle?.cancelled &&
            (!cycle.nativeEnd ||
              cycle.nativeEnd === event ||
              ("timestamp" in cycle.nativeEnd.nativeEvent &&
                "timestamp" in event.nativeEvent &&
                cycle.nativeEnd.nativeEvent.timestamp === event.nativeEvent.timestamp))
          if (!blocked && !cancelledGesture && !cycle?.activationDelivered) onPress?.(event)
          if (cycle) {
            cycle.activationDelivered = true
            if (cycle.nativeEnd) pressCycle.current = undefined
          }
        }}
        onLongPress={
          onLongPress
            ? (event) => {
                if (!blocked && !pressCycle.current?.cancelled) onLongPress(event)
              }
            : undefined
        }
        onHoverIn={(event) => {
          if (blocked || hoverEvent.current) return
          event.persist?.()
          hoverEvent.current = event
          setHovered(true)
          onHoverStart?.(event)
          onHoverChange?.(true)
          onHoverIn?.(event)
        }}
        onHoverOut={(event) => {
          if (!hoverEvent.current) return
          finishHover(event)
          onHoverOut?.(event)
        }}
        onFocusVisibilityChange={setFocusVisible}
        onFocus={(event) => {
          if (!keyboardFocusable) return
          setFocused(true)
          onFocus?.(event)
          if (!focusState.current) onFocusChange?.(true)
          focusState.current = true
        }}
        onBlur={(event) => {
          setFocused(false)
          onBlur?.(event)
          if (focusState.current) onFocusChange?.(false)
          focusState.current = false
        }}
      >
        {content}
      </NativePressable>
    </NativeContentContext.Provider>
  )
})

Button.displayName = "Button"
