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
import { findNodeHandle, Platform, Pressable, ScrollView, Text, TextInput, View, type PointerEvent } from "react-native"

import { NUMBER_INTL_PREPARATION } from "../../../../apps/native-showcase/src/runtime/number-format"
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
import type { TimeValue } from "../../../../packages/react-native/src/date/state/types"
import { useTimeFieldState } from "../../../../packages/react-native/src/date/state/useTimeFieldState"
import { Time } from "../../../../packages/react-native/src/date/values"
import { useNativeTimeFieldForm } from "../../../../packages/react-native/src/form/useTimeField"
import {
  NativeFieldInputContext,
  moveNativeFieldFocus,
  activeNativeFieldInputEvent,
  nativeFieldGroupKeyHandler,
  receiveNativeFieldKey,
  type TNativeFieldInputScope,
  type TNativeFieldKeyEvent,
  type TNativeFieldPointerEvent,
} from "../../../../packages/react-native/src/input/fieldInput"
import { useNativeFieldGroupPress } from "../../../../packages/react-native/src/input/useFieldGroupPress"
import {
  NativeFieldInputSession,
  type TNativeFieldInputPlan,
} from "../../../../packages/react-native/src/input/fieldInputBinding"
import {
  getNativeFieldInputModule,
  takeNativeFieldInputRecords,
} from "../../../../packages/react-native/src/input/fieldInputModule"
import { NativeFocusHost } from "../../../../packages/react-native/src/input/NativeFocusView"
import {
  NativeKeyboardScope,
  useNativeKeyboardObservation,
  useNativeKeyScope,
} from "../../../../packages/react-native/src/input/NativeKeyboardScope"
import { NativePressable } from "../../../../packages/react-native/src/input/NativePressable"
import NativeDocument from "../../../../packages/react-native/src/input/specs/NativeCUIFormDocument"
import type { TNativeKeyboardEvent } from "../../../../packages/react-native/src/input/types"
import {
  NativeLocaleProvider,
  useNativeLocale,
} from "../../../../packages/react-native/src/locale/NativeLocaleProvider"

