import { decodeNativeDateFieldBinding } from "./dateSegments"

export type TNativeFormDocumentNode = Readonly<{
  target: number
  parent: number
  component: string
  hidden: boolean
  displayNone: boolean
}>
export type TNativeFormDescriptor = Readonly<{
  ownerId: string
  descriptorId: string
  descriptorRevision: string
  metadataTarget: number
  target: number
  position: number
  formId: string
}>
export type TNativeFieldDescriptor = TNativeFormDescriptor &
  Readonly<{ hasFormAssociation: boolean; ownedEditorBinding?: string }>
export type TNativeFormDocument = Readonly<{
  documentId: string
  surfaceId: number
  rootTarget: number
  revision: string
  target: number
  requestId: string
  nodes: readonly TNativeFormDocumentNode[]
  forms: readonly TNativeFormDescriptor[]
  fields: readonly TNativeFieldDescriptor[]
}>

const fail = (): never => {
  throw new Error("invalid-native-form-document")
}
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : fail()
const integer = (value: unknown, minimum = 1): number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= 2_147_483_647
    ? value
    : fail()
const text = (value: unknown, empty = false): string =>
  typeof value === "string" && (empty || value.length > 0) ? value : fail()
const boolean = (value: unknown): boolean => (typeof value === "boolean" ? value : fail())
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : fail())

