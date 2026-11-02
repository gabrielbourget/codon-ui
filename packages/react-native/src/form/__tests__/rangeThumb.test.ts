import type { View } from "react-native"

import { VALID_VALIDITY_STATE } from "../../components/ComboBox/state/useFormValidationState"
import { NativeFormController } from "../controller"
import {
  decodeNativeFormDocument,
  fieldsInNativeForm,
  type TNativeFieldDescriptor,
  type TNativeFormDocumentNode,
} from "../document"
import { decodeNativeRangeThumbBinding } from "../rangeThumb"
import { NativeFormRegistry, nativeFormRevision } from "../registry"

const binding = JSON.stringify({ kind: "range-thumb", rootTarget: 4 })
const request = { target: 2, requestId: "read:1" }
const packet = () => {
  const rows = [
    [1, 0, "RootView"],
    [2, 1, "View"],
    [3, 2, "CUIFormRoot"],
    [4, 2, "View"],
    [6, 4, "CUIFocusView"],
    [5, 6, "CUIFieldBinding"],
    [8, 4, "CUIFocusView"],
    [7, 8, "CUIFieldBinding"],
    [9, 2, "CUIFieldBinding"],
    [10, 2, "TextInput"],
    [13, 2, "View"],
    [11, 13, "CUIFieldBinding"],
    [12, 13, "CUIDateSegment"],
  ] as const
  const nodes: TNativeFormDocumentNode[] = rows.map(([target, parent, component]) => ({
    target,
    parent,
    component,
    hidden: false,
    displayNone: false,
    ...(component === "CUIFocusView" ? { rangeThumb: true } : {}),
    ...(component === "CUIDateSegment" ? { dateSegmentOwner: "date-owner" } : {}),
  }))
  const descriptor = (id: string, metadataTarget: number, target: number) => ({
    ownerId: id,
    descriptorId: id,
    descriptorRevision: `${id}:1`,
    metadataTarget,
    target,
    position: nodes.findIndex((node) => node.target === metadataTarget),
    formId: "",
  })
  const fields: TNativeFieldDescriptor[] = [
    { ...descriptor("start", 5, 6), hasFormAssociation: false, ownedControlBinding: binding },
    { ...descriptor("end", 7, 8), hasFormAssociation: false, ownedControlBinding: binding },
    { ...descriptor("editor", 9, 10), hasFormAssociation: false },
    {
      ...descriptor("date", 11, 12),
      hasFormAssociation: false,
      ownedEditorBinding: JSON.stringify({
        kind: "date-field",
        rootTarget: 13,
        segments: [
          {
            ownerId: "date-owner",
            segmentId: "day",
            bindingRevision: "date:1",
            target: 12,
            nativeInstance: "segment:1",
            surfaceId: 11,
            windowId: "window:1",
            epoch: 1,
          },
        ],
      }),
    },
  ]
  return {
    ...request,
    documentId: "document:1",
    surfaceId: 11,
    rootTarget: 1,
    revision: "1",
    nodes,
    fields,
    forms: [{ ...descriptor("form", 3, 2), formId: "owner" }],
  }
}
const decode = (value = packet()) => decodeNativeFormDocument(JSON.stringify(value), request)

it("admits explicit original range thumbs in native order alongside unchanged editor and date bindings", () => {
  const document = decode()
  expect(fieldsInNativeForm(document, document.forms[0]).map((field) => field.descriptorId)).toEqual([
    "start",
    "end",
    "editor",
    "date",
  ])
  expect(document.fields[0].ownedControlBinding).toBe(binding)
  expect(document.fields[2].ownedControlBinding).toBeUndefined()
  expect(document.fields[3].ownedEditorBinding).toBe(packet().fields[3].ownedEditorBinding)
  expect(Object.isFrozen(document.fields[0])).toBe(true)
})

it.each([
  null,
  [],
  {},
  { kind: "date-field", rootTarget: 4 },
  { kind: "range-thumb", rootTarget: 0 },
  { kind: "range-thumb", rootTarget: true },
  { kind: "range-thumb", rootTarget: "4" },
  { kind: "range-thumb", rootTarget: 1.5 },
  { kind: "range-thumb", rootTarget: 2147483648 },
  { kind: "range-thumb", rootTarget: 4, value: "private" },
])("rejects a malformed control binding %p", (value) => {
  expect(() => decodeNativeRangeThumbBinding(JSON.stringify(value))).toThrow()
})

