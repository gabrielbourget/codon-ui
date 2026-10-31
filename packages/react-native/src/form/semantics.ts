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
export type TNativeFieldSemanticAlias = Readonly<{ id: string; target: number }>
export type TNativeFieldSemanticBinding = Readonly<{
  revision: string
  aliases: readonly TNativeFieldSemanticAlias[]
  labelledBy: readonly string[]
  describedBy: readonly string[]
  errorMessageBy: readonly string[]
  detailsBy: readonly string[]
  controls: readonly string[]
  activeDescendant: Readonly<{ target: number; binding: string }> | null
  disabled: boolean
  readOnly: boolean
  required: boolean
  invalid: boolean
  expanded: boolean
  labels: TNativeFieldSemanticLabels
}>

// The wire carries only semantic IDs, original targets, flags and localizable
// captions. Field/query values and collection keys stay in their JS owners.
export const encodeNativeFieldSemantics = (value: TNativeFieldSemanticBinding) => {
  const ids = (items: readonly string[]) => {
    if (items.some((item) => typeof item !== "string" || item.length === 0))
      throw new Error("native-field-semantic-id-required")
    return [...new Set(items)]
  }
  const positive = (target: number) => Number.isSafeInteger(target) && target > 0 && target <= 2_147_483_647
  if (
    typeof value.revision !== "string" ||
    !value.revision ||
    value.aliases.some((alias) => typeof alias.id !== "string" || !alias.id || !positive(alias.target))
  )
    throw new Error("native-field-semantic-identity-required")
  if (value.activeDescendant && (!positive(value.activeDescendant.target) || !value.activeDescendant.binding))
    throw new Error("native-field-semantic-option-required")
  if (
    Object.keys(NATIVE_FIELD_SEMANTIC_LABELS).some(
      (key) => typeof value.labels[key as keyof TNativeFieldSemanticLabels] !== "string",
    )
  )
    throw new Error("native-field-semantic-captions-required")
  if (
    [value.disabled, value.readOnly, value.required, value.invalid, value.expanded].some(
      (flag) => typeof flag !== "boolean",
    )
  )
    throw new Error("native-field-semantic-flags-required")
  return JSON.stringify({
    revision: value.revision,
    aliases: value.aliases.map(({ id, target }) => ({ id, target })),
    labelledBy: ids(value.labelledBy),
    describedBy: ids(value.describedBy),
    errorMessageBy: ids(value.errorMessageBy),
    detailsBy: ids(value.detailsBy),
    controls: ids(value.controls),
    activeDescendant: value.activeDescendant
      ? { target: value.activeDescendant.target, binding: value.activeDescendant.binding }
      : null,
    disabled: value.disabled,
    readOnly: value.readOnly,
    required: value.required,
    invalid: value.invalid,
    expanded: value.expanded,
    labels: Object.fromEntries(
      Object.keys(NATIVE_FIELD_SEMANTIC_LABELS).map((key) => [
        key,
        value.labels[key as keyof TNativeFieldSemanticLabels],
      ]),
    ),
  })
}

export type TNativeDateFieldSemanticBinding = TNativeFieldSemanticBinding &
  Readonly<{
    dateField: Readonly<{ firstEditableTarget: number }>
  }>
export const encodeNativeDateFieldSemantics = (value: TNativeDateFieldSemanticBinding) => {
  const target = value.dateField.firstEditableTarget
  if (
    !Number.isSafeInteger(target) ||
    target <= 0 ||
    target > 2_147_483_647 ||
    value.expanded ||
    value.controls.length ||
    value.activeDescendant
  )
    throw new Error("native-date-field-semantic-identity-required")
  return JSON.stringify({
    ...JSON.parse(encodeNativeFieldSemantics(value)),
    dateField: { firstEditableTarget: target },
  })
}
