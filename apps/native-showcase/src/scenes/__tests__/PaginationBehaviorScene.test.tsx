import { fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"

import { NativeFloatingLayerHost, NativeOverlayProvider, NativeThemeProvider } from "@codon-ui/react-native"

import { PaginationScene } from "../PaginationScene"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))

type TReceipt = { sequence: number; kind: string; data: unknown }
const owner = () => JSON.parse(screen.getByTestId("pagination-behavior-owner").children.join(""))
const receipts = (): TReceipt[] => JSON.parse(screen.getByTestId("pagination-behavior-callbacks").children.join(""))
const node = (mode: "light" | "dark" = "light") => (
  <NativeThemeProvider mode={mode}>
    <NativeOverlayProvider>
      <NativeFloatingLayerHost>
        <PaginationScene />
      </NativeFloatingLayerHost>
    </NativeOverlayProvider>
  </NativeThemeProvider>
)
const press = (name: string) => userEvent.setup().press(screen.getByRole("button", { name }))
const kinds = () => receipts().map(({ kind }) => kind)
const selected = (page: number) => screen.getByRole("button", { name: `Go To Page ${page}` })

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("observes a current-page contact without inventing a page request", async () => {
  await render(node())
  await press("Go To Page 3")
  expect(owner()).toMatchObject({ page: 3, size: 10, requests: [] })
  expect(selected(3).props.accessibilityState).toMatchObject({ selected: true })
  expect(kinds()).toEqual(["button"])
  expect(receipts()[0]?.data).toMatchObject({ kind: null, preventedBefore: false, preventedAfter: false })
})

it("records the general-button callback before the echoed page request exactly once", async () => {
  await render(node())
  await press("Go To Page 4")
  expect(owner()).toMatchObject({ page: 4, requests: ["page:4"] })
  expect(selected(4).props.accessibilityState).toMatchObject({ selected: true })
  expect(screen.queryByTestId("pagination-page-3")?.props.accessibilityState.selected ?? false).toBe(false)
  expect(kinds()).toEqual(["button", "page"])
  expect(receipts()[1]?.data).toBe(4)
})

it("keeps repeated declined requests authoritative and uses the newly echoed page on the next contact", async () => {
  await render(node())
  await press("Toggle pager echo")
  await press("Next Page")
  await press("Next Page")
  expect(owner()).toMatchObject({ page: 3, requests: ["page:4", "page:4"] })
  expect(selected(3).props.accessibilityState).toMatchObject({ selected: true })
  await press("Toggle pager echo")
  await press("Next Page")
  await press("Next Page")
  expect(owner()).toMatchObject({ page: 5, requests: ["page:4", "page:4", "page:4", "page:5"] })
  expect(kinds()).toEqual(["button", "page", "button", "page", "button", "page", "button", "page"])
})

it("records first, previous, next and last requests from the same declined caller page", async () => {
  await render(node())
  await press("Toggle pager echo")
  for (const label of ["First Page", "Previous Page", "Next Page", "Last Page"]) await press(label)
  expect(owner()).toMatchObject({ page: 3, requests: ["page:1", "page:2", "page:4", "page:20"] })
  expect(
    receipts()
      .filter(({ kind }) => kind === "page")
      .map(({ data }) => data),
  ).toEqual([1, 2, 4, 20])
  expect(kinds()).toEqual(["button", "page", "button", "page", "button", "page", "button", "page"])
})

it.each([
  ["First Page", "Previous Page", "First Page", "Next Page", 1, 2],
  ["Last Page", "Next Page", "Last Page", "Previous Page", 20, 19],
] as const)(
  "retains the %s boundary without accepting blocked contacts",
  async (edge, blocked, alsoBlocked, back, at, next) => {
    await render(node())
    await press(edge)
    const before = receipts()
    for (const label of [blocked, alsoBlocked]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled()
      await press(label)
    }
    expect(owner()).toMatchObject({ page: at, requests: [`page:${at}`] })
    expect(receipts()).toEqual(before)
    await press(back)
    expect(owner()).toMatchObject({ page: next, requests: [`page:${at}`, `page:${next}`] })
  },
)

