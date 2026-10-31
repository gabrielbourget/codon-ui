import { act, renderHook } from "@testing-library/react-native"
import { AccessibilityInfo, Platform } from "react-native"

import { createNativeCollectionSnapshot, type TNativeCollectionDescriptor } from "../../../collection/snapshot"
import { useListState } from "../../../collection/state"
import type { TNativeTagGroupLabels } from "../types"
import { useNativeTagSelectionAnnouncement } from "../useSelectionAnnouncement"

type TKey = string | number
type TProps = {
  keys: "all" | Set<TKey>
  mode: "multiple" | "single"
  behavior: "toggle" | "replace"
  labels: TNativeTagGroupLabels
}
const descriptors: TNativeCollectionDescriptor<object>[] = [
  { key: 0, textValue: "Number zero" },
  { key: "0", textValue: "String zero" },
].map((item, index) => ({
  ...item,
  descriptorId: String(index),
  descriptorRevision: "1",
  type: "item",
  value: item,
  rendered: item.textValue,
  props: {},
}))
const collection = createNativeCollectionSnapshot(
  descriptors.map((item, index) => ({
    descriptorId: item.descriptorId,
    descriptorRevision: "1",
    parentDescriptorId: "",
    target: index + 10,
    index,
    retainedIndex: index,
    hasRetainedChildren: false,
  })),
  new Map(descriptors.map((item) => [item.descriptorId, item])),
)
const fixture = (props: TProps) =>
  renderHook(
    (current: TProps) => {
      const state = useListState({
        collection,
        selectedKeys: current.keys,
        selectionMode: current.mode,
        selectionBehavior: current.behavior,
      })
      useNativeTagSelectionAnnouncement(state, current.labels)
      return state
    },
    { initialProps: props },
  )
const props = (keys: "all" | Set<TKey> = new Set()): TProps => ({
  keys,
  mode: "multiple",
  behavior: "toggle",
  labels: {},
})
beforeEach(() => jest.clearAllMocks())
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("announces committed selection changes with the pinned item/count/all outcomes and preserves owner veto", async () => {
  jest.replaceProperty(Platform, "OS", "android")
  const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {})
  const view = await fixture(props())
  await act(() => view.result.current.selectionManager.setFocused(true))
  expect(announce).not.toHaveBeenCalled()
  const one = props(new Set([0]))
  await view.rerender(one)
  await view.rerender(one)
  await view.rerender(props(new Set([0, "0"])))
  await view.rerender(props(new Set(["0"])))
  await view.rerender(props("all"))
  await view.rerender(props())
  expect(announce.mock.calls.map(([message]) => message)).toEqual([
    "Number zero selected.",
    "String zero selected. 2 items selected.",
    "Number zero not selected. 1 item selected.",
    "All items selected.",
    "No items selected.",
  ])
  expect(one.keys).toEqual(new Set([0]))
})

it("preserves assertive native iOS speech, localized overrides and removed replace-mode rows", async () => {
  jest.replaceProperty(Platform, "OS", "ios")
  const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibilityWithOptions").mockImplementation(() => {})
  const initial: TProps = {
    ...props(new Set([0])),
    mode: "single",
    behavior: "replace",
    labels: { selectedItem: (text) => `Selected: ${text}` },
  }
  const view = await fixture(initial)
  await act(() => view.result.current.selectionManager.setFocused(true))
  await view.rerender({ ...initial, keys: new Set(["0"]) })
  await view.rerender({ ...initial, keys: new Set(["missing"]) })
  expect(announce.mock.calls).toEqual([["Selected: String zero", { queue: false }]])
})

it("waits one frame for actual focus and retires queued announcements on unmount", async () => {
  jest.useFakeTimers()
  jest.replaceProperty(Platform, "OS", "android")
  const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {})
  const view = await fixture(props())
  await view.rerender(props(new Set([0])))
  expect(announce).not.toHaveBeenCalled()
  await act(() => view.result.current.selectionManager.setFocused(true))
  await act(() => jest.advanceTimersByTime(20))
  expect(announce.mock.calls).toEqual([["Number zero selected."]])
  await act(() => view.result.current.selectionManager.setFocused(false))
  await view.rerender(props(new Set(["0"])))
  await view.unmount()
  await act(() => jest.advanceTimersByTime(20))
  expect(announce).toHaveBeenCalledTimes(1)
})

it("delivers integer selection counts when native Locale and PluralRules constructors are absent", async () => {
  jest.replaceProperty(Platform, "OS", "android")
  const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {})
  const locale = Object.getOwnPropertyDescriptor(Intl, "Locale")!
  const plural = Object.getOwnPropertyDescriptor(Intl, "PluralRules")!
  try {
    Object.defineProperty(Intl, "Locale", { ...locale, value: undefined })
    Object.defineProperty(Intl, "PluralRules", { ...plural, value: undefined })
    const view = await fixture(props())
    await act(() => view.result.current.selectionManager.setFocused(true))
    await view.rerender(props(new Set([0, "0"])))
    await view.rerender(props(new Set([0])))
    expect(announce.mock.calls).toEqual([["2 items selected."], ["String zero not selected. 1 item selected."]])
  } finally {
    Object.defineProperty(Intl, "Locale", locale)
    Object.defineProperty(Intl, "PluralRules", plural)
  }
})
