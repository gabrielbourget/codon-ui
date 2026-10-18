export type TNativeCollectionKey = string | number
export type TNativeCollectionEntry<T> = Readonly<{
  key: TNativeCollectionKey
  encodedKey: string
  text: string
  item: T
}>

export const validateCollectionKey = (key: TNativeCollectionKey, field = "key", component = "Select") => {
  if (typeof key !== "string" && (typeof key !== "number" || !Number.isFinite(key)))
    throw new TypeError(`${component}: ${field} must be a string or finite number`)
}

export const encodeCollectionKey = (key: TNativeCollectionKey) => `${typeof key}:${key}`

export const normalizeCollection = <T>(
  items: readonly T[],
  getKey: (item: T) => TNativeCollectionKey,
  getTextValue: (item: T) => string,
  component = "Select",
) => {
  const keys = new Set<string>()
  return Array.from(items, (item): TNativeCollectionEntry<T> => {
    const key = getKey(item)
    validateCollectionKey(key, "key", component)
    const encodedKey = encodeCollectionKey(key)
    if (keys.has(encodedKey)) throw new TypeError(`${component}: duplicate key ${encodedKey}`)
    keys.add(encodedKey)
    const text = getTextValue(item)
    if (typeof text !== "string" || !text.trim())
      throw new TypeError(`${component}: textValue for ${encodedKey} must not be empty`)
    return { item, key, encodedKey, text }
  })
}
