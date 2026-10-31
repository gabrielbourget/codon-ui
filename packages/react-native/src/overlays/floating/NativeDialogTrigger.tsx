import {
  createContext,
  useCallback,
  useContext,
  useId,
  useInsertionEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react"
import type { View } from "react-native"

import type { TNativeButtonProps } from "../../components/Button/types"
import {
  NativeDialogContext,
  NativeOverlayTriggerStateContext,
  NativePopoverContext,
} from "../../components/ClickPopover/context"
import { NativeRootMenuTriggerStateContext } from "../../components/Menu/context"
import { useNativeMenuTriggerState } from "../../components/Menu/triggerState"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"

import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "./scope"

export type TNativeDialogTriggerRenderState = Readonly<{
  isOpen: boolean
  isDisabled: boolean
  triggerRef: RefObject<View | null>
  open: () => void
  close: () => void
  toggle: () => void
  triggerProps: Readonly<{
    ref: RefObject<View | null>
    onPress: NonNullable<TNativeButtonProps["onPress"]>
    isDisabled: boolean
    nativeID: string
    accessibilityState: NonNullable<TNativeButtonProps["accessibilityState"]>
  }>
}>
export type TNativeDialogTriggerProps = {
  isOpen?: boolean
  defaultOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  isDisabled?: boolean
  trigger: (state: TNativeDialogTriggerRenderState) => ReactNode
  children?: ReactNode | ((state: TNativeDialogTriggerRenderState) => ReactNode)
}

const NativeDialogTriggerContext = createContext<{
  isOpen: boolean
  triggerRef: RefObject<View | null>
  request: (next: boolean) => void
} | null>(null)
export const useNativeDialogTrigger = () => useContext(NativeDialogTriggerContext)

export const NativeDialogTrigger = (props: TNativeDialogTriggerProps) => {
  const controlled = props.isOpen !== undefined
  const initialOwnership = useRef(controlled)
  if (initialOwnership.current !== controlled)
    throw new TypeError("NativeDialogTrigger: changing controlled/uncontrolled ownership is unsupported")
  const overlayState = useNativeMenuTriggerState(props)
  const isOpen = overlayState.isOpen
  const isDisabled = props.isDisabled ?? false
  const scope = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const input = useNativeKeyScope()
  const triggerRef = useRef<View>(null)
  const id = useId()
  const live = useRef(false)
  const current = useRef({
    isOpen,
    isDisabled,
    overlayState,
    scope,
    windowActive,
    input,
    onOpenChange: props.onOpenChange,
  })
  current.current = { isOpen, isDisabled, overlayState, scope, windowActive, input, onOpenChange: props.onOpenChange }
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const request = useCallback((next: boolean) => {
    const latest = current.current
    if (!live.current || next === latest.isOpen) return
    if (next) latest.overlayState.open()
    else latest.overlayState.close()
  }, [])
  const state: TNativeDialogTriggerRenderState = {
    isOpen,
    isDisabled,
    triggerRef,
    open: () => request(true),
    close: () => request(false),
    toggle: () => request(!current.current.isOpen),
    triggerProps: {
      ref: triggerRef,
      nativeID: `codon-dialog-trigger-${id}`,
      isDisabled,
      accessibilityState: { expanded: isOpen },
      onPress: () => {
        const latest = current.current
        if (
          latest.isDisabled ||
          latest.scope?.canAct() === false ||
          latest.windowActive?.() === false ||
          latest.input?.isWindowActive() === false
        )
          return
        request(!latest.isOpen)
      },
    },
  }
  const sharedState: typeof overlayState = {
    ...overlayState,
    setOpen: (next) => {
      if (live.current) current.current.overlayState.setOpen(next)
    },
    open: (strategy) => {
      if (live.current) current.current.overlayState.open(strategy)
    },
    close: () => {
      if (live.current) current.current.overlayState.close()
    },
    toggle: (strategy) => {
      if (live.current) current.current.overlayState.toggle(strategy)
    },
    openSubmenu: (key, level) => {
      if (live.current) current.current.overlayState.openSubmenu(key, level)
    },
    closeSubmenu: (key, level) => {
      if (live.current) current.current.overlayState.closeSubmenu(key, level)
    },
  }
  return (
    <NativeDialogTriggerContext.Provider value={{ isOpen, triggerRef, request }}>
      <NativeOverlayTriggerStateContext.Provider value={sharedState}>
        <NativeRootMenuTriggerStateContext.Provider value={sharedState}>
          <NativeDialogContext.Provider value={{ accessibilityLabelledBy: state.triggerProps.nativeID }}>
            <NativePopoverContext.Provider
              value={{ triggerRef, trigger: "DialogTrigger", accessibilityLabelledBy: state.triggerProps.nativeID }}
            >
              {props.trigger(state)}
              {typeof props.children === "function" ? props.children(state) : props.children}
            </NativePopoverContext.Provider>
          </NativeDialogContext.Provider>
        </NativeRootMenuTriggerStateContext.Provider>
      </NativeOverlayTriggerStateContext.Provider>
    </NativeDialogTriggerContext.Provider>
  )
}
