import type { NativeFormCommitData } from "../../../input/specs/CUIFormRootNativeComponent"
import { decodeNativeFieldGroupDocument } from "../document"

const mount: NativeFormCommitData = {
  ownerId: "field",
  descriptorId: "field:1",
  descriptorRevision: "field:revision:1",
  target: 15,
  originalTarget: 10,
  surfaceId: 11,
  windowId: "window:1",
  epoch: 2,
  sequence: 9,
  mountRevision: "mount:7",
  attached: true,
  active: true,
  complete: true,
  metadataOnly: true,
  originalClass: "CUIDateSegment",
  error: "",
}
const request = {
  target: 10,
  surfaceId: 11,
  requestId: "read:1",
  fieldGroup: { outerTarget: 2, inputTarget: 3, mount },
}
const segment = (target: number) => ({
  ownerId: "field",
  segmentId: `segment:${target}`,
  bindingRevision: "wire:1",
  target,
  nativeInstance: `date:${target}`,
  surfaceId: 11,
  windowId: "window:1",
  epoch: 2,
})
const node = (target: number, parent: number, component = "View") => ({
  target,
  parent,
  component,
  hidden: false,
  displayNone: false,
  ...(component === "CUIDateSegment" ? { dateSegmentOwner: "field" } : {}),
})
const field = {
  ownerId: "field",
  descriptorId: "field:1",
  descriptorRevision: "field:revision:1",
  metadataTarget: 15,
  target: 10,
  position: 5,
  formId: "",
  hasFormAssociation: false,
  ownedEditorBinding: JSON.stringify({ kind: "date-field", rootTarget: 2, segments: [segment(10), segment(13)] }),
}
const original = (target: number, groups: number[]) => ({
  target,
  nativeInstance: `component:${target}`,
  editorInstance: `editor:${target}`,
  focused: target === 10,
  eligible: true,
  tabStop: true,
  readOnly: target === 13,
  placeholder: false,
  groups,
  rect: { x: target * 3, y: 0, width: 10, height: 30 },
  ...([10, 13].includes(target) ? { segment: segment(target) } : {}),
})
const packet = () => ({
  documentId: "document:1",
  surfaceId: 11,
  rootTarget: 1,
  revision: "7",
  target: 10,
  requestId: "read:1",
  nodes: [
    node(1, 0, "RootView"),
    node(2, 1, "CUIFocusView"),
    node(3, 2),
    node(10, 3, "CUIDateSegment"),
    node(13, 3, "CUIDateSegment"),
    node(15, 2, "CUIFieldBinding"),
    node(20, 2, "CUIFocusView"),
    node(21, 20, "TextInput"),
    node(30, 1, "TextInput"),
  ],
  forms: [],
  fields: [{ ...field }],
  fieldGroupSnapshot: {
    documentId: "document:1",
    revision: "7",
    surfaceId: 11,
    windowId: "window:1",
    outerTarget: 2,
    inputTarget: 3,
    outerInstance: "outer:1",
    inputInstance: "input:1",
    field: { ...field },
    mount: { ...mount },
    focusedTarget: 10,
    originals: [original(10, [3, 2]), original(13, [3, 2]), original(20, [2]), original(21, [2])],
    selection: { first: 10, next: 13, previous: 0, physicalLeft: 0, physicalRight: 13 },
  },
})
const decode = (value = packet()) => decodeNativeFieldGroupDocument(JSON.stringify(value), request)

it("retains SDK originals and actual containment without creating refs or focus completion", () => {
  const result = decode()
  expect(result.originals.map((row) => row.target)).toEqual([10, 13, 20, 21])
  expect(result.originals[1].readOnly).toBe(true)
  expect(result.originals[2].groups).toEqual([2])
  expect(result.focusedTarget).toBe(10)
  expect(result.selection.next).toBe(13)
  expect(Object.isFrozen(result.originals[0].rect)).toBe(true)
  expect(Object.isFrozen(result.originals)).toBe(true)
})

it("retains a disabled current original separately from navigation admission", () => {
  const value = packet()
  value.fieldGroupSnapshot.originals[0].eligible = false
  value.fieldGroupSnapshot.selection.first = 13
  const result = decode(value)
  expect(result.focusedTarget).toBe(10)
  expect(result.originals[0].eligible).toBe(false)
  expect(result.selection.first).toBe(13)
})

