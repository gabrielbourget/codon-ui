import { requireNativeModule } from "expo"
import {
  Activity,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentRef,
} from "react"
import {
  findNodeHandle,
  Modal,
  PixelRatio,
  Platform,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
} from "react-native"
import { Portal, PortalHost, PortalProvider } from "react-native-teleport"

import { decodeNativeFormDocument, fieldsInNativeForm } from "../../../../packages/react-native/src/form/document"
import { NativeFormMountReceipt } from "../../../../packages/react-native/src/form/mount"
import { NativeFieldMetadata, NativeFormMetadata } from "../../../../packages/react-native/src/form/NativeFormMetadata"
import type FieldHost from "../../../../packages/react-native/src/input/specs/CUIFieldBindingNativeComponent"
import type FormHost from "../../../../packages/react-native/src/input/specs/CUIFormRootNativeComponent"
import type { NativeFormCommitData } from "../../../../packages/react-native/src/input/specs/CUIFormRootNativeComponent"
import Document from "../../../../packages/react-native/src/input/specs/NativeCUIFormDocument"

import { FORM_ORDERS, FORM_PHASES, FORM_PROBE, type TFormPhase } from "./form"
import { SOURCE_PRODUCER } from "./identity"

type TRecord = Record<string, unknown>
type TField = {
  id: string
  ownerId: string
  revision: string
  target: number
  metadataTarget: number
  original: () => TextInput | null
}
type TContext = {
  phase: TFormPhase
  commit: (field: TField) => () => void
  acknowledge: (id: string, packet: NativeFormCommitData, receiver: NativeFormMountReceipt | null) => void
  record: (value: TRecord) => void
}
const Context = createContext<TContext | null>(null)
const ensure: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message)
}
const Field = ({ id, form }: { id: string; form?: string }) => {
  const context = useContext(Context)!
  const ownerId = useId()
  const original = useRef<TextInput | null>(null)
  const metadata = useRef<ComponentRef<typeof FieldHost> | null>(null)
  const receipt = useRef<NativeFormMountReceipt | null>(null)
  const [target, setTarget] = useState(0)
  const revision = `${ownerId}:${context.phase}:${target}:${form ?? "ancestor"}`
  const bind = useCallback((view: TextInput | null) => {
    original.current = view
    if (view) setTarget(findNodeHandle(view) ?? 0)
  }, [])
  useInsertionEffect(() =>
    context.commit({
      id,
      ownerId,
      revision,
      target,
      metadataTarget: findNodeHandle(metadata.current) ?? 0,
      original: () => original.current,
    }),
  )
  useLayoutEffect(() => {
    const host = metadata.current,
      editor = original.current
    if (!host || !editor || !target) return
    const current = new NativeFormMountReceipt(
      {
        ownerId,
        descriptorId: id,
        descriptorRevision: revision,
        target: findNodeHandle(host) ?? 0,
        originalTarget: target,
      },
      { metadata: host, original: editor, current: () => ({ metadata: metadata.current, original: original.current }) },
    )
    receipt.current = current
    return () => {
      current.retire()
      if (receipt.current === current) receipt.current = null
    }
  }, [ownerId, revision, target])
  return (
    <View collapsable={false}>
      <NativeFieldMetadata
        metadataRef={metadata}
        ownerId={ownerId}
        descriptorId={id}
        descriptorRevision={revision}
        editorTarget={target}
        hasFormAssociation={form !== undefined}
        formId={form ?? ""}
        onNativeFormCommit={(event: NativeSyntheticEvent<NativeFormCommitData>) => {
          const receiver = receipt.current
          const admitted = receiver?.receive(event.nativeEvent) ?? false
          context.acknowledge(id, event.nativeEvent, admitted ? receiver : null)
        }}
      />
      <TextInput
        ref={bind}
        multiline={id === "second"}
        accessibilityLabel={`Original ${id}`}
        value={`Held ${id}`}
        onChange={(event) => context.record({ kind: "unexpected-input", id, nativeEvent: event.nativeEvent })}
        onFocus={(event) =>
          context.record({ kind: "native-editor-event", id, type: "focus", nativeEvent: event.nativeEvent })
        }
        onBlur={(event) =>
          context.record({ kind: "native-editor-event", id, type: "blur", nativeEvent: event.nativeEvent })
        }
        onSelectionChange={(event) =>
          context.record({ kind: "native-editor-event", id, type: "selection", nativeEvent: event.nativeEvent })
        }
      />
    </View>
  )
}

