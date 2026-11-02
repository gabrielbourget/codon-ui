import {
  encodeNativeFieldSemantics,
  encodeNativeDateFieldSemantics,
  nativeFieldAccessibilityProps,
  NATIVE_FIELD_SEMANTIC_LABELS,
} from "../semantics"

const frame = () => ({
  revision: "field:1",
  text: {
    label: "Account",
    description: "Choose an account",
    errorMessage: "Account required",
    details: "Personal or business",
  },
  disabled: false,
  readOnly: false,
  required: true,
  invalid: true,
  expanded: true,
  labels: NATIVE_FIELD_SEMANTIC_LABELS,
  activeDescendant: { target: 8, binding: "admitted-option" },
})
it("carries explicit text without a native document or label-discovery request", () => {
  const result = JSON.parse(encodeNativeFieldSemantics(frame()))
  expect(result.text).toEqual(frame().text)
  expect(result).not.toHaveProperty("aliases")
  expect(result).not.toHaveProperty("labelledBy")
  expect(result.activeDescendant).toEqual({ target: 8, binding: "admitted-option" })
})
it("keeps essential errors and required/read-only status in the label even when hints are disabled", () => {
  const props = nativeFieldAccessibilityProps(encodeNativeFieldSemantics({ ...frame(), readOnly: true }))
  expect(props.accessibilityLabel).toBe("Account, Required, Read only, Account required")
  expect(props.accessibilityHint).toBe("Choose an account Personal or business")
  expect(props.accessibilityState).toEqual({ disabled: false, expanded: true })
})
it("preserves owner label and hint fallbacks and removes retired invalid text", () => {
  const props = nativeFieldAccessibilityProps(
    encodeNativeFieldSemantics({ ...frame(), text: {}, required: false, invalid: false }),
    "Owner label",
    "Owner hint",
  )
  expect(props.accessibilityLabel).toBe("Owner label")
  expect(props.accessibilityHint).toBe("Owner hint")
})
it.each([0, -1, 1.5, 2147483648, NaN])("rejects invalid active option target %s", (target) => {
  expect(() => encodeNativeFieldSemantics({ ...frame(), activeDescendant: { target, binding: "lease" } })).toThrow()
})
it("keeps date segment custom content separate from core editor option focus", () => {
  const value = { ...frame(), expanded: false, activeDescendant: null, dateField: { firstEditableTarget: 7 } }
  expect(JSON.parse(encodeNativeDateFieldSemantics(value)).dateField).toEqual({ firstEditableTarget: 7 })
  expect(() => encodeNativeDateFieldSemantics({ ...value, expanded: true })).toThrow()
})
