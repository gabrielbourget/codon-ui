import { decodeNativeDateFieldBinding } from "../../form/dateSegments"
import { decodeNativeFormDocument, isNativeFormDescendant } from "../../form/document"
import type { NativeFormCommitData } from "../../input/specs/CUIFormRootNativeComponent"

export type TNativeFieldGroupRequest = Readonly<{
  target: number
  surfaceId: number
  requestId: string
  fieldGroup: Readonly<{ outerTarget: number; inputTarget: number; mount: NativeFormCommitData }>
}>
export type TNativeFieldGroupOriginal = Readonly<{
  target: number
  nativeInstance: string
  editorInstance: string
  focused: boolean
  eligible: boolean
  tabStop: boolean
  readOnly: boolean
  placeholder: boolean
  groups: readonly number[]
  rect: Readonly<{ x: number; y: number; width: number; height: number }>
}>

const invalid = (): never => {
  throw new Error("invalid-native-field-group-document")
}
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : invalid()
const text = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : invalid())
const integer = (value: unknown, zero = false) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= (zero ? 0 : 1) && value <= 2147483647
    ? value
    : invalid()
const boolean = (value: unknown) => (typeof value === "boolean" ? value : invalid())
const finite = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : invalid())
const array = (value: unknown) => (Array.isArray(value) ? value : invalid())
const sameRecord = (value: unknown, expected: object) => {
  const record = object(value)
  return (
    Object.keys(record).length === Object.keys(expected).length &&
    Object.entries(expected).every(([key, item]) => record[key] === item)
  )
}

// This decoder retains native evidence, not a focus registry or a JS document.
// A returned target never grants authority to focus or acknowledge an event.
export const decodeNativeFieldGroupDocument = (encoded: string, request: TNativeFieldGroupRequest) => {
  const document = decodeNativeFormDocument(encoded, request)
  const raw = object(object(JSON.parse(encoded)).fieldGroupSnapshot)
  const { outerTarget, inputTarget, mount } = request.fieldGroup
  const field = document.fields.find((candidate) => candidate.metadataTarget === mount.target)
  if (!field || !field.ownedEditorBinding) return invalid()
  if (
    raw.documentId !== document.documentId ||
    raw.revision !== document.revision ||
    raw.surfaceId !== document.surfaceId ||
    raw.outerTarget !== outerTarget ||
    raw.inputTarget !== inputTarget ||
    !sameRecord(raw.mount, mount) ||
    !sameRecord(raw.field, field) ||
    outerTarget === inputTarget ||
    !isNativeFormDescendant(document, inputTarget, outerTarget) ||
    !isNativeFormDescendant(document, field.metadataTarget, outerTarget) ||
    !mount.active ||
    !mount.attached ||
    !mount.complete ||
    !mount.metadataOnly ||
    mount.error !== "" ||
    mount.surfaceId !== document.surfaceId ||
    mount.originalTarget !== field.target ||
    mount.ownerId !== field.ownerId ||
    mount.descriptorId !== field.descriptorId ||
    mount.descriptorRevision !== field.descriptorRevision ||
    !Number.isSafeInteger(mount.epoch) ||
    mount.epoch <= 0 ||
    !Number.isSafeInteger(mount.sequence) ||
    mount.sequence <= 0 ||
    !mount.mountRevision ||
    !mount.originalClass ||
    text(raw.windowId) !== mount.windowId
  )
    invalid()
  const owned = decodeNativeDateFieldBinding(field.ownedEditorBinding)
  if (
    owned.rootTarget !== outerTarget ||
    owned.segments.some((segment) => !isNativeFormDescendant(document, segment.target, inputTarget))
  )
    invalid()
  const positions = new Map(document.nodes.map((node, index) => [node.target, index]))
  const segments = new Map(
    document.fields.flatMap((entry) =>
      entry.ownedEditorBinding
        ? decodeNativeDateFieldBinding(entry.ownedEditorBinding).segments.map(
            (segment) => [segment.target, segment] as const,
          )
        : [],
    ),
  )
  const parents = new Map(document.nodes.map((node) => [node.target, node]))
  const visible = (target: number) => {
    for (let node = parents.get(target); node; node = parents.get(node.parent))
      if (node.hidden || node.displayNone) return false
    return true
  }
  let previous = -1
  const originals = array(raw.originals).map((value): TNativeFieldGroupOriginal => {
    const row = object(value),
      target = integer(row.target),
      position = positions.get(target) ?? -1,
      rect = object(row.rect),
      groups = array(row.groups).map((group) => integer(group)),
      expectedGroups = [...(isNativeFormDescendant(document, target, inputTarget) ? [inputTarget] : []), outerTarget]
    const rectangle = Object.freeze({
      x: finite(rect.x),
      y: finite(rect.y),
      width: finite(rect.width),
      height: finite(rect.height),
    })
    if (
      position <= previous ||
      target === outerTarget ||
      !visible(target) ||
      !isNativeFormDescendant(document, target, outerTarget) ||
      rectangle.width < 0 ||
      rectangle.height < 0 ||
      groups.length !== expectedGroups.length ||
      groups.some((group, index) => group !== expectedGroups[index]) ||
      (!boolean(row.eligible) && !boolean(row.focused))
    )
      invalid()
    const node = document.nodes[position]
    if (node.component === "CUIDateSegment") {
      const expected = segments.get(target)
      if (!expected || !sameRecord(row.segment, expected) || expected.windowId !== mount.windowId) invalid()
    } else if (row.segment !== undefined) invalid()
    previous = position
    return Object.freeze({
      target,
      nativeInstance: text(row.nativeInstance),
      editorInstance: text(row.editorInstance),
      focused: boolean(row.focused),
      eligible: boolean(row.eligible),
      tabStop: boolean(row.tabStop),
      readOnly: boolean(row.readOnly),
      placeholder: boolean(row.placeholder),
      groups: Object.freeze(groups),
      rect: rectangle,
    })
  })
  const focusedTarget = integer(raw.focusedTarget, true),
    focused = originals.filter((row) => row.focused)
  if (focused.length > 1 || focusedTarget !== (focused[0]?.target ?? 0)) invalid()
  const selection = object(raw.selection)
  const selected = (name: string) => {
    const target = integer(selection[name], true)
    if (target !== 0 && !originals.some((row) => row.target === target && row.eligible)) invalid()
    return target
  }
  return Object.freeze({
    document,
    outerTarget,
    inputTarget,
    outerInstance: text(raw.outerInstance),
    inputInstance: text(raw.inputInstance),
    windowId: text(raw.windowId),
    focusedTarget,
    originals: Object.freeze(originals),
    selection: Object.freeze({
      first: selected("first"),
      next: selected("next"),
      previous: selected("previous"),
      physicalLeft: selected("physicalLeft"),
      physicalRight: selected("physicalRight"),
    }),
  })
}
