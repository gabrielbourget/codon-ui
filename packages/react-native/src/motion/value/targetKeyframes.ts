const ARRAY_FIELDS = new Set(["transform", "transformOrigin", "boxShadow", "filter", "fontVariant"])

export const nativeTargetKeyframes = (name: string, target: unknown): unknown[] => {
  if (!Array.isArray(target)) return [null, target]
  const first = target.find((value) => value !== null && value !== undefined)
  if (
    ARRAY_FIELDS.has(name) &&
    (target.length === 0 ||
      (!Array.isArray(first) && (typeof first !== "string" || name === "fontVariant" || name === "transformOrigin")))
  )
    return [null, target]
  return [...target]
}
