export type TNativeRangeThumbFormBinding = Readonly<{ kind: "range-thumb"; rootTarget: number }>

export const decodeNativeRangeThumbBinding = (encoded: string): TNativeRangeThumbFormBinding => {
  const value: unknown = JSON.parse(encoded)
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid-owned-range-thumb-binding")
  const binding = value as Record<string, unknown>
  if (
    Object.keys(binding).length !== 2 ||
    binding.kind !== "range-thumb" ||
    typeof binding.rootTarget !== "number" ||
    !Number.isSafeInteger(binding.rootTarget) ||
    binding.rootTarget <= 0 ||
    binding.rootTarget > 2147483647
  )
    throw new Error("invalid-owned-range-thumb-binding")
  return Object.freeze({ kind: "range-thumb", rootTarget: binding.rootTarget })
}