import { TIME_ENTRY_VALUES, timeEntryValueClass } from "./sdk"

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
    original = useRef<TNativeDateSegmentRef | null>(null)
  const navigate = (kind: "next" | "previous") => {
    const event = scope && activeNativeFieldInputEvent(scope)
    if (!event || !scope) {
      record({ kind: "failure", gate: "owned-input-focus-phase", field: name, segment: segment.type })
      throw new Error("field-prototype-owned-input-dispatch-required")
    }
    const result = moveNativeFieldFocus(scope, event, { groupTarget: outerTarget, kind })
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
            record({ kind: "segment-key", field: name, data: event.nativeEvent })
            entry.keyDown(event, composing.current)
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
  value: TimeValue
  onOwnerValueChange: (value: TimeValue) => void
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
  value,
  onOwnerValueChange,
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
  const [nestedValue, setNestedValue] = useState<TimeValue>(() => new Time(8, 15))
  const currentConfig = useRef({ echo, value, onOwnerValueChange })
  useInsertionEffect(() => {
    currentConfig.current = { echo, value, onOwnerValueChange }
  })
  const onChange = useCallback(
    (next: TimeValue | null) => {
      record({
        kind: "value-request",
        field: name,
        value: next?.toString() ?? null,
        valueClass: next ? timeEntryValueClass(next) : null,
        held: currentConfig.current.value.toString(),
        heldClass: timeEntryValueClass(currentConfig.current.value),
        echo: currentConfig.current.echo,
      })
      if (next && currentConfig.current.echo) currentConfig.current.onOwnerValueChange(next)
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
  const keyboardScope = useNativeKeyScope()
  useSyncExternalStore(keyboardScope?.subscribe ?? (() => () => {}), keyboardScope?.snapshot ?? (() => 0), () => 0)
  useNativeKeyboardObservation({
    targetTag: firstOriginalTarget,
    isEnabled: firstOriginalTarget > 0,
    lifetimeKey: `${ownerId}:original-key-observation:${firstOriginalTarget}`,
    canAct: () => keyboardScope?.isNativeReady() === true && keyboardScope.isWindowActive() !== false,
    onKeyDown: (event) =>
      record({ kind: "field-observed-key", field: name, disabled, readonly, data: event.nativeEvent }),
  })
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
  const snapshot = JSON.stringify({
    field: name,
    value: value.toString(),
    valueClass: timeEntryValueClass(value),
    locale,
    direction,
    intlPreparation: NUMBER_INTL_PREPARATION,
    disabled,
    readonly,
    echo,
    veto,
    stop,
    revision,
    outerTarget,
    inputTarget,
    originalSegments: original?.rows.map((row) => row.identity) ?? [],
    binding: session.status(),
    keyboardReady: keyboardScope?.isNativeReady() ?? false,
  })
  useLayoutEffect(() => record({ kind: "field-state", ...JSON.parse(snapshot) }), [record, snapshot])
  const receiverTarget = useRef(0)
  const caller = useCallback(
    (event: TNativeKeyboardEvent) => {
      record({
        kind: "field-key",
        field: name,
        revision,
        receiverTarget: receiverTarget.current,
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
  const receiveGroup = group
    ? (event: TNativeFieldKeyEvent, target: number) => {
        const previous = receiverTarget.current
        receiverTarget.current = target
        try {
          return group(event, target)
        } finally {
          receiverTarget.current = previous
        }
      }
    : undefined
  const pointerCaller = useCallback(
    (event: TNativeFieldPointerEvent) => {
      record({
        kind: "group-pointer",
        field: name,
        revision,
        data: event.nativeEvent,
        prevented: event.defaultPrevented,
        stopped: event.isPropagationStopped(),
      })
    },
    [record, name, revision],
  )
  const pointerGroup = useNativeFieldGroupPress({
    scope,
    onPointerDown: pointerCaller,
    onPointerUp: pointerCaller,
    onPointerCancel: pointerCaller,
    onClick: pointerCaller,
  })
  const rootPointerCaller = (phase: string, event: PointerEvent) => {
    record({
      kind: "field-pointer",
      field: name,
      revision,
      phase,
      data: event.nativeEvent,
      prevented: event.defaultPrevented,
      stopped: event.isPropagationStopped(),
    })
    if (veto) event.preventDefault()
  }
  return (
    <NativeFieldInputContext.Provider value={scope}>
      <View
        testID={`${name}-root`}
        onPointerDown={(event) => rootPointerCaller("down", event)}
        onPointerUp={(event) => rootPointerCaller("up", event)}
        onPointerCancel={(event) => rootPointerCaller("cancel", event)}
      >
        <NativeFocusHost
          ref={bindOuter}
          focusable={false}
          testID={`${name}-outer`}
          nativeFieldGroupHandler={receiveGroup}
          nativeFieldGroupPointerHandler={pointerGroup}
          nativeFocusWithinObservation
          nativeOnFocusWithin={(event) => {
            focused.current = event.nativeEvent.within
            record({ kind: "field-focus", field: name, data: event.nativeEvent })
          }}
          style={frame}
        >
          {metadata}
          <Text testID={`${name}-value`} accessibilityLabel={snapshot}>
            {name}: {value.toString()}
          </Text>
          <Text testID={`${name}-binding`} accessibilityLabel={JSON.stringify(session.status())}>
            {JSON.stringify(session.status())}
          </Text>
          <NativeFocusHost
            ref={setInput}
            focusable={false}
            testID={`${name}-input`}
            nativeFieldGroupHandler={receiveGroup}
            nativeFieldGroupPointerHandler={pointerGroup}
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
            onPointerDown={(event) => {
              record({ kind: "child-pointer", field: name, data: event.nativeEvent })
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
              value={nestedValue}
              onOwnerValueChange={setNestedValue}
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
      </View>
    </NativeFieldInputContext.Provider>
  )
}

export const FieldInputSDKScene = ({ record }: { record: TRecord }) => {
  const [value, setValue] = useState<TimeValue>(() => new Time(13, 45))
  const requests = useRef<Record<string, unknown>[]>([])
  const observations = useRef<Record<string, unknown>[]>([])
  const [observationSnapshot, setObservationSnapshot] = useState("{}")
  const receive = useCallback(
    (row: Record<string, unknown>) => {
      if (row.kind === "value-request") requests.current.push(row)
      if (row.kind === "field-observed-key") {
        observations.current.push(row)
        setObservationSnapshot(JSON.stringify(row))
      }
      record(row)
    },
    [record],
  )
  const [receiptSnapshot, setReceiptSnapshot] = useState("{}")
  const receiptBatches = useRef(0)
  const receipts = () => {
    const batch = takeNativeFieldInputRecords()
    receive({ kind: "native-receipts", ...batch })
    const frames = batch.records
      .filter((row) => ["key", "pointer", "input"].includes(String(row.kind)))
      .map((row) => {
        const event = row.event as Record<string, unknown> | undefined
        const dispatch = typeof event?.fieldDispatch === "string" ? JSON.parse(event.fieldDispatch) : null
        const before = row.before as Record<string, unknown> | null
        const after = row.after as Record<string, unknown> | null
        return {
          kind: row.kind,
          identity: row.identity ?? null,
          token: dispatch?.token ?? null,
          key: event?.key ?? null,
          phase: dispatch?.phase ?? null,
          decision: row.decision ?? null,
          deliveryStarted: row.deliveryStarted === true,
          deliveryReturned: row.deliveryReturned === true,
          renderPhasesComplete: row.renderPhasesComplete === true,
          scopeCurrent: row.scopeCurrent === true,
          beforeFocusedTarget: before?.focusedTarget ?? null,
          afterFocusedTarget: after?.focusedTarget ?? null,
          error: row.error ?? "missing-native-frame-error",
        }
      })
    const failures = batch.records.filter((row) => row.kind === "failure")
    setReceiptSnapshot(
      JSON.stringify({
        batch: ++receiptBatches.current,
        dropped: batch.dropped,
        frames,
        failures,
        requests: requests.current,
        observations: observations.current,
      }),
    )
  }
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
        <Text testID="field-sdk-observation-snapshot" accessibilityLabel={observationSnapshot}>
          Original passive key observation
        </Text>
        <Text testID="field-sdk-receipt-snapshot" accessibilityLabel={receiptSnapshot}>
          Native receipt batches: {receiptBatches.current}
        </Text>
        <Pressable testID="field-sdk-checkpoint" onPress={receipts} style={frame}>
          <Text>Check original receipts</Text>
        </Pressable>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          contentContainerStyle={{ padding: 20 }}
        >
          <Text>Original field input prototype</Text>
          {visible && (
            <Field
              name="outer"
              value={value}
              onOwnerValueChange={setValue}
              record={receive}
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
            ["time", () => setValue(TIME_ENTRY_VALUES[0])],
            ["calendar", () => setValue(TIME_ENTRY_VALUES[1])],
            ["zoned", () => setValue(TIME_ENTRY_VALUES[2])],
            ["unmount", () => setRemoveOnKey((value) => !value)],
            ["show", () => setVisible(true)],
            ["receipts", receipts],
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
