import { useCallback, useRef, useState } from "react"
import { findNodeHandle, Platform, Text, type TextStyle } from "react-native"

import {
  activeNativeFieldInputEvent,
  moveNativeFieldFocus,
  receiveNativeFieldKey,
  type TNativeFieldInputScope,
  type TNativeFieldKeyEvent,
} from "../../input/fieldInput"
import { getNativeDateSegmentSemantics } from "../entry/semantics"
import { useNativeDateSegmentEntry } from "../entry/useNativeDateSegmentEntry"
import { NativeDateSegment, type TNativeDateSegmentInput, type TNativeDateSegmentRef } from "../input/NativeDateSegment"
import type { DateFieldState, DateSegment } from "../state/useDateFieldState"

import type { getNativeTimePickerAppearance } from "./appearance"
import type { NativeDateFieldHostSet } from "./hostSet"

type TProps = {
  ownerId: string
  segmentId: string
  segment: DateSegment
  state: DateFieldState
  locale: string
  direction: "ltr" | "rtl"
  hostSet: NativeDateFieldHostSet
  scope: TNativeFieldInputScope | null
  outerTarget: number
  appearance: Pick<
    ReturnType<typeof getNativeTimePickerAppearance>,
    "text" | "placeholder" | "segment" | "focusedSegment"
  >
  inheritedText: TextStyle
  label?: string
  testID: string
}

// The fixed Codon wrapper renders each formatter segment. Literal separators
// use the same visual surface but never become duplicate editable targets.
export const NativeTimePickerSegment = (props: TProps) => {
  const {
    segment,
    state,
    locale,
    direction,
    ownerId,
    segmentId,
    hostSet,
    scope,
    outerTarget,
    appearance,
    inheritedText,
    testID,
  } = props
  const original = useRef<TNativeDateSegmentRef | null>(null)
  const [focused, setFocused] = useState(false)
  const composing = useRef(false)
  const navigate = (kind: "next" | "previous") => {
    const event = scope && activeNativeFieldInputEvent(scope)
    if (!scope || !event) throw new Error("time-field-original-input-dispatch-required")
    moveNativeFieldFocus(scope, event, { groupTarget: outerTarget, kind })
  }
  const entry = useNativeDateSegmentEntry(segment, state, locale, {
    focusNext: () => navigate("next"),
    focusPrevious: () => navigate("previous"),
  })
  const semantics = getNativeDateSegmentSemantics(
    segment,
    state,
    entry.textValue,
    locale,
    Platform.OS === "ios" ? "ios" : "android",
    props.label,
  )
  const bind = useCallback(
    (value: TNativeDateSegmentRef | null) => {
      const previous = original.current
      if (previous) hostSet.detach(segmentId, previous)
      original.current = value
      if (value) hostSet.attach(segmentId, value)
    },
    [hostSet, segmentId],
  )
  const receive = (event: TNativeDateSegmentInput) => {
    if (!original.current) return
    const data = event.nativeEvent
    hostSet.receive(segmentId, original.current, data)
    if (data.kind === "status") {
      if (!data.active || !data.focused) {
        setFocused(false)
        composing.current = false
      }
    } else if (data.kind === "focus") {
      setFocused(true)
      entry.focus()
    } else if (data.kind === "blur") {
      setFocused(false)
      composing.current = false
    } else if (data.kind === "marked") {
      composing.current = true
      entry.compositionText(data.text)
    } else if (data.kind === "unmark") {
      composing.current = false
      entry.input(data.text)
    } else if (data.kind === "insert") entry.input(data.text)
    else if (data.kind === "delete") entry.backspace()
  }
  const numeric = state.dateFormatter.resolvedOptions()[segment.type as "hour" | "minute" | "second"]
  const text = (
    <Text
      accessible={false}
      style={[
        inheritedText,
        appearance.text,
        segment.isPlaceholder ? appearance.placeholder : undefined,
        direction === "rtl" && (numeric === "numeric" || numeric === "2-digit")
          ? { writingDirection: "ltr" }
          : undefined,
      ]}
    >
      {segment.text}
    </Text>
  )
  if (semantics.hidden)
    return (
      <Text testID={testID} accessible={false} style={[appearance.segment, inheritedText, appearance.text]}>
        {segment.text}
      </Text>
    )
  return (
    <NativeDateSegment
      ref={bind}
      ownerId={ownerId}
      segmentId={segmentId}
      bindingRevision={`${ownerId}:${segmentId}`}
      displayText={segment.text}
      locale={locale}
      keyboardMode={segment.type === "dayPeriod" || segment.type === "era" || !segment.isEditable ? "text" : "numeric"}
      segmentDisabled={state.isDisabled}
      segmentReadOnly={state.isReadOnly || !segment.isEditable}
      segmentEditable
      segmentPlaceholder={segment.isPlaceholder}
      accessible
      role={semantics.role === "spinbutton" ? "spinbutton" : undefined}
      accessibilityLabel={semantics.label}
      accessibilityState={{ disabled: state.isDisabled }}
      accessibilityValue={
        semantics.role === "spinbutton"
          ? {
              min: semantics.minimum ?? undefined,
              max: semantics.maximum ?? undefined,
              now: semantics.value ?? undefined,
              text: semantics.textValue ?? undefined,
            }
          : undefined
      }
      aria-readonly={semantics.isReadOnly}
      aria-required={semantics.isRequired}
      aria-invalid={state.isInvalid}
      accessibilityActions={
        state.isDisabled || state.isReadOnly || !segment.isEditable
          ? []
          : [{ name: "increment" }, { name: "decrement" }]
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") entry.adjust("increment")
        else if (event.nativeEvent.actionName === "decrement") entry.adjust("decrement")
      }}
      onNativeSegmentInput={receive}
      onNativeFieldKey={(raw) => {
        const target = original.current && findNodeHandle(original.current)
        if (!scope || !target) return
        const event = raw as unknown as TNativeFieldKeyEvent
        receiveNativeFieldKey(scope, event, {
          target,
          group: false,
          run: () => {
            if (event.nativeEvent.phase === "down") entry.keyDown(event, composing.current)
          },
        })
      }}
      testID={testID}
      style={[appearance.segment, focused ? appearance.focusedSegment : undefined]}
    >
      {text}
    </NativeDateSegment>
  )
}
