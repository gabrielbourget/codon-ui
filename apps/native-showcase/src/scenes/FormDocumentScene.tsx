import {
  Activity,
  useCallback,
  useContext,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { findNodeHandle, Modal, TextInput, View } from "react-native"

import { Button, Text } from "@codon-ui/react-native"

import { VALID_VALIDITY_STATE } from "../../../../packages/react-native/src/components/ComboBox/state/useFormValidationState"
import { admitNativeFormAction } from "../../../../packages/react-native/src/form/actionAdmission"
import { NativeFormOwnerContext, NativeFormRegistryContext } from "../../../../packages/react-native/src/form/context"
import { NativeFormMountReceipt } from "../../../../packages/react-native/src/form/mount"
import { NativeForm } from "../../../../packages/react-native/src/form/NativeForm"
import { NativeFieldMetadata } from "../../../../packages/react-native/src/form/NativeFormMetadata"
import type { NativeFormCommitData } from "../../../../packages/react-native/src/input/specs/CUIFormRootNativeComponent"

let nextFieldRevision = 0

// The scene's plain editors publish their explicit data and original mount receipt.
// Their native parents never determine membership or order.
const Field = ({ name, form, hidden = false }: { name: string; form?: string; hidden?: boolean }) => {
  const registry = useContext(NativeFormRegistryContext)
  const formOwnerId = useContext(NativeFormOwnerContext)
  const ownerId = useId()
  const descriptorId = `${ownerId}:field`
  const original = useRef<TextInput | null>(null)
  const metadata = useRef<View | null>(null)
  const receipt = useRef<NativeFormMountReceipt | null>(null)
  const [editor, setEditor] = useState<TextInput | null>(null)
  const [metadataTarget, setMetadataTarget] = useState(0)
  const [value, setValue] = useState(`Draft ${name}`)
  const target = editor ? (findNodeHandle(editor) ?? 0) : 0
  const descriptorRevision = useMemo(
    () => `${ownerId}:${++nextFieldRevision}`,
    [ownerId, target, value, form, formOwnerId],
  )
  const current = useRef({ descriptorRevision, target, metadataTarget })
  useInsertionEffect(() => {
    current.current = { descriptorRevision, target, metadataTarget }
  })
  const bind = useCallback((view: TextInput | null) => {
    // Activity may disconnect the ref while retaining this exact editor. The outer metadata receipt still proves native attachment.
    if (!view) return
    if (original.current !== view) {
      receipt.current?.retire()
      receipt.current = null
    }
    original.current = view
    setEditor(view)
  }, [])
  useLayoutEffect(
    () => () => {
      original.current = null
      receipt.current?.retire()
    },
    [],
  )
  const bindMetadata = useCallback((view: View | null) => {
    if (metadata.current !== view) {
      receipt.current?.retire()
      receipt.current = null
    }
    metadata.current = view
    if (view) setMetadataTarget(findNodeHandle(view) ?? 0)
  }, [])
  const receive = (packet: NativeFormCommitData) => {
    const host = metadata.current,
      editor = original.current,
      state = current.current
    if (
      !host ||
      !editor ||
      !packet ||
      packet.ownerId !== ownerId ||
      packet.descriptorId !== descriptorId ||
      packet.descriptorRevision !== state.descriptorRevision ||
      packet.target !== state.metadataTarget ||
      packet.originalTarget !== state.target
    )
      return
    if (receipt.current?.scope.descriptorRevision !== state.descriptorRevision) {
      receipt.current?.retire()
      receipt.current = null
    }
    receipt.current ??= new NativeFormMountReceipt(packet, {
      metadata: host,
      original: editor,
      current: () => ({ metadata: metadata.current, original: original.current }),
    })
    receipt.current.receive(packet)
  }
  useLayoutEffect(() => {
    if (!target || !metadataTarget || !original.current) return
    const release = registry.commitField({
      descriptor: {
        ownerId,
        descriptorId,
        descriptorRevision,
        target,
        metadataTarget,
        formId: form ?? "",
        hasFormAssociation: form !== undefined,
      },
      fieldId: name,
      formOwnerId,
      data: {
        entries: [[name, value]],
        isDisabled: false,
        isReadOnly: false,
        validationBehavior: "native",
        validation: { isInvalid: false, validationDetails: VALID_VALIDITY_STATE, validationErrors: [] },
      },
      editor: () => original.current,
      mount: () => receipt.current,
      isFocusObserved: () => original.current?.isFocused() ?? false,
      commitValidation: () => {},
      reset: () => {
        if (original.current) setValue(`Draft ${name}`)
      },
    })
    return () => {
      release()
      receipt.current?.retire()
      receipt.current = null
    }
  }, [registry, ownerId, descriptorId, descriptorRevision, target, metadataTarget, name, form, formOwnerId, value])
  return (
    <View>
      <NativeFieldMetadata
        metadataRef={bindMetadata}
        ownerId={ownerId}
        descriptorId={descriptorId}
        descriptorRevision={descriptorRevision}
        editorTarget={target}
        hasFormAssociation={form !== undefined}
        formId={form ?? ""}
        onNativeFormCommit={(event) => receive(event.nativeEvent)}
      />
      <Activity mode={hidden ? "hidden" : "visible"}>
        <TextInput ref={bind} accessibilityLabel={`Form document ${name}`} value={value} onChangeText={setValue} />
      </Activity>
    </View>
  )
}

export const FormDocumentScene = () => {
  const owner = useId()
  const formId = `${owner}:explicit-form`
  const registry = useContext(NativeFormRegistryContext)
  const form = useRef<View | null>(null)
  const [reverse, setReverse] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [modal, setModal] = useState(false)
  const [report, setReport] = useState("No explicit form model captured")
  const live = useRef(false)
  const sequence = useRef(0)
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      sequence.current++
    }
  }, [])
  const capture = async () => {
    const original = form.current
    const generation = ++sequence.current
    try {
      const binding = registry.resolveForm(formId, null)
      const revision = registry.getRevision()
      const fields = registry.fieldsFor(binding)
      if (
        !original ||
        binding.original !== original ||
        binding.fieldRevision !== revision ||
        !(await admitNativeFormAction(binding, fields))
      )
        throw new Error("Original native form hosts not admitted")
      if (!live.current || generation !== sequence.current || form.current !== original) return
      if (registry.getRevision() !== revision || registry.forms.get(binding.descriptor.descriptorId) !== binding)
        throw new Error("Explicit form model changed during admission")
      setReport(
        JSON.stringify({
          source: "explicit-model",
          originalForm: binding.descriptor.target,
          fieldOrder: binding.fieldOrder,
          fields: fields.map((field) => ({
            id: field.fieldId,
            target: field.descriptor.target,
            entries: field.data.entries,
          })),
        }),
      )
    } catch (error) {
      if (live.current && generation === sequence.current) setReport(`Form capture rejected: ${String(error)}`)
    }
  }
  const ids = reverse ? ["second", "first"] : ["first", "second"]
  const fieldOrder = ["external-before", ...ids, "activity", ...(modal ? ["modal"] : []), "external-after"]
  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2">Explicit form model</Text>
      <Text>Declared field order and association; original editors retain their independent drafts.</Text>
      <Button
        onPress={() => {
          void capture()
        }}
      >
        Capture explicit form model
      </Button>
      <Button onPress={() => setReverse((value) => !value)}>Reorder form document fields</Button>
      <Button onPress={() => setHidden((value) => !value)}>Toggle form document Activity</Button>
      <Button onPress={() => setModal((value) => !value)}>Toggle form document Modal</Button>
      <Text>
        Activity field: {hidden ? "hidden, with its draft retained" : "visible"}. Modal shares the declared owner;
        admission still requires the same native window.
      </Text>
      <Text testID="form-document-report">{report}</Text>
      <Field name="external-before" form={formId} />
      <NativeForm ref={form} id={formId} fieldOrder={fieldOrder} testID="form-document-original-root">
        {ids.map((id) => (
          <View key={id}>
            <Field name={id} />
          </View>
        ))}
        <Field name="activity" hidden={hidden} />
        {modal && (
          <Modal visible onRequestClose={() => setModal(false)}>
            <View>
              <Field name="modal" />
              <Button
                onPress={() => {
                  void capture()
                }}
              >
                Capture modal form model
              </Button>
              <Button onPress={() => setModal(false)}>Close form document Modal</Button>
            </View>
          </Modal>
        )}
      </NativeForm>
      <Field name="external-after" form={formId} />
      <Field name="disassociated" form="" />
    </View>
  )
}
