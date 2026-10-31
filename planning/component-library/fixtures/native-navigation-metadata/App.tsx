import { requireNativeModule } from "expo"
import { useCallback, useEffect, useRef, useState, type ComponentProps, type RefAttributes } from "react"
import { findNodeHandle, View, type NativeSyntheticEvent } from "react-native"
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context"

import {
  NativeFloatingLayerHost,
  NativeOverlayProvider,
  NativeThemeProvider,
  Text,
} from "../../../../packages/react-native/src"
import { Breadcrumbs } from "../../../../packages/react-native/src/components/Breadcrumbs/Breadcrumbs"
import type { TNativeButtonProps } from "../../../../packages/react-native/src/components/Button/types"
import { Pagination } from "../../../../packages/react-native/src/components/Pagination/Pagination"
import { inspectNativeAccessibility } from "../../../../packages/react-native/src/input/accessibilityInspection"
import type { NativeFocusHost } from "../../../../packages/react-native/src/input/NativeFocusView"
import { useNativeKeyScope } from "../../../../packages/react-native/src/input/NativeKeyboardScope"
import type { NativeAccessibilityData } from "../../../../packages/react-native/src/input/specs/CUIFocusViewNativeComponent"

import configuration from "./phases.json"
import { createReceiptJournal, type TReceiptFileSystem } from "./receipt"

type TPhase = {
  id: string
  page: number
  currentText?: string
  role?: string
  paginationLabel?: string
  breadcrumbLabel?: string
  breadcrumbDisabled?: boolean
  paginationDisabled?: boolean
  valueAlias?: string
  selectedAlias?: boolean
  referenceMode?: string
}
type TObservation = Pick<ComponentProps<typeof NativeFocusHost>, "onNativeAccessibilitySnapshot">
type TPending = { phase: string; remaining: Set<number>; windowId: string; epoch: number }
const phases: readonly TPhase[] = configuration.phases
const items = ["A", "B", "C"].map((content) => ({ id: content, content, href: `#${content}`, disabled: false }))

