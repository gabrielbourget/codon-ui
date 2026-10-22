import type { View } from "react-native"

import { decodeNativeDateFieldBinding, encodeNativeDateFieldBinding, sameNativeDateFieldTargets } from "../dateSegments"
import { decodeNativeFormDocument, fieldsInNativeForm } from "../document"

const segment = (target: number, segmentId: string) => ({
  ownerId: "time-owner",
  segmentId,
  bindingRevision: "wire:1",
  target,
  nativeInstance: `native:${target}`,
  surfaceId: 11,
  windowId: "window:1",
  epoch: 5,
})
const binding = () => ({ kind: "date-field", rootTarget: 4, segments: [segment(6, "hour"), segment(8, "minute")] })
const node = (target: number, parent: number, component = "View") => ({
  target,
  parent,
  component,
  hidden: false,
  displayNone: false,
})
const packet = () => ({
  documentId: "document:1",
  surfaceId: 11,
  rootTarget: 1,
  revision: "2",
  target: 2,
  requestId: "request:1",
  nodes: [
    node(1, 0, "RootView"),
    node(2, 1),
    node(3, 2, "CUIFormRoot"),
    node(4, 2),
    node(5, 4, "CUIFieldBinding"),
    node(6, 4, "CUIDateSegment"),
    node(7, 4, "Text"),
    node(8, 4, "CUIDateSegment"),
  ],
  forms: [
    {
      ownerId: "form-owner",
      descriptorId: "form",
      descriptorRevision: "form:1",
      metadataTarget: 3,
      target: 2,
      position: 2,
      formId: "form-id",
    },
  ],
  fields: [
    {
      ownerId: "field-owner",
      descriptorId: "field",
      descriptorRevision: "field:1",
      metadataTarget: 5,
      target: 6,
      position: 4,
      formId: "",
      hasFormAssociation: false,
      ownedEditorBinding: JSON.stringify(binding()),
    },
  ],
})
const decode = (value = packet()) =>
  decodeNativeFormDocument(JSON.stringify(value), { target: 2, requestId: "request:1" })

it("retains one logical field over every original segment in committed order", () => {
  const document = decode()
  expect(fieldsInNativeForm(document, document.forms[0])).toEqual(document.fields)
  expect(document.fields).toHaveLength(1)
  const owned = decodeNativeDateFieldBinding(document.fields[0].ownedEditorBinding!)
  expect(owned).toEqual(binding())
  expect(Object.isFrozen(owned.segments[0])).toBe(true)
  expect(Object.isFrozen(owned.segments)).toBe(true)
})
it.each([
  ["missing segment", (value: ReturnType<typeof binding>) => value.segments.pop()],
  ["reordered segments", (value: ReturnType<typeof binding>) => value.segments.reverse()],
  [
    "foreign root",
    (value: ReturnType<typeof binding>) => {
      value.rootTarget = 7
    },
  ],
  [
    "foreign surface",
    (value: ReturnType<typeof binding>) => {
      for (const row of value.segments) row.surfaceId = 12
    },
  ],
  [
    "non-segment",
    (value: ReturnType<typeof binding>) => {
      value.segments[1].target = 7
    },
  ],
  [
    "duplicate original",
    (value: ReturnType<typeof binding>) => {
      value.segments[1].target = 6
    },
  ],
  [
    "duplicate segment id",
    (value: ReturnType<typeof binding>) => {
      value.segments[1].segmentId = "hour"
    },
  ],
  [
    "mixed windows",
    (value: ReturnType<typeof binding>) => {
      value.segments[1].windowId = "window:2"
    },
  ],
  [
    "mixed owners",
    (value: ReturnType<typeof binding>) => {
      value.segments[1].ownerId = "owner:2"
    },
  ],
  [
    "fractional epoch",
    (value: ReturnType<typeof binding>) => {
      value.segments[1].epoch = 1.5
    },
  ],
  [
    "missing native instance",
    (value: ReturnType<typeof binding>) => {
      value.segments[1].nativeInstance = ""
    },
  ],
] as const)("rejects %s before admitting field actions", (_name, change) => {
  const value = packet(),
    owned = binding()
  change(owned)
  value.fields[0].ownedEditorBinding = JSON.stringify(owned)
  expect(() => decode(value)).toThrow()
})
it("requires an explicit owned binding and rejects omitted or newly added native segments", () => {
  const value = packet()
  value.fields[0].ownedEditorBinding = ""
  expect(() => decode(value)).toThrow()
  const extra = packet()
  extra.nodes.push(node(9, 4, "CUIDateSegment"))
  expect(() => decode(extra)).toThrow()
})
it("rejects metadata moved outside the original field root", () => {
  const value = packet()
  value.nodes[4].parent = 2
  // Keep a valid preorder while placing the original segment subtree elsewhere.
  value.nodes = [
    value.nodes[0],
    value.nodes[1],
    value.nodes[2],
    value.nodes[4],
    value.nodes[3],
    ...value.nodes.slice(5),
  ]
  value.fields[0].position = 3
  expect(() => decode(value)).toThrow()
})
it("retires the whole set for a non-primary object, epoch, window, revision or root target replacement", () => {
  const targets = binding().segments.map((identity) => ({ original: {} as View, identity }))
  const encoded = encodeNativeDateFieldBinding(4, targets)
  expect(decodeNativeDateFieldBinding(encoded)).toEqual(binding())
  expect(sameNativeDateFieldTargets(targets, [...targets])).toBe(true)
  expect(sameNativeDateFieldTargets(targets, [targets[0]])).toBe(false)
  expect(sameNativeDateFieldTargets(targets, [targets[0], { ...targets[1], original: {} as View }])).toBe(false)
  for (const identity of [
    { ...targets[1].identity, epoch: 6 },
    { ...targets[1].identity, windowId: "window:2" },
    { ...targets[1].identity, bindingRevision: "wire:2" },
    { ...targets[1].identity, nativeInstance: "native:new" },
  ])
    expect(sameNativeDateFieldTargets(targets, [targets[0], { ...targets[1], identity }])).toBe(false)
})
it.each([
  null,
  [],
  {},
  { ...binding(), segments: [] },
  { ...binding(), segments: [{ ...segment(6, "hour"), text: "13" }] },
])("rejects malformed or business-value-bearing descriptor %j", (value) => {
  expect(() => decodeNativeDateFieldBinding(JSON.stringify(value))).toThrow()
})
