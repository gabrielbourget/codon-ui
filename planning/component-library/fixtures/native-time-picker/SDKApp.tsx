import { CalendarDateTime, Time, ZonedDateTime, parseZonedDateTime } from "@internationalized/date"
import { requireNativeModule } from "expo"
import { useCallback, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { findNodeHandle, Pressable, Text, TextInput, View } from "react-native"

import { NUMBER_INTL_PREPARATION } from "../../../../apps/native-showcase/src/runtime/number-format"
import { useNativeDateSegmentEntry } from "../../../../packages/react-native/src/date/entry/useNativeDateSegmentEntry"
import {
  NativeDateSegment,
  type TNativeDateSegmentInput,
  type TNativeDateSegmentRef,
} from "../../../../packages/react-native/src/date/input/NativeDateSegment"
import type { TimeValue } from "../../../../packages/react-native/src/date/state/types"
import type {
  DateFieldState,
  DateSegment,
  DateSegmentType,
} from "../../../../packages/react-native/src/date/state/useDateFieldState"
import { useTimeFieldState } from "../../../../packages/react-native/src/date/state/useTimeFieldState"
import { focusNativeTarget, getNativeFocusedTarget } from "../../../../packages/react-native/src/input/focus"
import { nativeKeyToken } from "../../../../packages/react-native/src/input/keyScope"
import {
  NativeKeyboardScope,
  useNativeKeyPolicy,
  useNativeKeyboardObservation,
  useNativeKeyScope,
} from "../../../../packages/react-native/src/input/NativeKeyboardScope"
import type { TNativeKeyboardEvent } from "../../../../packages/react-native/src/input/types"

import { SOURCE_PRODUCER } from "./identity"
import { createTimeEntryJournal, TIME_ENTRY_PROBE } from "./sdk"

type TController = ReturnType<typeof useNativeDateSegmentEntry>
type TRow = Record<string, unknown>
const valueClass = (value: TimeValue) =>
  value instanceof ZonedDateTime
    ? "ZonedDateTime"
    : value instanceof CalendarDateTime
      ? "CalendarDateTime"
      : value instanceof Time
        ? "Time"
        : "foreign"
const examples: TimeValue[] = [
  new Time(13, 45, 7),
  new CalendarDateTime(2024, 10, 1, 13, 45, 7),
  parseZonedDateTime("2024-10-01T13:45:07[America/New_York]"),
]

type TPartProps = {
  segment: DateSegment
  state: DateFieldState
  locale: string
  ownerId: string
  refs: Map<DateSegmentType, TNativeDateSegmentRef>
  controllers: Map<DateSegmentType, TController>
  record: (row: TRow) => void
  focusPart: (type: DateSegmentType, next: boolean) => void
  onFocus: (type: DateSegmentType, focused: boolean) => void
}
const Part = ({ segment, state, locale, ownerId, refs, controllers, record, focusPart, onFocus }: TPartProps) => {
  const original = useRef<TNativeDateSegmentRef | null>(null)
  const [ready, setReady] = useState(false)
  const entry = useNativeDateSegmentEntry(segment, state, locale, {
    focusNext: () => focusPart(segment.type, true),
    focusPrevious: () => focusPart(segment.type, false),
  })
  useLayoutEffect(() => {
    controllers.set(segment.type, entry)
    return () => {
      if (controllers.get(segment.type) === entry) controllers.delete(segment.type)
    }
  }, [controllers, segment.type, entry])
  const bind = useCallback(
    (target: TNativeDateSegmentRef | null) => {
      original.current = target
      if (target) refs.set(segment.type, target)
      else refs.delete(segment.type)
    },
    [refs, segment.type],
  )
  const input = (event: TNativeDateSegmentInput) => {
    const data = event.nativeEvent
    record({
      kind: "native",
      readonly: state.isReadOnly,
      disabled: state.isDisabled,
      data,
      originalRef: original.current === refs.get(segment.type),
      originalTarget: original.current ? findNodeHandle(original.current) : null,
    })
    if (data.kind === "status") {
      setReady(data.active)
      if (!data.focused) onFocus(segment.type, false)
      return
    }
    if (data.kind === "focus") {
      entry.focus()
      onFocus(segment.type, true)
    } else if (data.kind === "blur") onFocus(segment.type, false)
    else if (data.kind === "insert" || data.kind === "unmark") entry.input(data.text)
    else if (data.kind === "marked") entry.compositionText(data.text)
    else if (data.kind === "delete") entry.backspace()
  }
  return (
    <View>
      <NativeDateSegment
        accessible
        ownerId={ownerId}
        segmentId={segment.type}
        bindingRevision="prototype-1"
        ref={bind}
        displayText={segment.text}
        locale={locale}
        keyboardMode={
          segment.type === "dayPeriod" || segment.type === "era" || !segment.isEditable ? "text" : "numeric"
        }
        segmentDisabled={state.isDisabled}
        segmentReadOnly={state.isReadOnly || !segment.isEditable}
        segmentEditable
        testID={`time-sdk-${segment.type}`}
        accessibilityLabel={`${segment.type} entry`}
        onNativeSegmentInput={input}
        style={{ padding: 12, borderWidth: 1, minWidth: 48, minHeight: 48 }}
      >
        <Text accessible={false} style={{ fontSize: 20 }}>
          {segment.text}
        </Text>
      </NativeDateSegment>
      <Text testID={`time-sdk-${segment.type}-ready`} accessibilityLabel={ready ? "ready" : "waiting"}>
        {ready ? "ready" : "waiting"}
      </Text>
    </View>
  )
}

const Field = () => {
  const ownerId = useId()
  const root = useRef<View | null>(null),
    core = useRef<TextInput | null>(null)
  const [rootTag, setRootTag] = useState(0)
  const [value, setValue] = useState<TimeValue>(examples[0])
  const [classIndex, setClassIndex] = useState(0)
  const [echo, setEcho] = useState(false),
    [readonly, setReadonly] = useState(false),
    [disabled, setDisabled] = useState(false),
    [locale, setLocale] = useState("en-GB")
  const [hidden, setHidden] = useState(false)
  const [focused, setFocused] = useState<DateSegmentType | null>(null),
    [observations, setObservations] = useState(0)
  const requests = useRef<TRow[]>([])
  const refs = useRef(new Map<DateSegmentType, TNativeDateSegmentRef>()),
    controllers = useRef(new Map<DateSegmentType, TController>())
  const [journal] = useState(() =>
    createTimeEntryJournal(SOURCE_PRODUCER, async (encoded) => {
      const fs = requireNativeModule<{
        cacheDirectory: string | null
        writeAsStringAsync: (path: string, text: string, options: { encoding: "utf8" }) => Promise<void>
      }>("ExponentFileSystem")
      if (!fs.cacheDirectory) throw new Error("Original native cache unavailable")
      await fs.writeAsStringAsync(`${fs.cacheDirectory.replace(/\/?$/, "/")}${TIME_ENTRY_PROBE}.jsonl`, encoded, {
        encoding: "utf8",
      })
    }),
  )
  const record = useCallback(
    (row: TRow) => {
      void journal.record(row).catch((error: unknown) => console.warn(`CUI_TIME_SDK_PERSIST ${String(error)}`))
    },
    [journal],
  )
  const state = useTimeFieldState({
    locale,
    value,
    hourCycle: 24,
    granularity: "second",
    shouldForceLeadingZeros: true,
    isReadOnly: readonly,
    isDisabled: disabled,
    onChange: (next) => {
      if (!next) throw new Error("Prototype sequence unexpectedly cleared its value")
      const request = {
        kind: "request",
        value: next.toString(),
        valueClass: valueClass(next),
        held: value.toString(),
        heldClass: valueClass(value),
        echo,
      }
      requests.current.push(request)
      record(request)
      if (echo) setValue(next)
    },
  })
  const scope = useNativeKeyScope()
  useSyncExternalStore(scope?.subscribe ?? (() => () => {}), scope?.snapshot ?? (() => 0), () => 0)
  const focusPart = (type: DateSegmentType, next: boolean) => {
    const parts = state.segments.filter((part) => part.type !== "literal")
    const index = parts.findIndex((part) => part.type === type),
      part = parts[index + (next ? 1 : -1)]
    if (part) {
      const target = refs.current.get(part.type)
      const admitted = target ? focusNativeTarget(target) : false
      record({ kind: "focus-request", from: type, to: part.type, admitted })
    }
  }
  useNativeKeyPolicy({
    tokens: [nativeKeyToken({ key: "ArrowUp", shiftKey: false, ctrlKey: false, altKey: false, metaKey: false })],
    excludeEditable: false,
    excludeComposing: true,
    isEnabled: rootTag > 0 && !disabled && !readonly,
    lifetimeKey: `${ownerId}:${rootTag}:${disabled}:${readonly}`,
    targetTag: rootTag,
    canAct: () => !!getNativeFocusedTarget(),
    onKey: (event: TNativeKeyboardEvent) => {
      record({ kind: "key", data: event.nativeEvent })
      const target = getNativeFocusedTarget()
      for (const [type, ref] of refs.current) if (ref === target) controllers.current.get(type)?.keyDown(event)
    },
  })
  useNativeKeyboardObservation({
    isEnabled: rootTag > 0,
    targetTag: rootTag,
    lifetimeKey: `${ownerId}:observation:${rootTag}`,
    canAct: () => true,
    onKeyDown: (event) => {
      record({ kind: "observation", readonly, disabled, held: value.toString(), data: event.nativeEvent })
      setObservations((current) => current + 1)
    },
  })
  const onFocusPart = useCallback(
    (type: DateSegmentType, isFocused: boolean) =>
      setFocused((current) => (isFocused ? type : current === type ? null : current)),
    [],
  )
  const bindRoot = useCallback((target: View | null) => {
    root.current = target
    setRootTag(target ? (findNodeHandle(target) ?? 0) : 0)
  }, [])
  const snapshot = JSON.stringify({
    intlPreparation: NUMBER_INTL_PREPARATION,
    hidden,
    value: value.toString(),
    valueClass: valueClass(value),
    requests: requests.current,
    readonly,
    disabled,
    locale,
    focused,
    observations,
    scopeReady: scope?.isNativeReady() ?? false,
    coreTarget: core.current ? findNodeHandle(core.current) : null,
  })
  useLayoutEffect(() => record({ kind: "snapshot", data: JSON.parse(snapshot) }), [snapshot, record])
  return (
    <View ref={bindRoot} collapsable={false} style={{ padding: 24, paddingTop: 60, gap: 12 }}>
      <Text>Owned time entry SDK prerequisite</Text>
      <View style={{ flexDirection: "row", alignItems: "center", display: hidden ? "none" : "flex" }}>
        {state.segments.map((segment, index) =>
          segment.type === "literal" ? (
            <Text key={`literal:${index}`}>{segment.text}</Text>
          ) : (
            <Part
              key={segment.type}
              segment={segment}
              state={state}
              locale={locale}
              ownerId={ownerId}
              refs={refs.current}
              controllers={controllers.current}
              record={record}
              focusPart={focusPart}
              onFocus={onFocusPart}
            />
          ),
        )}
      </View>
      <Text testID="time-sdk-snapshot" accessibilityLabel={snapshot}>
        SDK journal snapshot
      </Text>
      <Text testID="time-sdk-scope-ready" accessibilityLabel={scope?.isNativeReady() ? "ready" : "waiting"}>
        {scope?.isNativeReady() ? "ready" : "waiting"}
      </Text>
      <Pressable testID="time-sdk-echo" accessibilityRole="button" onPress={() => setEcho((current) => !current)}>
        <Text>Toggle owner echo</Text>
      </Pressable>
      <Pressable
        testID="time-sdk-readonly"
        accessibilityRole="button"
        onPress={() => setReadonly((current) => !current)}
      >
        <Text>Toggle readonly</Text>
      </Pressable>
      <Pressable testID="time-sdk-hidden" accessibilityRole="button" onPress={() => setHidden((current) => !current)}>
        <Text>Toggle segment visibility</Text>
      </Pressable>
      <Pressable
        testID="time-sdk-disabled"
        accessibilityRole="button"
        onPress={() => setDisabled((current) => !current)}
      >
        <Text>Toggle disabled</Text>
      </Pressable>
      <Pressable
        testID="time-sdk-class"
        accessibilityRole="button"
        onPress={() => {
          const next = (classIndex + 1) % examples.length
          setClassIndex(next)
          setEcho(false)
          setValue(examples[next])
        }}
      >
        <Text>Next value class</Text>
      </Pressable>
      <Pressable
        testID="time-sdk-locale"
        accessibilityRole="button"
        onPress={() => setLocale((current) => (current === "en-GB" ? "ar-EG" : "en-GB"))}
      >
        <Text>Toggle locale</Text>
      </Pressable>
      <TextInput
        ref={core}
        testID="time-sdk-existing-core"
        defaultValue=""
        placeholder="Original independent editor"
        onChangeText={(text) => record({ kind: "core-change", text })}
        style={{ borderWidth: 1, padding: 10 }}
      />
    </View>
  )
}
const SDKApp = () => (
  <NativeKeyboardScope captureEnabled style={{ flex: 1 }}>
    <Field />
  </NativeKeyboardScope>
)
export default SDKApp