it("retains non-tab-stop focusables and actual outside focus without inferring completion", () => {
  const value = packet()
  value.fieldGroupSnapshot.originals[2].tabStop = false
  value.fieldGroupSnapshot.originals[0].focused = false
  value.fieldGroupSnapshot.focusedTarget = 0
  expect(decode(value).originals[2].tabStop).toBe(false)
  expect(decode(value).focusedTarget).toBe(0)
})

it("retains an independent nested field's original identities in outer reading order", () => {
  const value = packet()
  const nestedSegments = [23, 24].map((target) => ({ ...segment(target), ownerId: "nested" }))
  const nestedNodes = [
    node(22, 20),
    node(23, 22, "CUIDateSegment"),
    node(24, 22, "CUIDateSegment"),
    node(25, 20, "CUIFieldBinding"),
  ]
  for (const entry of nestedNodes) if (entry.component === "CUIDateSegment") entry.dateSegmentOwner = "nested"
  value.nodes.splice(value.nodes.length - 1, 0, ...nestedNodes)
  value.fields.push({
    ...field,
    ownerId: "nested",
    descriptorId: "nested:1",
    metadataTarget: 25,
    target: 23,
    position: 11,
    ownedEditorBinding: JSON.stringify({ kind: "date-field", rootTarget: 20, segments: nestedSegments }),
  })
  value.fieldGroupSnapshot.originals.push(
    ...nestedSegments.map((identity) => ({ ...original(identity.target, [2]), segment: identity })),
  )
  expect(decode(value).originals.map((row) => row.target)).toEqual([10, 13, 20, 21, 23, 24])
  value.fieldGroupSnapshot.originals[4].segment!.ownerId = "field"
  expect(() => decode(value)).toThrow()
})

it.each([
  [
    "document",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.documentId = "other"
    },
  ],
  [
    "revision",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.revision = "8"
    },
  ],
  [
    "surface",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.surfaceId = 12
    },
  ],
  [
    "window",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.windowId = "other"
    },
  ],
  [
    "outer",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.outerTarget = 1
    },
  ],
  [
    "input",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.inputTarget = 2
    },
  ],
  [
    "instance",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.outerInstance = ""
    },
  ],
  [
    "mount epoch",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.mount.epoch++
    },
  ],
  [
    "mount owner",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.mount.ownerId = "other"
    },
  ],
  [
    "mount active",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.mount.active = false
    },
  ],
  [
    "descriptor",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.field.descriptorRevision = "other"
    },
  ],
  [
    "order",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.originals.reverse()
    },
  ],
  [
    "duplicate",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.originals.push(value.fieldGroupSnapshot.originals[3])
    },
  ],
  [
    "foreign original",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.originals[3].target = 30
    },
  ],
  [
    "group path",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.originals[3].groups = [3, 2]
    },
  ],
  [
    "missing group",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.originals[0].groups = [2]
    },
  ],
  [
    "hidden ancestor",
    (value: ReturnType<typeof packet>) => {
      value.nodes[2].hidden = true
    },
  ],
  [
    "display-none ancestor",
    (value: ReturnType<typeof packet>) => {
      value.nodes[2].displayNone = true
    },
  ],
  [
    "segment instance",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.originals[0].segment!.nativeInstance = "other"
    },
  ],
  [
    "segment epoch",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.originals[0].segment!.epoch++
    },
  ],
  [
    "invented segment",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.originals[2].segment = segment(20)
    },
  ],
  [
    "original instance",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.originals[0].nativeInstance = ""
    },
  ],
  [
    "negative geometry",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.originals[0].rect.width = -1
    },
  ],
  [
    "nonfinite geometry",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.originals[0].rect.x = Infinity
    },
  ],
  [
    "unobserved focus",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.focusedTarget = 13
    },
  ],
  [
    "multiple focus",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.originals[1].focused = true
    },
  ],
  [
    "unavailable unfocused",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.originals[1].eligible = false
    },
  ],
  [
    "foreign selection",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.selection.next = 30
    },
  ],
  [
    "ineligible selection",
    (value: ReturnType<typeof packet>) => {
      value.fieldGroupSnapshot.originals[0].eligible = false
    },
  ],
] as const)("rejects %s changes in native evidence", (_, mutate) => {
  const value = packet()
  mutate(value)
  expect(() => decode(value)).toThrow()
})
