import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useInsertionEffect,
  useRef,
  useState,
  type RefObject,
} from "react"
import { findNodeHandle, type View } from "react-native"

import { useNativeContextProps, type TNativeContextValue, type TNativeSlotProps } from "../../collection/context"
import { useNativeContentContext } from "../../components/NativeContentContext"
import { splitNativeTextStyle } from "../../components/nativeTextStyle"
import type { TNativeDateInputSlot } from "../../form/dateSegments"
import { NativeFieldInputContext, type TNativeFieldInputScope } from "../../input/fieldInput"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { NativeOrdinaryFocusParticipantsContext } from "../../input/ordinaryEditorKeys"
import type { TNativeFocusViewProps, TNativeKeyboardEvent } from "../../input/types"
import type { NativeDateFieldHostSet } from "../field/hostSet"
import { NativeTimePickerSegment } from "../field/NativeTimePickerSegment"
import { useNativeOrdinaryDateGroup } from "../field/ordinaryGroup"
import { NativeDateFieldParticipantFocusManager, type TNativeExtraFocusParticipants } from "../field/participants"
import { useNativeDateFieldParticipants } from "../field/useParticipants"
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
export const NativeDateInputOrdinaryEventsContext = createContext<{
  input: boolean
  group: boolean
  observe?: boolean
  root?: RefObject<View | null>
  participants?: TNativeExtraFocusParticipants
  onNavigationKeyDown?: (event: TNativeKeyboardEvent) => void
}>({ input: false, group: false })
export const NativeDateFieldStateContext = createContext<DateFieldState | null>(null)
export const NativePickerInput = forwardRef<View, TNativePickerInputProps>((authored, forwardedRef) => {
  const inherited = useNativeContentContext()
  const [props, ref] = useNativeContextProps(authored, forwardedRef, NativeDateInputContext)
  const { field, ownerId, scope, outerTarget, appearance, locale, direction, label, slot: _slot, ...native } = props
  const ordinaryEvents = useContext(NativeDateInputOrdinaryEventsContext)
  const ordinaryInputEvents = ordinaryEvents.input
  const currentField = useRef({ field, ordinaryEvents })
  const [originalRoot, setOriginalRoot] = useState<View | null>(null)
  useInsertionEffect(() => {
    currentField.current = { field, ordinaryEvents }
  })
  const [inputFocus] = useState(
    () =>
      new NativeDateFieldParticipantFocusManager(() => {
        const { field, ordinaryEvents } = currentField.current
        const owned = field?.hosts.snapshot(field.state.segments)
        const root = ordinaryEvents.root?.current ?? owned?.root
        return owned && root
          ? { owned, root, scope: owned.root, participants: ordinaryEvents.participants ?? [] }
          : null
      }),
  )
  useInsertionEffect(() => () => inputFocus.retire(), [inputFocus])
  const ordinary = useNativeOrdinaryDateGroup({
    enabled: ordinaryEvents.group,
    disabled: !!field?.state.isDisabled,
    direction: direction ?? "ltr",
    focus: inputFocus,
    admitKey: (target) =>
      (field?.hosts.snapshot(field.state.segments)?.rows.some((row) => row.original === target) ?? false) ||
      (ordinaryEvents.participants?.some((ref) => ref.current === target) ?? false),
    onKeyDown: (event) => {
      if (event.isPropagationStopped()) ordinaryEvents.onNavigationKeyDown?.(event)
    },
  })
  const key = (event: TNativeKeyboardEvent) => {
    if (field?.state.isDisabled) return
    if (event.nativeEvent.phase === "down") native.onKeyDown?.(event)
    else native.onKeyUp?.(event)
    if (!event.isPropagationStopped()) ordinary.key(event)
  }
  const participants = useNativeDateFieldParticipants({
    root: originalRoot,
    participants: [],
    disabled: !!field?.state.isDisabled,
    requiresHost: !!ordinaryEvents.observe || !!(native.onKeyDown || native.onKeyUp),
    key,
  })
  const hosts = field?.hosts
  const bind = useCallback(
    (target: View | null) => {
      setOriginalRoot(target)
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
      <NativeOrdinaryFocusParticipantsContext.Provider value={participants.observes}>
        <NativeFieldInputContext.Provider value={scope ?? null}>
          <NativeFocusHost
            {...native}
            onKeyDown={undefined}
            onKeyUp={undefined}
            nativeOrdinaryGroupKeyHandler={ordinaryEvents.group ? key : undefined}
            onNativeOrdinaryEditorKey={participants.receive}
            {...ordinary.pointer}
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
                ordinaryGroupEvents={ordinaryEvents.group}
                pickerKeyboard
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
      </NativeOrdinaryFocusParticipantsContext.Provider>
    </NativeDateFieldStateContext.Provider>
  )
})
NativePickerInput.displayName = "NativeDateInput"
