export const KEYBOARD_PROBE = "codon-original-editor-keyboard-01"
export const KEYBOARD_MODES = ["veto", "allow", "late", "throw"] as const
export type TKeyboardMode = (typeof KEYBOARD_MODES)[number]
