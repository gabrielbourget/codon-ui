import { getCompactTypeaheadEntries } from "../model"
import type { TNativeCompactTypeaheadEntry, TNativeCompactTypeaheadSearchProps } from "../types"

type TItem = { id: string | number; name: string }
type TProps = TNativeCompactTypeaheadSearchProps<TItem>
const cache = () => new WeakMap<TItem, TNativeCompactTypeaheadEntry<TItem>>()

it("reuses compact entry metadata for original objects across new arrays", () => {
  const item = { id: 0, name: "Original" }
  const entries = cache()
  const firstKey = jest.fn((value: TItem) => value.id)
  const firstText = jest.fn((value: TItem) => value.name)
  const first = getCompactTypeaheadEntries(
    { items: [item], getItemKey: firstKey, getItemTextValue: firstText },
    "",
    entries,
  )
  const nextKey = jest.fn(() => "replacement")
  const nextText = jest.fn(() => "Replacement")
  const second = getCompactTypeaheadEntries(
    { items: [item], getItemKey: nextKey, getItemTextValue: nextText },
    "",
    entries,
  )
  expect(second[0]).toBe(first[0])
  expect(second[0]).toMatchObject({ item, key: 0, encodedKey: "number:0", text: "Original" })
  expect(firstKey).toHaveBeenCalledTimes(1)
  expect(firstText).toHaveBeenCalledTimes(1)
  expect(nextKey).not.toHaveBeenCalled()
  expect(nextText).not.toHaveBeenCalled()
})

it("refreshes compact entry metadata with a fresh query or dependency cache", () => {
  const item = { id: 0, name: "Original" }
  const first = getCompactTypeaheadEntries({ items: [item], getItemTextValue: () => "Before" }, "query", cache())
  const next = getCompactTypeaheadEntries({ items: [item], getItemTextValue: () => "After" }, "query", cache())
  expect(first[0].text).toBe("Before")
  expect(next[0].text).toBe("After")
  expect(next[0]).not.toBe(first[0])
})

it("computes new compact objects while retaining typed zero and empty cached keys", () => {
  const originals: TItem[] = [
    { id: 0, name: "Number" },
    { id: "0", name: "String" },
    { id: "", name: "Empty" },
  ]
  const entries = cache()
  const props: TProps = { items: originals, getItemKey: (item) => item.id, getItemTextValue: (item) => item.name }
  getCompactTypeaheadEntries(props, "", entries)
  const added = { id: "", name: "New object" }
  const text = jest.fn((item: TItem) => `${item.name}!`)
  const result = getCompactTypeaheadEntries(
    { ...props, items: [originals[0], originals[1], added], getItemTextValue: text },
    "",
    entries,
  )
  expect(result.map(({ key }) => key)).toEqual([0, "0", ""])
  expect(result.map(({ encodedKey }) => encodedKey)).toEqual(["number:0", "string:0", "string:"])
  expect(result.map(({ text }) => text)).toEqual(["Number", "String", "New object!"])
  expect(text.mock.calls).toEqual([[added]])
})

it("rejects duplicate and invalid compact entries without caching invalid values", () => {
  const first = { id: 0, name: "First" },
    second = { id: 0, name: "Second" }
  const entries = cache()
  const props: TProps = { items: [first], getItemKey: (item) => item.id, getItemTextValue: (item) => item.name }
  getCompactTypeaheadEntries(props, "", entries)
  expect(() => getCompactTypeaheadEntries({ ...props, items: [first, second] }, "", entries)).toThrow(
    "duplicate key number:0",
  )
  const invalidText = { id: "invalid", name: "Invalid" }
  expect(() =>
    getCompactTypeaheadEntries(
      { ...props, items: [invalidText], getItemTextValue: () => 0 as unknown as string },
      "",
      entries,
    ),
  ).toThrow("item text must be a string")
  expect(entries.has(invalidText)).toBe(false)
  expect(() =>
    getCompactTypeaheadEntries({ ...props, items: [invalidText], getItemKey: () => Number.NaN }, "", entries),
  ).toThrow("item key must be a string or finite number")
  expect(entries.has(invalidText)).toBe(false)
})

it("keeps uncached compact entry calls fresh and preserves minimum-query exclusion", () => {
  const item = { id: "alpha", name: "Alpha" }
  const props: TProps = { items: [item], getItemTextValue: () => "Before" }
  expect(getCompactTypeaheadEntries(props, "")[0].text).toBe("Before")
  expect(getCompactTypeaheadEntries({ ...props, getItemTextValue: () => "After" }, "")[0].text).toBe("After")
  const text = jest.fn(() => "Hidden")
  expect(getCompactTypeaheadEntries({ ...props, minimumInputLength: 2, getItemTextValue: text }, "x", cache())).toEqual(
    [],
  )
  expect(text).not.toHaveBeenCalled()
})
