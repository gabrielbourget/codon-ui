import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { findNodeHandle, Platform, Pressable, ScrollView, Text, TextInput, View, type PointerEvent } from "react-native"
import { Portal, PortalHost, PortalProvider } from "react-native-teleport"

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
import { TimePicker as NativeTimePickerRenderer } from "@codon-ui/react-native"
import { NativeTimeFieldStateContext } from "../../../../packages/react-native/src/date/field/context"
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
import { type TNativeFieldInputPlan } from "../../../../packages/react-native/src/input/fieldInputBinding"
import { takeNativeFieldInputRecords } from "../../../../packages/react-native/src/input/fieldInputModule"
import { NativeFocusHost } from "../../../../packages/react-native/src/input/NativeFocusView"
import {
  NativeKeyboardScope,
  useNativeKeyboardObservation,
  useNativeKeyScope,
} from "../../../../packages/react-native/src/input/NativeKeyboardScope"
import { NativePressable } from "../../../../packages/react-native/src/input/NativePressable"
import { focusNativeTarget } from "../../../../packages/react-native/src/input/focus"
import { useNativeFieldInputBinding } from "../../../../packages/react-native/src/input/useFieldInputBinding"
import type { TNativeKeyboardEvent } from "../../../../packages/react-native/src/input/types"
import {
  NativeLocaleProvider,
  useNativeLocale,
} from "../../../../packages/react-native/src/locale/NativeLocaleProvider"

import { TIME_ENTRY_VALUES, timeEntryValueClass } from "./sdk"

