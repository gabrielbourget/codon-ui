import { createContext, useContext, useId, useInsertionEffect, useRef, type ReactNode, type RefObject } from "react"
import type { PressableProps, View, ViewProps } from "react-native"

import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "./scope"
import { useNativeTooltipTriggerState } from "./useTooltipTriggerState"

export const NATIVE_TOOLTIP_TRIGGER_MODES = ["hover", "focus"] as const
export type TNativeTooltipTriggerMode = (typeof NATIVE_TOOLTIP_TRIGGER_MODES)[number]
export type TNativeTooltipTriggerRenderState = Readonly<{
  isOpen: boolean
  isDisabled: boolean
  triggerRef: RefObject<View | null>
  open: (immediate?: boolean) => void
  close: (immediate?: boolean) => void
  triggerProps: Readonly<{
    ref: RefObject<View | null>
    nativeID: string
    onHoverIn: NonNullable<PressableProps["onHoverIn"]>
    onHoverOut: NonNullable<PressableProps["onHoverOut"]>
    onPointerEnter: NonNullable<ViewProps["onPointerEnter"]>
    onPointerLeave: NonNullable<ViewProps["onPointerLeave"]>
    onFocus: NonNullable<ViewProps["onFocus"]>
    onBlur: NonNullable<ViewProps["onBlur"]>
    onPressIn: NonNullable<PressableProps["onPressIn"]>
  }>
  tooltipProps: Readonly<{
    nativeID: string
    onPointerEnter: NonNullable<ViewProps["onPointerEnter"]>
    onPointerLeave: NonNullable<ViewProps["onPointerLeave"]>
  }>
}>
export type TNativeTooltipTriggerProps = Parameters<typeof useNativeTooltipTriggerState>[0] & {
  isDisabled?: boolean
  triggerMode?: TNativeTooltipTriggerMode
  shouldCloseOnPress?: boolean
  trigger: (state: TNativeTooltipTriggerRenderState) => ReactNode
  children?: ReactNode | ((state: TNativeTooltipTriggerRenderState) => ReactNode)
}

const NativeTooltipTriggerContext = createContext<TNativeTooltipTriggerRenderState | null>(null)
export const useNativeTooltipTrigger = () => useContext(NativeTooltipTriggerContext)

export const NativeTooltipTrigger = (props: TNativeTooltipTriggerProps) => {
  const state = useNativeTooltipTriggerState(props)
  const { isDisabled = false, triggerMode = "hover", shouldCloseOnPress = true } = props
  if (!NATIVE_TOOLTIP_TRIGGER_MODES.includes(triggerMode)) throw new TypeError("Tooltip: unsupported triggerMode")
  const scope = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const triggerRef = useRef<View>(null)
  const id = useId()
  const live = useRef(false)
  const focused = useRef(false)
  const hovered = useRef(false)
  const contentHovered = useRef(false)
  const current = useRef({ state, isDisabled, triggerMode, shouldCloseOnPress, scope, windowActive })
  current.current = { state, isDisabled, triggerMode, shouldCloseOnPress, scope, windowActive }
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const eligible = () => {
    const latest = current.current
    return live.current && latest.scope?.canAct() !== false && latest.windowActive?.() !== false
  }
  const canOpen = () => eligible() && !current.current.isDisabled
  const hoverIn = () => {
    if (!canOpen() || current.current.triggerMode === "focus" || hovered.current) return
    hovered.current = true
    current.current.state.open(focused.current, canOpen)
  }
  const hoverOut = () => {
    if (current.current.triggerMode === "focus" || !hovered.current) return
    hovered.current = false
    focused.current = false
    if (eligible()) current.current.state.close(false, eligible)
  }
  const rendered: TNativeTooltipTriggerRenderState = {
    isOpen: state.isOpen,
    isDisabled,
    triggerRef,
    open: (immediate) => state.open(immediate),
    close: (immediate) => state.close(immediate),
    triggerProps: {
      ref: triggerRef,
      nativeID: `codon-tooltip-trigger-${id}`,
      onHoverIn: hoverIn,
      onHoverOut: hoverOut,
      onPointerEnter: (event) => {
        if (event.nativeEvent.pointerType !== "touch") hoverIn()
      },
      onPointerLeave: (event) => {
        if (event.nativeEvent.pointerType !== "touch") hoverOut()
      },
      onFocus: (event) => {
        if (event.target !== event.currentTarget || !canOpen()) return
        focused.current = true
        current.current.state.open(true, canOpen)
      },
      onBlur: (event) => {
        if (event.target !== event.currentTarget) return
        focused.current = false
        hovered.current = false
        if (eligible()) current.current.state.close(true, eligible)
      },
      onPressIn: () => {
        if (!eligible() || !current.current.shouldCloseOnPress) return
        focused.current = false
        hovered.current = false
        current.current.state.close(true, eligible)
      },
    },
    tooltipProps: {
      nativeID: `codon-tooltip-${id}`,
      onPointerEnter: (event) => {
        if (event.nativeEvent.pointerType === "touch" || !eligible() || contentHovered.current) return
        contentHovered.current = true
        current.current.state.open(true, eligible)
      },
      onPointerLeave: (event) => {
        if (event.nativeEvent.pointerType === "touch" || !contentHovered.current) return
        contentHovered.current = false
        if (eligible()) current.current.state.close(false, eligible)
      },
    },
  }
  return (
    <NativeTooltipTriggerContext.Provider value={rendered}>
      {props.trigger(rendered)}
      {typeof props.children === "function" ? props.children(rendered) : props.children}
    </NativeTooltipTriggerContext.Provider>
  )
}
