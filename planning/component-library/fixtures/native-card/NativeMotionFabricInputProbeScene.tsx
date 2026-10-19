import { useLayoutEffect, useRef, useState } from "react"
import { Button, ScrollView, Text, TextInput, View } from "react-native"

import { NativeFocusHost } from "../../../../packages/react-native/src/input/NativeFocusView"
import { NativeKeyboardScope } from "../../../../packages/react-native/src/input/NativeKeyboardScope"
import { captureNativeMotionFabricInput } from "../../../../packages/react-native/src/motion/measurement/fabricInput"

// Non-shipping real-module scene. Results remain Fabric input descriptors;
// this scene does not produce mount acknowledgments or measurement acceptance.
export const NativeMotionFabricInputProbeScene = () => {
  const target = useRef<View>(null),
    editor = useRef<TextInput>(null)
  const generation = useRef(0),
    cancellations = useRef(new Set<() => void>()),
    alive = useRef(true)
  const requests = useRef(0)
  const [visible, setVisible] = useState(true),
    [revision, setRevision] = useState(0)
  const [expanded, setExpanded] = useState(false),
    [display, setDisplay] = useState("")
  const retire = () => {
    generation.current++
    for (const cancel of [...cancellations.current]) cancel()
  }
  useLayoutEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      retire()
    }
  }, [])
  const query = async () => {
    const actual = target.current,
      originalEditor = editor.current,
      current = generation.current
    if (!actual) return
    try {
      const data = await captureNativeMotionFabricInput(actual, {
        isCurrent: () => generation.current === current && target.current === actual,
        onCancel: (listener) => {
          cancellations.current.add(listener)
          return () => {
            cancellations.current.delete(listener)
          }
        },
      })
      if (alive.current)
        setDisplay(
          JSON.stringify(
            {
              data,
              sameView: target.current === actual,
              sameEditor: editor.current === originalEditor,
              editorRequests: requests.current,
            },
            null,
            2,
          ),
        )
    } catch (error) {
      if (alive.current)
        setDisplay(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            sameView: target.current === actual,
            sameEditor: editor.current === originalEditor,
            editorRequests: requests.current,
          }),
        )
    }
  }
  return (
    <NativeKeyboardScope captureEnabled>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text accessibilityRole="header">Private actual-view Fabric input probe</Text>
        <Button
          title="Capture actual Fabric input"
          disabled={!visible}
          onPress={() => {
            void query()
          }}
        />
        <Button title="Cancel pending capture" onPress={retire} />
        <Button
          title="Change containing layout"
          onPress={() => {
            setExpanded((value) => !value)
            setRevision((value) => value + 1)
          }}
        />
        <Button
          title={visible ? "Remove original owner" : "Create replacement owner"}
          onPress={() => {
            retire()
            setVisible((value) => !value)
            setRevision((value) => value + 1)
          }}
        />
        <View style={{ width: expanded ? 300 : 200, padding: 12, borderWidth: 1 }}>
          {visible ? (
            <NativeFocusHost
              ref={target}
              nativeMotionGeometryObservation
              nativeMotionGeometryRevision={`fabric-probe:${revision}`}
              testID="fabric-input-owner"
              style={{ width: "75%", padding: 8 }}
            >
              <Text>Original owned native view</Text>
              <TextInput
                ref={editor}
                accessibilityLabel="Held empty Fabric probe editor"
                value=""
                onChangeText={() => {
                  requests.current++
                }}
              />
            </NativeFocusHost>
          ) : null}
        </View>
        <Text selectable>{display}</Text>
      </ScrollView>
    </NativeKeyboardScope>
  )
}
