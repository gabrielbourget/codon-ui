import { requireNativeModule } from "expo"
import { useCallback, useId, useRef, useState, type ComponentRef } from "react"
import { findNodeHandle, Pressable, Text, TextInput, View, type GestureResponderEvent } from "react-native"

import { NativeFormMountReceipt } from "../../../../packages/react-native/src/form/mount"
import { NativeFieldMetadata } from "../../../../packages/react-native/src/form/NativeFormMetadata"
import type Field from "../../../../packages/react-native/src/input/specs/CUIFieldBindingNativeComponent"
import Document from "../../../../packages/react-native/src/input/specs/NativeCUIFormDocument"

import { SOURCE_PRODUCER } from "./identity"
import { createResponderJournal, RESPONDER_PROBE } from "./responder"

const ResponderApp = () => {
  const ownerId = useId()
  const root = useRef<View | null>(null)
  const captureRoot = useRef<View | null>(null)
  const editor = useRef<TextInput | null>(null)
  const metadata = useRef<ComponentRef<typeof Field> | null>(null)
  const receipt = useRef<NativeFormMountReceipt | null>(null)
  const veto = useRef(true)
  const snapshotSequence = useRef(0)
  const [target, setTarget] = useState(0)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState("veto")
  const [snapshot, setSnapshot] = useState("no snapshot")
  const [diagnostics, setDiagnostics] = useState("no native receipt")
  const revision = `${ownerId}:${target}`
  const [journal] = useState(() =>
    createResponderJournal(SOURCE_PRODUCER, async (encoded) => {
      const fs = requireNativeModule<{
        cacheDirectory: string | null
        writeAsStringAsync: (path: string, text: string, options: { encoding: "utf8" }) => Promise<void>
      }>("ExponentFileSystem")
      if (!fs.cacheDirectory) throw new Error("Original native cache unavailable")
      await fs.writeAsStringAsync(`${fs.cacheDirectory.replace(/\/?$/, "/")}${RESPONDER_PROBE}.jsonl`, encoded, {
        encoding: "utf8",
      })
    }),
  )
  const record = useCallback(
    (value: Record<string, unknown>) => {
      journal.record(value)
      void journal.persist().catch((error: unknown) => console.warn(`CUI_RESPONDER_JOURNAL ${String(error)}`))
    },
    [journal],
  )
  const bind = useCallback((original: TextInput | null) => {
    if (editor.current !== original) {
      receipt.current?.retire()
      receipt.current = null
      setReady(false)
    }
    editor.current = original
    setTarget(original ? (findNodeHandle(original) ?? 0) : 0)
  }, [])
  const capture = (event: GestureResponderEvent) => {
    const original = editor.current
    event.persist()
    const originalTarget = original && findNodeHandle(original)
    if (veto.current) event.preventDefault()
    const captured = event.defaultPrevented || event.isDefaultPrevented()
    record({
      kind: "responder-capture",
      mode: veto.current ? "veto" : "allow",
      captured,
      originalTarget,
      currentRoot: findNodeHandle(captureRoot.current),
      currentTargetIsOriginalRoot: Object.is(event.currentTarget, captureRoot.current),
      targetMatchesOriginal: String(event.nativeEvent.target) === String(originalTarget),
      data: event.nativeEvent,
    })
    return captured
  }
  const inspect = async () => {
    const original = editor.current
    const request = {
      target: findNodeHandle(root.current),
      requestId: `responder:${++snapshotSequence.current}`,
      inspect: true,
    }
    if (!Document || !original || !request.target) throw new Error("Original document/editor unavailable")
    const response = JSON.parse(await Document.getSnapshot(JSON.stringify(request))) as Record<string, unknown>
    if (editor.current !== original) throw new Error("Original editor retired during SDK observation")
    const value = { sequence: snapshotSequence.current, target, response }
    record({ kind: "sdk-snapshot", snapshotSequence: value.sequence, target, response })
    setSnapshot(JSON.stringify(value))
    await journal.persist()
  }
  return (
    <View ref={root} collapsable={false} style={{ flex: 1, paddingTop: 60, paddingHorizontal: 12, gap: 12 }}>
      <Text testID="responder-ready">{ready ? "ready" : "waiting"}</Text>
      <Text testID="responder-mode">{mode}</Text>
      <Text testID="responder-diagnostics" numberOfLines={2} accessibilityLabel={diagnostics}>
        {diagnostics}
      </Text>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Pressable
          testID="responder-toggle"
          accessibilityRole="button"
          onPress={() => {
            veto.current = !veto.current
            setMode(veto.current ? "veto" : "allow")
            record({ kind: "mode", mode: veto.current ? "veto" : "allow" })
          }}
          style={{ padding: 12, backgroundColor: "#ddd" }}
        >
          <Text>Toggle capture veto</Text>
        </Pressable>
        <Pressable
          testID="responder-inspect"
          accessibilityRole="button"
          onPress={() =>
            void inspect().catch((error: unknown) => {
              record({ kind: "failure", error: String(error) })
              setSnapshot(`ERROR ${String(error)}`)
            })
          }
          style={{ padding: 12, backgroundColor: "#ddd" }}
        >
          <Text>Inspect SDK</Text>
        </Pressable>
      </View>
      <Text testID="responder-snapshot" numberOfLines={2} accessibilityLabel={snapshot}>
        {snapshot}
      </Text>
      <View
        ref={captureRoot}
        collapsable={false}
        onStartShouldSetResponderCapture={capture}
        onResponderGrant={(event) => {
          record({ kind: "responder-grant", data: event.nativeEvent })
          return veto.current
        }}
        onResponderRelease={(event) => record({ kind: "responder-release", data: event.nativeEvent })}
        onResponderTerminationRequest={() => !veto.current}
        style={{ borderWidth: 1, padding: 8 }}
      >
        <NativeFieldMetadata
          metadataRef={metadata}
          ownerId={ownerId}
          descriptorId="editor"
          descriptorRevision={revision}
          editorTarget={target}
          hasFormAssociation={false}
          formId=""
          onNativeFormCommit={(event) => {
            const packet = event.nativeEvent
            record({ kind: "metadata-status", data: packet })
            setDiagnostics(JSON.stringify(packet))
            const original = editor.current,
              host = metadata.current
            if (
              !original ||
              !host ||
              !target ||
              packet.ownerId !== ownerId ||
              packet.descriptorId !== "editor" ||
              packet.descriptorRevision !== revision ||
              packet.originalTarget !== target ||
              packet.target !== findNodeHandle(host)
            )
              return
            if (!receipt.current || receipt.current.scope.descriptorRevision !== revision) {
              receipt.current?.retire()
              receipt.current = new NativeFormMountReceipt(
                {
                  ownerId,
                  descriptorId: "editor",
                  descriptorRevision: revision,
                  target: packet.target,
                  originalTarget: target,
                },
                { metadata: host, original, current: () => ({ metadata: metadata.current, original: editor.current }) },
              )
            }
            const admitted = receipt.current.receive(packet)
            setReady(admitted && packet.complete && packet.attached && packet.active && packet.metadataOnly)
          }}
        />
        <TextInput
          ref={bind}
          testID="responder-default-editor"
          accessibilityLabel="Original responder editor"
          defaultValue=""
          autoCorrect={false}
          autoCapitalize="none"
          style={{ height: 44, borderWidth: 1 }}
          onFocus={(event) => record({ kind: "editor-focus", data: event.nativeEvent })}
          onBlur={(event) => record({ kind: "editor-blur", data: event.nativeEvent })}
          onChange={(event) => record({ kind: "unexpected-editor-change", data: event.nativeEvent })}
          onSelectionChange={(event) => record({ kind: "editor-selection", data: event.nativeEvent })}
        />
      </View>
    </View>
  )
}

export default ResponderApp
