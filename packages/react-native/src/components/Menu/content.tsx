/* Adapted from pinned React Aria Components; Apache-2.0. See ../../collection/LICENSE.react-aria.md. */
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useRef,
  useInsertionEffect,
  useLayoutEffect,
  type Context,
  type Ref,
} from "react"

import { useNativeCollectionRefs, useNativeContextProps, type TNativeContextValue } from "../../collection/context"
import { Text } from "../Text/Text"
import type { TNativeTextProps, TNativeTextRef } from "../Text/types"

export type TNativeMenuTextProps = TNativeTextProps & { slot?: string | null }
export const NativeMenuTextContext =
  createContext<TNativeContextValue<Partial<TNativeMenuTextProps>, TNativeTextRef>>(null)
export const NativeMenuKeyboardShortcutContext =
  createContext<TNativeContextValue<Partial<TNativeMenuTextProps>, TNativeTextRef>>(null)
export { NativeSelectionIndicatorContext as NativeMenuSelectionIndicatorContext } from "../../collection/context"
export const NATIVE_MENU_TEXT_SLOTS = ["label", "description", "keyboard"] as const
export type TNativeMenuTextSlot = (typeof NATIVE_MENU_TEXT_SLOTS)[number]
export const NativeMenuTextBindingContext = createContext<
  | ((token: object, slot: TNativeMenuTextSlot, target: TNativeTextRef | null, nativeID: string | undefined) => void)
  | null
>(null)

const useTextSlot = (
  props: TNativeMenuTextProps,
  ref: Ref<TNativeTextRef> | undefined,
  context: Context<TNativeContextValue<Partial<TNativeMenuTextProps>, TNativeTextRef>>,
  slot: TNativeMenuTextSlot,
) => {
  const [merged, mergedRef] = useNativeContextProps(props, ref, context)
  const register = useContext(NativeMenuTextBindingContext)
  const token = useRef({})
  const target = useRef<TNativeTextRef | null>(null)
  const nativeID = ("id" in merged && typeof merged.id === "string" ? merged.id : undefined) ?? merged.nativeID
  const current = useRef({ slot, nativeID, enabled: props.slot !== null })
  useInsertionEffect(() => {
    current.current = { slot, nativeID, enabled: props.slot !== null }
  })
  const bind = useCallback(
    (view: TNativeTextRef | null) => {
      target.current = view
      const binding = current.current
      register?.(token.current, binding.slot, binding.enabled ? view : null, binding.nativeID)
    },
    [register],
  )
  useLayoutEffect(() => {
    const binding = current.current
    register?.(token.current, binding.slot, binding.enabled ? target.current : null, binding.nativeID)
  }, [register, slot, nativeID, props.slot])
  return [merged, useNativeCollectionRefs(mergedRef, bind)] as const
}

export const MenuText = forwardRef<TNativeTextRef, TNativeMenuTextProps>((props, ref) => {
  const [merged, mergedRef] = useTextSlot(
    props,
    ref,
    NativeMenuTextContext,
    props.slot === "description" ? "description" : "label",
  )
  const { slot: _slot, ...native } = merged
  return <Text {...native} ref={mergedRef} />
})
export const MenuKeyboardShortcut = forwardRef<TNativeTextRef, TNativeMenuTextProps>((props, ref) => {
  const [merged, mergedRef] = useTextSlot(props, ref, NativeMenuKeyboardShortcutContext, "keyboard")
  const { slot: _slot, ...native } = merged
  return <Text {...native} ref={mergedRef} />
})
