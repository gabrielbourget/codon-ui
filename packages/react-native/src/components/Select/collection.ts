export type TNativeSelectKey = string | number
export type TNativeSelectEntry<T> = Readonly<{ key: TNativeSelectKey; encodedKey: string; text: string; item: T }>

export const validateSelectKey = (key: TNativeSelectKey, field = "key") => {
  if (typeof key !== "string" && (typeof key !== "number" || !Number.isFinite(key)))
    throw new TypeError(`Select: ${field} must be a string or finite number`)
}

export const encodeSelectKey = (key: TNativeSelectKey) => `${typeof key}:${key}`

export const normalizeSelectCollection = <T>(
  items: readonly T[],
  getKey: (item: T) => TNativeSelectKey,
  getTextValue: (item: T) => string,
) => {
  const keys = new Set<string>()
  return Array.from(items, (item): TNativeSelectEntry<T> => {
    const key = getKey(item)
    validateSelectKey(key)
    const encodedKey = encodeSelectKey(key)
    if (keys.has(encodedKey)) throw new TypeError(`Select: duplicate key ${encodedKey}`)
    keys.add(encodedKey)
    const text = getTextValue(item)
    if (typeof text !== "string" || !text.trim())
      throw new TypeError(`Select: textValue for ${encodedKey} must not be empty`)
    return { item, key, encodedKey, text }
  })
}
