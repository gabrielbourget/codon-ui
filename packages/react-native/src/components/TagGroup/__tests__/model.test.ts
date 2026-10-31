import { encodeCollectionKey } from "../../collection"
import {
  equalNativeTagGroupSelection,
  getNativeTagGroupRemovalRequest,
  getNativeTagGroupSelectAllRequest,
  getNativeTagGroupSelectionRequest,
  nativeTagGroupSelected,
  nativeTagGroupSelectionKeys,
  normalizeNativeTagGroupKeys,
  type TNativeTagGroupRow,
} from "../model"

const rows: readonly TNativeTagGroupRow[] = [
  { key: 0, textValue: "Zero", isDisabled: false, hasAction: false },
  { key: "0", textValue: "String", isDisabled: false, hasAction: false },
  { key: "", textValue: "", isDisabled: false, hasAction: false },
  { key: "disabled", textValue: "Disabled", isDisabled: true, hasAction: false },
  { key: "link", textValue: "Link", isDisabled: false, hasAction: true, href: "https://example.test" },
]
it("retains typed zero/empty keys, consumes a one-shot iterator once and rejects invalid keys", () => {
  const owner = new Set([0, "0", ""]),
    iterator = owner.values()
  expect([...normalizeNativeTagGroupKeys(iterator)]).toEqual([0, "0", ""])
  expect([...owner]).toEqual([0, "0", ""])
  expect(encodeCollectionKey(0)).not.toBe(encodeCollectionKey("0"))
  for (const value of [NaN, Infinity, -Infinity]) expect(() => normalizeNativeTagGroupKeys([value])).toThrow(/finite/)
})
it("preserves explicitly selected missing/disabled keys and mode-none presentation", () => {
  const owner = new Set(["missing", "disabled", 0])
  expect(nativeTagGroupSelected("multiple", owner, rows[3])).toBe(true)
  expect(nativeTagGroupSelected("none", owner, rows[0])).toBe(false)
  expect([...nativeTagGroupSelectionKeys(owner, rows)]).toEqual([...owner])
})
it("materializes all from enabled rows including link membership without selecting on link action", () => {
  expect([...nativeTagGroupSelectionKeys("all", rows)]).toEqual([0, "0", "", "link"])
  expect(nativeTagGroupSelected("multiple", "all", rows[3])).toBe(false)
  expect(getNativeTagGroupSelectionRequest("multiple", "all", rows, "link", "toggle")).toBeNull()
  expect([
    ...getNativeTagGroupSelectionRequest("multiple", new Set(), rows, "link", "toggle", { allowLinkSelection: true })!,
  ]).toEqual(["link"])
})
it.each(["none", "single", "multiple"] as const)("does not admit disabled/missing requests in %s", (mode) => {
  expect(getNativeTagGroupSelectionRequest(mode, new Set(), rows, "disabled", "toggle")).toBeNull()
  expect(getNativeTagGroupSelectionRequest(mode, new Set(), rows, "missing", "replace")).toBeNull()
})
it("single selection preserves repeated vetoes and unrelated owner keys when toggling off", () => {
  const owner = new Set([0, "missing"])
  for (let n = 0; n < 2; n++)
    expect([...getNativeTagGroupSelectionRequest("single", owner, rows, "", "replace")!]).toEqual([""])
  expect([...getNativeTagGroupSelectionRequest("single", owner, rows, 0, "toggle")!]).toEqual(["missing"])
  expect([...owner]).toEqual([0, "missing"])
})
it("disallowEmptySelection vetoes clearing the final key without altering owner state", () => {
  const owner = new Set([0])
  expect(
    getNativeTagGroupSelectionRequest("single", owner, rows, 0, "toggle", { disallowEmptySelection: true }),
  ).toBeNull()
  expect([
    ...getNativeTagGroupSelectionRequest("single", owner, rows, 0, "replace", { disallowEmptySelection: true })!,
  ]).toEqual([0])
  expect([...getNativeTagGroupSelectionRequest("single", owner, rows, 0, "extend")!]).toEqual([0])
  expect([...owner]).toEqual([0])
})
it("multiple toggle versus replace preserves missing keys only for toggles", () => {
  const owner = new Set([0, "missing"])
  expect([...getNativeTagGroupSelectionRequest("multiple", owner, rows, "", "toggle")!]).toEqual([0, "missing", ""])
  expect([...getNativeTagGroupSelectionRequest("multiple", owner, rows, "", "replace")!]).toEqual([""])
})
it("extends/contracts current anchor ranges without a stale controlled-state mirror", () => {
  const start = getNativeTagGroupSelectionRequest("multiple", new Set(["missing"]), rows, 0, "toggle")!
  const echo = normalizeNativeTagGroupKeys(start)
  const extended = getNativeTagGroupSelectionRequest("multiple", echo, rows, "", "extend")!
  expect([...extended]).toEqual(["missing", 0, "0", ""])
  expect(extended.anchorKey).toBe(0)
  expect(extended.currentKey).toBe("")
  expect([...getNativeTagGroupSelectionRequest("multiple", extended, rows, "0", "extend")!]).toEqual([
    "missing",
    0,
    "0",
  ])
  expect([...start]).toEqual(["missing", 0])
  expect([...getNativeTagGroupSelectionRequest("multiple", "all", rows, "", "extend")!]).toEqual([""])
})
it("distinguishes remove-button item ownership from selected keyboard removal", () => {
  const owner = new Set([0, "missing", "disabled"])
  expect([...getNativeTagGroupRemovalRequest("multiple", owner, rows, 0, "button")!]).toEqual([0])
  expect([...getNativeTagGroupRemovalRequest("multiple", owner, rows, 0, "keyboard")!]).toEqual([
    0,
    "missing",
    "disabled",
  ])
  expect([...getNativeTagGroupRemovalRequest("multiple", owner, rows, "", "keyboard")!]).toEqual([""])
  expect([...getNativeTagGroupRemovalRequest("none", owner, rows, 0, "keyboard")!]).toEqual([0])
  expect(getNativeTagGroupRemovalRequest("multiple", owner, rows, "disabled", "button")).toBeNull()
  expect([...owner]).toEqual([0, "missing", "disabled"])
})
it("keyboard removal of all materializes enabled collection members without touching the collection", () => {
  expect([...getNativeTagGroupRemovalRequest("multiple", "all", rows, 0, "keyboard")!]).toEqual([0, "0", "", "link"])
  expect(rows).toHaveLength(5)
})
it("select-all preserves already-all owners, explicit complete sets and typed keys", () => {
  expect(getNativeTagGroupSelectAllRequest("single", new Set(), rows)).toBeNull()
  expect(getNativeTagGroupSelectAllRequest("multiple", new Set(), rows)).toBe("all")
  expect(getNativeTagGroupSelectAllRequest("multiple", "all", rows)).toBeNull()
  expect(getNativeTagGroupSelectAllRequest("multiple", new Set([0, "0", "", "link"]), rows)).toBeNull()
  expect(getNativeTagGroupSelectAllRequest("multiple", new Set(), [])).toBe("all")
  expect(getNativeTagGroupSelectAllRequest("multiple", new Set(["missing"]), [])).toBeNull()
})
it("compares authoritative membership without conflating all or mutating anchor metadata", () => {
  expect(equalNativeTagGroupSelection(new Set([0, ""]), new Set(["", 0]))).toBe(true)
  expect(equalNativeTagGroupSelection("all", new Set([0]))).toBe(false)
})
