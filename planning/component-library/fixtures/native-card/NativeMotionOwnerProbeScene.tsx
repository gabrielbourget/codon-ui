import { useLayoutEffect, useRef, useState } from "react"
import { Button, ScrollView, Text, TextInput, View } from "react-native"

import { readNativeMotionGeometry } from "../../../../packages/react-native/src/input/motionGeometry"
import { NativeKeyboardScope } from "../../../../packages/react-native/src/input/NativeKeyboardScope"
import { useNativeAnimationControls } from "../../../../packages/react-native/src/motion/animation/hooks"
import { NativeMotionConfig } from "../../../../packages/react-native/src/motion/config"
import type { TNativeReducedMotionMode } from "../../../../packages/react-native/src/motion/config"
import type { TNativeMotionPanInfo } from "../../../../packages/react-native/src/motion/interactions/types"
import { NativeMotionOwnerHost } from "../../../../packages/react-native/src/motion/owner/NativeMotionOwnerHost"

// Non-shipping actual-owner scene. Source callbacks/settled promises are not native paint acknowledgments.
export const NativeMotionOwnerProbeScene = () => {
  const controls = useNativeAnimationControls()
  const root = useRef<View>(null),
    editor = useRef<TextInput>(null),
    alive = useRef(true)
  const original = useRef<{ root: View | null; editor: TextInput | null } | null>(null)
  const [visible, setVisible] = useState(true),
    [skip, setSkip] = useState(false)
  const [interactions, setInteractions] = useState(false)
  const panSamples = useRef<{ identity: number | string; source: "pointer" | "touch"; info: TNativeMotionPanInfo }[]>(
    [],
  )
  const [reduced, setReduced] = useState<TNativeReducedMotionMode>("user")
  const [journal, setJournal] = useState<readonly unknown[]>([])
  const append = (data: unknown) => {
    if (alive.current) setJournal((current) => [...current, data])
  }
  const identity = () => ({
    sameRoot: root.current === original.current?.root,
    sameEditor: editor.current === original.current?.editor,
  })
  useLayoutEffect(() => {
    alive.current = true
    original.current = { root: root.current, editor: editor.current }
    return () => {
      alive.current = false
    }
  }, [])
  const animate = async () => {
    original.current = { root: root.current, editor: editor.current }
    append({ event: "request", ...identity() })
    try {
      await controls.start({ x: [0, 80, 0], opacity: [1, 0.3, 1], transition: { duration: 1, ease: "linear" } })
      append({ event: "request-settled", ...identity() })
    } catch (error) {
      append({ event: "request-failed", error: String(error), ...identity() })
    }
  }
  const inspect = async () => {
    const target = root.current
    if (!target) return
    try {
      append({ event: "actual-native-geometry", data: await readNativeMotionGeometry(target), ...identity() })
    } catch (error) {
      append({ event: "native-query-failed", error: String(error), ...identity() })
    }
  }
  return (
    <NativeKeyboardScope captureEnabled>
      <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Text>Private owner probe. Native text/selection/presentation need independent inspection.</Text>
        <Button
          title="Animate original root"
          onPress={() => {
            void animate()
          }}
        />
        <Button title="Stop" onPress={() => controls.stop()} />
        <Button
          title="Inspect recent source pan samples"
          onPress={() => append({ event: "recent-source-pan-samples", samples: [...panSamples.current] })}
        />
        <Button title="Set original root" onPress={() => controls.set({ x: 0, opacity: 1 })} />
        <Button title="Toggle scoped skip" onPress={() => setSkip((current) => !current)} />
        <Button
          title="Toggle tap/hover/focus/pan on original root"
          onPress={() => setInteractions((current) => !current)}
        />
        <Button
          title={`Reduced motion: ${reduced}`}
          onPress={() =>
            setReduced((current) => (current === "user" ? "always" : current === "always" ? "never" : "user"))
          }
        />
        <Button title={visible ? "Remove root" : "Show root"} onPress={() => setVisible((current) => !current)} />
        <Button
          title="Inspect original native root"
          onPress={() => {
            void inspect()
          }}
        />
        <NativeMotionConfig skipAnimations={skip} reducedMotion={reduced} transition={{ duration: 0.4 }}>
          {visible && (
            <NativeMotionOwnerHost
              ref={root}
              style={{ padding: 16, minHeight: 120, borderWidth: 1 }}
              motion={{
                initial: { x: 0, scale: 1, opacity: 1 },
                animate: controls,
                ...(interactions
                  ? {
                      whileTap: { scale: 0.95 },
                      whileHover: { scale: 1.03 },
                      whileFocus: { opacity: 0.7 },
                      onTapStart: (event, info) =>
                        append({
                          event: "source-tap-start",
                          native: event.nativeEvent,
                          info,
                          ...identity(),
                        }),
                      onTap: (event, info) =>
                        append({ event: "source-tap", native: event.nativeEvent, info, ...identity() }),
                      onTapCancel: (event, info) =>
                        append({
                          event: "source-tap-cancel",
                          native: event.nativeEvent,
                          info,
                          ...identity(),
                        }),
                      onHoverStart: (event, info) =>
                        append({
                          event: "source-hover-start",
                          native: event.nativeEvent,
                          info,
                          ...identity(),
                        }),
                      onHoverEnd: (event, info) =>
                        append({
                          event: "source-hover-end",
                          native: event.nativeEvent,
                          info,
                          ...identity(),
                        }),
                      onPanSessionStart: (event, info) => {
                        panSamples.current = []
                        append({
                          event: "source-pan-session",
                          native: event.nativeEvent,
                          info,
                          ...identity(),
                        })
                      },
                      onPanStart: (event, info) =>
                        append({
                          event: "source-pan-start",
                          native: event.nativeEvent,
                          info,
                          ...identity(),
                        }),
                      onPan: (event, info) => {
                        if (panSamples.current.length < 256) {
                          const data = event.nativeEvent
                          panSamples.current.push({
                            identity: "pointerId" in data ? data.pointerId : data.identifier,
                            source: "pointerId" in data ? "pointer" : "touch",
                            info,
                          })
                        }
                      },
                      onPanEnd: (event, info) =>
                        append({
                          event: "source-pan-end",
                          native: event.nativeEvent,
                          info,
                          ...identity(),
                        }),
                    }
                  : {}),
                onAnimationStart: (definition) =>
                  append({ event: "source-animation-start", definition, ...identity() }),
                onAnimationComplete: (definition) =>
                  append({ event: "source-animation-complete", definition, ...identity() }),
              }}
            >
              <TextInput
                ref={editor}
                value=""
                placeholder="Owner declines text requests"
                onChangeText={(text) => append({ event: "editor-request", text, authoredValue: "", ...identity() })}
              />
            </NativeMotionOwnerHost>
          )}
        </NativeMotionConfig>
        <Text selectable>{JSON.stringify(journal, null, 2)}</Text>
      </ScrollView>
    </NativeKeyboardScope>
  )
}