// Decodes only immutable native document evidence. It does not admit a submit,
// reset, focus request or field metadata lease.
export const decodeNativeFormDocument = (
  encoded: string,
  request: Readonly<{ target: number; requestId: string; surfaceId?: number }>,
): TNativeFormDocument => {
  const raw = object(JSON.parse(encoded) as unknown)
  const rootTarget = integer(raw.rootTarget)
  const surfaceId = integer(raw.surfaceId)
  const revision = text(raw.revision)
  if (
    raw.target !== request.target ||
    raw.requestId !== request.requestId ||
    (request.surfaceId !== undefined && surfaceId !== request.surfaceId) ||
    !/^(0|[1-9][0-9]*)$/.test(revision)
  )
    fail()
  const nodes: TNativeFormDocumentNode[] = []
  const positions = new Map<number, number>()
  const path: number[] = []
  for (const value of array(raw.nodes)) {
    const node = object(value)
    const target = integer(node.target)
    const parent = integer(node.parent, 0)
    if (positions.has(target)) fail()
    if (nodes.length === 0) {
      if (target !== rootTarget || parent !== 0) fail()
    } else {
      const parentIndex = path.indexOf(parent)
      if (parentIndex < 0) fail()
      path.length = parentIndex + 1
    }
    positions.set(target, nodes.length)
    path.push(target)
    nodes.push(
      Object.freeze({
        target,
        parent,
        component: text(node.component),
        hidden: boolean(node.hidden),
        displayNone: boolean(node.displayNone),
      }),
    )
  }
  if (!nodes.length || !positions.has(request.target)) fail()
  const ids = new Set<string>()
  const targets = new Set<number>()
  const metadataTargets = new Set<number>()
  const descriptor = (value: unknown, component: string): TNativeFormDescriptor => {
    const raw = object(value)
    const result = Object.freeze({
      ownerId: text(raw.ownerId),
      descriptorId: text(raw.descriptorId),
      descriptorRevision: text(raw.descriptorRevision),
      metadataTarget: integer(raw.metadataTarget),
      target: integer(raw.target),
      position: integer(raw.position, 0),
      formId: text(raw.formId, true),
    })
    if (
      ids.has(result.descriptorId) ||
      targets.has(result.target) ||
      metadataTargets.has(result.metadataTarget) ||
      !positions.has(result.target) ||
      positions.get(result.metadataTarget) !== result.position ||
      nodes[result.position]?.component !== component
    )
      fail()
    ids.add(result.descriptorId)
    targets.add(result.target)
    metadataTargets.add(result.metadataTarget)
    return result
  }
  const forms = array(raw.forms).map((value) => descriptor(value, "CUIFormRoot"))
  const ownedDateTargets = new Set<number>()
  const fields = array(raw.fields).map((value) => {
    const result = descriptor(value, "CUIFieldBinding")
    const editor = nodes[positions.get(result.target) ?? -1]
    const owned = object(value).ownedEditorBinding
    if (owned !== undefined && owned !== "") {
      const encoded = text(owned),
        binding = decodeNativeDateFieldBinding(encoded)
      if (
        editor?.component !== "CUIDateSegment" ||
        binding.segments[0].target !== result.target ||
        !positions.has(binding.rootTarget)
      )
        fail()
      const descendant = (target: number) => {
        let current = target
        while (current) {
          if (current === binding.rootTarget) return true
          current = nodes[positions.get(current) ?? -1]?.parent ?? 0
        }
        return false
      }
      if (!descendant(result.metadataTarget) || binding.rootTarget === result.metadataTarget) fail()
      const actual = nodes.filter((node) => node.component === "CUIDateSegment" && descendant(node.target))
      if (
        actual.length !== binding.segments.length ||
        actual.some((node, index) => node.target !== binding.segments[index].target)
      )
        fail()
      for (const segment of binding.segments) {
        if (
          ownedDateTargets.has(segment.target) ||
          segment.surfaceId !== surfaceId ||
          nodes[positions.get(segment.target) ?? -1]?.component !== "CUIDateSegment" ||
          !descendant(segment.target)
        )
          fail()
        ownedDateTargets.add(segment.target)
      }
      return Object.freeze({
        ...result,
        hasFormAssociation: boolean(object(value).hasFormAssociation),
        ownedEditorBinding: encoded,
      })
    }
    if (editor?.component !== "TextInput" && editor?.component !== "AndroidTextInput") fail()
    return Object.freeze({ ...result, hasFormAssociation: boolean(object(value).hasFormAssociation) })
  })
  // Every retained metadata node must be represented exactly once. Incomplete
  // or foreign native packets cannot become an empty successful form.
  for (const node of nodes)
    if ((node.component === "CUIFormRoot" || node.component === "CUIFieldBinding") && !metadataTargets.has(node.target))
      fail()
  const ordered = (values: readonly TNativeFormDescriptor[]) =>
    values.every((value, index) => index === 0 || value.position > values[index - 1].position)
  if (!ordered(forms) || !ordered(fields)) fail()
  const document = Object.freeze({
    documentId: text(raw.documentId),
    surfaceId,
    rootTarget,
    revision,
    target: request.target,
    requestId: request.requestId,
    nodes: Object.freeze(nodes),
    forms: Object.freeze(forms),
    fields: Object.freeze(fields),
  })
  for (const form of forms) if (!isNativeFormDescendant(document, form.metadataTarget, form.target)) fail()
  return document
}

export const isNativeFormDescendant = (document: TNativeFormDocument, target: number, ancestor: number) => {
  const parents = new Map(document.nodes.map((node) => [node.target, node.parent]))
  let current = target
  while (current !== 0) {
    if (current === ancestor) return true
    current = parents.get(current) ?? 0
  }
  return false
}

export const fieldsInNativeForm = (document: TNativeFormDocument, form: TNativeFormDescriptor) => {
  if (!document.forms.includes(form)) throw new Error("foreign-native-form")
  return document.fields.filter((field) => {
    if (field.hasFormAssociation) {
      if (!field.formId) return false
      const associated = document.forms.filter((candidate) => candidate.formId === field.formId)
      if (associated.length > 1) throw new Error("ambiguous-native-form-id")
      return associated[0] === form
    }
    const parents = new Map(document.nodes.map((node) => [node.target, node.parent]))
    // A key field serializes at its metadata host; its original editor may
    // occupy a different authored position. UI authority remains separate.
    let target = field.metadataTarget
    while (target !== 0) {
      const ancestor = document.forms.find((candidate) => candidate.target === target)
      if (ancestor) return ancestor === form
      target = parents.get(target) ?? 0
    }
    return false
  })
}
