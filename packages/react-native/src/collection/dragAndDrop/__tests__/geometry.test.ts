import type { View } from "react-native"

import type { TNativeCollectionKey } from "../../snapshot"
import type { TNativeDragRect } from "../geometry"
import { publishNativeDragGeometry } from "../geometry"
import { NativeListDropTargetDelegate } from "../NativeListDropTargetDelegate"

import { dragCollection } from "./fixtures"

it("uses one actual-cohort coordinate space while retaining zero and empty keys", () => {
  const root = {} as View
  const collection = dragCollection()
  publishNativeDragGeometry(
    root,
    {
      windowId: "original-window",
      epoch: 1,
      revision: 1,
      root: { x: 100, y: 200, width: 120, height: 200 },
      items: new Map<TNativeCollectionKey, TNativeDragRect>([
        [0, { x: 100, y: 200, width: 120, height: 30 }],
        ["", { x: 100, y: 230, width: 120, height: 30 }],
        ["folder", { x: 100, y: 260, width: 120, height: 30 }],
      ]),
    },
    () => true,
  )
  const delegate = new NativeListDropTargetDelegate(collection, { current: root })
  expect(delegate.getDropTargetFromPoint(50, 15, () => true)).toEqual({ type: "item", key: 0, dropPosition: "on" })
  expect(delegate.getDropTargetFromPoint(50, 45, () => true)).toEqual({ type: "item", key: "", dropPosition: "on" })
  expect(delegate.getDropTargetFromPoint(50, 31, () => true)).toEqual({ type: "item", key: "", dropPosition: "before" })
})
it("does not materialize a logical row when the native cohort has no original rectangle", () => {
  const root = {} as View
  publishNativeDragGeometry(
    root,
    {
      windowId: "original-window",
      epoch: 1,
      revision: 1,
      root: { x: 0, y: 0, width: 120, height: 200 },
      items: new Map(),
    },
    () => true,
  )
  const delegate = new NativeListDropTargetDelegate(dragCollection(), { current: root })
  expect(delegate.getDropTargetFromPoint(10, 10, () => true)).toBeNull()
})
it("rejects foreign or stale native geometry instead of guessing a native root rectangle", () => {
  const root = {} as View
  let live = true
  const value = {
    windowId: "original-window",
    epoch: 1,
    revision: 2,
    root: { x: 0, y: 0, width: 120, height: 200 },
    items: new Map(),
  }
  const retire = publishNativeDragGeometry(root, value, () => live)
  expect(() => publishNativeDragGeometry(root, { ...value, revision: 1 }, () => live)).toThrow("stale")
  live = false
  const delegate = new NativeListDropTargetDelegate(dragCollection(), { current: root })
  expect(() => delegate.getDropTargetFromPoint(10, 10, () => true)).toThrow("no current")
  retire()
})