it("keeps the global disabled guard above nested button props and admits the first reenabled contact", async () => {
  await render(node())
  await press("Toggle pager disabled")
  for (const id of [
    "pagination-first",
    "pagination-previous",
    "pagination-next",
    "pagination-last",
    "pagination-page-3",
  ]) {
    expect(screen.getByTestId(id)).toBeDisabled()
  }
  await press("Next Page")
  expect(owner()).toMatchObject({ page: 3, disabled: true, requests: [] })
  expect(receipts()).toEqual([])
  await press("Toggle pager disabled")
  await press("Next Page")
  expect(owner()).toMatchObject({ page: 4, disabled: false, requests: ["page:4"] })
  expect(kinds()).toEqual(["button", "page"])
})

it("retains a general-button veto and clears it for a distinct subsequent action", async () => {
  await render(node())
  await press("Toggle pager action veto")
  let prevented = false
  // Reuse the original Pagination oracle's public event seam and prevention state.
  // This source-only check does not substitute for the native veto method.
  const original = {
    nativeEvent: { target: 17, timestamp: 0 },
    persist: jest.fn(),
    preventDefault: () => {
      prevented = true
    },
    isDefaultPrevented: () => prevented,
  }
  await fireEvent(screen.getByRole("button", { name: "Next Page" }), "press", original)
  expect(owner()).toMatchObject({ page: 3, veto: true, requests: [] })
  expect(kinds()).toEqual(["button"])
  expect(receipts()[0]?.data).toMatchObject({ preventedBefore: false, preventedAfter: true })
  await press("Toggle pager action veto")
  await press("Next Page")
  expect(owner()).toMatchObject({ page: 4, veto: false, requests: ["page:4"] })
  expect(kinds()).toEqual(["button", "button", "page"])
})

it("records no normalization request for a direct owner replacement and uses the latest value", async () => {
  await render(node())
  await press("Replace owner page")
  expect(owner()).toMatchObject({ page: 8, requests: [] })
  expect(receipts()).toEqual([])
  expect(selected(8).props.accessibilityState).toMatchObject({ selected: true })
  await press("Next Page")
  expect(owner()).toMatchObject({ page: 9, requests: ["page:9"] })
})

it("retains an out-of-range caller page for empty data until an explicit bounded request", async () => {
  await render(node())
  await press("Toggle pager empty data")
  expect(owner()).toMatchObject({ page: 3, empty: true, requests: [] })
  expect(receipts()).toEqual([])
  expect(selected(1).props.accessibilityState).toMatchObject({ selected: false })
  await press("Go To Page 1")
  expect(owner()).toMatchObject({ page: 1, requests: ["page:1"] })
  for (const label of ["First Page", "Previous Page", "Next Page", "Last Page"])
    expect(screen.getByRole("button", { name: label })).toBeDisabled()
  const before = receipts()
  await press("Toggle pager empty data")
  expect(owner()).toMatchObject({ page: 1, empty: false, requests: ["page:1"] })
  expect(receipts()).toEqual(before)
})

it("preserves the paging observations through existing context controls and clears them only on explicit reset", async () => {
  const result = await render(node())
  await press("Next Page")
  const before = receipts()
  await press("Toggle pager RTL")
  await press("Toggle pager consolidation")
  await press("Toggle pager groups")
  await result.rerender(node("dark"))
  expect(owner()).toMatchObject({ page: 4, requests: ["page:4"] })
  expect(receipts()).toEqual(before)
  await press("Reset pager")
  expect(owner()).toMatchObject({ page: 3, size: 10, echo: true, veto: false, disabled: false, requests: [] })
  expect(receipts()).toEqual([])
  await press("Next Page")
  expect(receipts().map(({ sequence }) => sequence)).toEqual([1, 2])
})
