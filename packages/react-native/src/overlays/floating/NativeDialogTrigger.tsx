import {
  createContext,
  useCallback,
  useContext,
  useId,
  useInsertionEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import type { View } from "react-native"

import type { TNativeButtonProps } from "../../components/Button/types"

import { NativeFloatingScopeContext } from "./scope"

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
  const [local, setLocal] = useState(() => props.defaultOpen ?? false)
  if (initialOwnership.current !== controlled)
    throw new TypeError("NativeDialogTrigger: changing controlled/uncontrolled ownership is unsupported")
  const isOpen = controlled ? props.isOpen! : local
  const isDisabled = props.isDisabled ?? false
  const scope = useContext(NativeFloatingScopeContext)
  const triggerRef = useRef<View>(null)
  const id = useId()
  const live = useRef(false)
  const current = useRef({ isOpen, isDisabled, controlled, scope, onOpenChange: props.onOpenChange })
  current.current = { isOpen, isDisabled, controlled, scope, onOpenChange: props.onOpenChange }
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const request = useCallback((next: boolean) => {
    const latest = current.current
    if (!live.current || next === latest.isOpen) return
    if (!latest.controlled) setLocal(next)
    latest.onOpenChange?.(next)
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
        if (latest.isDisabled || latest.scope?.canAct() === false) return
        request(!latest.isOpen)
      },
    },
  }
  return (
    <NativeDialogTriggerContext.Provider value={{ isOpen, triggerRef, request }}>
      {props.trigger(state)}
      {typeof props.children === "function" ? props.children(state) : props.children}
    </NativeDialogTriggerContext.Provider>
  )
}
