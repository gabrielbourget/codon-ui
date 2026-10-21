import { decodeNativeFormDocument, fieldsInNativeForm } from "../document"

const request = { target: 2, requestId: "request:1" }
const node = (target: number, parent: number, component = "View", hidden = false, displayNone = false) => ({
  target,
  parent,
  component,
  hidden,
  displayNone,
})
const descriptor = (descriptorId: string, metadataTarget: number, target: number, position: number, formId = "") => ({
  ownerId: "owner:1",
  descriptorId,
  descriptorRevision: "revision:1",
  metadataTarget,
  target,
  position,
  formId,
})
const packet = () => ({
  documentId: "native:1:root:1",
  surfaceId: 11,
  rootTarget: 1,
  revision: "9",
  ...request,
  nodes: [
    node(1, 0, "RootView"),
    node(2, 1),
    node(3, 2, "CUIFormRoot"),
    node(4, 2),
    node(5, 4, "CUIFieldBinding"),
    node(6, 4, "TextInput"),
    node(7, 2, "ModalHostView"),
    node(8, 7, "CUIFieldBinding"),
    node(9, 7, "TextInput"),
    node(10, 2, "View", true, true),
    node(11, 10, "CUIFieldBinding", true),
    node(12, 10, "TextInput", true, true),
    node(13, 1),
    node(14, 13, "CUIFieldBinding"),
    node(15, 13, "AndroidTextInput"),
  ],
  forms: [descriptor("form:1", 3, 2, 2, "owner-form")],
  fields: [
    { ...descriptor("inside", 5, 6, 4), hasFormAssociation: false },
    { ...descriptor("modal", 8, 9, 7), hasFormAssociation: false },
    { ...descriptor("hidden", 11, 12, 10), hasFormAssociation: false },
    { ...descriptor("external", 14, 15, 13, "owner-form"), hasFormAssociation: true },
  ],
})
const decode = (value = packet()) => decodeNativeFormDocument(JSON.stringify(value), request)

it("retains native preorder across wrappers, modal roots, hidden nodes and external associations", () => {
  const document = decode()
  expect(fieldsInNativeForm(document, document.forms[0]).map((field) => field.descriptorId)).toEqual([
    "inside",
    "modal",
    "hidden",
    "external",
  ])
  expect(document.nodes.find((node) => node.target === 12)).toMatchObject({ hidden: true, displayNone: true })
  expect(Object.isFrozen(document.fields[0])).toBe(true)
  expect(Object.isFrozen(document.nodes)).toBe(true)
})

it("uses native committed reorder while preserving explicit empty/no-match form disassociation", () => {
  const value = packet()
  value.nodes = [value.nodes[0], ...value.nodes.slice(12), ...value.nodes.slice(1, 12)]
  value.fields = [value.fields[3], ...value.fields.slice(0, 3)]
  for (const field of value.fields)
    field.position = value.nodes.findIndex((node) => node.target === field.metadataTarget)
  value.forms[0].position = value.nodes.findIndex((node) => node.target === 3)
  const document = decode(value)
  expect(fieldsInNativeForm(document, document.forms[0]).map((field) => field.descriptorId)).toEqual([
    "external",
    "inside",
    "modal",
    "hidden",
  ])
  value.fields[1].hasFormAssociation = true
  for (const formId of ["", "missing"]) {
    value.fields[1].formId = formId
    const next = decode(value)
    expect(fieldsInNativeForm(next, next.forms[0]).some((field) => field.descriptorId === "inside")).toBe(false)
  }
})

it.each([
  [
    "stale request",
    (value: ReturnType<typeof packet>) => {
      value.requestId = "old"
    },
  ],
  [
    "foreign original target",
    (value: ReturnType<typeof packet>) => {
      value.target = 999
    },
  ],
  [
    "duplicate native target",
    (value: ReturnType<typeof packet>) => {
      value.nodes.push({ ...value.nodes[1] })
    },
  ],
  [
    "reopened closed subtree",
    (value: ReturnType<typeof packet>) => {
      value.nodes.push(node(16, 4))
    },
  ],
  [
    "missing retained descriptor",
    (value: ReturnType<typeof packet>) => {
      value.fields.pop()
    },
  ],
  [
    "uncommitted descriptor position",
    (value: ReturnType<typeof packet>) => {
      value.fields[0].position = 5
    },
  ],
  [
    "duplicate descriptor",
    (value: ReturnType<typeof packet>) => {
      value.fields[1].descriptorId = "inside"
    },
  ],
  [
    "duplicate editor",
    (value: ReturnType<typeof packet>) => {
      value.fields[1].target = 6
    },
  ],
  [
    "non-editor target",
    (value: ReturnType<typeof packet>) => {
      value.fields[1].target = 7
    },
  ],
  [
    "form root outside original view",
    (value: ReturnType<typeof packet>) => {
      value.forms[0].target = 13
    },
  ],
  [
    "registration order substituted",
    (value: ReturnType<typeof packet>) => {
      value.fields.reverse()
    },
  ],
] as const)("rejects %s", (_name, change) => {
  const value = packet()
  change(value)
  expect(() => decode(value)).toThrow("invalid-native-form-document")
})

it("rejects a foreign document surface and a descriptor from another decoded snapshot", () => {
  expect(() => decodeNativeFormDocument(JSON.stringify(packet()), { ...request, surfaceId: 99 })).toThrow()
  const document = decode()
  expect(() => fieldsInNativeForm(document, decode().forms[0])).toThrow("foreign-native-form")
})

it("uses the committed serialization descriptor location rather than the editor's visual placement", () => {
  const value = packet()
  const editor = value.nodes.splice(
    value.nodes.findIndex((node) => node.target === 6),
    1,
  )[0]
  value.nodes.push({ ...editor, parent: 13 })
  for (const form of value.forms) form.position = value.nodes.findIndex((node) => node.target === form.metadataTarget)
  for (const field of value.fields)
    field.position = value.nodes.findIndex((node) => node.target === field.metadataTarget)
  const document = decode(value)
  expect(fieldsInNativeForm(document, document.forms[0]).map((field) => field.descriptorId)).toContain("inside")
})
