import { createContext, forwardRef, useCallback, useContext, useInsertionEffect, useRef, useState } from "react"
import { findNodeHandle, type View } from "react-native"

import { useNativeContextProps, type TNativeContextValue, type TNativeSlotProps } from "../../collection/context"
import { useNativeContentContext } from "../../components/NativeContentContext"
import { splitNativeTextStyle } from "../../components/nativeTextStyle"
import type { TNativeDateInputSlot } from "../../form/dateSegments"
import { NativeFieldInputContext, type TNativeFieldInputScope } from "../../input/fieldInput"
import { NativeFocusHost } from "../../input/NativeFocusView"
import type { TNativeFocusViewProps } from "../../input/types"
import { NativeDateFieldFocusManager } from "../field/focus"
import type { NativeDateFieldHostSet } from "../field/hostSet"
import { NativeTimePickerSegment } from "../field/NativeTimePickerSegment"
import type { DateFieldState } from "../state/useDateFieldState"

import type { TNativeDatePickerAppearanceResult } from "./appearance"

export type TNativePickerInputProps = TNativeSlotProps &
  TNativeFocusViewProps & {
    field?: Readonly<{ slot: TNativeDateInputSlot; state: DateFieldState; hosts: NativeDateFieldHostSet }>
    ownerId?: string
    scope?: TNativeFieldInputScope | null
    outerTarget?: number
    appearance?: TNativeDatePickerAppearanceResult
    locale?: string
    direction?: "ltr" | "rtl"
    label?: string
  }
export const NativeDateInputContext = createContext<TNativeContextValue<TNativePickerInputProps, View>>(null)
export const NativeDateInputOrdinaryEventsContext = createContext(false)
export const NativeDateFieldStateContext = createContext<DateFieldState | null>(null)
export const NativePickerInput = forwardRef<View, TNativePickerInputProps>((authored, forwardedRef) => {
  const inherited = useNativeContentContext()
  const [props, ref] = useNativeContextProps(authored, forwardedRef, NativeDateInputContext)
  const { field, ownerId, scope, outerTarget, appearance, locale, direction, label, slot: _slot, ...native } = props
  const ordinaryInputEvents = useContext(NativeDateInputOrdinaryEventsContext)
  const currentField = useRef(field)
  useInsertionEffect(() => {
    currentField.current = field
  })
  const [inputFocus] = useState(
    () =>
      new NativeDateFieldFocusManager(() => {
        const current = currentField.current
        return current ? current.hosts.snapshot(current.state.segments) : null
      }),
  )
  useInsertionEffect(() => () => inputFocus.retire(), [inputFocus])
  const hosts = field?.hosts
  const bind = useCallback(
    (target: View | null) => {
      hosts?.root(target, target ? (findNodeHandle(target) ?? 0) : 0)
      return ref(target)
    },
    [hosts, ref],
  )
  if (!field || !appearance || !ownerId || !locale || !direction || outerTarget === undefined)
    throw new Error("DateInput requires its current picker context")
  const { state } = field
  const inputStyle = splitNativeTextStyle(appearance.input)
  return (
    <NativeDateFieldStateContext.Provider value={state}>
      <NativeFieldInputContext.Provider value={scope ?? null}>
        <NativeFocusHost
          {...native}
          ref={bind}
          focusable={false}
          accessible={false}
          role="group"
          accessibilityLabel={label}
          style={{ direction, ...inputStyle.view }}
        >
          {state.segments.map((segment, index) => (
            <NativeTimePickerSegment
              key={index}
              ownerId={ownerId}
              segmentId={field.hosts.segmentId(segment, index)}
              segment={segment}
              state={state}
              locale={locale}
              direction={direction}
              hostSet={field.hosts}
              inputFocus={ordinaryInputEvents ? inputFocus : undefined}
              scope={scope ?? null}
              outerTarget={outerTarget}
              appearance={appearance}
              inheritedText={{ ...inherited?.textStyle, ...inputStyle.text }}
              label={label}
              testID={`${native.testID}-segment-${index}`}
            />
          ))}
        </NativeFocusHost>
      </NativeFieldInputContext.Provider>
    </NativeDateFieldStateContext.Provider>
  )
})
NativePickerInput.displayName = "NativeDateInput"
