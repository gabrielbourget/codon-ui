import { requireNativeModule } from "expo"
import { Activity, useCallback, useId, useRef, useState } from "react"
import { findNodeHandle, Modal, Pressable, Text, TextInput, View } from "react-native"

import { NativeFieldMetadata } from "../../../../packages/react-native/src/form/NativeFormMetadata"
import {
  NativeEditorKeyboardLease,
  type TNativeEditorKeyEvent,
  type TNativeEditorKeyboardAcknowledgement,
  type TNativeEditorKeyboardCallbacks,
} from "../../../../packages/react-native/src/input/editorKeyboard"
import Scope from "../../../../packages/react-native/src/input/specs/CUIKeyboardScopeNativeComponent"
import Defaults from "../../../../packages/react-native/src/input/specs/NativeCUIEditorKeyboardDefaults"
import Document from "../../../../packages/react-native/src/input/specs/NativeCUIFormDocument"

import { SOURCE_PRODUCER } from "./identity"
import { createKeyboardJournal, KEYBOARD_MODES, KEYBOARD_PROBE, type TKeyboardMode } from "./keyboard"

type TRow = Record<string, unknown>
const KeyboardApp = () => {
  const ownerId = useId()
  const root = useRef<View | null>(null)
  const original = useRef<TextInput | null>(null)
  const lease = useRef<NativeEditorKeyboardLease | null>(null)
  const leaseIdentity = useRef("")
  const previousAck = useRef<TNativeEditorKeyboardAcknowledgement | null>(null)
  const mode = useRef<TKeyboardMode>("veto")
  const snapshotSequence = useRef(0)
  const [moduleLease] = useState(() => Defaults?.getLease() ?? "")
  const [target, setTarget] = useState(0)
  const [generation, setGeneration] = useState(1)
  const [visible, setVisible] = useState(true)
  const [modal, setModal] = useState(false)
  const [accepted, setAccepted] = useState({ windowId: "", epoch: 0 })
  const [keyboardReady, setKeyboardReady] = useState(false)
  const [metadataReady, setMetadataReady] = useState(false)
  const [caption, setCaption] = useState("mode veto")
  const [snapshot, setSnapshot] = useState("no snapshot")
  const bindingId = `${ownerId}:editor`
  const revision = `${generation}:${target}`
  const [diagnostics, setDiagnostics] = useState<{ scope?: unknown; keyboard?: unknown; metadata?: unknown }>({})
  const [journal] = useState(() =>
    createKeyboardJournal(SOURCE_PRODUCER, async (encoded) => {
      const fs = requireNativeModule<{
        cacheDirectory: string | null
        writeAsStringAsync: (path: string, text: string, options: { encoding: "utf8" }) => Promise<void>
      }>("ExponentFileSystem")
      if (!fs.cacheDirectory) throw new Error("Original native cache unavailable")
      await fs.writeAsStringAsync(`${fs.cacheDirectory.replace(/\/?$/, "/")}${KEYBOARD_PROBE}.jsonl`, encoded, {
        encoding: "utf8",
      })
    }),
  )
  const persist = useCallback(() => journal.persist(), [journal])
  const record = useCallback(
    (value: TRow) => {
      const row = journal.record(value)
      console.warn(`CUI_EDITOR_KEYBOARD ${JSON.stringify(row)}`)
      void persist().catch((error: unknown) => console.warn(`CUI_EDITOR_KEYBOARD_PERSIST ${String(error)}`))
    },
    [journal, persist],
  )
  const bind = useCallback((editor: TextInput | null) => {
    if (editor !== original.current) {
      lease.current?.retire()
      lease.current = null
      leaseIdentity.current = ""
      setKeyboardReady(false)
      setMetadataReady(false)
    }
    original.current = editor
    setTarget(editor ? (findNodeHandle(editor) ?? 0) : 0)
  }, [])
  const callbacks = useRef<TNativeEditorKeyboardCallbacks>({})
  callbacks.current = {
    owned: (event: TNativeEditorKeyEvent, editor: TextInput) =>
      record({ kind: "owned", data: event.nativeEvent, originalRef: editor === original.current }),
    onKeyDown: (event: TNativeEditorKeyEvent, editor: TextInput) => {
      const data = event.nativeEvent
      record({ kind: "caller", mode: mode.current, data, originalRef: editor === original.current })
      if (!data.metaKey && !data.ctrlKey && !data.altKey) {
        if (mode.current === "veto" && data.key.toLowerCase() === "a") event.preventDefault()
        if (mode.current === "late" && data.key.toLowerCase() === "c")
          void Promise.resolve().then(() => {
            event.preventDefault()
            record({ kind: "late-prevent", eventId: data.eventId })
          })
        if (mode.current === "throw" && data.key.toLowerCase() === "d") {
          event.preventDefault()
          throw new Error("Expected prototype callback exception")
        }
      }
    },
    onKeyUp: (event: TNativeEditorKeyEvent, editor: TextInput) =>
      record({ kind: "caller", mode: mode.current, data: event.nativeEvent, originalRef: editor === original.current }),
    onKeyCancel: (event: TNativeEditorKeyEvent, editor: TextInput) =>
      record({ kind: "caller", mode: mode.current, data: event.nativeEvent, originalRef: editor === original.current }),
  }
  const inspect = async () => {
    const current = original.current
    const request = {
      target: findNodeHandle(root.current),
      requestId: `keyboard:${++snapshotSequence.current}`,
      inspect: true,
    }
    if (!Document || !request.target) throw new Error("Native document unavailable")
    const response = JSON.parse(await Document.getSnapshot(JSON.stringify(request))) as TRow
    if (original.current !== current) throw new Error("Original editor changed during SDK query")
    const value = { sequence: snapshotSequence.current, generation, target, response }
    record({ kind: "sdk-snapshot", snapshotSequence: value.sequence, generation, target, response })
    setSnapshot(JSON.stringify(value))
    await persist()
  }
  const button = (id: string, label: string, action: () => void) => (
    <Pressable testID={id} accessibilityRole="button" onPress={action} style={{ padding: 8, backgroundColor: "#ddd" }}>
      <Text>{label}</Text>
    </Pressable>
  )
  return (
    <View ref={root} collapsable={false} style={{ flex: 1, paddingTop: 55, paddingHorizontal: 12, gap: 8 }}>
      <Text testID="keyboard-ready">{keyboardReady && metadataReady ? "ready" : "waiting"}</Text>
      <Text testID="keyboard-mode">{caption}</Text>
      <Text
        testID="keyboard-status-detail"
        numberOfLines={2}
        accessibilityLabel={JSON.stringify({
          target,
          revision,
          moduleAvailable: !!moduleLease,
          accepted,
          keyboardReady,
          metadataReady,
          diagnostics,
        })}
      >
        {JSON.stringify({ target, keyboardReady, metadataReady })}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {button("keyboard-next-mode", "Next mode", () => {
          mode.current = KEYBOARD_MODES[(KEYBOARD_MODES.indexOf(mode.current) + 1) % KEYBOARD_MODES.length]!
          record({ kind: "mode", mode: mode.current, revision })
          setCaption(`mode ${mode.current}`)
        })}
        {button(
          "keyboard-inspect",
          "Inspect SDK",
          () =>
            void inspect().catch((error: unknown) => {
              record({ kind: "failure", error: String(error) })
              setSnapshot(`ERROR ${String(error)}`)
              void persist()
            }),
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {button("keyboard-hide", visible ? "Hide editor" : "Restore editor", () => {
          if (visible) {
            lease.current?.retire()
            lease.current = null
            leaseIdentity.current = ""
          }
          record({ kind: "activity", visible: !visible })
          setVisible(!visible)
          setKeyboardReady(false)
        })}
        {button("keyboard-replace", "Replace editor", () => {
          lease.current?.retire()
          record({ kind: "replace", generation: generation + 1 })
          setGeneration(generation + 1)
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {button("keyboard-modal", "Open modal", () => setModal(true))}
        {button("keyboard-replay", "Replay stale ack", () => {
          const accepted = previousAck.current ? Defaults?.settle(JSON.stringify(previousAck.current)) : null
          record({ kind: "stale-ack", accepted })
          setCaption(`stale ack ${String(accepted)}`)
        })}
        {button("keyboard-export", "Export", () => void persist())}
      </View>
      <Text testID="keyboard-snapshot" accessibilityLabel={snapshot} numberOfLines={2}>
        {snapshot}
      </Text>
      <Activity mode={visible ? "visible" : "hidden"}>
        <Scope
          key={generation}
          ownerId={ownerId}
          enabled={visible}
          acceptedWindowId={accepted.windowId}
          acceptedEpoch={accepted.epoch}
          policies={[]}
          observations={[]}
          editorKeyboardBindings={
            target && moduleLease ? [{ bindingId, bindingRevision: revision, targetTag: target, moduleLease }] : []
          }
          onNativeScopeStatus={(event) => {
            const status = event.nativeEvent
            record({ kind: "scope-status", data: status })
            setDiagnostics((previous) => ({ ...previous, scope: status }))
            if (status.ownerId === ownerId && status.windowId && status.epoch > 0)
              setAccepted((previous) =>
                previous.windowId === status.windowId && previous.epoch === status.epoch
                  ? previous
                  : { windowId: status.windowId, epoch: status.epoch },
              )
          }}
          onNativeEditorKeyboardStatus={(event) => {
            const data = event.nativeEvent
            record({ kind: "keyboard-status", data })
            setDiagnostics((previous) => ({ ...previous, keyboard: data }))
            const editor = original.current
            if (
              !editor ||
              data.ownerId !== ownerId ||
              data.bindingId !== bindingId ||
              data.bindingRevision !== revision ||
              data.target !== target ||
              !data.windowId ||
              data.epoch <= 0
            )
              return
            const identity = {
              ownerId,
              bindingId,
              bindingRevision: revision,
              target,
              windowId: data.windowId,
              epoch: data.epoch,
            }
            const key = JSON.stringify(identity)
            if (key !== leaseIdentity.current) {
              lease.current?.retire()
              lease.current = new NativeEditorKeyboardLease({
                identity,
                original: editor,
                current: () => original.current,
                callbacks: () => callbacks.current,
                acknowledge: (request) => {
                  previousAck.current = request
                  const accepted = Defaults?.settle(JSON.stringify(request)) ?? false
                  record({ kind: "acknowledgement", request, accepted })
                  return accepted
                },
              })
              leaseIdentity.current = key
            }
            setKeyboardReady(lease.current?.acceptStatus(data) ?? false)
          }}
          onNativeEditorKey={(event) => {
            try {
              record({ kind: "delivery", outcome: lease.current?.receive(event) ?? "no-lease" })
            } catch (error) {
              record({ kind: "callback-exception", error: String(error) })
            }
          }}
          onNativeEditorKeyboardDecision={(event) => record({ kind: "native-decision", data: event.nativeEvent })}
          style={{ borderWidth: 1, padding: 8 }}
        >
          <NativeFieldMetadata
            ownerId={ownerId}
            descriptorId="editor"
            descriptorRevision={revision}
            editorTarget={target}
            hasFormAssociation={false}
            formId=""
            onNativeFormCommit={(event) => {
              const data = event.nativeEvent
              record({ kind: "metadata-status", data })
              setDiagnostics((previous) => ({ ...previous, metadata: data }))
              setMetadataReady(
                data.ownerId === ownerId &&
                  data.descriptorId === "editor" &&
                  data.descriptorRevision === revision &&
                  data.originalTarget === target &&
                  data.complete &&
                  data.attached &&
                  data.active &&
                  data.metadataOnly,
              )
            }}
          />
          <TextInput
            ref={bind}
            testID="keyboard-default-editor"
            accessibilityLabel="Original keyboard editor"
            defaultValue=""
            autoCorrect={false}
            autoCapitalize="none"
            style={{ height: 44, borderWidth: 1 }}
            onChange={(event) => record({ kind: "editor-change", data: event.nativeEvent })}
            onSelectionChange={(event) => record({ kind: "editor-selection", data: event.nativeEvent })}
            onFocus={(event) => record({ kind: "editor-focus", data: event.nativeEvent })}
            onBlur={(event) => record({ kind: "editor-blur", data: event.nativeEvent })}
          />
        </Scope>
      </Activity>
      <TextInput
        testID="keyboard-independent-editor"
        accessibilityLabel="Independent editor"
        defaultValue=""
        autoCorrect={false}
        autoCapitalize="none"
        style={{ height: 44, borderWidth: 1 }}
        onChange={(event) => record({ kind: "independent-change", data: event.nativeEvent })}
      />
      <Modal visible={modal} onRequestClose={() => setModal(false)}>
        <View style={{ paddingTop: 60, paddingHorizontal: 12 }}>
          {button("keyboard-close-modal", "Close modal", () => setModal(false))}
          <TextInput
            testID="keyboard-modal-editor"
            accessibilityLabel="Modal editor"
            defaultValue=""
            style={{ height: 44, borderWidth: 1 }}
            onChange={(event) => record({ kind: "modal-change", data: event.nativeEvent })}
          />
        </View>
      </Modal>
    </View>
  )
}

export default KeyboardApp
