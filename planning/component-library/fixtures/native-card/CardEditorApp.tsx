import { requireNativeModule } from "expo"
import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  findNodeHandle,
  PixelRatio,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputChangeEventData,
  type TextInputSelectionChangeEventData,
} from "react-native"

import { Card } from "../../../../packages/react-native/src/components/Card/Card"
import {
  observeNativeMotionGeometry,
  readNativeMotionGeometry,
  type TNativeMotionGeometryRecord,
} from "../../../../packages/react-native/src/input/motionGeometry"
import { NativeKeyboardScope } from "../../../../packages/react-native/src/input/NativeKeyboardScope"
import { NativeMotionConfig } from "../../../../packages/react-native/src/motion/config"
import { resolveNativeMotionIsolatedLayout } from "../../../../packages/react-native/src/motion/measurement/isolatedGeometry"
import type { TNativeMotionResolutionToken } from "../../../../packages/react-native/src/motion/value/types"
import { NativeThemeProvider } from "../../../../packages/react-native/src/theme"

import { SOURCE_PRODUCER } from "./callback-identity"

type TPhase = "initial" | "narrow" | "restore"
type TFileSystem = {
  cacheDirectory: string | null
  readAsStringAsync: (path: string, options: { encoding: "utf8" }) => Promise<string>
  writeAsStringAsync: (path: string, value: string, options: { encoding: "utf8" }) => Promise<void>
}
const DIRTY = "Held editor 123 with enough text to wrap into several native lines."
const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

class Boundary extends Component<{ fail: (error: unknown) => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override componentDidCatch(error: Error) {
    this.props.fail(error)
  }
  override render() {
    return this.state.failed ? <Text>Card editor gate failed</Text> : this.props.children
  }
}

