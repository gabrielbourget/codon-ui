import { useLayoutEffect, useRef, useState } from "react"
import { Button, Platform, ScrollView, Text, TextInput, View } from "react-native"

import { readNativeMotionGeometry } from "../../../../packages/react-native/src/input/motionGeometry"
import { NativeKeyboardScope } from "../../../../packages/react-native/src/input/NativeKeyboardScope"
import { NativeFocusHost } from "../../../../packages/react-native/src/input/NativeFocusView"
import { useNativeAnimationControls } from "../../../../packages/react-native/src/motion/animation/hooks"
import { NativeMotionConfig } from "../../../../packages/react-native/src/motion/config"
import type { TNativeReducedMotionMode } from "../../../../packages/react-native/src/motion/config"
import type { TNativeMotionPanInfo } from "../../../../packages/react-native/src/motion/interactions/types"
import { useNativeDragControls } from "../../../../packages/react-native/src/motion/interactions/NativeDragControls"
import { readNativeMotionTargetGeometry } from "../../../../packages/react-native/src/motion/measurement/targetGeometry"
import { NativeMotionOwnerHost } from "../../../../packages/react-native/src/motion/owner/NativeMotionOwnerHost"
import { NativeAnimatePresence } from "../../../../packages/react-native/src/motion/presence/NativeAnimatePresence"
import { NativeLayoutGroup } from "../../../../packages/react-native/src/motion/projection/NativeLayoutGroup"
import type { TNativeViewportEntry } from "../../../../packages/react-native/src/motion/viewport/types"

