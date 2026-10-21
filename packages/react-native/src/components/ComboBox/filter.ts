/* Adapted from react-aria 3.48.0 useFilter, Copyright 2020 Adobe, Apache-2.0. */
export const createNativeComboBoxFilter = (locale?: string) => {
  const collator = new Intl.Collator(locale, { usage: "search", sensitivity: "base" })
  return (text: string, query: string) => {
    if (query.length === 0) return true
    text = text.normalize("NFC")
    query = query.normalize("NFC")
    for (let start = 0; start + query.length <= text.length; start++)
      if (collator.compare(query, text.slice(start, start + query.length)) === 0) return true
    return false
  }
}