type TRecord = (row: Record<string, unknown>) => void
const COMMAND_MODES = ["none", "original-only", "mixed"] as const
type TCommandMode = (typeof COMMAND_MODES)[number]
const MUTATIONS = ["none", "callback", "disabled", "readonly", "layout", "unmount"] as const
type TMutation = (typeof MUTATIONS)[number]
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
  value: TimeValue | null
  onOwnerValueChange: (value: TimeValue | null) => void
  record: TRecord
  disabled: boolean
  readonly: boolean
  echo: boolean
  veto: boolean
  stop: boolean
  revision: number
  commandMode?: TCommandMode
  onButtonRef?: (target: View | null) => void
  portaled?: boolean
  mutation?: TMutation
  layoutRevision?: number
  onMutation?: (mutation: TMutation) => void
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
  commandMode = "none",
  onButtonRef,
  portaled = false,
  mutation = "none",
  layoutRevision = 0,
  onMutation,
  nested = false,
  removeOnKey = false,
  onRemove,
}: TFieldProps) => {
  const ownerId = useId(),
    { locale, direction } = useNativeLocale()
  const [nestedValue, setNestedValue] = useState<TimeValue | null>(() => new Time(8, 15))
  const originalCore = useRef<TextInput | null>(null)
  const originalButton = useRef<View | null>(null)
  const bindButton = useCallback(
    (target: View | null) => {
      originalButton.current = target
      onButtonRef?.(target)
    },
    [onButtonRef],
  )
  const [observedFocusTarget, setObservedFocusTarget] = useState(0)
  const [commandTransactions, setCommandTransactions] = useState(0)
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
        held: currentConfig.current.value?.toString() ?? null,
        heldClass: currentConfig.current.value ? timeEntryValueClass(currentConfig.current.value) : null,
        echo: currentConfig.current.echo,
      })
      if (currentConfig.current.echo) currentConfig.current.onOwnerValueChange(next)
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
  const lifetime = JSON.stringify([
    originalSignature,
    disabled,
    readonly,
    locale,
    veto,
    stop,
    revision,
    removeOnKey,
    mutation,
  ])
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
  const inputBinding = useNativeFieldInputBinding(plan)
  const { scope } = inputBinding
  const bindingStatus = JSON.stringify(inputBinding.status)
  useLayoutEffect(() => {
    record({ kind: "binding-status", field: name, ...JSON.parse(bindingStatus) })
  }, [bindingStatus, record, name])
  const focused = useRef(false)
  const metadata = useNativeTimeFieldForm(
    { name },
    state,
    original ? { root: original.root, rootTarget: original.rootTarget, segments: original.rows } : null,
    currentOriginal,
    () => focused.current,
    "",
    {
      ...inputBinding.metadata,
      record: (event) =>
        record({ kind: "native-field-input", field: name, data: JSON.parse(event.nativeEvent.record) }),
    },
  )
  const snapshot = JSON.stringify({
    field: name,
    value: value?.toString() ?? null,
    valueClass: value ? timeEntryValueClass(value) : null,
    locale,
    direction,
    intlPreparation: NUMBER_INTL_PREPARATION,
    disabled,
    readonly,
    echo,
    veto,
    stop,
    revision,
    mutation,
    layoutRevision,
    commandMode,
    commandTransactions,
    coreTarget: originalCore.current ? findNodeHandle(originalCore.current) : null,
    buttonTarget: originalButton.current ? findNodeHandle(originalButton.current) : null,
    portaled,
    observedFocusTarget,
    outerTarget,
    inputTarget,
    originalSegments: original?.rows.map((row) => row.identity) ?? [],
    placeholderSegments: state.segments.filter((segment) => segment.isPlaceholder).map((segment) => segment.type),
    binding: inputBinding.status,
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
      if (
        mutation !== "none" &&
        event.nativeEvent.phase === "down" &&
        event.nativeEvent.key === "m" &&
        receiverTarget.current === outerTarget
      ) {
        event.preventDefault()
        record({ kind: "mutation-call", field: name, mutation, revision, data: event.nativeEvent })
        onMutation?.(mutation)
        record({ kind: "mutation-return", field: name, mutation, revision, data: event.nativeEvent })
      }
      if (
        commandMode !== "none" &&
        event.nativeEvent.phase === "down" &&
        event.nativeEvent.key === "f" &&
        receiverTarget.current === outerTarget
      ) {
        event.preventDefault()
        const core = originalCore.current
        if (!core) throw new Error("field-prototype-original-core-ref-missing")
        const focus = core.focus
        record({
          kind: "original-command-call",
          field: name,
          mode: commandMode,
          command: "focus",
          target: findNodeHandle(core),
          data: event.nativeEvent,
        })
        if (commandMode === "mixed") setCommandTransactions((count) => count + 1)
        core.focus()
        record({
          kind: "original-command-return",
          field: name,
          mode: commandMode,
          command: "focus",
          target: findNodeHandle(core),
          sameRef: originalCore.current === core,
          sameMethod: core.focus === focus,
          data: event.nativeEvent,
        })
      }
      if (removeOnKey && event.nativeEvent.phase === "down") {
        event.preventDefault()
        onRemove?.()
      }
    },
    [record, name, veto, revision, removeOnKey, onRemove, commandMode, outerTarget, mutation, onMutation],
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
        receiverTarget: receiverTarget.current,
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
  const receivePointerGroup = (...args: Parameters<typeof pointerGroup>) => {
    const previous = receiverTarget.current
    receiverTarget.current = args[1]
    try {
      return pointerGroup(...args)
    } finally {
      receiverTarget.current = previous
    }
  }
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
          nativeFieldGroupPointerHandler={receivePointerGroup}
          nativeFocusWithinObservation
          nativeOnFocusWithin={(event) => {
            focused.current = event.nativeEvent.within
            setObservedFocusTarget(event.nativeEvent.within ? event.nativeEvent.focusedTarget : 0)
            record({ kind: "field-focus", field: name, data: event.nativeEvent })
          }}
          style={[frame, { paddingLeft: 8 + layoutRevision * 16 }]}
        >
          {metadata}
          <Text testID={`${name}-value`} accessibilityLabel={snapshot}>
            {name}: {value?.toString() ?? "empty"}
          </Text>
          <Text testID={`${name}-binding`} accessibilityLabel={bindingStatus}>
            {bindingStatus}
          </Text>
          <Text testID={`${name}-command-transactions`}>{commandTransactions}</Text>
          <NativeFocusHost
            ref={setInput}
            focusable={false}
            testID={`${name}-input`}
            nativeFieldGroupHandler={receiveGroup}
            nativeFieldGroupPointerHandler={receivePointerGroup}
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
            <NativeFocusHost
              testID={`${name}-press-tail`}
              focusable={false}
              accessible
              accessibilityLabel="Field end"
              style={{ padding: 8 }}
            >
              <View pointerEvents="none">
                <Text>Field end</Text>
              </View>
            </NativeFocusHost>
          </NativeFocusHost>
          <Portal hostName={portaled ? "field-original-portal" : undefined}>
            <NativePressable
              ref={bindButton}
              testID={`${name}-button`}
              onKeyDown={(event) => {
                record({ kind: "child-key", field: name, data: event.nativeEvent })
                if (stop) event.stopPropagation()
              }}
              onKeyUp={(event) => {
                record({ kind: "child-key", field: name, data: event.nativeEvent })
                if (stop) event.stopPropagation()
              }}
              onPointerDown={(event) => {
                if (stop) event.stopPropagation()
                record({
                  kind: "child-pointer",
                  field: name,
                  data: event.nativeEvent,
                  stopped: event.isPropagationStopped(),
                  prevented: event.defaultPrevented,
                })
              }}
              onPress={(event) => record({ kind: "child-press", field: name, data: event.nativeEvent })}
              style={frame}
            >
              <Text>Authored action</Text>
            </NativePressable>
          </Portal>
          <NativePressable testID={`${name}-negative-tab`} tabIndex={-1} nativeProgrammaticFocusable style={frame}>
            <Text>Programmatic action</Text>
          </NativePressable>
          <TextInput
            ref={originalCore}
            testID={`${name}-core-editor`}
            defaultValue=""
            accessibilityLabel={`${name} original core editor`}
            onKeyPress={(event) => record({ kind: "core-key", field: name, data: event.nativeEvent })}
            onFocus={(event) => record({ kind: "core-focus", field: name, data: event.nativeEvent })}
            onChange={(event) => record({ kind: "core-native-change", field: name, data: event.nativeEvent })}
            onChangeText={(text) => record({ kind: "core-change", field: name, text })}
            onSelectionChange={(event) => record({ kind: "core-selection", field: name, data: event.nativeEvent })}
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

const CandidateIcon = ({ buttonRef, record }: { buttonRef: (target: View | null) => void; record: TRecord }) => {
  const scope = useContext(NativeFieldInputContext)
  const state = useContext(NativeTimeFieldStateContext)
  const { locale, direction } = useNativeLocale()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const timer = setInterval(() => setReady(scope?.current() ?? false), 30)
    return () => clearInterval(timer)
  }, [scope])
  const snapshot = JSON.stringify({
    ready: ready && (scope?.current() ?? false),
    locale,
    direction,
    hourTestID: `candidate-time-segment-${state?.segments.findIndex((segment) => segment.type === "hour")}`,
    value: state?.timeValue?.toString() ?? null,
    minuteTestID: `candidate-time-segment-${state?.segments.findIndex((segment) => segment.type === "minute")}`,
    valueClass: state?.timeValue ? timeEntryValueClass(state.timeValue) : null,
  })
  useLayoutEffect(() => {
    record({ kind: "candidate-state", ...JSON.parse(snapshot) })
  }, [record, snapshot])
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Text testID="candidate-state" accessibilityLabel={snapshot} style={{ fontSize: 1, width: 1 }}>
        Candidate
      </Text>
      <NativePressable ref={buttonRef} testID="candidate-button" style={{ minWidth: 50, minHeight: 24 }}>
        <Text>Action</Text>
      </NativePressable>
      <TextInput
        testID="candidate-core"
        accessibilityLabel="Candidate original core editor"
        style={{ width: 64, height: 24 }}
      />
    </View>
  )
}