// Non-shipping actual-owner scene. Source callbacks/settled promises are not native paint acknowledgments.
export const NativeMotionOwnerProbeScene = () => {
  const controls = useNativeAnimationControls()
  const dragControls = useNativeDragControls()
  const root = useRef<View>(null),
    constraint = useRef<View>(null),
    editor = useRef<TextInput>(null),
    alive = useRef(true)
  const original = useRef<{ root: View | null; editor: TextInput | null } | null>(null)
  const [visible, setVisible] = useState(true),
    [skip, setSkip] = useState(false)
  const [interactions, setInteractions] = useState(false)
  const [dragEnabled, setDragEnabled] = useState(false)
  const [viewportEnabled, setViewportEnabled] = useState(false)
  const [drawingWide, setDrawingWide] = useState(false)
  const [shifted, setShifted] = useState(false)
  const dragSamples = useRef<TNativeMotionPanInfo[]>([])
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
  const inspectConstraint = async () => {
    const owner = root.current,
      target = constraint.current
    if (!owner || !target) return
    try {
      const data = await readNativeMotionTargetGeometry(owner, target, {
        isCurrent: () => alive.current && root.current === owner && constraint.current === target,
        onCancel: () => () => {},
      })
      append({ event: "actual-ordinary-view-geometry", data, ...identity() })
    } catch (error) {
      append({ event: "native-target-query-failed", error: String(error), ...identity() })
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
        <Button title="Toggle constrained drag" onPress={() => setDragEnabled((current) => !current)} />
        <Button title="Toggle viewport observation" onPress={() => setViewportEnabled((current) => !current)} />
        {Platform.OS === "ios" && (
          <>
            <Button title="Change private drawing radii" onPress={() => setDrawingWide((current) => !current)} />
            <NativeFocusHost
              nativeMotionDrawingOwner
              nativeMotionProjectionRadii={JSON.stringify({
                topLeft: { x: drawingWide ? 32 : 16, y: 8 },
                topRight: null,
                bottomLeft: null,
                bottomRight: { x: 10, y: drawingWide ? 24 : 12 },
              })}
              style={{
                minHeight: 100,
                padding: 16,
                borderRadius: 20,
                borderWidth: 4,
                borderColor: "#2855aa",
                backgroundColor: "#eef2f8",
                shadowColor: "#161616",
                shadowOpacity: 0.3,
                shadowRadius: 8,
                shadowOffset: { width: 2, height: 4 },
                boxShadow: [{ offsetX: 0, offsetY: 5, blurRadius: 8, color: "#16161660" }],
                overflow: "hidden",
              }}
            >
              <Text>Private iOS drawing probe; native pixels/defaults remain unverified.</Text>
              <TextInput value="" onChangeText={() => {}} placeholder="Original held-empty drawing editor" />
            </NativeFocusHost>
          </>
        )}
        <Button title="Move original layout" onPress={() => setShifted((current) => !current)} />
        <Button title="Stop drag with inertia" onPress={dragControls.stop} />
        <Button title="Cancel drag" onPress={dragControls.cancel} />
        <Button
          title="Inspect recent source drag samples"
          onPress={() => append({ event: "recent-source-drag-samples", samples: [...dragSamples.current] })}
        />
        <View
          onTouchStart={(event) => {
            if (dragEnabled) dragControls.start(event, { snapToCursor: true })
          }}
          style={{ padding: 16, borderWidth: 1 }}
        >
          <Text>Manual drag handle: move this touch through the native scope.</Text>
        </View>
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
        <Button title="Inspect ordinary constraint view" onPress={() => void inspectConstraint()} />
        <View ref={constraint} collapsable={false} style={{ padding: 12, minHeight: 180, borderWidth: 1 }}>
          <NativeMotionConfig skipAnimations={skip} reducedMotion={reduced} transition={{ duration: 0.4 }}>
            <NativeLayoutGroup id="owner-probe">
              <NativeAnimatePresence
                mode="sync"
                onExitComplete={() => append({ event: "source-presence-exit-complete", ...identity() })}
              >
                {visible && (
                  <NativeMotionOwnerHost
                    key="original-owner"
                    ref={root}
                    style={{ padding: 16, minHeight: 120, borderWidth: 1, marginLeft: shifted ? 40 : 0 }}
                    motion={{
                      initial: { x: 0, scale: 1, opacity: 1 },
                      animate: controls,
                      exit: { opacity: 0, x: 30 },
                      layout: "position",
                      onBeforeLayoutMeasure: () => append({ event: "source-before-layout-measure", ...identity() }),
                      onLayoutMeasure: (layout, previous) =>
                        append({ event: "source-layout-measure", layout, previous, ...identity() }),
                      onLayoutAnimationStart: () => append({ event: "source-layout-animation-start", ...identity() }),
                      onLayoutAnimationComplete: () =>
                        append({ event: "source-layout-animation-complete", ...identity() }),
                      drag: dragEnabled,
                      ...(viewportEnabled
                        ? {
                            whileInView: { opacity: 0.65 },
                            viewport: { root: constraint, margin: "12% 0px", amount: "all" as const },
                            onViewportEnter: (entry: TNativeViewportEntry) =>
                              append({
                                event: "source-viewport-enter",
                                time: entry.time,
                                ratio: entry.intersectionRatio,
                                targetIsOriginal: entry.target === root.current,
                                bounds: entry.boundingClientRect.toJSON(),
                                rootBounds: entry.rootBounds?.toJSON(),
                                intersection: entry.intersectionRect.toJSON(),
                                ...identity(),
                              }),
                            onViewportLeave: (entry: TNativeViewportEntry) =>
                              append({
                                event: "source-viewport-leave",
                                time: entry.time,
                                ratio: entry.intersectionRatio,
                                targetIsOriginal: entry.target === root.current,
                                ...identity(),
                              }),
                          }
                        : {}),
                      dragControls,
                      dragConstraints: constraint,
                      whileDrag: { scale: 1.03 },
                      onDragStart: (event, info) => {
                        dragSamples.current = []
                        append({ event: "source-drag-start", native: event.nativeEvent, info, ...identity() })
                      },
                      onDrag: (_event, info) => {
                        if (dragSamples.current.length < 256) dragSamples.current.push(info)
                      },
                      onDragEnd: (event, info) =>
                        append({ event: "source-drag-end", native: event.nativeEvent, info, ...identity() }),
                      onDragTransitionEnd: () => append({ event: "source-drag-transition-end", ...identity() }),
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
                      onChangeText={(text) =>
                        append({ event: "editor-request", text, authoredValue: "", ...identity() })
                      }
                    />
                  </NativeMotionOwnerHost>
                )}
              </NativeAnimatePresence>
            </NativeLayoutGroup>
          </NativeMotionConfig>
        </View>
        <Text selectable>{JSON.stringify(journal, null, 2)}</Text>
      </ScrollView>
    </NativeKeyboardScope>
  )
}
