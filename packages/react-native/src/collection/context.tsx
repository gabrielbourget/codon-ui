/* Copyright 2022 Adobe. Licensed under Apache-2.0; see LICENSE.react-aria.md. */
import { createContext, useContext, useMemo, type Context, type Ref, type RefCallback } from "react"
import { StyleSheet, type StyleProp, type View, type ViewStyle } from "react-native"

import type { TNativeFocusViewProps } from "../input/types"

import type { TNativeCollectionNode } from "./snapshot"

export const NATIVE_DEFAULT_SLOT = Symbol("default")
export type TNativeSlotProps = { slot?: string | null }
export type TNativeContextValue<P, R> =
  | (P & { ref?: Ref<R> })
  | { slots: Partial<Record<string | symbol, P & { ref?: Ref<R> }>> }
  | null
  | undefined

export const NativeSelectionIndicatorContext = createContext<Readonly<{ isSelected: boolean }>>({ isSelected: false })

export type TNativeSelectableCollectionContextValue = TNativeFocusViewProps &
  TNativeSlotProps & {
    filter?: (textValue: string, node: TNativeCollectionNode<unknown>) => boolean
    shouldUseVirtualFocus?: boolean
    disallowTypeAhead?: boolean
  }
export const NativeSelectableCollectionContext =
  createContext<TNativeContextValue<TNativeSelectableCollectionContextValue, View>>(null)

// Pinned RAC slot lookup and merge order, with native style arrays and actual native refs.
export const useNativeSlottedContext = <P, R>(
  context: Context<TNativeContextValue<P, R>>,
  slot?: string | null,
): (P & { ref?: Ref<R> }) | null | undefined => {
  const value = useContext(context)
  if (slot === null) return null
  if (value && "slots" in value && value.slots) {
    const selected = value.slots[slot || NATIVE_DEFAULT_SLOT]
    if (!selected) {
      const available = new Intl.ListFormat().format(Object.keys(value.slots).map((name) => `"${name}"`))
      throw new Error(
        `${slot ? `Invalid slot "${slot}".` : "A slot prop is required."} Valid slot names are ${available}.`,
      )
    }
    return selected
  }
  return value as (P & { ref?: Ref<R> }) | null | undefined
}

export const mergeNativeCollectionProps = <P extends object>(context: Partial<P>, props: P): P => {
  const merged = { ...context } as Record<string, unknown>
  for (const [key, value] of Object.entries(props)) {
    const previous = merged[key]
    if (/^on[A-Z]/.test(key) && typeof previous === "function" && typeof value === "function") {
      merged[key] = (...args: unknown[]) => {
        previous(...args)
        value(...args)
      }
    } else if (value !== undefined) merged[key] = value
  }
  const inheritedStyle = (context as { style?: unknown }).style
  const callerStyle = (props as { style?: unknown }).style
  const flatten = (value: unknown) => StyleSheet.flatten(value as StyleProp<ViewStyle>) ?? {}
  if (inheritedStyle && callerStyle) {
    if (typeof inheritedStyle === "function" || typeof callerStyle === "function") {
      merged.style = (values: { defaultStyle?: unknown }) => {
        const inherited = typeof inheritedStyle === "function" ? inheritedStyle(values) : inheritedStyle
        const defaultStyle = { ...flatten(values.defaultStyle), ...flatten(inherited) }
        const caller = typeof callerStyle === "function" ? callerStyle({ ...values, defaultStyle }) : callerStyle
        return { ...defaultStyle, ...flatten(caller) }
      }
    } else merged.style = [inheritedStyle, callerStyle]
  }
  return merged as P
}

export const useNativeCollectionRefs = <R,>(first: Ref<R> | undefined, second: Ref<R> | undefined): RefCallback<R> =>
  useMemo(
    () => (target: R | null) => {
      const releases = [first, second].map((ref) => {
        if (typeof ref === "function") {
          const cleanup = ref(target)
          return typeof cleanup === "function" ? cleanup : () => ref(null)
        }
        if (ref) ref.current = target
        return () => {
          if (ref) ref.current = null
        }
      })
      return () => {
        for (const release of releases) release()
      }
    },
    [first, second],
  )

export const useNativeContextProps = <P extends object & TNativeSlotProps, R, C extends object>(
  props: P,
  ref: Ref<R> | undefined,
  context: Context<TNativeContextValue<C, R>>,
): [P & Omit<C, keyof P>, RefCallback<R>] => {
  const { ref: contextRef, ...defaults } = useNativeSlottedContext(context, props.slot) ?? {}
  return [
    mergeNativeCollectionProps(defaults as Partial<P>, props) as P & Omit<C, keyof P>,
    useNativeCollectionRefs(ref, contextRef),
  ]
}