export const FieldInputSDKScene = ({ record }: { record: TRecord }) => {
  const [value, setValue] = useState<TimeValue | null>(() => new Time(13, 45))
  const [candidate, setCandidate] = useState(false)
  const requests = useRef<Record<string, unknown>[]>([])
  const observations = useRef<Record<string, unknown>[]>([])
  const callbacks = useRef<Record<string, unknown>[]>([])
  const authoredButton = useRef<View | null>(null)
  const bindAuthoredButton = useCallback((target: View | null) => {
    authoredButton.current = target
  }, [])
  const [observationSnapshot, setObservationSnapshot] = useState("{}")
  const [busyPhase, setBusyPhase] = useState("idle")
  useEffect(() => {
    if (busyPhase !== "running") return
    const timer = setTimeout(() => {
      const started = Date.now()
      record({ kind: "busy-start", started })
      // The non-shipping trial deliberately occupies JS beyond the native turn's deadline.
      while (Date.now() - started < 10000) {
        /* occupied */
      }
      record({ kind: "busy-end", elapsedMilliseconds: Date.now() - started })
      setBusyPhase("complete")
    }, 20)
    return () => clearTimeout(timer)
  }, [busyPhase, record])
  const receive = useCallback(
    (row: Record<string, unknown>) => {
      if (row.kind === "value-request") requests.current.push(row)
      if (
        [
          "segment-key",
          "field-key",
          "child-key",
          "child-press",
          "child-pointer",
          "group-pointer",
          "field-pointer",
          "core-key",
          "mutation-call",
          "mutation-return",
          "core-focus",
          "original-command-call",
          "original-command-return",
          "core-native-change",
          "core-change",
          "core-selection",
        ].includes(String(row.kind))
      ) {
        const data = row.data as Record<string, unknown> | undefined
        const selection = data?.selection as { start: number; end: number } | undefined
        callbacks.current.push({
          kind: row.kind,
          field: row.field,
          receiverTarget: row.receiverTarget ?? null,
          key: data?.key ?? null,
          dispatch: typeof data?.fieldDispatch === "string" ? data.fieldDispatch : null,
          text: row.text ?? data?.text ?? null,
          revision: row.revision ?? null,
          mutation: row.mutation ?? null,
          stopped: row.stopped ?? null,
          prevented: row.prevented ?? null,
          target: row.target ?? data?.target ?? null,
          sameRef: row.sameRef ?? null,
          sameMethod: row.sameMethod ?? null,
          selection: selection ? { start: selection.start, end: selection.end } : null,
        })
      }
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
    const batchNumber = ++receiptBatches.current
    receive({ kind: "native-receipts", batch: batchNumber, ...batch })
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
          groupTargets: dispatch?.groups.map((group: { target: number }) => group.target) ?? [],
          key: event?.key ?? null,
          modifiers:
            row.kind === "key"
              ? { shiftKey: event?.shiftKey, altKey: event?.altKey, ctrlKey: event?.ctrlKey, metaKey: event?.metaKey }
              : null,
          nativeCode: event?.nativeCode ?? null,
          nativeModifierData: event?.nativeModifierData ?? null,
          repeat: event?.repeat ?? null,
          phase: dispatch?.phase ?? null,
          decision: row.decision ?? null,
          wait: row.wait ?? null,
          deliveryStarted: row.deliveryStarted === true,
          deliveryReturned: row.deliveryReturned === true,
          renderPhasesComplete: row.renderPhasesComplete === true,
          scopeCurrent: row.scopeCurrent === true,
          beforeFocusedTarget: before?.focusedTarget ?? null,
          afterFocusedTarget: after?.focusedTarget ?? null,
          groups: dispatch?.groups ?? null,
          beforeEventFocusedTarget: before?.eventFocusedTarget ?? null,
          afterEventFocusedTarget: after?.eventFocusedTarget ?? null,
          error: row.error ?? "missing-native-frame-error",
        }
      })
    const failures = batch.records.filter((row) => row.kind === "failure")
    const callbackSnapshot = callbacks.current.map(({ dispatch, ...row }) => {
      const packet = typeof dispatch === "string" ? JSON.parse(dispatch) : null
      return { ...row, token: packet?.token ?? null, phase: packet?.phase ?? null }
    })
    setReceiptSnapshot(
      JSON.stringify({
        batch: batchNumber,
        dropped: batch.dropped,
        frames,
        failures,
        requests: requests.current,
        observations: observations.current,
        callbacks: callbackSnapshot,
        focusActions: batch.records.filter((row) => row.kind === "focus"),
        commands: batch.records.filter((row) => row.kind === "command-native" || row.kind === "command"),
      }),
    )
  }
  const [disabled, setDisabled] = useState(false),
    [readonly, setReadonly] = useState(false),
    [echo, setEcho] = useState(true),
    [veto, setVeto] = useState(false),
    [stop, setStop] = useState(false),
    [revision, setRevision] = useState(0),
    [mutation, setMutation] = useState<TMutation>("none"),
    [layoutRevision, setLayoutRevision] = useState(0),
    [commandMode, setCommandMode] = useState<TCommandMode>("none"),
    [portaled, setPortaled] = useState(false),
    [locale, setLocale] = useState("en-GB"),
    [visible, setVisible] = useState(true),
    [removeOnKey, setRemoveOnKey] = useState(false)
  const candidateOwner = useRef({ value, echo })
  useInsertionEffect(() => {
    candidateOwner.current = { value, echo }
  })
  const candidateChange = useCallback(
    (next: TimeValue | null) => {
      receive({
        kind: "value-request",
        field: "candidate",
        value: next?.toString() ?? null,
        valueClass: next ? timeEntryValueClass(next) : null,
        held: candidateOwner.current.value?.toString() ?? null,
        heldClass: candidateOwner.current.value ? timeEntryValueClass(candidateOwner.current.value) : null,
        echo: candidateOwner.current.echo,
      })
      if (candidateOwner.current.echo) setValue(next)
    },
    [receive],
  )
  const candidateKey = useCallback(
    (event: TNativeKeyboardEvent) =>
      receive({
        kind: "field-key",
        field: "candidate",
        receiverTarget: findNodeHandle(event.currentTarget as unknown as View),
        data: event.nativeEvent,
        prevented: event.defaultPrevented,
        stopped: event.isPropagationStopped(),
      }),
    [receive],
  )
  const candidatePointerUp = useCallback(
    (event: PointerEvent) => {
      receive({ kind: "field-pointer", field: "candidate", phase: "up", data: event.nativeEvent })
    },
    [receive],
  )
  const removeField = useCallback(() => setVisible(false), [])
  const mutate = useCallback((action: TMutation) => {
    if (action === "callback") setRevision((value) => value + 1)
    else if (action === "disabled") setDisabled(true)
    else if (action === "readonly") setReadonly(true)
    else if (action === "layout") setLayoutRevision((value) => value + 1)
    else if (action === "unmount") setVisible(false)
  }, [])
  const sceneState = JSON.stringify({
    mutation,
    layoutRevision,
    revision,
    disabled,
    readonly,
    visible,
    portaled,
    busyPhase,
  })
  useLayoutEffect(() => {
    record({ kind: "scene-state", ...JSON.parse(sceneState) })
  }, [record, sceneState])
  return (
    <PortalProvider>
      <NativeLocaleProvider locale={locale}>
        <NativeKeyboardScope captureEnabled style={{ flex: 1 }}>
          <Text testID="field-sdk-scene-state" accessibilityLabel={sceneState}>
            Mutation: {mutation}
          </Text>
          <Text testID="field-sdk-observation-snapshot" accessibilityLabel={observationSnapshot}>
            Original passive key observation
          </Text>
          <Text testID="field-sdk-receipt-snapshot" accessibilityLabel={receiptSnapshot}>
            Native receipt batches: {receiptBatches.current}
          </Text>
          <Pressable testID="field-sdk-checkpoint" onPress={receipts} style={frame}>
            <Text>Check original receipts</Text>
          </Pressable>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {[
              ["time", () => setValue(TIME_ENTRY_VALUES[0])],
              ["empty", () => setValue(null)],
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
              ["mutation", () => setMutation((value) => MUTATIONS[(MUTATIONS.indexOf(value) + 1) % MUTATIONS.length])],
              ["command-only", () => setCommandMode("original-only")],
              ["command-mixed", () => setCommandMode("mixed")],
              ["command-off", () => setCommandMode("none")],
              ["portal", () => setPortaled((value) => !value)],
              ["busy", () => setBusyPhase("running")],
              [
                "candidate",
                () => {
                  setValue(TIME_ENTRY_VALUES[0])
                  setLocale("en-GB")
                  setCandidate(true)
                },
              ],
              [
                "focus-button",
                () =>
                  record({
                    kind: "setup-focus-request",
                    field: "outer",
                    requested: focusNativeTarget(authoredButton.current),
                  }),
              ],
              ["locale", () => setLocale((value) => (value === "en-GB" ? "ar-EG" : "en-GB"))],
            ].map(([name, action]) => (
              <Pressable key={name as string} testID={`field-sdk-${name}`} onPress={action as () => void} style={frame}>
                <Text>{name as string}</Text>
              </Pressable>
            ))}
          </View>
          <ScrollView
            testID="field-sdk-content"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            contentContainerStyle={{ padding: 20 }}
          >
            <Text>Original field input prototype</Text>
            {visible && !candidate && (
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
                mutation={mutation}
                layoutRevision={layoutRevision}
                onMutation={mutate}
                commandMode={commandMode}
                onButtonRef={bindAuthoredButton}
                portaled={portaled}
                removeOnKey={removeOnKey}
                onRemove={removeField}
              />
            )}
            {candidate && (
              <NativeTimePickerRenderer
                testID="candidate-time"
                value={value}
                onChange={candidateChange}
                onKeyDown={candidateKey}
                onKeyUp={candidateKey}
                onPointerUp={candidatePointerUp}
                ComponentIcon={<CandidateIcon buttonRef={bindAuthoredButton} record={record} />}
              />
            )}
          </ScrollView>
          <PortalHost name="field-original-portal" style={{ minHeight: 70 }} />
        </NativeKeyboardScope>
      </NativeLocaleProvider>
    </PortalProvider>
  )
}
