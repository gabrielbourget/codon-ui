import {
  encodeNativeMenuKey,
  equalNativeMenuSelection,
  getNativeMenuSelectionRequest,
  nativeMenuSelected,
  nativeMenuSelectionKeys,
  normalizeNativeMenuKeys,
  validateNativeMenuKey,
  type TNativeMenuRow,
} from "../model"

const rows: readonly TNativeMenuRow[] = [
  { id: 0, text: "Zero", disabled: false },
  { id: "0", text: "String", disabled: false },
  { id: "", text: "Empty", disabled: false },
  { id: "disabled", text: "Disabled", disabled: true },
  { id: "link", text: "Link", disabled: false, href: "https://example.test" },
]
it("preserves typed zero/empty IDs and rejects non-native keys", () => {
  expect([...normalizeNativeMenuKeys([0, "0", "", 0])]).toEqual([0, "0", ""])
  expect(encodeNativeMenuKey(0)).not.toBe(encodeNativeMenuKey("0"))
  for (const value of [NaN, Infinity, -Infinity]) expect(() => validateNativeMenuKey(value)).toThrow(/finite/)
})
it("does not rewrite controlled selected missing or disabled keys", () => {
  const owner = new Set(["disabled", "missing"])
  expect(nativeMenuSelected(owner, rows[3])).toBe(true)
  expect([...nativeMenuSelectionKeys(owner, rows)]).toEqual(["disabled", "missing"])
  expect([...owner]).toEqual(["disabled", "missing"])
})
it("materializes all from enabled collection keys, including link membership, without allowing link actions to select", () => {
  expect([...nativeMenuSelectionKeys("all", rows)]).toEqual([0, "0", "", "link"])
  expect(nativeMenuSelected("all", rows[3])).toBe(false)
  expect(getNativeMenuSelectionRequest("multiple", "all", rows, "link")).toBeNull()
})
it("single selection requests are independent of declined owner echoes", () => {
  const owner = new Set([0])
  for (let n = 0; n < 2; n++) expect([...getNativeMenuSelectionRequest("single", owner, rows, "0")!]).toEqual(["0"])
  expect([...owner]).toEqual([0])
  expect([...getNativeMenuSelectionRequest("single", owner, rows, 0)!]).toEqual([])
})
it.each(["none", "single", "multiple"] as const)("guards disabled/link rows in %s", (mode) => {
  expect(getNativeMenuSelectionRequest(mode, new Set(), rows, "disabled")).toBeNull()
  expect(getNativeMenuSelectionRequest(mode, new Set(), rows, "link")).toBeNull()
  expect(getNativeMenuSelectionRequest(mode, new Set(), rows, "missing")).toBeNull()
})
it("toggles multiple selection while preserving unrelated missing keys and caller ownership", () => {
  const owner = new Set([0, "missing"])
  expect([...getNativeMenuSelectionRequest("multiple", owner, rows, "0")!]).toEqual([0, "missing", "0"])
  expect([...getNativeMenuSelectionRequest("multiple", owner, rows, 0)!]).toEqual(["missing"])
  expect([...owner]).toEqual([0, "missing"])
})
it("carries selection anchors in requests instead of a stale controlled-state mirror", () => {
  const request = getNativeMenuSelectionRequest("multiple", new Set(["missing"]), rows, 0)!
  expect(request.anchorKey).toBe(0)
  const echo = normalizeNativeMenuKeys(request)
  const extended = getNativeMenuSelectionRequest("multiple", echo, rows, "", true)!
  expect([...extended]).toEqual(["missing", 0, "0", ""])
  expect(extended.currentKey).toBe("")
  const contracted = getNativeMenuSelectionRequest("multiple", extended, rows, "0", true)!
  expect([...contracted]).toEqual(["missing", 0, "0"])
  expect([...request]).toEqual(["missing", 0])
})
it("extending all replaces it with the requested key", () => {
  expect([...getNativeMenuSelectionRequest("multiple", "all", rows, 0, true)!]).toEqual([0])
})
it("compares selection membership without mutating sets or conflating all", () => {
  expect(equalNativeMenuSelection(new Set([0, ""]), new Set(["", 0]))).toBe(true)
  expect(equalNativeMenuSelection("all", new Set([0]))).toBe(false)
})

it("single deselection retains unrelated caller keys rather than normalizing the owner's set", () => {
  const owner = new Set([0, "missing"])
  expect([...getNativeMenuSelectionRequest("single", owner, rows, 0)!]).toEqual(["missing"])
  expect([...owner]).toEqual([0, "missing"])
})
