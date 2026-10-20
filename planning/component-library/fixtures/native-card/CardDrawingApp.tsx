import { requireNativeModule } from "expo"
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { AppState, Dimensions, findNodeHandle, PixelRatio, Text, View, type ViewStyle } from "react-native"

import { Card } from "../../../../packages/react-native/src/components/Card/Card"
import { NativeFocusHost } from "../../../../packages/react-native/src/input/NativeFocusView"
import { NativeKeyboardScope } from "../../../../packages/react-native/src/input/NativeKeyboardScope"
import { NativeThemeProvider } from "../../../../packages/react-native/src/theme"

import { DRAWING_STEPS, identityRadii } from "./drawing-profiles"
import { SOURCE_PRODUCER } from "./geometry-identity"

const PROBE = "codon-native-card-drawing-v1"
type TFileSystem = {
  cacheDirectory: string | null
  writeAsStringAsync: (path: string, value: string, options: { encoding: "utf8" }) => Promise<void>
  readAsStringAsync: (path: string, options: { encoding: "utf8" }) => Promise<string>
}
const fs = () => {
  const value = requireNativeModule<TFileSystem>("ExponentFileSystem")
  if (!value.cacheDirectory) throw new Error("Native cache directory unavailable")
  return { value, base: value.cacheDirectory.replace(/\/?$/, "/") + PROBE }
}
const write = async (value: Record<string, unknown>) => {
  const file = fs()
  await file.value.writeAsStringAsync(
    file.base + ".ready.json",
    JSON.stringify({ probe: PROBE, producer: SOURCE_PRODUCER, ...value }),
    { encoding: "utf8" },
  )
}
const frame = (target: View) =>
  new Promise<readonly number[]>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Original native window measurement timed out")), 5000)
    target.measureInWindow((x, y, width, height) => {
      clearTimeout(timer)
      if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0)
        reject(new Error("Invalid actual native frame"))
      else resolve([x, y, width, height])
    })
  })
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override componentDidCatch(error: Error) {
    void write({ status: "failure", error: error.message })
  }
  override render() {
    return this.state.failed ? <Text>Drawing capture failed</Text> : this.props.children
  }
}

const Pair = ({ step, nonce, advance }: { step: number; nonce: string; advance: () => void }) => {
  const item = DRAWING_STEPS[step]!
  const left = useRef<View>(null),
    right = useRef<View>(null),
    marker = useRef<View>(null)
  const start = Math.floor((Dimensions.get("window").width - 360) / 2)
  const common: ViewStyle = { position: "absolute", top: 184, width: 120, height: 80, padding: 0, gap: 0 }
  const rightStyle: ViewStyle = { ...item.profile.style, ...common, left: start + 216 }
  if (item.profile.defaultRaised && item.kind === "owned" && item.mode === "authored") delete rightStyle.boxShadow
  useEffect(() => {
    let live = true
    const run = async () => {
      await nextFrame()
      await nextFrame()
      const original = [left.current, right.current, marker.current] as const
      if (!original.every(Boolean)) throw new Error("Original native refs required")
      const targets = original.map((value) => findNodeHandle(value))
      if (targets.some((value) => typeof value !== "number" || value <= 0) || new Set(targets).size !== 3)
        throw new Error("Distinct original native targets required")
      const frames = await Promise.all(original.map((value) => frame(value!)))
      if (!live) return
      if (AppState.currentState !== "active") throw new Error("Drawing app is not foreground active")
      await write({
        status: "ready",
        nonce,
        step,
        pairIndex: item.pairIndex,
        profile: item.profile.name,
        mode: item.mode,
        kind: item.kind,
        control: item.profile.control,
        frames,
        targets,
        density: PixelRatio.get(),
        screen: Dimensions.get("screen"),
        appState: AppState.currentState,
        scope: "Original native window frames and displayed peer drawing only; no editor/input/full Card verdict",
      })
      const deadline = Date.now() + 30000
      while (live && Date.now() < deadline) {
        const file = fs()
        try {
          const ack = JSON.parse(await file.value.readAsStringAsync(file.base + ".ack.json", { encoding: "utf8" })) as {
            nonce?: string
            step?: number
            screenshotSHA256?: string
          }
          if (ack.nonce === nonce && ack.step === step && /^[a-f0-9]{64}$/.test(ack.screenshotSHA256 ?? "")) {
            if (left.current !== original[0] || right.current !== original[1] || marker.current !== original[2])
              throw new Error("Original refs replaced before capture")
            advance()
            return
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes("Original refs")) throw error
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 100))
      }
      if (live) throw new Error("Original screenshot acknowledgement timed out")
    }
    void run().catch((error: unknown) => {
      if (live) void write({ status: "failure", nonce, step, error: String(error) })
    })
    return () => {
      live = false
    }
  }, [advance, item, nonce, step])
  return (
    <>
      <Text style={{ position: "absolute", top: 56, left: 16, fontSize: 14 }}>
        {step + 1}/{DRAWING_STEPS.length} {item.profile.name} {item.mode} {item.kind}
      </Text>
      <View
        ref={marker}
        collapsable={false}
        style={{ position: "absolute", top: 104, left: 16, width: 32, height: 8, flexDirection: "row" }}
      >
        {Array.from({ length: 8 }, (_, bit) => (
          <View
            key={bit}
            style={{ width: 4, height: 8, backgroundColor: (step + 1) & (1 << bit) ? "#000000" : "#ffffff" }}
          />
        ))}
      </View>
      <View ref={left} collapsable={false} style={{ ...item.profile.style, ...common, left: start + 24 }} />
      {item.kind === "calibration" ? (
        <View ref={right} collapsable={false} style={rightStyle} />
      ) : item.mode === "identity" ? (
        <NativeFocusHost
          ref={right}
          nativeMotionDrawingOwner
          nativeMotionProjectionRadii={identityRadii(item.profile.style)}
          style={rightStyle}
        />
      ) : (
        <Card
          ref={right}
          width={120}
          height={80}
          raised={item.profile.defaultRaised ? undefined : false}
          style={rightStyle}
        />
      )}
    </>
  )
}

const Gate = () => {
  const [step, setStep] = useState(0)
  const [nonce] = useState(() => `${SOURCE_PRODUCER}:${Date.now()}`)
  const complete = useRef(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!complete.current) void write({ status: "failure", nonce, error: "Drawing scene total deadline reached" })
    }, 390000)
    return () => clearTimeout(timer)
  }, [nonce])
  useEffect(() => {
    if (step === DRAWING_STEPS.length) {
      complete.current = true
      void write({ status: "complete", nonce, capturedSteps: step, fullCard: false, fullGoal: false })
    }
  }, [nonce, step])
  const advance = useCallback(() => setStep((value) => value + 1), [])
  if (step === DRAWING_STEPS.length) {
    return <Text>Native drawing captures complete</Text>
  }
  return <Pair key={step} step={step} nonce={nonce} advance={advance} />
}

export default () => (
  <NativeThemeProvider mode="light">
    <Boundary>
      <NativeKeyboardScope captureEnabled style={{ flex: 1, backgroundColor: "#ffffff" }}>
        <View style={{ flex: 1, backgroundColor: "#ffffff" }}>
          <Gate />
        </View>
      </NativeKeyboardScope>
    </Boundary>
  </NativeThemeProvider>
)
