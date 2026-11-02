export const NATIVE_FIELD_SEMANTIC_LABELS = {
  role: "Combo box",
  state: "State",
  expanded: "Expanded",
  collapsed: "Collapsed",
  required: "Required",
  invalid: "Invalid",
  readOnly: "Read only",
  disabled: "Disabled",
  yes: "Yes",
  no: "No",
  options: "Options",
  activeOption: "Active option",
  autocomplete: "Autocomplete",
  list: "List",
  details: "Details",
} as const

export type TNativeFieldSemanticLabels = { readonly [K in keyof typeof NATIVE_FIELD_SEMANTIC_LABELS]: string }
export type TNativeFieldSemanticText = Readonly<{
  label?: string
  description?: string
  errorMessage?: string
  details?: string
}>
export type TNativeFieldSemanticBinding = Readonly<{
  revision: string
  text: TNativeFieldSemanticText
  activeDescendant: Readonly<{ target: number; binding: string }> | null
  disabled: boolean
  readOnly: boolean
  required: boolean
  invalid: boolean
  expanded: boolean
  labels: TNativeFieldSemanticLabels
}>
const textKeys = ["label", "description", "errorMessage", "details"] as const
export const encodeNativeFieldSemantics = (value: TNativeFieldSemanticBinding) => {
  if (
    !value.revision ||
    textKeys.some((key) => value.text[key] !== undefined && typeof value.text[key] !== "string") ||
    [value.disabled, value.readOnly, value.required, value.invalid, value.expanded].some(
      (flag) => typeof flag !== "boolean",
    ) ||
    Object.keys(NATIVE_FIELD_SEMANTIC_LABELS).some(
      (key) => typeof value.labels[key as keyof TNativeFieldSemanticLabels] !== "string",
    )
  )
    throw new Error("native-field-semantics-invalid")
  if (
    value.activeDescendant &&
    (!Number.isSafeInteger(value.activeDescendant.target) ||
      value.activeDescendant.target <= 0 ||
      value.activeDescendant.target > 2147483647 ||
      !value.activeDescendant.binding)
  )
    throw new Error("native-field-semantic-option-required")
  return JSON.stringify({ ...value, text: Object.fromEntries(textKeys.map((key) => [key, value.text[key] ?? ""])) })
}
export type TNativeDateFieldSemanticBinding = TNativeFieldSemanticBinding &
  Readonly<{ dateField: Readonly<{ firstEditableTarget: number }> }>
export const encodeNativeDateFieldSemantics = (value: TNativeDateFieldSemanticBinding) => {
  if (
    !Number.isSafeInteger(value.dateField.firstEditableTarget) ||
    value.dateField.firstEditableTarget <= 0 ||
    value.dateField.firstEditableTarget > 2147483647 ||
    value.expanded ||
    value.activeDescendant
  )
    throw new Error("native-date-field-semantic-identity-required")
  return JSON.stringify({ ...JSON.parse(encodeNativeFieldSemantics(value)), dateField: value.dateField })
}

// Core editors receive supported RN props; errors/status never depend on optional hints.
export const nativeFieldAccessibilityProps = (encoded: string, fallbackLabel?: string, fallbackHint?: string) => {
  const value = JSON.parse(encoded) as TNativeFieldSemanticBinding
  const text = value.text
  const status = [
    value.required && value.labels.required,
    value.readOnly && value.labels.readOnly,
    value.invalid && (text.errorMessage || value.labels.invalid),
  ].filter(Boolean)
  return {
    accessibilityLabel: [text.label || fallbackLabel, ...status].filter(Boolean).join(", ") || undefined,
    accessibilityHint: [fallbackHint, text.description, text.details].filter(Boolean).join(" ") || undefined,
    accessibilityState: { disabled: value.disabled, expanded: value.expanded },
  }
}
