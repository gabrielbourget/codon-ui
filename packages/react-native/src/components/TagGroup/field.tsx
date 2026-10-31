/* Adapted from pinned RAC TagGroup/useField; Apache-2.0. See ../../collection/LICENSE.react-aria.md. */
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ForwardedRef,
} from "react"

import { useNativeCollectionRefs, useNativeContextProps, type TNativeContextValue } from "../../collection/context"
import { Text } from "../Text/Text"
import type { TNativeTextProps, TNativeTextRef } from "../Text/types"

export type TNativeTagGroupTextProps = TNativeTextProps & { slot?: string | null }
export const NativeTagGroupLabelContext =
  createContext<TNativeContextValue<Partial<TNativeTagGroupTextProps>, TNativeTextRef>>(null)
export const NativeTagGroupTextContext =
  createContext<TNativeContextValue<Partial<TNativeTagGroupTextProps>, TNativeTextRef>>(null)
type TFieldSlot = "label" | "description" | "errorMessage"
type TFieldBinding = { slot: TFieldSlot; target: TNativeTextRef; nativeID?: string }
const NativeTagGroupFieldBindingContext = createContext<
  ((token: object, slot: TFieldSlot, target: TNativeTextRef | null, nativeID?: string) => void) | null
>(null)

export const useNativeTagGroupField = () => {
  const labelID = `codon-tag-label-${useId()}`
  const descriptionID = `codon-tag-description-${useId()}`
  const errorID = `codon-tag-error-${useId()}`
  const labelToken = useRef({})
  const bindings = useRef(new Map<object, TFieldBinding>())
  const [slots, setSlots] = useState<Partial<Record<TFieldSlot, string>>>({})
  const report = useCallback(
    (token: object, slot: TFieldSlot, target: TNativeTextRef | null, nativeID?: string) => {
      if (target) bindings.current.set(token, { slot, target, nativeID })
      else bindings.current.delete(token)
      const next: Partial<Record<TFieldSlot, string>> = {}
      for (const binding of bindings.current.values())
        next[binding.slot] =
          binding.nativeID ?? { label: labelID, description: descriptionID, errorMessage: errorID }[binding.slot]
      setSlots((previous) =>
        previous.label === next.label &&
        previous.description === next.description &&
        previous.errorMessage === next.errorMessage
          ? previous
          : next,
      )
    },
    [labelID, descriptionID, errorID],
  )
  const labelRef = useCallback(
    (target: TNativeTextRef | null) => report(labelToken.current, "label", target, labelID),
    [report, labelID],
  )
  return {
    labelID: slots.label,
    descriptionID: slots.description,
    errorID: slots.errorMessage,
    labelProps: { nativeID: labelID, elementType: "span" as const, ref: labelRef },
    textProps: { slots: { description: { nativeID: descriptionID }, errorMessage: { nativeID: errorID } } },
    report,
  }
}

const useFieldText = (props: TNativeTagGroupTextProps, ref: ForwardedRef<TNativeTextRef>, label: boolean) => {
  const [merged, mergedRef] = useNativeContextProps(
    props,
    ref,
    label ? NativeTagGroupLabelContext : NativeTagGroupTextContext,
  )
  const report = useContext(NativeTagGroupFieldBindingContext)
  const token = useRef({})
  const target = useRef<TNativeTextRef | null>(null)
  const slot: TFieldSlot = label ? "label" : props.slot === "description" ? "description" : "errorMessage"
  const enabled = props.slot !== null && (label || props.slot === "description" || props.slot === "errorMessage")
  const nativeID = merged.id ?? merged.nativeID
  const current = useRef({ slot, enabled, nativeID })
  useInsertionEffect(() => {
    current.current = { slot, enabled, nativeID }
  })
  const bind = useCallback(
    (view: TNativeTextRef | null) => {
      target.current = view
      const binding = current.current
      report?.(token.current, binding.slot, binding.enabled ? view : null, binding.nativeID)
    },
    [report],
  )
  useLayoutEffect(() => {
    report?.(token.current, slot, enabled ? target.current : null, nativeID)
    return () => report?.(token.current, slot, null, nativeID)
  }, [report, slot, enabled, nativeID])
  return [merged, useNativeCollectionRefs(mergedRef, bind)] as const
}

export const TagGroupLabel = forwardRef<TNativeTextRef, TNativeTagGroupTextProps>((props, ref) => {
  const [merged, mergedRef] = useFieldText(props, ref, true)
  const { slot: _slot, ...native } = merged
  return <Text {...native} elementType={native.elementType ?? "label"} ref={mergedRef} />
})
export const TagGroupText = forwardRef<TNativeTextRef, TNativeTagGroupTextProps>((props, ref) => {
  const [merged, mergedRef] = useFieldText(props, ref, false)
  const { slot: _slot, ...native } = merged
  return <Text {...native} elementType={native.elementType ?? "span"} ref={mergedRef} />
})
export const NativeTagGroupFieldProvider = NativeTagGroupFieldBindingContext.Provider