const NavigationCases = () => {
  const [index, setIndex] = useState(0)
  const [receiptState, setReceiptState] = useState("collecting")
  const [journal] = useState(() =>
    createReceiptJournal(
      configuration.probe,
      () => requireNativeModule<TReceiptFileSystem>("ExponentFileSystem"),
      (line) => console.warn(line),
    ),
  )
  const emit = useCallback((record: Record<string, unknown>) => journal.append(record), [journal])
  const persist = useCallback(() => {
    journal.flush().then(
      () => setReceiptState("persisted"),
      () => setReceiptState("receipt-failed"),
    )
  }, [journal])
  const phase = phases[index]
  const pagination = useRef<View>(null),
    breadcrumbs = useRef<View>(null)
  const buttons = useRef(new Set<View>())
  const pending = useRef<TPending | null>(null)
  const stopped = useRef(false)
  const total = useRef(0)
  const scope = useNativeKeyScope()
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const fail = useCallback(
    (reason: string) => {
      if (stopped.current) return
      stopped.current = true
      clearTimeout(watchdog.current)
      emit({
        kind: "failure",
        reason,
        pending: pending.current ? [...pending.current.remaining] : [],
        snapshots: total.current,
      })
      persist()
    },
    [emit, persist],
  )
  useEffect(() => {
    emit({ kind: "begin", libraryProducer: configuration.libraryProducer, phases: phases.map((item) => item.id) })
    watchdog.current = setTimeout(() => fail("scope-or-snapshot-deadline"), 240_000)
    return () => {
      stopped.current = true
      clearTimeout(watchdog.current)
    }
  }, [fail, emit])
  const receive = useCallback(
    (event: NativeSyntheticEvent<NativeAccessibilityData>) => {
      const request = pending.current
      if (stopped.current) return
      if (!request || !request.remaining.has(event.nativeEvent.target)) return fail("unrequested-native-snapshot")
      if (event.nativeEvent.windowId !== request.windowId) return fail("native-window-mismatch")
      // Keep the native packet untouched; expected fields are checked outside this app.
      emit({
        kind: "snapshot",
        phase: request.phase,
        session: { windowId: request.windowId, epoch: request.epoch },
        actual: event.nativeEvent,
      })
      total.current += 1
      request.remaining.delete(event.nativeEvent.target)
      if (!request.remaining.size) {
        emit({ kind: "phase-complete", phase: request.phase })
        pending.current = null
        setIndex((current) => current + 1)
      }
    },
    [fail, emit],
  )
  const registerButton = useCallback((target: View | null) => {
    if (!target) return
    buttons.current.add(target)
    return () => {
      buttons.current.delete(target)
    }
  }, [])
  useEffect(() => {
    if (stopped.current) return
    if (!phase) {
      stopped.current = true
      clearTimeout(watchdog.current)
      emit({ kind: "complete", snapshots: total.current, phases: phases.length })
      persist()
      return
    }
    let frame: number | undefined
    let settling = false
    const begin = () => {
      if (settling || pending.current || stopped.current || !scope?.isNativeReady() || !scope.isWindowActive()) return
      settling = true
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (stopped.current || !scope.isNativeReady() || !scope.isWindowActive()) {
            settling = false
            return
          }
          const roots = [pagination.current, breadcrumbs.current]
          if (roots.some((target) => target === null) || buttons.current.size !== 5) return fail("mounted-target-set")
          const targets = [...roots.filter((target): target is View => target !== null), ...buttons.current]
          const tags = targets.map((target) => findNodeHandle(target))
          if (tags.some((tag) => tag === null) || new Set(tags).size !== 7) return fail("actual-native-target-tags")
          const session = scope.acknowledgedSession()
          pending.current = {
            phase: phase.id,
            remaining: new Set(tags.filter((tag): tag is number => tag !== null)),
            ...session,
          }
          emit({ kind: "request", phase: phase.id, targets: tags, session })
          for (const target of targets)
            if (!inspectNativeAccessibility(target)) return fail("unregistered-native-target")
        })
      })
    }
    const unsubscribe = scope?.subscribe(begin)
    begin()
    return () => {
      unsubscribe?.()
      if (frame !== undefined) cancelAnimationFrame(frame)
    }
  }, [index, phase, scope, fail, emit, persist])
  const observation: TObservation = { onNativeAccessibilitySnapshot: receive }
  const general: Partial<TNativeButtonProps> & RefAttributes<View> & TObservation = {
    ...observation,
    ref: registerButton,
    ...(phase?.valueAlias !== undefined
      ? { accessibilityValue: { min: 0, max: 0, now: 0, text: "ignored" }, "aria-valuetext": phase.valueAlias }
      : {}),
    ...(phase?.selectedAlias !== undefined ? { "aria-selected": phase.selectedAlias } : {}),
  }
  const referenceMode = phase?.referenceMode
  const referenced = referenceMode !== undefined
  const referenceText =
    referenceMode === "changed"
      ? ["Changed A", "Changed B"]
      : referenceMode === "returned"
        ? ["Return A", "Return B"]
        : ["First", "Second"]
  return (
    <View style={{ flex: 1, padding: 20, gap: 12 }}>
      <Text testID="navigation-observer-phase">{`${phase?.id ?? "complete"}:${receiptState}`}</Text>
      {referenced && referenceMode !== "removed" ? (
        <>
          <Text nativeID="probe-title-a">{referenceText[0]}</Text>
          <Text nativeID="probe-title-b">{referenceText[1]}</Text>
        </>
      ) : null}
      <Breadcrumbs
        {...observation}
        ref={breadcrumbs}
        items={items}
        maxVisibleItems={3}
        ariaLabel={phase?.breadcrumbLabel ?? "Probe trail"}
        ariaLabelledBy={referenced ? "probe-title-a probe-title-b" : undefined}
        isDisabled={phase?.breadcrumbDisabled}
        labels={{
          navigationRoleDescription: phase?.role ?? "Navigation",
          currentPageValue: phase?.currentText ?? "Current page",
        }}
      />
      <Pagination
        {...observation}
        ref={pagination}
        currentPage={phase?.page ?? 2}
        itemsPerPage={10}
        numberOfItems={30}
        setCurrentPage={() => emit({ kind: "unexpected-page-request" })}
        setItemsPerPage={() => emit({ kind: "unexpected-size-request" })}
        ariaLabel={phase?.paginationLabel ?? "Probe pagination"}
        ariaLabelledBy={referenced ? "probe-title-a probe-title-b" : undefined}
        isDisabled={phase?.paginationDisabled}
        maxVisiblePages={20}
        customGeneralButtonProps={general}
        labels={{
          root: { navigationRoleDescription: phase?.role ?? "Navigation" },
          primaryControls: { currentPageValue: phase?.currentText ?? "Current page" },
        }}
      />
    </View>
  )
}
const App = () => (
  <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <NativeThemeProvider mode="light">
      <NativeOverlayProvider>
        <NativeFloatingLayerHost style={{ flex: 1 }}>
          <NavigationCases />
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  </SafeAreaProvider>
)
export default App
