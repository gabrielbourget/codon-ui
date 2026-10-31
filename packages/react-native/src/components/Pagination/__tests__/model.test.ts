import {
  getNativePaginationGroups,
  getNativePaginationPageCount,
  getNativePaginationPageForSize,
  getNativePaginationWindow,
  type TNativePaginationNumbers,
} from "../model"

import oracle from "./fixtures/windowOracle.json"

type THash = { update: (text: string) => THash; digest: (encoding: "hex") => string }
const { createHash } = jest.requireActual<{ createHash: (algorithm: "sha256") => THash }>("node:crypto")
const values: TNativePaginationNumbers = Object.freeze({ currentPage: 3, itemsPerPage: 10, numberOfItems: 200 })

it("CAP.pagination.013/.014 exactly matches the independent canonical window oracle for every 1..60-page case", () => {
  const hash = createHash("sha256")
  let cases = 0
  for (let count = 1; count <= 60; count++)
    for (let maximum = 3; maximum <= 20; maximum++)
      for (const side of ["left", "right"] as const)
        for (const rtl of [false, true])
          for (let current = 1; current <= count; current++) {
            const items = getNativePaginationWindow({
              currentPage: current,
              itemsPerPage: 10,
              numberOfItems: count * 10,
              maxVisiblePages: maximum,
              consolidationPlacement: side,
              rtl,
            })
            hash.update(JSON.stringify([count, maximum, side, rtl, current, items]) + "\n")
            cases++
          }
  expect(cases).toBe(oracle.caseCount)
  expect(hash.digest("hex")).toBe(oracle.sha256)
})

it("keeps first/last/current anchors and exact side-priority overflow boundaries", () => {
  expect(
    getNativePaginationWindow({ ...values, currentPage: 10, maxVisiblePages: 4, consolidationPlacement: "right" }),
  ).toEqual([1, [2, 3, 4, 5, 6, 7, 8], 9, 10, [11, 12, 13, 14, 15, 16, 17, 18, 19], 20])
  expect(
    getNativePaginationWindow({ ...values, currentPage: 10, maxVisiblePages: 4, consolidationPlacement: "left" }),
  ).toEqual([1, [2, 3, 4, 5, 6, 7, 8, 9], 10, 11, [12, 13, 14, 15, 16, 17, 18, 19], 20])
})

it("retains caller page state while bounding only window placement during an independent page-size echo", () => {
  const props = Object.freeze({ currentPage: 20, itemsPerPage: 100, numberOfItems: 200 })
  expect(getNativePaginationPageCount(props)).toBe(2)
  expect(getNativePaginationWindow(props)).toEqual([1, 2])
  expect(props.currentPage).toBe(20)
})

it("CAP.pagination.024 uses caller values repeatedly when an owner declines a size request", () => {
  expect(getNativePaginationPageForSize(values, 50)).toBe(1)
  expect(getNativePaginationPageForSize(values, 20)).toBe(2)
  expect(getNativePaginationPageForSize(values, 20)).toBe(2)
  expect(values).toEqual({ currentPage: 3, itemsPerPage: 10, numberOfItems: 200 })
  expect(getNativePaginationPageForSize({ ...values, itemsPerPage: 50 }, 20)).toBe(6)
})

it("preserves zero items and returns page one for an empty coordinated size request", () => {
  const props = { currentPage: 1, itemsPerPage: 10, numberOfItems: 0 }
  expect(getNativePaginationPageCount(props)).toBe(1)
  expect(getNativePaginationWindow(props)).toEqual([1])
  expect(getNativePaginationPageForSize(props, 50)).toBe(1)
})

it("bounds a coordinated request at the last actual item when the caller page is temporarily out of range", () => {
  expect(getNativePaginationPageForSize({ ...values, currentPage: 99 }, 50)).toBe(4)
  expect(getNativePaginationPageForSize({ ...values, numberOfItems: 21 }, 100)).toBe(1)
})

it("CAP.pagination.022 preserves group order/deduplication and the canonical empty-array default", () => {
  const chosen = ["page-input", "page-counter", "page-input"] as const
  expect(getNativePaginationGroups(chosen)).toEqual(["page-input", "page-counter"])
  expect(chosen).toEqual(["page-input", "page-counter", "page-input"])
  expect(getNativePaginationGroups([])).toEqual(["primary-controls"])
  expect(getNativePaginationGroups()).toEqual(["primary-controls"])
})

it.each([0, -1, 2, 2.5, 21, Number.NaN, Number.POSITIVE_INFINITY])(
  "rejects unsupported maxVisiblePages=%s without a falsy default",
  (maximum) => {
    expect(() => getNativePaginationWindow({ ...values, maxVisiblePages: maximum })).toThrow(/maxVisiblePages/)
  },
)

it.each([
  { currentPage: 0 },
  { currentPage: -1 },
  { currentPage: 1.5 },
  { currentPage: Number.NaN },
  { itemsPerPage: 0 },
  { itemsPerPage: -1 },
  { itemsPerPage: Number.POSITIVE_INFINITY },
  { numberOfItems: -1 },
  { numberOfItems: Number.MAX_SAFE_INTEGER + 1 },
])("rejects invalid required numeric input %j instead of rewriting an authoritative value", (invalid) => {
  expect(() => getNativePaginationPageCount({ ...values, ...invalid })).toThrow(/safe integer/)
})

it("rejects invalid requested sizes explicitly", () => {
  expect(() => getNativePaginationPageForSize(values, 0)).toThrow(/requested itemsPerPage/)
})
