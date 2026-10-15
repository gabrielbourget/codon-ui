import { useEffect, useRef, useState } from "react"
import { Platform, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from "react-native"

import type { TNativeTheme } from "../theme/types"
import type { TCornerGeometry } from "../tokens/geometry"

import { resolveNativeStyle } from "./colors"

export type TNativeSelectionState = Readonly<{
  isSelected: boolean
  isPressed: boolean
  isHovered: boolean
  isFocused: boolean
  isDisabled: boolean
  isReadOnly: boolean
}>

export type TNativeSelectionHostProps = Omit<
  PressableProps,
  | "children"
  | "style"
  | "disabled"
  | "role"
  | "accessibilityRole"
  | "accessible"
  | "accessibilityState"
  | "aria-disabled"
  | "aria-checked"
  | "aria-selected"
  | "aria-label"
> & {
  accessibilityState?: Omit<NonNullable<PressableProps["accessibilityState"]>, "disabled" | "checked" | "selected">
  "data-testid"?: string
  "aria-label"?: string
  "aria-checked"?: never
  "aria-disabled"?: never
  "aria-selected"?: never
}

export const useNativeSelectionInteraction = (
  props: TNativeSelectionHostProps,
  isDisabled: boolean,
  isReadOnly: boolean,
  activate: () => void,
) => {
  const [pressed, setPressed] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const cycle = useRef<{ active: boolean; cancelled: boolean; end?: GestureResponderEvent }>({
    active: false,
    cancelled: false,
  })
  const blocked = isDisabled || isReadOnly
  useEffect(() => {
    if (!blocked) return
    if (cycle.current.active) cycle.current.cancelled = true
    setPressed(false)
    setHovered(false)
  }, [blocked])

  const handlers: Pick<
    PressableProps,
    "onPressIn" | "onPressOut" | "onPress" | "onLongPress" | "onHoverIn" | "onHoverOut" | "onFocus" | "onBlur"
  > = {
    onPressIn: (event) => {
      if (blocked) return
      cycle.current = { active: true, cancelled: false }
      setPressed(true)
      props.onPressIn?.(event)
    },
    onPressOut: (event) => {
      if (!cycle.current.active) return
      event.persist?.()
      cycle.current.active = false
      cycle.current.end = event
      setPressed(false)
      props.onPressOut?.(event)
    },
    onPress: (event) => {
      const cancelledGesture =
        cycle.current.cancelled &&
        (!cycle.current.end ||
          cycle.current.end === event ||
          cycle.current.end.nativeEvent.timestamp === event.nativeEvent.timestamp)
      if (blocked || cancelledGesture) return
      cycle.current.cancelled = false
      activate()
      props.onPress?.(event)
    },
    onLongPress: props.onLongPress
      ? (event) => {
          if (!blocked && !cycle.current.cancelled) props.onLongPress?.(event)
        }
      : undefined,
    onHoverIn: (event) => {
      if (blocked) return
      setHovered(true)
      props.onHoverIn?.(event)
    },
    onHoverOut: (event) => {
      setHovered(false)
      props.onHoverOut?.(event)
    },
    onFocus: (event) => {
      if (isDisabled) return
      setFocused(true)
      props.onFocus?.(event)
    },
    onBlur: (event) => {
      setFocused(false)
      props.onBlur?.(event)
    },
  }
  return {
    flags: {
      isPressed: pressed && !blocked,
      isHovered: hovered && !blocked,
      isFocused: focused && !isDisabled,
      isDisabled,
      isReadOnly,
    },
    handlers,
  }
}

export const nativeControlTarget = () => (Platform.OS === "ios" ? 44 : 48)

export const getNativeControlRootStyle = <T extends ViewStyle, S extends object>(
  component: string,
  base: T,
  customStyles: StyleProp<T>,
  style: StyleProp<T> | ((state: S & { defaultStyle: T }) => StyleProp<T>),
  state: S,
) => {
  const target = nativeControlTarget()
  const custom = resolveNativeStyle(customStyles, component, "customStyles")
  const baseline = {
    ...base,
    minWidth: (custom.width ?? base.width) === undefined ? target : undefined,
    minHeight: (custom.height ?? base.height) === undefined ? target : undefined,
    ...custom,
  }
  const final = resolveNativeStyle(
    typeof style === "function" ? style({ ...state, defaultStyle: baseline }) : style,
    component,
    "style",
  )
  return resolveNativeStyle(
    [
      {
        ...base,
        minWidth: (final.width ?? custom.width ?? base.width) === undefined ? target : undefined,
        minHeight: (final.height ?? custom.height ?? base.height) === undefined ? target : undefined,
      },
      custom,
      final,
    ],
    component,
    "resolvedStyle",
  )
}

export const getNativeControlRadius = (theme: TNativeTheme, geometry: TCornerGeometry) =>
  geometry === "round" ? theme.radius.round : geometry === "rounded" ? theme.radius.rounded : 0

export const validateNativeControlDimension = (value: number | undefined, component: string, field: string) => {
  if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    throw new TypeError(`${component}: ${field} must be a finite positive native dimension`)
  }
}

export const useNativeControlHitSlop = (onLayout: PressableProps["onLayout"], hitSlop: PressableProps["hitSlop"]) => {
  const [bounds, setBounds] = useState<{ width: number; height: number }>()
  const target = nativeControlTarget()
  return {
    onLayout: ((event) => {
      const { width, height } = event.nativeEvent.layout
      setBounds((current) => (current?.width === width && current.height === height ? current : { width, height }))
      onLayout?.(event)
    }) as NonNullable<PressableProps["onLayout"]>,
    hitSlop:
      hitSlop ??
      (bounds
        ? {
            left: Math.max(0, (target - bounds.width) / 2),
            right: Math.max(0, (target - bounds.width) / 2),
            top: Math.max(0, (target - bounds.height) / 2),
            bottom: Math.max(0, (target - bounds.height) / 2),
          }
        : undefined),
  }
}
