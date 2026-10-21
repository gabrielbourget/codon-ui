import { Activity, useCallback, useId, useInsertionEffect, useRef, useState } from "react"
import { findNodeHandle, Modal, TextInput, View } from "react-native"

import { Button, Text } from "@codon-ui/react-native"

import { decodeNativeFormDocument, fieldsInNativeForm } from "../../../../packages/react-native/src/form/document"
import { NativeFieldMetadata, NativeFormMetadata } from "../../../../packages/react-native/src/form/NativeFormMetadata"
import Document from "../../../../packages/react-native/src/input/specs/NativeCUIFormDocument"

const Field = ({ name, form }: { name: string; form?: string }) => {
  const identity = useId()
  const [target, setTarget] = useState(0)
  const [value, setValue] = useState(`Draft ${name}`)
  const original = useRef<TextInput | null>(null)
  const bind = useCallback((editor: TextInput | null) => {
    original.current = editor
    // Activity may detach refs while retaining the original Fabric family.
    // Native document membership, not this ref callback, owns retained order.
    if (editor) setTarget(findNodeHandle(editor) ?? 0)
  }, [])
  return (
    <View>
      <NativeFieldMetadata
        ownerId={identity}
        descriptorId={`field:${name}`}
        descriptorRevision={`${identity}:${target}:${form ?? "inside"}`}
        editorTarget={target}
        hasFormAssociation={form !== undefined}
        formId={form ?? ""}
      />
      <TextInput ref={bind} accessibilityLabel={`Form document ${name}`} value={value} onChangeText={setValue} />
    </View>
  )
}

// Private SDK-order prototype. This does not expose NativeForm or admit form
// actions; its result remains separate from installed/interaction acceptance.
export const FormDocumentScene = () => {
  const owner = useId()
  const form = useRef<View | null>(null)
  const [formTarget, setFormTarget] = useState(0)
  const [reverse, setReverse] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [modal, setModal] = useState(false)
  const [report, setReport] = useState("No native document captured")
  const live = useRef(false)
  const sequence = useRef(0)
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      sequence.current++
    }
  }, [])
  const bind = useCallback((view: View | null) => {
    form.current = view
    if (view) setFormTarget(findNodeHandle(view) ?? 0)
  }, [])
  const capture = async () => {
    const target = findNodeHandle(form.current)
    const requestId = `${owner}:capture:${++sequence.current}`
    const generation = sequence.current
    if (!target || !Document) {
      setReport("Native form document module/target unavailable")
      return
    }
    try {
      const encoded = await Document.getSnapshot(JSON.stringify({ target, requestId }))
      if (!live.current || generation !== sequence.current || findNodeHandle(form.current) !== target) return
      const document = decodeNativeFormDocument(encoded, { target, requestId })
      const current = document.forms.find((candidate) => candidate.ownerId === owner)
      if (!current) throw new Error("Original form descriptor missing")
      const fields = fieldsInNativeForm(document, current)
      const result = {
        documentId: document.documentId,
        revision: document.revision,
        surfaceId: document.surfaceId,
        originalForm: target,
        fields: fields.map((field) => ({ id: field.descriptorId, target: field.target, position: field.position })),
        retainedHidden: document.nodes.filter((node) => node.hidden || node.displayNone).map((node) => node.target),
      }
      setReport(JSON.stringify(result))
    } catch (error) {
      if (live.current && generation === sequence.current) setReport(`Native document rejected: ${String(error)}`)
    }
  }
  const ids = reverse ? ["second", "first"] : ["first", "second"]
  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2">Native form document prototype</Text>
      <Text>Read-only native order; original editors retain their independent drafts.</Text>
      <Button
        onPress={() => {
          void capture()
        }}
      >
        Capture native form document
      </Button>
      <Button onPress={() => setReverse((value) => !value)}>Reorder form document fields</Button>
      <Button onPress={() => setHidden((value) => !value)}>Toggle form document Activity</Button>
      <Button onPress={() => setModal((value) => !value)}>Toggle form document Modal</Button>
      <Text testID="form-document-report">{report}</Text>
      <Field name="external-before" form="native-owner-form" />
      <View ref={bind} collapsable={false} testID="form-document-original-root">
        <NativeFormMetadata
          ownerId={owner}
          descriptorId="prototype-form"
          descriptorRevision={`${owner}:${formTarget}`}
          formTarget={formTarget}
          formId="native-owner-form"
        />
        {ids.map((id) => (
          <View key={id}>
            <Field name={id} />
          </View>
        ))}
        <Activity mode={hidden ? "hidden" : "visible"}>
          <Field name="activity" />
        </Activity>
        <Modal visible={modal} onRequestClose={() => setModal(false)}>
          <View>
            <Field name="modal" />
            <Button
              onPress={() => {
                void capture()
              }}
            >
              Capture modal form document
            </Button>
            <Button onPress={() => setModal(false)}>Close form document Modal</Button>
          </View>
        </Modal>
      </View>
      <Field name="external-after" form="native-owner-form" />
      <Field name="disassociated" form="" />
    </View>
  )
}
