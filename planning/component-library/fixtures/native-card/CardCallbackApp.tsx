import { requireNativeModule } from "expo"
import { Component, useCallback, useEffect, useInsertionEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { findNodeHandle, Text, View } from "react-native"

import { Card } from "../../../../packages/react-native/src/components/Card/Card"
import {
  observeNativeMotionGeometry,
  readNativeMotionGeometry,
  type TNativeMotionGeometryRecord,
} from "../../../../packages/react-native/src/input/motionGeometry"
import { NativeKeyboardScope } from "../../../../packages/react-native/src/input/NativeKeyboardScope"
import { NativeMotionConfig } from "../../../../packages/react-native/src/motion/config"
import type { Box } from "../../../../packages/react-native/src/motion/projection/types"
import { NativeThemeProvider } from "../../../../packages/react-native/src/theme"

import { SOURCE_PRODUCER } from "./callback-identity"

const PROBE = "codon-native-card-callback-v1"
type TPhase = "initial" | "out" | "back"
type TRecord = Record<string, unknown>
type TFileSystem = {
  cacheDirectory: string | null
  writeAsStringAsync: (path: string, value: string, options: { encoding: "utf8" }) => Promise<void>
}

class Boundary extends Component<{ fail: (error: unknown) => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override componentDidCatch(error: Error) {
    this.props.fail(error)
  }
  override render() {
    return this.state.failed ? <Text>Card callback gate failed</Text> : this.props.children
  }
}

const Gate = () => {
  const [stage, setStage] = useState<TPhase>("initial")
  const phase = useRef<TPhase>("initial")
  const root = useRef<View>(null)
  const original = useRef<View | null>(null)
  const initial = useRef<TNativeMotionGeometryRecord | null>(null)
  const closed = useRef(false)
  const rows = useRef<string[]>([])
  const completed = useRef(new Set<TPhase>())
  const advanced = useRef(new Set<TPhase>())
  const frames = useRef(new Set<TPhase>())
  const captured = useRef(new Set<string>())
  const callbacks = useRef({ before: 0, measure: 0 })
  const advance = useRef<(value: TNativeMotionGeometryRecord) => void>(() => {})
  const record = useCallback((value: TRecord) => {
    if (closed.current) return
    const line = `CUI_CARD_CALLBACK ${JSON.stringify({ probe: PROBE, sequence: rows.current.length + 1, observedAt: Date.now(), phase: phase.current, ...value })}`
    rows.current.push(line)
    const parts = Math.ceil(line.length / 768)
    for (let part = 0; part < parts; part++)
      console.warn(
        `CUI_CARD_CALLBACK_CHUNK ${JSON.stringify({ probe: PROBE, recordSequence: rows.current.length, part, parts, content: line.slice(part * 768, (part + 1) * 768) })}`,
      )
  }, [])
  const persist = useCallback(
    async (outcome: string) => {
      record({ kind: "terminal", outcome })
      closed.current = true
      const fs = requireNativeModule<TFileSystem>("ExponentFileSystem")
      if (!fs.cacheDirectory) throw new Error("No native cache directory")
      await fs.writeAsStringAsync(
        `${fs.cacheDirectory.replace(/\/?$/, "/")}${PROBE}.jsonl`,
        rows.current.join("\n") + "\n",
        { encoding: "utf8" },
      )
    },
    [record],
  )
  const fail = useCallback(
    (error: unknown) => {
      if (closed.current) return
      record({ kind: "failure", error: String(error) })
      void persist("failed").catch((reason: unknown) => console.warn(`CUI_CARD_CALLBACK_PERSIST ${String(reason)}`))
    },
    [persist, record],
  )
  const capture = (value: TNativeMotionGeometryRecord) => {
    const key = `${value.target}:${value.geometryRevision}`
    if (captured.current.has(key)) return
    captured.current.add(key)
    record({ kind: "native-geometry", actual: value })
  }
  useInsertionEffect(() => {
    record({
      kind: "begin",
      sourceProducer: SOURCE_PRODUCER,
      scope:
        "Actual private Card layout and original geometry observer records; no genuine input/pixel/font/full-Card verdict",
    })
  }, [record])
  useEffect(() => {
    const timeout = setTimeout(() => fail("native-card-callback-gate-timeout"), 45000)
    return () => clearTimeout(timeout)
  }, [fail])
  advance.current = (value) => {
    const current = phase.current
    if (!value.snapshot || closed.current || advanced.current.has(current)) return
    if (!initial.current) {
      if (value.kind !== "frame" || value.snapshot.layout[2] <= 0) return
      initial.current = value
      original.current = root.current
    } else {
      if (!completed.current.has(current) || (value.kind !== "frame" && value.kind !== "sample")) return
      const expected = initial.current.snapshot!.layout[0] + (current === "out" ? 40 : 0)
      if (Math.abs(value.snapshot.layout[0] - expected) > 0.001) return
    }
    advanced.current.add(current)
    capture(value)
    record({
      kind: "settled-native-layout",
      actual: value,
      sameRoot: root.current === original.current,
      actualTarget: root.current ? findNodeHandle(root.current) : null,
      callbacks: { ...callbacks.current },
    })
    if (current === "back") {
      void persist("native-records-complete").catch(fail)
      return
    }
    setTimeout(() => {
      if (closed.current) return
      phase.current = current === "initial" ? "out" : "back"
      record({ kind: "authoring-command", marginLeft: phase.current === "out" ? 40 : 0 })
      setStage(phase.current)
    }, 0)
  }
  useEffect(
    () =>
      observeNativeMotionGeometry(root.current, (value) => {
        if (!value?.attached || !value.snapshot) return
        if (value.kind !== "frame" || !frames.current.has(phase.current)) {
          capture(value)
          if (value.kind === "frame") frames.current.add(phase.current)
        }
        advance.current(value)
      }),
    [record],
  )
  const motion = useMemo(
    () => ({
      transition: { duration: 0.1, ease: "linear" as const },
      onBeforeLayoutMeasure: (...args: Box[]) => {
        callbacks.current.before++
        record({
          kind: "source-callback",
          name: "before",
          callbackStage: stage,
          args: args.map((value) => (value === undefined ? "$undefined" : value)),
          sameRoot: root.current === original.current,
        })
      },
      onLayoutMeasure: (...args: Box[]) => {
        callbacks.current.measure++
        record({
          kind: "source-callback",
          name: "measure",
          callbackStage: stage,
          args: args.map((value) => (value === undefined ? "$undefined" : value)),
          sameRoot: root.current === original.current,
        })
      },
      onLayoutAnimationStart: () => record({ kind: "source-callback", name: "start", callbackStage: stage }),
      onLayoutAnimationComplete: () => {
        record({ kind: "source-callback", name: "complete", callbackStage: stage })
        if (stage !== "initial" && phase.current === stage) {
          completed.current.add(stage)
          void readNativeMotionGeometry(root.current)
            .then((value) => {
              if (closed.current || phase.current !== stage) return
              advance.current(value)
            })
            .catch(fail)
        }
      },
    }),
    [fail, record, stage],
  )
  return (
    <Boundary fail={fail}>
      <NativeKeyboardScope captureEnabled>
        <View style={{ flex: 1, padding: 24 }}>
          <NativeMotionConfig reducedMotion="never">
            <Card
              {...motion}
              ref={root}
              layoutMode="position"
              width={100}
              height={80}
              style={{ marginLeft: stage === "out" ? 40 : 0, backgroundColor: "#4488cc" }}
            />
          </NativeMotionConfig>
        </View>
      </NativeKeyboardScope>
    </Boundary>
  )
}

export default () => (
  <NativeThemeProvider>
    <Gate />
  </NativeThemeProvider>
)
