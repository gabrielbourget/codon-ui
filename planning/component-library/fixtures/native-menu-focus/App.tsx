import { requireNativeModule } from "expo"
import { useCallback, useEffect, useInsertionEffect, useRef, useState, type ComponentProps } from "react"
import { Dimensions, findNodeHandle, Keyboard, PixelRatio, View, type NativeSyntheticEvent } from "react-native"
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context"

import {
  NativeFloatingLayerHost,
  NativeOverlayProvider,
  NativeThemeProvider,
  Text,
} from "../../../../packages/react-native/src"
import { Menu } from "../../../../packages/react-native/src/components/Menu/Menu"
import { MenuItem } from "../../../../packages/react-native/src/components/Menu/MenuItem"
import { encodeNativeMenuKey, type TNativeMenuKey } from "../../../../packages/react-native/src/components/Menu/model"
import { inspectNativeAccessibility } from "../../../../packages/react-native/src/input/accessibilityInspection"
import { focusNativeTarget } from "../../../../packages/react-native/src/input/focus"
import type { NativeFocusHost } from "../../../../packages/react-native/src/input/NativeFocusView"
import { useNativeKeyScope } from "../../../../packages/react-native/src/input/NativeKeyboardScope"
import type {
  NativeAccessibilityData,
  NativeFocusData,
} from "../../../../packages/react-native/src/input/specs/CUIFocusViewNativeComponent"
import type { TNativeFocusEvent } from "../../../../packages/react-native/src/input/types"

import configuration from "./phases.json"
import { createReceiptJournal, type TReceiptFileSystem } from "./receipt"

type TPhase = { id: string; keys: TNativeMenuKey[]; focusKey: TNativeMenuKey; explicitFocus: boolean }
type TFocus = { sequence: number; actual: NativeFocusData }
type TPending = {
  index: number
  begun: boolean
  dispatched: boolean
  settling: boolean
  requested: boolean
  focus?: TFocus
  session?: { windowId: string; epoch: number }
}
type TObservation = Pick<ComponentProps<typeof NativeFocusHost>, "onNativeAccessibilitySnapshot">
const phases: readonly TPhase[] = configuration.phases
const labels = new Map<TNativeMenuKey, string>([
  [0, "Zero"],
  ["", "Middle"],
  ["tail", "Tail"],
])