const FormGate = () => {
  const ownerId = useId()
  const root = useRef<View | null>(null)
  const metadata = useRef<ComponentRef<typeof FormHost> | null>(null)
  const control = useRef<TextInput | null>(null)
  const [target, setTarget] = useState(0)
  const [phase, setPhase] = useState<TFormPhase>("initial")
  const [modalVisible, setModalVisible] = useState(false)
  const currentPhase = useRef<TFormPhase>(phase)
  const fields = useRef(new Map<string, TField>())
  const acknowledgments = useRef(new Map<string, { packet: NativeFormCommitData; receiver: NativeFormMountReceipt }>())
  const rootReceipt = useRef<NativeFormMountReceipt | null>(null)
  const rootStatus = useRef<NativeFormCommitData | null>(null)
  const rows = useRef<TRecord[]>([])
  const busy = useRef(false),
    stopped = useRef(false),
    shown = useRef(false)
  const tokens = useRef(new WeakMap<object, number>()),
    tokenSequence = useRef(0)
  const firstTokens = useRef(new Map<string, number>())
  const documentId = useRef<string | null>(null)
  const originalRoot = useRef<number | null>(null)
  const advance = useRef<() => void>(() => {})
  const revision = `${ownerId}:${phase}:${target}`
  const bind = useCallback((view: View | null) => {
    root.current = view
    if (view) setTarget(findNodeHandle(view) ?? 0)
  }, [])
  const record = useCallback((value: TRecord) => {
    if (stopped.current && value.kind !== "terminal") return
    const row = {
      probe: FORM_PROBE,
      producer: SOURCE_PRODUCER,
      sequence: rows.current.length + 1,
      phase: currentPhase.current,
      observedAt: Date.now(),
      ...value,
    }
    rows.current.push(row)
    console.warn(`CUI_FORM_DOCUMENT ${JSON.stringify(row)}`)
  }, [])
  const persist = useCallback(
    async (outcome: string) => {
      record({ kind: "terminal", outcome, fullFamily: false, fullGoal: false })
      stopped.current = true
      const fs = requireNativeModule<{
        cacheDirectory: string | null
        writeAsStringAsync: (path: string, text: string, options: { encoding: "utf8" }) => Promise<void>
      }>("ExponentFileSystem")
      ensure(fs.cacheDirectory, "Native cache unavailable")
      await fs.writeAsStringAsync(
        `${fs.cacheDirectory.replace(/\/?$/, "/")}${FORM_PROBE}.jsonl`,
        rows.current.map((row) => JSON.stringify(row)).join("\n") + "\n",
        { encoding: "utf8" },
      )
    },
    [record],
  )
  const fail = useCallback(
    (error: unknown) => {
      if (stopped.current) return
      record({ kind: "failure", error: String(error) })
      void persist("failed").catch((reason: unknown) => console.warn(`CUI_FORM_PERSIST ${String(reason)}`))
    },
    [persist, record],
  )
  useInsertionEffect(() => {
    currentPhase.current = phase
  })
  useInsertionEffect(() => {
    record({ kind: "begin", platform: Platform.OS, fontScale: PixelRatio.getFontScale() })
  }, [record])
  useEffect(() => {
    const timer = setTimeout(() => fail(new Error("Original form prototype deadline")), 90000)
    return () => clearTimeout(timer)
  }, [fail, record])
  useLayoutEffect(() => {
    const host = metadata.current,
      original = root.current
    if (!host || !original || !target) return
    const current = new NativeFormMountReceipt(
      {
        ownerId,
        descriptorId: "form",
        descriptorRevision: revision,
        target: findNodeHandle(host) ?? 0,
        originalTarget: target,
      },
      { metadata: host, original, current: () => ({ metadata: metadata.current, original: root.current }) },
    )
    rootReceipt.current = current
    return () => {
      current.retire()
      if (rootReceipt.current === current) rootReceipt.current = null
    }
  }, [ownerId, revision, target])
  const capture = useCallback(async () => {
    const phase = currentPhase.current
    const status = rootStatus.current
    const rootReady =
      phase === "modal"
        ? shown.current &&
          status?.descriptorRevision === `${ownerId}:modal:${target}` &&
          status.metadataOnly &&
          ((status.complete && status.attached) ||
            (!status.complete && !status.attached && status.error === "form-metadata-detached"))
        : rootReceipt.current?.getSnapshot()
    if (busy.current || stopped.current || !rootReady) return
    const expected = FORM_ORDERS[phase]
    for (const id of expected) {
      if ((phase === "activity-hidden" && id === "activity") || (phase === "modal" && id !== "modal")) continue
      const field = fields.current.get(id),
        ack = acknowledgments.current.get(id)
      if (!field || !ack?.receiver.getSnapshot() || ack.packet.descriptorRevision !== field.revision) return
    }
    busy.current = true
    try {
      ensure(Document && root.current && control.current, "Original module/refs unavailable")
      const request = {
        target: findNodeHandle(root.current)!,
        requestId: `${ownerId}:${phase}`,
        inspect: true,
        probeCustomContent: Platform.OS === "ios",
        controlTarget: findNodeHandle(control.current)!,
      }
      const committed = new Map(
        [...fields.current].map(([id, field]) => [
          id,
          { ownerId: field.ownerId, revision: field.revision, target: field.target },
        ]),
      )
      const encoded = await Document.getSnapshot(JSON.stringify(request))
      ensure(currentPhase.current === phase, "Phase retired during original native query")
      const document = decodeNativeFormDocument(encoded, request)
      const form = document.forms.find((candidate) => candidate.ownerId === ownerId)
      ensure(form, "Original form missing")
      for (const field of document.fields) {
        const expected = committed.get(field.descriptorId)
        ensure(
          expected &&
            field.ownerId === expected.ownerId &&
            field.descriptorRevision === expected.revision &&
            field.target === expected.target,
          "Native descriptor differs from committed field state",
        )
      }
      const selected = fieldsInNativeForm(document, form)
      ensure(
        JSON.stringify(selected.map((field) => field.descriptorId)) === JSON.stringify(expected),
        "Native committed field order mismatch",
      )
      ensure(
        !selected.some((field) => field.descriptorId === "disassociated"),
        "Empty explicit form association inherited an ancestor",
      )
      const raw = JSON.parse(encoded) as {
        inspection: {
          platform: string
          fields: {
            descriptorId: string
            available: boolean
            resolved: boolean
            probeSkipped?: string
            customContentCurrent?: { label: string; value: string }[]
            currentDescriptor?: boolean
            metadataOnly?: boolean
            state?: { text: string }
            stateUnchanged?: boolean
            customContentBound?: boolean
            customContentBefore?: unknown[]
            customContentDuring?: unknown[]
            customContentAfter?: unknown[]
            originalEditorUnchanged?: boolean
            delegateUnchanged?: boolean
            unregisteredControlUnchanged?: boolean
            unregisteredControlAfterUnchanged?: boolean
          }[]
        }
      }
      for (const descriptor of selected) {
        const native = raw.inspection.fields.find((entry) => entry.descriptorId === descriptor.descriptorId)
        ensure(native, "Original SDK observation absent")
        if (phase !== "activity-hidden" || descriptor.descriptorId !== "activity") {
          ensure(
            native.resolved && native.currentDescriptor && native.metadataOnly,
            "Original current inert binding unavailable",
          )
          const inactiveModalField = phase === "modal" && descriptor.descriptorId !== "modal" && !native.available
          ensure(native.available || inactiveModalField, "Unexpected physical target unavailability")
          ensure(
            native.state?.text === `Held ${descriptor.descriptorId}` && native.stateUnchanged !== false,
            "Original editor state changed",
          )
          if (Platform.OS === "ios" && inactiveModalField) {
            ensure(
              native.probeSkipped === "inactive-window" &&
                !native.customContentCurrent?.some(
                  (item) => item.label === "Form prototype" && item.value === "Original editor metadata",
                ),
              "Detached editor retained a metadata override",
            )
          } else if (Platform.OS === "ios")
            ensure(
              native.customContentBound &&
                native.originalEditorUnchanged &&
                native.delegateUnchanged &&
                native.unregisteredControlUnchanged &&
                native.unregisteredControlAfterUnchanged &&
                JSON.stringify(native.customContentBefore) === JSON.stringify(native.customContentAfter) &&
                native.customContentDuring!.length === native.customContentBefore!.length + 1,
              "Original custom-content getter/retirement mismatch",
            )
          const original = fields.current.get(descriptor.descriptorId)?.original()
          ensure(original, "Original editor ref unavailable")
          if (!tokens.current.has(original)) tokens.current.set(original, ++tokenSequence.current)
          const token = tokens.current.get(original)!
          const first = firstTokens.current.get(descriptor.descriptorId)
          if (first !== undefined && descriptor.descriptorId !== "modal") {
            const replaced = phase === "root-replaced" && !["before", "after"].includes(descriptor.descriptorId)
            ensure(
              replaced ? first !== token : first === token,
              "Editor replacement did not match its requested host boundary",
            )
          }
          firstTokens.current.set(descriptor.descriptorId, token)
        }
      }
      if (documentId.current !== null)
        ensure(documentId.current === document.documentId, "One Fabric root split into native window documents")
      documentId.current = document.documentId
      if (originalRoot.current !== null && phase !== "root-replaced")
        ensure(originalRoot.current === request.target, "Form ref changed unexpectedly")
      if (phase === "root-replaced")
        ensure(originalRoot.current !== request.target, "Requested root replacement did not occur")
      originalRoot.current = request.target
      record({
        kind: "native-document",
        request,
        originalResponse: JSON.parse(encoded),
        selected: selected.map((field) => field.descriptorId),
        originalRefTokens: [...firstTokens.current],
      })
      const index = FORM_PHASES.indexOf(phase)
      if (index === FORM_PHASES.length - 1) {
        await persist("native-form-order-complete")
        return
      }
      const next = FORM_PHASES[index + 1]
      if (phase === "modal") {
        setModalVisible(false)
        if (Platform.OS === "ios") return
      }
      if (next === "modal") {
        shown.current = false
        setModalVisible(true)
      }
      busy.current = false
      setPhase(next)
    } catch (error) {
      fail(error)
    }
  }, [fail, ownerId, persist, record, target])
  useInsertionEffect(() => {
    advance.current = () => {
      void capture()
    }
  }, [capture])
  const commit = useCallback((field: TField) => {
    fields.current.set(field.id, field)
    return () => {
      if (fields.current.get(field.id) === field) fields.current.delete(field.id)
    }
  }, [])
  const acknowledge = useCallback(
    (id: string, packet: NativeFormCommitData, receiver: NativeFormMountReceipt | null) => {
      record({ kind: "native-mount", id, packet, admitted: receiver !== null })
      if (receiver) acknowledgments.current.set(id, { packet, receiver })
      void Promise.resolve().then(() => advance.current())
    },
    [record],
  )
  const index = FORM_PHASES.indexOf(phase),
    externalMoved = index >= FORM_PHASES.indexOf("external-moved"),
    portal = index >= FORM_PHASES.indexOf("portal")
  return (
    <Context.Provider value={{ phase, commit, acknowledge, record }}>
      <PortalProvider>
        {!externalMoved && <Field key="external-before" id="before" form="owner-form" />}
        <View key={phase === "root-replaced" ? "replacement" : "original"} ref={bind} collapsable={false}>
          <NativeFormMetadata
            metadataRef={metadata}
            ownerId={ownerId}
            descriptorId="form"
            descriptorRevision={revision}
            formTarget={target}
            formId="owner-form"
            onNativeFormCommit={(event: NativeSyntheticEvent<NativeFormCommitData>) => {
              const receiver = rootReceipt.current
              const admitted = receiver?.receive(event.nativeEvent) ?? false
              if (admitted) rootStatus.current = { ...event.nativeEvent }
              acknowledge("form", event.nativeEvent, admitted ? receiver : null)
            }}
          />
          {(phase === "initial" ? ["first", "second"] : ["second", "first"]).map((id) => (
            <View key={id}>
              <Field id={id} />
            </View>
          ))}
          <Activity mode={phase === "activity-hidden" ? "hidden" : "visible"}>
            <Field id="activity" />
          </Activity>
          {portal && (
            <Portal hostName="form-destination">
              <Field id="portal" />
            </Portal>
          )}
          <Modal
            visible={modalVisible}
            onDismiss={() => {
              if (currentPhase.current === "modal" && busy.current) {
                busy.current = false
                setPhase("modal-closed")
              }
            }}
            onShow={() => {
              shown.current = true
              advance.current()
            }}
            onRequestClose={() => fail(new Error("Unexpected modal dismissal"))}
          >
            <View>
              <Field id="modal" />
            </View>
          </Modal>
        </View>
        <Field id="after" form="owner-form" />
        {externalMoved && <Field key="external-before" id="before" form="owner-form" />}
        <Field id="disassociated" form="" />
        <TextInput
          ref={control}
          value="Independent held editor"
          accessibilityLabel="Independent original editor"
          onChange={(event) => record({ kind: "unexpected-input", id: "control", nativeEvent: event.nativeEvent })}
        />
        <PortalHost name="form-destination" />
        <Text>Native form order prototype: {phase}</Text>
      </PortalProvider>
    </Context.Provider>
  )
}
export default FormGate
