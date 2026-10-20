import { useLayoutEffect, useRef, useState } from "react"
import { Button, ScrollView, Text, TextInput, View } from "react-native"

import { NativeFocusHost } from "../../../../packages/react-native/src/input/NativeFocusView"
import { NativeKeyboardScope } from "../../../../packages/react-native/src/input/NativeKeyboardScope"
import {
  observeNativeMotionGeometry,
  observeNativeMotionMountPairs,
  readNativeMotionGeometry,
} from "../../../../packages/react-native/src/input/motionGeometry"

// Non-shipping actual-native observation scene. Passive callbacks buffer data;
// they never update React and cause a new mount transaction by themselves.
export const NativeMotionGeometryProbeScene = () => {
  const target = useRef<View>(null),
    editor = useRef<TextInput>(null),
    scroll = useRef<ScrollView>(null)
  const generation = useRef(0),
    buffer = useRef<string[]>([]),
    counts = useRef({ records: 0, pairs: 0, dropped: 0, editorRequests: 0 })
  const [visible, setVisible] = useState(true),
    [expanded, setExpanded] = useState(false),
    [transformed, setTransformed] = useState(false),
    [ancestorShift, setAncestorShift] = useState(false),
    [revision, setRevision] = useState(0),
    [display, setDisplay] = useState("")
  const record = (kind: string, data: unknown) => {
    counts.current.records++
    buffer.current.push(JSON.stringify({ kind, data }))
    if (buffer.current.length > 1000) {
      buffer.current.shift()
      counts.current.dropped++
    }
  }
  useLayoutEffect(() => {
    const release = observeNativeMotionGeometry(target.current, (report) =>
      record(
        "native-geometry",
        report
          ? {
              kind: report.kind,
              ownerId: report.ownerId,
              bindingId: report.bindingId,
              target: report.target,
              windowId: report.windowId,
              epoch: report.epoch,
              attachmentRevision: report.attachmentRevision,
              geometryRevision: report.geometryRevision,
              commitRevision: report.commitRevision,
              transactionId: report.transactionId,
              layout: report.snapshot?.layout,
              untransformed: report.snapshot?.untransformed.box,
              model: report.snapshot?.model.box,
              presentation: report.snapshot?.presentation?.box,
            }
          : null,
      ),
    )
    const releasePairs = observeNativeMotionMountPairs(target.current, (pair) => {
      counts.current.pairs++
      record("native-mount-pair", {
        before: pair.before.geometryRevision,
        after: pair.after.geometryRevision,
        transactionId: pair.after.transactionId,
        beforeRevision: pair.before.commitRevision,
        afterRevision: pair.after.commitRevision,
      })
    })
    return () => {
      release()
      releasePairs()
    }
  }, [visible])
  const sample = async () => {
    const actual = target.current,
      currentGeneration = generation.current
    try {
      const result = await readNativeMotionGeometry(actual, undefined, `geometry-${revision}`)
      record("query-result", {
        result,
        sameView: actual === target.current,
        sameGeneration: currentGeneration === generation.current,
        editorAttached: editor.current !== null,
      })
    } catch (error) {
      record("query-error", { message: error instanceof Error ? error.message : String(error) })
    }
    setDisplay(JSON.stringify({ counts: counts.current, records: buffer.current }, null, 2))
  }
  return (
    <NativeKeyboardScope captureEnabled>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text accessibilityRole="header">Private native motion geometry probe</Text>
        <Button
          title="Sample actual geometry"
          disabled={!visible}
          onPress={() => {
            void sample()
          }}
        />
        <Button
          title="Change owned layout"
          disabled={!visible}
          onPress={() => {
            setExpanded((value) => !value)
            setRevision((value) => value + 1)
          }}
        />
        <Button
          title="Change owned transform"
          disabled={!visible}
          onPress={() => {
            setTransformed((value) => !value)
            setRevision((value) => value + 1)
          }}
        />
        <Button
          title="Move actual ancestor"
          onPress={() => {
            setAncestorShift((value) => !value)
            setRevision((value) => value + 1)
          }}
        />
        <Button title="Scroll actual ancestor" onPress={() => scroll.current?.scrollTo({ y: 180, animated: false })} />
        <Button
          title={visible ? "Remove owner" : "Restore owner"}
          onPress={() => {
            generation.current++
            setVisible((value) => !value)
            setRevision((value) => value + 1)
          }}
        />
        <Button
          title="Refresh buffered observations"
          onPress={() => setDisplay(JSON.stringify({ counts: counts.current, records: buffer.current }, null, 2))}
        />
        <View style={{ transform: [{ translateX: ancestorShift ? 12 : 0 }], padding: 12, borderWidth: 1 }}>
          {visible ? (
            <NativeFocusHost
              ref={target}
              nativeMotionGeometryObservation
              nativeMotionGeometryRevision={`geometry-${revision}`}
              testID="geometry-probe-owner"
              style={{
                width: "80%",
                height: expanded ? 180 : 100,
                padding: 10,
                backgroundColor: "#eee",
                transform: transformed ? [{ translateX: 9.25 }, { rotate: "12deg" }, { scale: 0.9 }] : undefined,
              }}
            >
              <Text>Actual geometry owner</Text>
              <TextInput
                ref={editor}
                testID="geometry-probe-editor"
                accessibilityLabel="Held empty editor"
                value=""
                selection={{ start: 0, end: 0 }}
                onChangeText={(value) => {
                  counts.current.editorRequests++
                  record("editor-request", value)
                }}
              />
            </NativeFocusHost>
          ) : null}
        </View>
        <Text testID="geometry-probe-state">
          {JSON.stringify({ visible, expanded, transformed, ancestorShift, revision, ownerValue: "" })}
        </Text>
        <Text testID="geometry-probe-records" selectable>
          {display}
        </Text>
        <View style={{ height: 400 }} />
        <Button
          title="Sample at actual end"
          disabled={!visible}
          onPress={() => {
            void sample()
          }}
        />
      </ScrollView>
    </NativeKeyboardScope>
  )
}
