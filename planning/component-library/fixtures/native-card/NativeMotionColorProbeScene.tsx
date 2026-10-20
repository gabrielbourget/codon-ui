import { useLayoutEffect, useRef, useState } from "react"
import { Button, DynamicColorIOS, Platform, PlatformColor, ScrollView, Text, TextInput, View } from "react-native"

import { NativeFocusHost } from "../../../../packages/react-native/src/input/NativeFocusView"
import { NativeKeyboardScope } from "../../../../packages/react-native/src/input/NativeKeyboardScope"
import {
  sampleNativeMotionColors,
  subscribeNativeMotionColorEnvironment,
} from "../../../../packages/react-native/src/input/motionColors"

// Non-shipping actual-native probe. Its imports are materialized against the
// frozen consumer by the acceptance runner; no package-root export is added.
export const NativeMotionColorProbeScene = () => {
  const target = useRef<View>(null)
  const editor = useRef<TextInput>(null)
  const generation = useRef(0)
  const [visible, setVisible] = useState(true)
  const [records, setRecords] = useState<string[]>([])
  const [requestCount, setRequestCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [queryCount, setQueryCount] = useState(0)
  const pending = pendingCount > 0
  const append = (event: string, data: unknown) =>
    setRecords((current) => [...current, JSON.stringify({ event, data })])
  useLayoutEffect(
    () =>
      subscribeNativeMotionColorEnvironment(target.current, () =>
        append("native-environment-invalidated", { generation: generation.current }),
      ),
    [visible],
  )
  const sample = async (kind: "standard" | "opaque" | "invalid") => {
    const actual = target.current,
      currentGeneration = generation.current
    const colors =
      kind === "standard"
        ? ["red", "rgba(0, 0, 255, 0.3)"]
        : kind === "invalid"
          ? [PlatformColor("codon.invalid.native.color")]
          : Platform.OS === "ios"
            ? [
                PlatformColor("labelColor"),
                DynamicColorIOS({
                  light: "#ff0000",
                  dark: "#0000ff",
                  highContrastLight: "#00ff00",
                  highContrastDark: "#ffff00",
                }),
              ]
            : [PlatformColor("?android:attr/textColorPrimary"), PlatformColor("@android:color/black")]
    setPendingCount((current) => current + 1)
    setQueryCount((current) => current + 1)
    append("query-start", { kind, generation: currentGeneration, hasActualTarget: actual !== null })
    try {
      const result = await sampleNativeMotionColors(actual, colors)
      append("query-result", {
        kind,
        result,
        sameView: actual === target.current,
        sameGeneration: currentGeneration === generation.current,
        editorAttached: editor.current !== null,
      })
    } catch (error) {
      append("query-error", {
        kind,
        message: error instanceof Error ? error.message : String(error),
        sameGeneration: currentGeneration === generation.current,
      })
    } finally {
      setPendingCount((current) => current - 1)
    }
  }
  return (
    <NativeKeyboardScope captureEnabled>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text accessibilityRole="header">Private native motion color probe</Text>
        <Text testID="color-probe-state">
          {JSON.stringify({
            visible,
            pending,
            queryCount,
            requestCount,
            generation: generation.current,
            ownerValue: "",
          })}
        </Text>
        <Button
          disabled={!visible || pending}
          title="Sample standard colors"
          onPress={() => {
            void sample("standard")
          }}
        />
        <Button
          disabled={!visible || pending}
          title="Sample native opaque colors"
          onPress={() => {
            void sample("opaque")
          }}
        />
        <Button
          disabled={!visible || pending}
          title="Sample unresolved native color"
          onPress={() => {
            void sample("invalid")
          }}
        />
        <Button
          title={visible ? "Remove actual owner" : "Restore actual owner"}
          onPress={() => {
            generation.current++
            setVisible((current) => !current)
          }}
        />
        <Button
          disabled={!visible || pending}
          title="Query then retire actual owner"
          onPress={() => {
            void sample("opaque")
            generation.current++
            setVisible(false)
          }}
        />
        {visible ? (
          <NativeFocusHost
            ref={target}
            nativeMotionColorObservation
            testID="color-probe-owner"
            style={{ padding: 12, borderWidth: 1, borderColor: "#777", backgroundColor: "#fff" }}
          >
            <Text>Sampling leaves this authored surface unchanged.</Text>
            <TextInput
              ref={editor}
              testID="color-probe-editor"
              accessibilityLabel="Held empty editor"
              value=""
              onChangeText={(value) => {
                setRequestCount((current) => current + 1)
                append("editor-request", { value })
              }}
            />
          </NativeFocusHost>
        ) : null}
        <Text testID="color-probe-records" selectable>
          {records.join("\n")}
        </Text>
        <Button
          disabled={!visible || pending}
          title="Sample at actual end"
          onPress={() => {
            void sample("opaque")
          }}
        />
      </ScrollView>
    </NativeKeyboardScope>
  )
}
