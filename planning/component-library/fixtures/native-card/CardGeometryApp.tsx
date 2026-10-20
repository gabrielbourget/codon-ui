import { requireNativeModule } from "expo"
import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { findNodeHandle, Text, TextInput, View } from "react-native"

import { Card } from "../../../../packages/react-native/src/components/Card/Card"
import {
  observeNativeMotionGeometry,
  requireNativeMotionGeometryCapabilities,
  type TNativeMotionGeometryRecord,
} from "../../../../packages/react-native/src/input/motionGeometry"
import { NativeKeyboardScope } from "../../../../packages/react-native/src/input/NativeKeyboardScope"
import { NativeThemeProvider } from "../../../../packages/react-native/src/theme"

import { SOURCE_PRODUCER } from "./geometry-identity"

const PROBE = "codon-native-card-geometry-v1"
const PHASES = ["initial", "narrow", "restore"] as const
const WIDTHS = [120, 96, 120]
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
    return this.state.failed ? <Text>Card geometry gate failed</Text> : this.props.children
  }
}

const Gate = () => {
  const [stage, setStage] = useState(0)
  const phase = useRef(0)
  const target = useRef<View>(null)
  const empty = useRef<TextInput>(null)
  const dirty = useRef<TextInput>(null)
  const original = useRef<readonly unknown[] | null>(null)
  const closed = useRef(false)
  const completed = useRef(new Set<number>())
  const frames = useRef(new Map<number, TNativeMotionGeometryRecord>())
  const mounts = useRef(new Map<number, TNativeMotionGeometryRecord>())
  const captured = useRef(new Set<number>())
  const rows = useRef<string[]>([])
  const textCallbacks = useRef(0)
  const record = useCallback((value: Record<string, unknown>) => {
    if (closed.current) return
    const row = { probe: PROBE, sequence: rows.current.length + 1, phase: PHASES[phase.current], ...value }
    rows.current.push(`CUI_CARD_GEOMETRY ${JSON.stringify(row)}`)
  }, [])
  const finish = useCallback(
    async (outcome: string) => {
      if (closed.current) return
      record({ kind: "terminal", outcome })
      closed.current = true
      const fs = requireNativeModule<TFileSystem>("ExponentFileSystem")
      if (!fs.cacheDirectory) throw new Error("Original native cache directory unavailable")
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
      void finish("failed").catch((reason: unknown) => console.warn(`CUI_CARD_GEOMETRY_PERSIST ${String(reason)}`))
    },
    [finish, record],
  )
  const accept = useRef<(value: TNativeMotionGeometryRecord) => void>(() => {})
  accept.current = (actual) => {
    if (closed.current || !actual.attached || !actual.snapshot) return
    if (!captured.current.has(actual.geometryRevision)) {
      captured.current.add(actual.geometryRevision)
      record({ kind: "native-geometry", actual })
    }
    const index = phase.current
    if (completed.current.has(index)) return
    if (Math.abs(actual.snapshot.layout[2] - WIDTHS[index]) > 0.001 || actual.snapshot.layout[3] !== 80) return
    const shape = actual.snapshot.ancestors.some((ancestor) => {
      const mask = ancestor.clip.mask as { nativePrimitive?: { kind?: string } } | null | undefined
      return mask?.nativePrimitive?.kind === "cui-owned-path-mask"
    })
    if (!shape) return
    if (actual.kind === "frame") frames.current.set(index, actual)
    if (actual.kind === "mount-after" && actual.transactionId) mounts.current.set(index, actual)
    const frame = frames.current.get(index)
    const mount = mounts.current.get(index)
    if (!frame || !mount || frame.geometryRevision <= mount.geometryRevision) return
    try {
      requireNativeMotionGeometryCapabilities(frame, { clipping: true, mount: true })
      requireNativeMotionGeometryCapabilities(mount, { clipping: true, mount: true })
      const refs = [target.current, empty.current, dirty.current]
      if (!refs.every(Boolean)) throw new Error("Original visible refs unavailable")
      original.current ??= refs
      if (!refs.every((ref, position) => ref === original.current![position]))
        throw new Error("Original visible refs replaced")
      completed.current.add(index)
      record({
        kind: "phase-complete",
        actual: frame,
        mount,
        actualTarget: target.current ? findNodeHandle(target.current) : null,
        sameRefs: true,
        editorTargets: [findNodeHandle(empty.current), findNodeHandle(dirty.current)],
        textCallbacks: textCallbacks.current,
      })
      if (index === PHASES.length - 1) {
        void finish("native-geometry-records-complete").catch(fail)
      } else {
        setTimeout(() => {
          if (closed.current) return
          phase.current = index + 1
          record({ kind: "authoring-command", width: WIDTHS[index + 1] })
          setStage(index + 1)
        }, 0)
      }
    } catch (error) {
      fail(error)
    }
  }
  useLayoutEffect(() => {
    record({
      kind: "begin",
      producer: SOURCE_PRODUCER,
      scope:
        "Actual mounted nested Card clip/observer/ref correspondence only; no typing, native editor-state, GPU pixel or full-family verdict",
    })
    return observeNativeMotionGeometry(target.current, (value) => {
      if (value) accept.current(value)
    })
  }, [record])
  useEffect(() => {
    const timer = setTimeout(() => fail("Original mounted Card geometry journal did not complete"), 45000)
    return () => clearTimeout(timer)
  }, [fail])
  return (
    <Boundary fail={fail}>
      <NativeKeyboardScope captureEnabled style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 24, gap: 12 }}>
          <Text>Actual mounted Card geometry: {PHASES[stage]}</Text>
          <Card
            width={240}
            height={220}
            raised={false}
            style={{
              padding: 12,
              overflow: "hidden",
              outlineWidth: 2,
              borderCurve: "continuous",
              borderTopLeftRadius: 30,
              borderTopRightRadius: 12,
              borderBottomLeftRadius: 5,
              borderBottomRightRadius: 22,
              backgroundColor: "#d0d0f0",
            }}
          >
            <Card
              ref={target}
              width={WIDTHS[stage]}
              height={80}
              raised={false}
              onLayout={(event) => record({ kind: "source-layout", layout: event.nativeEvent.layout })}
              style={{ padding: 8, gap: 2, backgroundColor: "#4488cc" }}
            >
              <TextInput
                ref={empty}
                defaultValue=""
                accessibilityLabel="Held empty editor"
                style={{ height: 24, padding: 0, fontSize: 12 }}
                onChangeText={() => textCallbacks.current++}
              />
              <TextInput
                ref={dirty}
                defaultValue="Held dirty editor"
                accessibilityLabel="Held dirty editor"
                style={{ height: 24, padding: 0, fontSize: 12 }}
                onChangeText={() => textCallbacks.current++}
              />
            </Card>
          </Card>
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