const Gate = () => {
  const [phase, setPhase] = useState<TPhase>("initial")
  const width = phase === "narrow" ? 180 : 240
  const first = useRef<View>(null),
    second = useRef<View>(null)
  const empty = useRef<TextInput>(null),
    dirty = useRef<TextInput>(null)
  const roots = useMemo(() => [first, second] as const, [])
  const fields = useMemo(() => [empty, dirty] as const, [])
  const geometry = useRef<(TNativeMotionGeometryRecord | undefined)[]>([])
  const originals = useRef<{ roots: View[]; fields: TextInput[] } | null>(null)
  const rows = useRef<string[]>([]),
    closed = useRef(false)
  const counts = useRef([
    { change: 0, text: 0, selection: 0 },
    { change: 0, text: 0, selection: 0 },
  ])
  const values = useRef(["", DIRTY])
  const currentPhase = useRef(phase)
  currentPhase.current = phase
  const record = useCallback((value: Record<string, unknown>) => {
    if (closed.current) return
    const text = JSON.stringify({
      sequence: rows.current.length + 1,
      phase: currentPhase.current,
      observedAt: Date.now(),
      ...value,
    })
    rows.current.push(text)
    const parts = Math.ceil(text.length / 768)
    for (let part = 0; part < parts; part++)
      console.warn(
        "CUI_CARD_EDITOR_CHUNK " +
          JSON.stringify({
            message: rows.current.length,
            part,
            parts,
            content: text.slice(part * 768, (part + 1) * 768),
          }),
      )
  }, [])
  const persist = useCallback(
    async (outcome: string) => {
      record({ kind: "terminal", outcome, producer: SOURCE_PRODUCER })
      closed.current = true
      const fs = requireNativeModule<TFileSystem>("ExponentFileSystem")
      if (!fs.cacheDirectory) throw new Error("Original app cache directory unavailable")
      await fs.writeAsStringAsync(
        `${fs.cacheDirectory}card-editor-${SOURCE_PRODUCER}.jsonl`,
        rows.current.join("\n") + "\n",
        { encoding: "utf8" },
      )
    },
    [record],
  )
  const fail = useCallback(
    (reason: unknown) => {
      if (closed.current) return
      record({ kind: "failure", reason: String(reason) })
      void persist("failed").catch((error: unknown) => console.warn(String(error)))
    },
    [persist, record],
  )
  const callbacks = useMemo(
    () =>
      fields.map((_ref, field) => ({
        onChange: (event: NativeSyntheticEvent<TextInputChangeEventData>) => {
          counts.current[field].change++
          record({ kind: "change", field, original: event.nativeEvent })
        },
        onChangeText: (value: string) => {
          counts.current[field].text++
          values.current[field] = value
          record({ kind: "change-text", field, value })
        },
        onSelectionChange: (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
          counts.current[field].selection++
          record({ kind: "selection", field, original: event.nativeEvent })
        },
      })),
    [fields, record],
  )
  useLayoutEffect(() => {
    record({ kind: "begin", producer: SOURCE_PRODUCER, density: PixelRatio.get() })
    const stops = roots.map((ref, index) =>
      observeNativeMotionGeometry(ref.current!, (value) => {
        geometry.current[index] = value
      }),
    )
    return () => {
      stops.forEach((stop) => stop())
    }
  }, [record, roots])
  useEffect(() => {
    const timeout = setTimeout(() => fail("card-editor-scene-deadline"), 180000)
    return () => clearTimeout(timeout)
  }, [fail])
  useEffect(() => {
    let active = true
    const cancellations = new Set<() => void>()
    const token: TNativeMotionResolutionToken = {
      isCurrent: () => active && !closed.current,
      onCancel: (listener) => {
        cancellations.add(listener)
        return () => {
          cancellations.delete(listener)
        }
      },
    }
    const marker = async (mode: "before" | "after") => {
      const fs = requireNativeModule<TFileSystem>("ExponentFileSystem")
      if (!fs.cacheDirectory) throw new Error("No actual native marker cache")
      while (token.isCurrent()) {
        let encoded: string | undefined
        try {
          encoded = await fs.readAsStringAsync(
            `${fs.cacheDirectory}card-editor-${mode}-${SOURCE_PRODUCER}-${phase}.json`,
            { encoding: "utf8" },
          )
        } catch {
          await delay(100)
          continue
        }
        const value: unknown = JSON.parse(encoded)
        if (
          !value ||
          typeof value !== "object" ||
          !("producer" in value) ||
          value.producer !== SOURCE_PRODUCER ||
          !("phase" in value) ||
          value.phase !== phase ||
          !("kind" in value) ||
          value.kind !== `native-editor-${mode}`
        )
          throw new Error("Original native inspection marker mismatch")
        return
      }
      throw new Error("Card editor phase retired")
    }
    void (async () => {
      let ready = false
      while (token.isCurrent()) {
        if (roots.every((ref) => ref.current) && fields.every((ref) => ref.current)) {
          if (
            roots.every((_ref, index) => {
              const row = geometry.current[index]
              return row?.snapshot && Math.abs(row.snapshot.layout[2] - width) < 1 / PixelRatio.get()
            })
          ) {
            const current = await Promise.all(roots.map((ref) => readNativeMotionGeometry(ref.current!, token)))
            const points = await Promise.all(
              fields.map(
                (ref) =>
                  new Promise<readonly number[]>((resolve) => {
                    ref.current!.measureInWindow((x, y, measuredWidth, height) =>
                      resolve([x, y, measuredWidth, height]),
                    )
                  }),
              ),
            )
            if (!originals.current)
              originals.current = { roots: roots.map((ref) => ref.current!), fields: fields.map((ref) => ref.current!) }
            if (
              !roots.every((ref, index) => ref.current === originals.current!.roots[index]) ||
              !fields.every((ref, index) => ref.current === originals.current!.fields[index])
            )
              throw new Error("Original Card/editor ref replaced")
            record({
              kind: "phase-ready",
              width,
              geometry: current,
              fields: fields.map((ref, index) => ({
                tag: findNodeHandle(ref.current),
                points: points[index],
              })),
              density: PixelRatio.get(),
              values: [...values.current],
            })
            ready = true
            break
          }
        }
        await delay(100)
      }
      if (!ready) return
      await marker("before")
      const priorCounts = JSON.parse(JSON.stringify(counts.current)) as typeof counts.current
      const priorValues = [...values.current]
      for (let field = 0; field < roots.length; field++) {
        const target = roots[field].current!
        const before = await readNativeMotionGeometry(target, token)
        const result = await resolveNativeMotionIsolatedLayout(
          target,
          [240, 180, 240].map((value, index) => ({
            index,
            nativeView: { width: value, height: "auto" },
          })),
          ["width", "height"],
          token,
        )
        const after = await readNativeMotionGeometry(target, token)
        if (
          JSON.stringify(counts.current) !== JSON.stringify(priorCounts) ||
          JSON.stringify(values.current) !== JSON.stringify(priorValues)
        )
          throw new Error("Measurement emitted editor callbacks")
        if (
          roots[field].current !== originals.current!.roots[field] ||
          fields[field].current !== originals.current!.fields[field]
        )
          throw new Error("Measurement replaced an original ref")
        record({
          kind: "evaluated",
          field,
          before,
          result,
          after,
          callbacksBefore: priorCounts,
          callbacksAfter: JSON.parse(JSON.stringify(counts.current)),
          values: [...values.current],
          sameRefs: true,
        })
      }
      record({ kind: "queries-complete" })
      await marker("after")
      record({ kind: "phase-complete" })
      if (phase === "restore") await persist("native-editor-records-complete")
      else setPhase(phase === "initial" ? "narrow" : "restore")
    })().catch((reason: unknown) => {
      if (active) fail(reason)
    })
    return () => {
      active = false
      for (const cancel of cancellations) cancel()
      cancellations.clear()
    }
  }, [fail, fields, persist, phase, record, roots, width])
  return (
    <Boundary fail={fail}>
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <Text>Card native editor isolation: {phase}</Text>
        {fields.map((ref, index) => (
          <Card
            key={index}
            ref={roots[index]}
            width={width}
            borderRadius={0}
            raised={false}
            layoutMode={undefined}
            style={{ padding: 8, gap: 0 }}
          >
            <TextInput
              ref={ref}
              testID={`card-editor-${index}`}
              defaultValue={index === 0 ? "" : DIRTY}
              placeholder={index === 0 ? "Empty native editor placeholder" : undefined}
              multiline
              autoCorrect={false}
              autoCapitalize="none"
              style={{ width: "100%", fontFamily: "serif", fontSize: 18, fontVariant: ["tabular-nums"] }}
              {...callbacks[index]}
            />
          </Card>
        ))}
        <Text>Editors stay uncontrolled while the native evaluator runs.</Text>
      </View>
    </Boundary>
  )
}

export default () => (
  <NativeThemeProvider>
    <NativeKeyboardScope captureEnabled={true} style={{ flex: 1 }}>
      <NativeMotionConfig reducedMotion="never">
        <Gate />
      </NativeMotionConfig>
    </NativeKeyboardScope>
  </NativeThemeProvider>
)
