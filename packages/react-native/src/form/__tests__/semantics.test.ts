import {
  encodeNativeFieldSemantics,
  encodeNativeDateFieldSemantics,
  NATIVE_FIELD_SEMANTIC_LABELS,
  type TNativeFieldSemanticBinding,
} from "../semantics"

const binding = (): TNativeFieldSemanticBinding => ({
  revision: "semantic:1",
  aliases: [{ id: "generated", target: 12 }],
  labelledBy: ["label", "label"],
  describedBy: [],
  errorMessageBy: [],
  detailsBy: [],
  controls: [],
  activeDescendant: null,
  disabled: false,
  readOnly: false,
  required: false,
  invalid: false,
  expanded: false,
  labels: NATIVE_FIELD_SEMANTIC_LABELS,
})

it("keeps the existing fourteen-field protocol intact and admits only an explicit segmented field", () => {
  expect(Object.keys(JSON.parse(encodeNativeFieldSemantics(binding())))).toHaveLength(14)
  const result = JSON.parse(encodeNativeDateFieldSemantics({ ...binding(), dateField: { firstEditableTarget: 12 } }))
  expect(Object.keys(result)).toHaveLength(15)
  expect(result.dateField).toEqual({ firstEditableTarget: 12 })
  expect(result).toMatchObject({ expanded: false, controls: [], activeDescendant: null })
})

it.each([
  { dateField: { firstEditableTarget: 0 } },
  { dateField: { firstEditableTarget: 1.5 } },
  { dateField: { firstEditableTarget: 2_147_483_648 } },
  { expanded: true },
  { controls: ["options"] },
  { activeDescendant: { target: 13, binding: "option" } },
])("rejects an unavailable date target or combobox-only state %j", (override) => {
  expect(() =>
    encodeNativeDateFieldSemantics({ ...binding(), dateField: { firstEditableTarget: 12 }, ...override }),
  ).toThrow()
})

it("preserves false flags, live aliases and caller-localized or explicitly empty captions", () => {
  const value = binding()
  const result = JSON.parse(
    encodeNativeFieldSemantics({ ...value, labels: { ...value.labels, role: "Liste", required: "" } }),
  )
  expect(result.labelledBy).toEqual(["label"])
  expect(result.aliases).toEqual([{ id: "generated", target: 12 }])
  expect(result).toMatchObject({ disabled: false, readOnly: false, required: false, invalid: false, expanded: false })
  expect(result.labels).toMatchObject({ role: "Liste", required: "" })
})

it("never encodes query/value/key objects from extra caller properties", () => {
  const value = binding()
  const result = encodeNativeFieldSemantics({
    ...value,
    query: "business query",
    value: { selected: "business value" },
    aliases: [{ id: "generated", target: 12, value: "business alias" }],
    activeDescendant: { target: 13, binding: "opaque", value: "business option" },
    labels: { ...value.labels, query: "business label" },
  } as unknown as TNativeFieldSemanticBinding)
  expect(result).not.toContain("business")
})

it.each([
  { revision: "" },
  { aliases: [{ id: "", target: 12 }] },
  { aliases: [{ id: "id", target: 0 }] },
  { aliases: [{ id: "id", target: 1.5 }] },
  { activeDescendant: { target: 0, binding: "opaque" } },
  { activeDescendant: { target: 13, binding: "" } },
  { labelledBy: [""] },
  { required: "yes" },
])("rejects malformed native semantic identity/flags %p", (updates) => {
  expect(() => encodeNativeFieldSemantics({ ...binding(), ...updates } as TNativeFieldSemanticBinding)).toThrow()
})
