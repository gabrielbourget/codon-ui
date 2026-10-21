import { forwardRef, useEffect, useRef, useState, type ForwardRefExoticComponent, type RefAttributes } from "react"
import type { AccessibilityState, MouseEvent, ViewProps } from "react-native"

import { useNativeContextProps } from "../../collection/context"
import { NativePressable, type TNativePressableRender } from "../../input/NativePressable"
import type { TNativeFocusEvent, TNativePressEvent, TNativeFocusViewProps } from "../../input/types"
import { useNativeTheme } from "../../theme"
import { NativeContentContext } from "../NativeContentContext"

import { getNativeButtonContent } from "./content"
import { NativeButtonContext } from "./context"
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

type TNativeButtonInternalProps = Omit<TNativeButtonProps, "accessibilityState"> &
  Pick<TNativeFocusViewProps, "nativeFormActionBinding" | "onNativeFormActionStatus"> & {
    accessibilityState?: Omit<AccessibilityState, "disabled">
    nativeRole?: ViewProps["role"]
    nativeAccessible?: boolean
    nativeInteraction?: boolean
    nativeRender?: (
      props: Parameters<TNativePressableRender>[0],
      state: TNativeButtonRenderState & { isFocusVisible: boolean },
    ) => ReturnType<TNativePressableRender>
    nativeProgrammaticFocusable?: boolean
    nativeTabStop?: boolean
    nativeOnFocusObserved?: (focused: boolean, event: TNativeFocusEvent) => void
    nativeStyle?: (
      state: Omit<TNativeButtonRenderState, "foregroundColor">,
      focusVisible: boolean,
    ) => ReturnType<typeof getNativeButtonStyle>
  }

export const NativeButton = forwardRef<TNativeButtonRef, TNativeButtonInternalProps>((props, ref) => {
  const {
    children,
    nativeRole = "button",
    nativeAccessible = true,
    nativeInteraction = true,
    nativeStyle,
    nativeRender,
    nativeProgrammaticFocusable,
    nativeOnFocusObserved,
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
  const blocked = isDisabled || isPending || !nativeInteraction
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
  const resolved = nativeStyle
    ? nativeStyle(flags, focusVisible)
    : getNativeButtonStyle(theme, props, flags, focusVisible)
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
        nativeRender={
          nativeRender
            ? (props) =>
                nativeRender(props, {
                  ...flags,
                  foregroundColor: resolved.foregroundColor,
                  isFocusVisible: focusVisible,
                })
            : undefined
        }
        nativeProgrammaticFocusable={nativeProgrammaticFocusable}
        onNativeFocusObserved={nativeOnFocusObserved}
        ref={ref}
        accessible={nativeAccessible}
        nativeInteraction={nativeInteraction}
        role={nativeRole}
        disabled={isDisabled}
        activationBlocked={blocked}
        focusable={keyboardFocusable}
        aria-disabled={isDisabled}
        aria-busy={nativeInteraction ? isPending : accessibilityState?.busy}
        accessibilityState={{
          ...accessibilityState,
          disabled: isDisabled,
          busy: nativeInteraction ? isPending : accessibilityState?.busy,
        }}
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

NativeButton.displayName = "Button"
export const Button: ForwardRefExoticComponent<TNativeButtonProps & RefAttributes<TNativeButtonRef>> = forwardRef(
  (props, ref) => {
    const [merged, mergedRef] = useNativeContextProps(props, ref, NativeButtonContext)
    const { slot: _slot, ...native } = merged
    return <NativeButton {...native} ref={mergedRef} />
  },
)
Button.displayName = "Button"
