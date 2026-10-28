import type { TNativeDropKeyboardDelegate } from "../keyboardNavigation"
import type { TNativeDropTarget } from "../types"
import { nativeVirtualDropTargetForKey } from "../virtualNavigation"

import { dragCollection } from "./fixtures"

const collection = dragCollection()
const delegate: TNativeDropKeyboardDelegate = {
  getFirstKey: () => 0,
  getLastKey: () => "child",
  getKeyAbove: (key) => collection.getKeyBefore(key),
  getKeyBelow: (key) => collection.getKeyAfter(key),
  getKeyPageAbove: () => 0,
  getKeyPageBelow: () => "child",
}
const valid = () => true
it("retains page positions and the first/last/root boundaries, including numeric zero", () => {
  const page = (key: string, target: TNativeDropTarget | null) =>
    nativeVirtualDropTargetForKey(key, collection, delegate, target, valid)
  expect(page("PageDown", { type: "root" })).toEqual({ type: "item", key: "child", dropPosition: "after" })
  expect(page("PageUp", { type: "item", key: 0, dropPosition: "after" })).toEqual({ type: "root" })
  expect(page("PageUp", { type: "item", key: "child", dropPosition: "on" })).toEqual({
    type: "item",
    key: 0,
    dropPosition: "on",
  })
  expect(page("PageDown", { type: "item", key: 0, dropPosition: "before" })).toEqual({
    type: "item",
    key: "child",
    dropPosition: "before",
  })
})
it("uses first/last fallback positions when the page delegate cannot move", () => {
  const empty = { ...delegate, getKeyPageAbove: () => null, getKeyPageBelow: () => null }
  expect(
    nativeVirtualDropTargetForKey("PageDown", collection, empty, { type: "item", key: 0, dropPosition: "on" }, valid),
  ).toEqual({ type: "item", key: "child", dropPosition: "after" })
  expect(
    nativeVirtualDropTargetForKey(
      "PageUp",
      collection,
      empty,
      { type: "item", key: "child", dropPosition: "after" },
      valid,
    ),
  ).toEqual({ type: "item", key: 0, dropPosition: "before" })
})
it("finds an allowed neighboring target after a rejected page and does not invent horizontal delegates", () => {
  const accept = (target: TNativeDropTarget) =>
    target.type === "item" && target.key === "child" && target.dropPosition === "after"
  expect(
    nativeVirtualDropTargetForKey(
      "PageDown",
      collection,
      delegate,
      { type: "item", key: 0, dropPosition: "before" },
      accept,
    ),
  ).toEqual({ type: "item", key: "child", dropPosition: "after" })
  expect(nativeVirtualDropTargetForKey("ArrowLeft", collection, delegate, { type: "root" }, valid)).toBeUndefined()
  expect(nativeVirtualDropTargetForKey("PageUp", collection, {}, { type: "root" }, valid)).toBeUndefined()
  expect(nativeVirtualDropTargetForKey("letter", collection, delegate, { type: "root" }, valid)).toBeUndefined()
})
