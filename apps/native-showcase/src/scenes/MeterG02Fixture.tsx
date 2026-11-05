import { useCallback, useEffect, useInsertionEffect, useRef, useState } from "react"
import {
  findNodeHandle,
  Pressable,
  Text as CoreText,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native"

import { Meter, useNativeTheme, type MeterProps, type TNativeMeterRef } from "@codon-ui/react-native"

type TOwner = Pick<MeterProps, "value" | "minValue" | "maxValue" | "valueLabel" | "locale" | "formatOptions" | "width">
type TCallback = "original" | "current"
type TReceipt = {
  sequence: number
  kind:
    | "owner"
    | "scheduled"
    | "attach"
    | "detach"
    | "layout"
    | "visibility"
    | "touchStart"
    | "touchEnd"
    | "touchCancel"
  data: unknown
  receivedAt: number
  rootTag: number | null
  refIdentity: number | null
  afterDetach: boolean
}

const presets: ReadonlyArray<readonly [string, TOwner]> = [
  ["G02 MT zero defaults", { value: 0 }],
  ["G02 MT explicit zero bounds", { value: 0, minValue: 0, maxValue: 100 }],
  ["G02 MT value 25", { value: 25 }],
  ["G02 MT negative bounded", { value: -25, minValue: -50, maxValue: 50 }],
  ["G02 MT lower clamp", { value: -80, minValue: -50, maxValue: 50 }],
  ["G02 MT upper clamp", { value: 80, minValue: -50, maxValue: 50 }],
  ["G02 MT English decimal", { value: 1250, maxValue: 2000, locale: "en-US", formatOptions: { style: "decimal" } }],
  ["G02 MT French decimal", { value: 1250, maxValue: 2000, locale: "fr-CA", formatOptions: { style: "decimal" } }],
  ["G02 MT authored label", { value: 25, valueLabel: "One quarter" }],
  ["G02 MT empty label", { value: 0, valueLabel: "" }],
]

const scalars = (value: object) =>
  Object.fromEntries(
    Object.entries(value).filter(([, item]) => item === null || ["number", "string", "boolean"].includes(typeof item)),
  )
const targetTag = (value: unknown) =>
  typeof value === "number"
    ? value
    : value === null || value === undefined
      ? null
      : findNodeHandle(value as TNativeMeterRef)

export const MeterG02Fixture = () => {
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(false)
  const [panel, setPanel] = useState<"values" | "format" | "motion" | "events">("values")
  const [owner, setOwner] = useState<TOwner>({ value: 0 })
  const [callback, setCallback] = useState<TCallback>("original")
  const [pointerEvents, setPointerEvents] = useState<"auto" | "none">("auto")
  const [retireOnStart, setRetireOnStart] = useState(false)
  const [receipts, setReceipts] = useState<TReceipt[]>([])
  const [pending, setPending] = useState<{ generation: number; operation: string } | null>(null)
  const [, refreshReadout] = useState(0)
  const root = useRef<TNativeMeterRef | null>(null)
  const identities = useRef(new WeakMap<object, number>())
  const nextIdentity = useRef(0)
  const sequence = useRef(0)
  const trace = useRef<TReceipt[]>([])
  const attaches = useRef(0)
  const detaches = useRef(0)
  const dropped = useRef(0)
  const generation = useRef(0)
  const live = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const committedOwner = useRef(owner)
  const committedRetireOnStart = useRef(retireOnStart)
  const theme = useNativeTheme()
  useInsertionEffect(() => {
    committedOwner.current = owner
    committedRetireOnStart.current = retireOnStart
  }, [owner, retireOnStart])
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
      generation.current += 1
      if (timer.current !== null) clearTimeout(timer.current)
    }
  }, [])

  const record = useCallback((kind: TReceipt["kind"], data: unknown) => {
    const node = root.current
    const receipt: TReceipt = {
      sequence: ++sequence.current,
      kind,
      data,
      receivedAt: Date.now(),
      rootTag: node === null ? null : findNodeHandle(node),
      refIdentity: node === null ? null : (identities.current.get(node) ?? null),
      afterDetach: node === null,
    }
    if (trace.current.length < 256) {
      trace.current = [...trace.current, receipt]
      setReceipts(trace.current)
    } else dropped.current += 1
    refreshReadout((current) => current + 1)
  }, [])
  const bind = useCallback(
    (node: TNativeMeterRef | null) => {
      if (root.current === node) return
      root.current = node
      if (node === null) detaches.current += 1
      else {
        attaches.current += 1
        if (!identities.current.has(node)) identities.current.set(node, ++nextIdentity.current)
      }
      record(node === null ? "detach" : "attach", { attaches: attaches.current, detaches: detaches.current })
    },
    [record],
  )
  const layout = useCallback(
    (recipient: TCallback, event: LayoutChangeEvent) => {
      const native = event.nativeEvent
      record("layout", {
        recipient,
        currentTarget: targetTag(event.currentTarget),
        native: { ...scalars(native), layout: { ...native.layout } },
      })
    },
    [record],
  )
  const originalLayout = useCallback((event: LayoutChangeEvent) => layout("original", event), [layout])
  const currentLayout = useCallback((event: LayoutChangeEvent) => layout("current", event), [layout])
  const touch = useCallback(
    (recipient: TCallback, kind: "touchStart" | "touchEnd" | "touchCancel", event: GestureResponderEvent) => {
      const native = event.nativeEvent
      record(kind, {
        recipient,
        currentTarget: targetTag(event.currentTarget),
        native: {
          ...scalars(native),
          changedTouches: native.changedTouches?.map(scalars),
          touches: native.touches?.map(scalars),
        },
      })
      if (kind === "touchStart" && committedRetireOnStart.current) {
        generation.current += 1
        if (timer.current !== null) clearTimeout(timer.current)
        timer.current = null
        setPending(null)
        record("visibility", { visible: false, cause: "actual-native-touchStart" })
        setVisible(false)
      }
    },
    [record],
  )
  const originalStart = useCallback((event: GestureResponderEvent) => touch("original", "touchStart", event), [touch])
  const originalEnd = useCallback((event: GestureResponderEvent) => touch("original", "touchEnd", event), [touch])
  const originalCancel = useCallback((event: GestureResponderEvent) => touch("original", "touchCancel", event), [touch])
  const currentStart = useCallback((event: GestureResponderEvent) => touch("current", "touchStart", event), [touch])
  const currentEnd = useCallback((event: GestureResponderEvent) => touch("current", "touchEnd", event), [touch])
  const currentCancel = useCallback((event: GestureResponderEvent) => touch("current", "touchCancel", event), [touch])
  const cancelPending = () => {
    generation.current += 1
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    setPending(null)
  }
  const apply = (operation: string, next: TOwner) => {
    cancelPending()
    record("owner", { operation, authored: next })
    setOwner(next)
  }
  const schedule = (operation: string, deliver: () => void, delay: number | null) => {
    const ticket = generation.current
    setPending({ generation: ticket, operation })
    record("scheduled", { operation, generation: ticket, delayMs: delay })
    const settled = () => {
      if (!live.current || generation.current !== ticket) return
      timer.current = null
      setPending(null)
      deliver()
    }
    if (delay === null) void Promise.resolve().then(settled)
    else timer.current = setTimeout(settled, delay)
  }
  const control = (label: string, action: () => void) => (
    <Pressable
      key={label}
      role="button"
      accessibilityLabel={label}
      onPress={action}
      style={{ width: "48%", minHeight: 48, padding: 6, justifyContent: "center" }}
    >
      <CoreText style={{ color: theme.colors.foreground }}>{label.replace("G02 MT ", "")}</CoreText>
    </Pressable>
  )
  const readout = {
    expanded,
    visible,
    panel,
    owner,
    callback,
    pointerEvents,
    retireOnStart,
    pending,
    rootTag: root.current === null ? null : findNodeHandle(root.current),
    refIdentity: root.current === null ? null : (identities.current.get(root.current) ?? null),
    attaches: attaches.current,
    detaches: detaches.current,
    dropped: dropped.current,
    receipts,
  }

  return (
    <View style={{ gap: 6 }}>
      {control("G02 prepare Meter", () => {
        apply("prepare", { value: 0 })
        setCallback("original")
        setPanel("values")
        setPointerEvents("auto")
        setRetireOnStart(false)
        setExpanded(true)
        setVisible(true)
      })}
      {expanded && (
        <>
          {visible && (
            <Meter
              {...owner}
              ref={bind}
              testID="meter-g02-target"
              accessibilityLabel="G02 meter"
              onLayout={callback === "original" ? originalLayout : currentLayout}
              onTouchStart={callback === "original" ? originalStart : currentStart}
              onTouchEnd={callback === "original" ? originalEnd : currentEnd}
              onTouchCancel={callback === "original" ? originalCancel : currentCancel}
              pointerEvents={pointerEvents}
            />
          )}
          <CoreText
            testID="meter-g02-state"
            accessible
            accessibilityLabel={JSON.stringify(readout)}
            numberOfLines={1}
            style={{ color: theme.colors.foreground }}
          >
            Meter G02 observations
          </CoreText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {(["values", "format", "motion", "events"] as const).map((next) =>
              control(`G02 MT ${next} controls`, () => setPanel(next)),
            )}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {(panel === "values"
              ? presets.slice(0, 6)
              : panel === "format"
                ? presets.slice(6)
                : panel === "motion"
                  ? presets.filter(([label]) => label === "G02 MT value 25")
                  : []
            ).map(([label, next]) => control(label, () => apply(label, next)))}
            {panel === "values" && (
              <>
                {control("G02 MT restore default bounds", () =>
                  apply("restore-default-bounds", { value: committedOwner.current.value }),
                )}
                {control("G02 MT deferred 35", () => {
                  cancelPending()
                  schedule(
                    "deferred-35",
                    () => apply("deferred-35-delivered", { value: 35, minValue: -5, maxValue: 75, valueLabel: "" }),
                    null,
                  )
                })}
              </>
            )}
            {panel === "motion" && (
              <>
                {control("G02 MT value 75", () => apply("value-75", { value: 75 }))}
                {control("G02 MT supersede fill", () => {
                  apply("supersede-start", { value: 90 })
                  schedule("supersede-latest", () => apply("supersede-latest-delivered", { value: 10 }), 100)
                })}
              </>
            )}
            {panel === "events" && (
              <>
                {control("G02 MT replace callbacks", () => setCallback("current"))}
                {control("G02 MT ignore pointer input", () => setPointerEvents("none"))}
                {control("G02 MT accept pointer input", () => setPointerEvents("auto"))}
                {control("G02 MT retire on touch start", () => setRetireOnStart(true))}
                {control("G02 MT widen root", () => apply("widen-root", { ...committedOwner.current, width: 180 }))}
                {control("G02 MT remove", () => {
                  cancelPending()
                  record("visibility", { visible: false })
                  setVisible(false)
                })}
              </>
            )}
            {panel === "motion" && (
              <>
                {control("G02 MT retire moving fill", () => {
                  apply("retire-start", { value: 90 })
                  schedule(
                    "retire-moving-fill",
                    () => {
                      record("visibility", { visible: false })
                      setVisible(false)
                    },
                    100,
                  )
                })}
              </>
            )}
            {(panel === "motion" || panel === "events") && (
              <>
                {control("G02 MT reinsert default zero", () => {
                  apply("reinsert-default-zero", { value: 0 })
                  setRetireOnStart(false)
                  setPointerEvents("auto")
                  record("visibility", { visible: true })
                  setVisible(true)
                })}
              </>
            )}
          </View>
        </>
      )}
    </View>
  )
}