const MenuFocusCases = () => {
  const [index, setIndex] = useState(0),
    [receiptState, setReceiptState] = useState("collecting")
  const [selectedKeys] = useState(() => new Set<TNativeMenuKey>([0, "missing"]))
  const [journal] = useState(() =>
    createReceiptJournal(
      configuration.probe,
      () => requireNativeModule<TReceiptFileSystem>("ExponentFileSystem"),
      (line) => console.warn(line),
    ),
  )
  const sequence = useRef(0),
    stopped = useRef(false),
    committedIndex = useRef(index)
  const refs = useRef(new Map<TNativeMenuKey, View>()),
    focused = useRef(new Map<TNativeMenuKey, TFocus>())
  const pending = useRef<TPending | null>(null),
    attempt = useRef<() => void>(() => {})
  const anchor = useRef<View>(null),
    scope = useNativeKeyScope()
  const phase = phases[index]
  const observedInsets = useSafeAreaInsets()
  const insets = useRef(observedInsets)
  useInsertionEffect(() => {
    committedIndex.current = index
    insets.current = observedInsets
  }, [index, observedInsets])
  const emit = useCallback(
    (record: Record<string, unknown>) => {
      const ordinal = ++sequence.current
      journal.append({ sequence: ordinal, ...record })
      return ordinal
    },
    [journal],
  )
  const persist = useCallback(() => {
    journal.flush().then(
      () => setReceiptState("persisted"),
      () => setReceiptState("receipt-failed"),
    )
  }, [journal])
  const fail = useCallback(
    (reason: string) => {
      if (stopped.current) return
      emit({
        kind: "failure",
        reason,
        phase: phases[committedIndex.current]?.id,
        scope: {
          ready: scope?.isNativeReady(),
          active: scope?.isWindowActive(),
          session: scope?.acknowledgedSession(),
        },
      })
      stopped.current = true
      persist()
    },
    [emit, persist, scope],
  )
  useEffect(() => {
    emit({ kind: "begin", libraryProducer: configuration.libraryProducer, phases: phases.map((item) => item.id) })
    const timer = setTimeout(() => fail("probe-deadline"), 240_000)
    return () => {
      clearTimeout(timer)
      stopped.current = true
    }
  }, [emit, fail])
  const receiveFocus = useCallback(
    (key: TNativeMenuKey, event: TNativeFocusEvent) => {
      if (stopped.current) return
      const actual = event.nativeEvent
      const ordinal = emit({ kind: "focus", phase: phases[committedIndex.current]?.id, key, actual })
      focused.current.set(key, { sequence: ordinal, actual: { ...actual } })
      const target = refs.current.get(key)
      if (!target || actual.target !== findNodeHandle(target)) return fail("native-focus-target-mismatch")
      attempt.current()
    },
    [emit, fail],
  )
  const receiveSnapshot = useCallback(
    (event: NativeSyntheticEvent<NativeAccessibilityData>) => {
      if (stopped.current) return
      const request = pending.current,
        currentPhase = phases[committedIndex.current]
      const ordinal = emit({ kind: "snapshot", phase: currentPhase?.id, actual: event.nativeEvent })
      if (
        !request?.requested ||
        request.index !== committedIndex.current ||
        !currentPhase ||
        !request.focus ||
        !request.session
      )
        return fail("unrequested-native-snapshot")
      const liveFocus = focused.current.get(currentPhase.focusKey),
        target = refs.current.get(currentPhase.focusKey)
      if (!liveFocus?.actual.isFocused || !target || findNodeHandle(target) !== event.nativeEvent.target)
        return fail("focus-lost-before-snapshot")
      if (
        event.nativeEvent.ownerId !== request.focus.actual.ownerId ||
        event.nativeEvent.windowId !== request.session.windowId ||
        scope?.isNativeReady() !== true ||
        scope.acknowledgedSession().epoch !== request.session.epoch
      )
        return fail("native-owner-or-window-mismatch")
      emit({
        kind: "phase-complete",
        phase: currentPhase.id,
        focusSequence: request.focus.sequence,
        snapshotSequence: ordinal,
        session: request.session,
        ownerKeys: [...selectedKeys],
      })
      pending.current = null
      setIndex((value) => value + 1)
    },
    [emit, fail, selectedKeys, scope],
  )
  useEffect(() => {
    if (stopped.current) return
    if (!phase) {
      emit({ kind: "complete", phases: phases.length })
      stopped.current = true
      persist()
      return
    }
    const request: TPending = { index, begun: false, dispatched: false, settling: false, requested: false }
    pending.current = request
    let frame: number | undefined
    const tick = () => {
      if (
        stopped.current ||
        committedIndex.current !== index ||
        pending.current !== request ||
        request.requested ||
        !scope?.isNativeReady() ||
        scope.isWindowActive() !== true
      )
        return
      const target = refs.current.get(phase.focusKey)
      if (!target || phase.keys.some((key) => !refs.current.has(key))) return
      if (!request.begun) {
        request.begun = true
        emit({
          kind: "phase",
          phase: phase.id,
          targets: phase.keys.map((key) => ({ key, target: findNodeHandle(refs.current.get(key)!) })),
          session: scope.acknowledgedSession(),
          window: Dimensions.get("window"),
          fontScale: PixelRatio.getFontScale(),
          safeAreaInsets: insets.current,
          keyboardVisible: Keyboard.isVisible(),
          keyboardFrame: Keyboard.metrics() ?? null,
          ownerKeys: [...selectedKeys],
        })
      }
      if (phase.explicitFocus && !request.dispatched) {
        request.dispatched = true
        const accepted = focusNativeTarget(target)
        emit({ kind: "dispatch", phase: phase.id, target: findNodeHandle(target), accepted })
        if (!accepted) fail("focus-dispatch-rejected")
        return
      }
      const actual = focused.current.get(phase.focusKey)
      if (request.settling || !actual?.actual.isFocused || actual.actual.target !== findNodeHandle(target)) return
      request.settling = true
      let remaining = 3
      const settled = () => {
        if (stopped.current || committedIndex.current !== index || pending.current !== request) return
        if (--remaining > 0) {
          frame = requestAnimationFrame(settled)
          return
        }
        request.settling = false
        const latest = focused.current.get(phase.focusKey),
          liveTarget = refs.current.get(phase.focusKey)
        if (
          !scope.isNativeReady() ||
          scope.isWindowActive() !== true ||
          !latest?.actual.isFocused ||
          !liveTarget ||
          latest.actual.target !== findNodeHandle(liveTarget)
        )
          return
        request.focus = latest
        request.session = scope.acknowledgedSession()
        request.requested = true
        emit({
          kind: "request",
          phase: phase.id,
          target: latest.actual.target,
          focusSequence: latest.sequence,
          session: request.session,
        })
        if (!inspectNativeAccessibility(liveTarget)) fail("native-inspector-dispatch-rejected")
      }
      frame = requestAnimationFrame(settled)
    }
    attempt.current = tick
    const interval = setInterval(tick, 40)
    const deadline = setTimeout(
      () =>
        fail(
          !request.begun
            ? "native-scope-or-layout-missing"
            : request.requested
              ? "native-snapshot-missing"
              : "native-focus-callback-missing",
        ),
      90_000,
    )
    tick()
    return () => {
      clearInterval(interval)
      clearTimeout(deadline)
      if (frame !== undefined) cancelAnimationFrame(frame)
      if (attempt.current === tick) attempt.current = () => {}
    }
  }, [index, phase, scope, emit, fail, persist, selectedKeys])
  const observation: TObservation = { onNativeAccessibilitySnapshot: receiveSnapshot }
  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text>
        Menu native focus: {phase?.id ?? "complete"} / {receiptState}
      </Text>
      <View ref={anchor} style={{ width: 140, height: 44, marginTop: 60 }} />
      <Menu
        isOpen
        triggerRef={anchor}
        selectionMode="multiple"
        selectedKeys={selectedKeys}
        shouldCloseOnSelect={false}
        menuAriaLabel="Focus acceptance"
        onAction={(key) => emit({ kind: "unexpected-action", key })}
        onSelectionChange={(keys) => emit({ kind: "unexpected-selection", keys: keys === "all" ? keys : [...keys] })}
        onOpenChange={(value) => emit({ kind: "unexpected-open-request", value })}
      >
        {(phase?.keys ?? [0]).map((key) => (
          <MenuItem
            {...observation}
            key={encodeNativeMenuKey(key)}
            id={key}
            textValue={labels.get(key)}
            ref={(target) => {
              if (!target) return
              refs.current.set(key, target)
              return () => {
                if (refs.current.get(key) === target) refs.current.delete(key)
              }
            }}
            onFocus={(event) => receiveFocus(key, event)}
            onBlur={(event) => receiveFocus(key, event)}
          >
            {labels.get(key)}
          </MenuItem>
        ))}
      </Menu>
    </View>
  )
}

const App = () => (
  <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <NativeThemeProvider mode="light">
      <NativeOverlayProvider>
        <NativeFloatingLayerHost style={{ flex: 1 }}>
          <MenuFocusCases />
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  </SafeAreaProvider>
)
export default App
