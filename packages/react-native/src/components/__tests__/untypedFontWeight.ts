import type { TextStyle } from "react-native"

// Runtime migration checks still cover untyped JavaScript input after stock weight types are restored.
export const untypedFontWeight = (value: unknown) => value as NonNullable<TextStyle["fontWeight"]>
