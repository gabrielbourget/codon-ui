export const FORM_PROBE = "codon-native-form-document-v1"
export const FORM_PHASES = [
  "initial",
  "reordered",
  "activity-hidden",
  "activity-restored",
  "portal",
  "modal",
  "modal-closed",
  "external-moved",
  "root-replaced",
] as const
export type TFormPhase = (typeof FORM_PHASES)[number]
export const FORM_ORDERS: Record<TFormPhase, readonly string[]> = {
  initial: ["before", "first", "second", "activity", "after"],
  reordered: ["before", "second", "first", "activity", "after"],
  "activity-hidden": ["before", "second", "first", "activity", "after"],
  "activity-restored": ["before", "second", "first", "activity", "after"],
  portal: ["before", "second", "first", "activity", "portal", "after"],
  modal: ["before", "second", "first", "activity", "portal", "modal", "after"],
  "modal-closed": ["before", "second", "first", "activity", "portal", "after"],
  "external-moved": ["second", "first", "activity", "portal", "after", "before"],
  "root-replaced": ["second", "first", "activity", "portal", "after", "before"],
}
