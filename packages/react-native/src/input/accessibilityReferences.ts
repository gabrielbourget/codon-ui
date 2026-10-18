export const nativeAccessibilityIDs = (value: string | readonly string[] | undefined): readonly string[] | undefined =>
  typeof value === "string" ? value.split(/\s+/u).filter(Boolean) : value
