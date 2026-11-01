import { useCallback, useRef, useState } from "react"
import { Platform, Text, type TextStyle } from "react-native"

import { getNativeDateSegmentSemantics } from "../entry/semantics"
import { useNativeDateSegmentEntry } from "../entry/useNativeDateSegmentEntry"
import { NativeDateSegment, type TNativeDateSegmentInput, type TNativeDateSegmentRef } from "../input/NativeDateSegment"
import type { DateFieldState, DateSegment } from "../state/useDateFieldState"

import type { getNativeTimePickerAppearance } from "./appearance"
import type { NativeDateFieldFocusManager } from "./focus"
import type { NativeDateFieldHostSet } from "./hostSet"

type TProps = {
  ownerId: string
  segmentId: string
  segment: DateSegment
  state: DateFieldState
  locale: string
  direction: "ltr" | "rtl"
  hostSet: NativeDateFieldHostSet
  inputFocus?: Pick<NativeDateFieldFocusManager, "focusFromInput">
  ordinaryGroupEvents?: boolean
  pickerKeyboard?: boolean
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
    inputFocus,
    appearance,
    inheritedText,
    testID,
  } = props
  const original = useRef<TNativeDateSegmentRef | null>(null)
  const [focused, setFocused] = useState(false)
  const composing = useRef(false)
  const inputOrigin = useRef<TNativeDateSegmentRef | null>(null)
  const navigate = (kind: "next" | "previous") => {
    if (inputFocus && inputOrigin.current) {
      inputFocus.focusFromInput(inputOrigin.current, kind)
      return
    }
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
    const previousInputOrigin = inputOrigin.current
    inputOrigin.current = inputFocus ? original.current : null
    try {
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
    } finally {
      inputOrigin.current = previousInputOrigin
    }
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
      ordinaryInputEvents={!!inputFocus}
      ordinaryGroupEvents={props.ordinaryGroupEvents}
      pickerKeyboard={props.pickerKeyboard}
      onNativeDateKey={(event) => {
        const previous = inputOrigin.current
        inputOrigin.current = original.current
        try {
          if (event.nativeEvent.phase === "down") entry.keyDown(event, event.nativeEvent.isComposing)
        } finally {
          inputOrigin.current = previous
        }
      }}
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
      testID={testID}
      style={[appearance.segment, focused ? appearance.focusedSegment : undefined]}
    >
      {text}
    </NativeDateSegment>
  )
}
