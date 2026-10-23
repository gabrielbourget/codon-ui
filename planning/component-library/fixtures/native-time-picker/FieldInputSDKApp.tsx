import {
  useCallback,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { findNodeHandle, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native"

import { getNativeDateSegmentSemantics } from "../../../../packages/react-native/src/date/entry/semantics"
import { useNativeDateSegmentEntry } from "../../../../packages/react-native/src/date/entry/useNativeDateSegmentEntry"
import {
  NativeDateFieldHostSet,
  nativeDateFieldSegmentId,
} from "../../../../packages/react-native/src/date/field/hostSet"
import {
  NativeDateSegment,
  type TNativeDateSegmentInput,
  type TNativeDateSegmentRef,
} from "../../../../packages/react-native/src/date/input/NativeDateSegment"
import type { DateFieldState, DateSegment } from "../../../../packages/react-native/src/date/state/useDateFieldState"
import { useTimeFieldState } from "../../../../packages/react-native/src/date/state/useTimeFieldState"
import { Time } from "../../../../packages/react-native/src/date/values"
import { useNativeTimeFieldForm } from "../../../../packages/react-native/src/form/useTimeField"
import {
  NativeFieldInputContext,
  moveNativeFieldFocus,
  nativeFieldGroupKeyHandler,
  receiveNativeFieldKey,
  type TNativeFieldInputScope,
  type TNativeFieldKeyEvent,
} from "../../../../packages/react-native/src/input/fieldInput"
import {
  NativeFieldInputSession,
  type TNativeFieldInputPlan,
} from "../../../../packages/react-native/src/input/fieldInputBinding"
import {
  getNativeFieldInputModule,
  takeNativeFieldInputRecords,
} from "../../../../packages/react-native/src/input/fieldInputModule"
import { NativeFocusHost } from "../../../../packages/react-native/src/input/NativeFocusView"
import { NativeKeyboardScope } from "../../../../packages/react-native/src/input/NativeKeyboardScope"
import { NativePressable } from "../../../../packages/react-native/src/input/NativePressable"
import NativeDocument from "../../../../packages/react-native/src/input/specs/NativeCUIFormDocument"
import type { TNativeKeyboardEvent } from "../../../../packages/react-native/src/input/types"
import {
  NativeLocaleProvider,
  useNativeLocale,
} from "../../../../packages/react-native/src/locale/NativeLocaleProvider"

type TRecord = (row: Record<string, unknown>) => void
const frame = { borderWidth: 1, padding: 8, margin: 4 } as const

type TPartProps = {
  segment: DateSegment
  index: number
  state: DateFieldState
  ownerId: string
  name: string
  locale: string
  hosts: NativeDateFieldHostSet
  scope: TNativeFieldInputScope | null
  outerTarget: number
  record: TRecord
}
const Part = ({ segment, index, state, ownerId, name, locale, hosts, scope, outerTarget, record }: TPartProps) => {
  const id = nativeDateFieldSegmentId(segment, index),
    original = useRef<TNativeDateSegmentRef | null>(null),
    active = useRef<TNativeFieldKeyEvent | null>(null)
  const navigate = (kind: "next" | "previous") => {
    if (!active.current || !scope) {
      record({ kind: "failure", gate: "owned-input-focus-phase", field: name, segment: segment.type })
      throw new Error("field-prototype-owned-input-dispatch-required")
    }
    const result = moveNativeFieldFocus(scope, active.current, { groupTarget: outerTarget, kind })
    record({ kind: "entry-focus", field: name, segment: segment.type, result })
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
    name,
  )
  const bind = useCallback(
    (value: TNativeDateSegmentRef | null) => {
      if (original.current) hosts.detach(id, original.current)
      original.current = value
      if (value) hosts.attach(id, value)
    },
    [hosts, id],
  )
  const composing = useRef(false)
  const input = (event: TNativeDateSegmentInput) => {
    if (!original.current) return
    const data = event.nativeEvent
    hosts.receive(id, original.current, data)
    record({ kind: "segment-input", field: name, data, originalTarget: findNodeHandle(original.current) })
    if (data.kind === "focus") entry.focus()
    else if (data.kind === "marked") {
      composing.current = true
      entry.compositionText(data.text)
    } else if (data.kind === "unmark") {
      composing.current = false
      entry.input(data.text)
    } else if (data.kind === "insert") entry.input(data.text)
    else if (data.kind === "delete") entry.backspace()
    else if (data.kind === "blur" || (data.kind === "status" && !data.active)) composing.current = false
  }
  if (segment.type === "literal") return <Text accessible={false}>{segment.text}</Text>
  return (
    <NativeDateSegment
      ref={bind}
      ownerId={ownerId}
      segmentId={id}
      bindingRevision={`${ownerId}:${id}`}
      testID={`${name}-${segment.type}`}
      displayText={segment.text}
      locale={locale}
      keyboardMode={segment.type === "dayPeriod" ? "text" : "numeric"}
      segmentEditable
      segmentDisabled={state.isDisabled}
      segmentReadOnly={state.isReadOnly || !segment.isEditable}
      segmentPlaceholder={segment.isPlaceholder}
      accessible
      role={semantics.role === "spinbutton" ? "spinbutton" : undefined}
      accessibilityLabel={semantics.label}
      accessibilityState={{ disabled: state.isDisabled }}
      accessibilityValue={{ text: semantics.textValue ?? undefined }}
      onNativeSegmentInput={input}
      onNativeFieldKey={(raw) => {
        const target = original.current && findNodeHandle(original.current)
        if (!scope || !target) return
        const event = raw as TNativeFieldKeyEvent
        receiveNativeFieldKey(scope, event, {
          target,
          group: false,
          run: () => {
            active.current = event
            try {
              record({ kind: "segment-key", field: name, data: event.nativeEvent })
              entry.keyDown(event, composing.current)
            } finally {
              active.current = null
            }
          },
        })
      }}
      style={frame}
    >
      <Text>{segment.text}</Text>
    </NativeDateSegment>
  )
}

type TFieldProps = {
  name: string
  record: TRecord
  disabled: boolean
  readonly: boolean
  echo: boolean
  veto: boolean
  stop: boolean
  revision: number
  nested?: boolean
  removeOnKey?: boolean
  onRemove?: () => void
}
const Field = ({
  name,
  record,
  disabled,
  readonly,
  echo,
  veto,
  stop,
  revision,
  nested = false,
  removeOnKey = false,
  onRemove,
}: TFieldProps) => {
  const ownerId = useId(),
    { locale, direction } = useNativeLocale()
  const [value, setValue] = useState(new Time(nested ? 8 : 13, nested ? 15 : 45))
  const currentConfig = useRef({ echo, value })
  useInsertionEffect(() => {
    currentConfig.current = { echo, value }
  })
  const onChange = useCallback(
    (next: Time | null) => {
      record({
        kind: "value-request",
        field: name,
        value: next?.toString() ?? null,
        held: currentConfig.current.value.toString(),
        echo: currentConfig.current.echo,
      })
      if (next && currentConfig.current.echo) setValue(next)
    },
    [name, record],
  )
  const state = useTimeFieldState({
    locale,
    value,
    onChange,
    hourCycle: 24,
    granularity: "minute",
    isDisabled: disabled,
    isReadOnly: readonly,
  })
  const currentState = useRef(state)
  useInsertionEffect(() => {
    currentState.current = state
  })
  const [hosts] = useState(() => new NativeDateFieldHostSet())
  useSyncExternalStore(hosts.subscribe, hosts.version, hosts.version)
  const [outer, setOuter] = useState<View | null>(null),
    [input, setInput] = useState<View | null>(null)
  const bindOuter = useCallback(
    (node: View | null) => {
      hosts.root(node, node ? (findNodeHandle(node) ?? 0) : 0)
      setOuter(node)
    },
    [hosts],
  )
  const original = hosts.snapshot(state.segments)
  const currentOriginal = useCallback(() => {
    const snapshot = hosts.snapshot(currentState.current.segments)
    return snapshot ? { root: snapshot.root, rootTarget: snapshot.rootTarget, segments: snapshot.rows } : null
  }, [hosts])
  const [session] = useState(() => {
    if (!NativeDocument) throw new Error("field-input-document-module-unavailable")
    return new NativeFieldInputSession(getNativeFieldInputModule(), NativeDocument)
  })
  const bindingVersion = useSyncExternalStore(session.subscribe, session.version, session.version)
  useLayoutEffect(() => {
    record({ kind: "binding-status", field: name, ...session.status() })
  }, [session, bindingVersion, record, name])
  const originalSignature = JSON.stringify(original?.rows.map((row) => row.identity))
  const outerTarget = outer ? (findNodeHandle(outer) ?? 0) : 0,
    inputTarget = input ? (findNodeHandle(input) ?? 0) : 0
  const firstOriginalTarget = original?.rows[0].identity.target ?? 0
  const lifetime = JSON.stringify([originalSignature, disabled, readonly, locale, veto, stop, revision, removeOnKey])
  const plan = useMemo<TNativeFieldInputPlan | null>(
    () =>
      firstOriginalTarget && outer && input && outerTarget && inputTarget
        ? Object.freeze({
            bindingId: ownerId,
            bindingRevision: `${ownerId}:group:${lifetime}`,
            outer,
            outerTarget,
            input,
            inputTarget,
            originalTarget: firstOriginalTarget,
          })
        : null,
    [ownerId, outer, input, outerTarget, inputTarget, firstOriginalTarget, lifetime],
  )
  useInsertionEffect(() => {
    session.configure(plan)
  }, [session, plan])
  useInsertionEffect(() => () => session.retire(), [session])
  const scope = useMemo(() => (plan ? session.scope(plan) : null), [session, plan])
  const focused = useRef(false)
  const metadata = useNativeTimeFieldForm(
    { name },
    state,
    original ? { root: original.root, rootTarget: original.rootTarget, segments: original.rows } : null,
    currentOriginal,
    () => focused.current,
    "",
    {
      ...session.metadataFor(plan),
      record: (event) =>
        record({ kind: "native-field-input", field: name, data: JSON.parse(event.nativeEvent.record) }),
    },
  )
  const caller = useCallback(
    (event: TNativeKeyboardEvent) => {
      record({
        kind: "field-key",
        field: name,
        revision,
        data: event.nativeEvent,
        prevented: event.defaultPrevented,
        stopped: event.isPropagationStopped(),
      })
      if (veto) event.preventDefault()
      if (removeOnKey && event.nativeEvent.phase === "down") {
        event.preventDefault()
        onRemove?.()
      }
    },
    [record, name, veto, revision, removeOnKey, onRemove],
  )
  const group = scope ? nativeFieldGroupKeyHandler(scope, { direction, onKeyDown: caller, onKeyUp: caller }) : undefined
  return (
    <NativeFieldInputContext.Provider value={scope}>
      <NativeFocusHost
        ref={bindOuter}
        focusable={false}
        testID={`${name}-outer`}
        nativeFieldGroupHandler={group}
        nativeFocusWithinObservation
        nativeOnFocusWithin={(event) => {
          focused.current = event.nativeEvent.within
          record({ kind: "field-focus", field: name, data: event.nativeEvent })
        }}
        style={frame}
      >
        {metadata}
        <Text>
          {name}: {value.toString()}
        </Text>
        <Text testID={`${name}-binding`} accessibilityLabel={JSON.stringify(session.status())}>
          {JSON.stringify(session.status())}
        </Text>
        <NativeFocusHost
          ref={setInput}
          focusable={false}
          testID={`${name}-input`}
          nativeFieldGroupHandler={group}
          style={{ flexDirection: "row" }}
        >
          {state.segments.map((segment, index) => (
            <Part
              key={nativeDateFieldSegmentId(segment, index)}
              segment={segment}
              index={index}
              state={state}
              ownerId={ownerId}
              name={name}
              locale={locale}
              hosts={hosts}
              scope={scope}
              outerTarget={outerTarget}
              record={record}
            />
          ))}
        </NativeFocusHost>
        <NativePressable
          testID={`${name}-button`}
          onKeyDown={(event) => {
            record({ kind: "child-key", field: name, data: event.nativeEvent })
            if (stop) event.stopPropagation()
          }}
          onPress={() => record({ kind: "child-press", field: name })}
          style={frame}
        >
          <Text>Authored action</Text>
        </NativePressable>
        <NativePressable testID={`${name}-negative-tab`} tabIndex={-1} style={frame}>
          <Text>Programmatic action</Text>
        </NativePressable>
        <TextInput
          testID={`${name}-core-editor`}
          defaultValue=""
          accessibilityLabel={`${name} original core editor`}
          onKeyPress={(event) => record({ kind: "core-key", field: name, data: event.nativeEvent })}
          onChangeText={(text) => record({ kind: "core-change", field: name, text })}
          style={frame}
        />
        {!nested && (
          <Field
            name="inner"
            record={record}
            disabled={false}
            readonly={false}
            echo={echo}
            veto={veto}
            stop={stop}
            revision={revision}
            nested
          />
        )}
      </NativeFocusHost>
    </NativeFieldInputContext.Provider>
  )
}

export const FieldInputSDKScene = ({ record }: { record: TRecord }) => {
  const [disabled, setDisabled] = useState(false),
    [readonly, setReadonly] = useState(false),
    [echo, setEcho] = useState(true),
    [veto, setVeto] = useState(false),
    [stop, setStop] = useState(false),
    [revision, setRevision] = useState(0),
    [locale, setLocale] = useState("en-GB"),
    [visible, setVisible] = useState(true),
    [removeOnKey, setRemoveOnKey] = useState(false)
  const removeField = useCallback(() => setVisible(false), [])
  return (
    <NativeLocaleProvider locale={locale}>
      <NativeKeyboardScope captureEnabled style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text>Original field input prototype</Text>
          {visible && (
            <Field
              name="outer"
              record={record}
              disabled={disabled}
              readonly={readonly}
              echo={echo}
              veto={veto}
              stop={stop}
              revision={revision}
              removeOnKey={removeOnKey}
              onRemove={removeField}
            />
          )}
          {[
            ["unmount", () => setRemoveOnKey((value) => !value)],
            ["show", () => setVisible(true)],
            ["receipts", () => record({ kind: "native-receipts", ...takeNativeFieldInputRecords() })],
            ["disabled", () => setDisabled((value) => !value)],
            ["readonly", () => setReadonly((value) => !value)],
            ["echo", () => setEcho((value) => !value)],
            ["veto", () => setVeto((value) => !value)],
            ["stop", () => setStop((value) => !value)],
            ["callback", () => setRevision((value) => value + 1)],
            ["locale", () => setLocale((value) => (value === "en-GB" ? "ar-EG" : "en-GB"))],
          ].map(([name, action]) => (
            <Pressable key={name as string} testID={`field-sdk-${name}`} onPress={action as () => void} style={frame}>
              <Text>{name as string}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </NativeKeyboardScope>
    </NativeLocaleProvider>
  )
}