it.each([
  "untyped",
  "core View",
  "unadjustable",
  "foreign root",
  "metadata outside original",
  "duplicate original",
  "mixed editor",
  "unknown kind",
  "missing descriptor",
] as const)("rejects the %s control admission instead of widening editor eligibility", (mode) => {
  const value = packet()
  if (mode === "untyped") delete (value.fields[0] as { ownedControlBinding?: string }).ownedControlBinding
  if (mode === "core View") value.nodes[4] = { ...value.nodes[4], component: "View" }
  if (mode === "unadjustable") value.nodes[4] = { ...value.nodes[4], rangeThumb: false }
  if (mode === "foreign root")
    value.fields[0] = {
      ...value.fields[0],
      ownedControlBinding: JSON.stringify({ kind: "range-thumb", rootTarget: 13 }),
    }
  if (mode === "metadata outside original") value.nodes[5] = { ...value.nodes[5], parent: 4 }
  if (mode === "duplicate original") value.fields[1] = { ...value.fields[1], target: 6 }
  if (mode === "mixed editor")
    value.fields[0] = { ...value.fields[0], ownedEditorBinding: value.fields[3].ownedEditorBinding }
  if (mode === "unknown kind")
    value.fields[0] = { ...value.fields[0], ownedControlBinding: JSON.stringify({ kind: "checkbox", rootTarget: 4 }) }
  if (mode === "missing descriptor") value.fields.shift()
  expect(() => decode(value)).toThrow()
})

it("retains logical hidden control membership and explicit empty association without granting focus", () => {
  const value = packet()
  value.nodes[4] = { ...value.nodes[4], hidden: true, displayNone: true }
  value.fields[1] = { ...value.fields[1], hasFormAssociation: true, formId: "" }
  const document = decode(value)
  expect(document.fields).toHaveLength(4)
  expect(fieldsInNativeForm(document, document.forms[0]).map((field) => field.descriptorId)).toEqual([
    "start",
    "editor",
    "date",
  ])
})

it.each(["matching", "missing", "changed"] as const)(
  "requires complete control descriptor equality with %s registry authority",
  async (mode) => {
    const registry = new NativeFormRegistry()
    const value = packet()
    for (const field of value.fields) {
      const { position: _position, ...descriptor } = field
      registry.commitField({
        descriptor:
          field.descriptorId === "start" && mode !== "matching"
            ? {
                ...descriptor,
                ownedControlBinding:
                  mode === "missing" ? undefined : JSON.stringify({ kind: "range-thumb", rootTarget: 2 }),
              }
            : descriptor,
        data: {
          entries: [[field.descriptorId, field.descriptorId === "start" ? "0" : "12.5"]],
          isDisabled: false,
          isReadOnly: false,
          validationBehavior: "native",
          validation: { isInvalid: false, validationDetails: VALID_VALIDITY_STATE, validationErrors: [] },
        },
        editor: () => null,
        mount: () => null,
        isFocusObserved: () => false,
        commitValidation: jest.fn(),
        reset: jest.fn(),
      })
    }
    const original = {} as View
    const { position: _position, ...form } = value.forms[0]
    value.forms[0].descriptorRevision = nativeFormRevision(form.ownerId, form.target, registry.getRevision())
    const onSubmit = jest.fn()
    registry.commitForm({
      descriptor: { ...form, descriptorRevision: value.forms[0].descriptorRevision },
      fieldRevision: registry.getRevision(),
      original,
      current: () => original,
      props: () => ({ onSubmit }),
    })
    const controller = new NativeFormController(registry, async (read) => JSON.stringify({ ...value, ...read }))
    const result = await controller.request("submit", { origin: "programmatic", form: original })
    if (mode === "matching") {
      expect(result.status).toBe("submitted")
      expect(result.request?.entries.slice(0, 2)).toEqual([
        ["start", "0"],
        ["end", "12.5"],
      ])
      expect(onSubmit).toHaveBeenCalledTimes(1)
    } else {
      expect(result).toMatchObject({ status: "retired", reason: "native-document-field-registration-incomplete" })
      expect(onSubmit).not.toHaveBeenCalled()
    }
  },
)
