import type { View } from "react-native"

import type { TNativeCollectionKey } from "../snapshot"

export type TNativeDragRect = Readonly<{ x: number; y: number; width: number; height: number }>
export type TNativeDragGeometry = Readonly<{
  windowId: string
  epoch: number
  revision: number
  root: TNativeDragRect
  items: ReadonlyMap<TNativeCollectionKey, TNativeDragRect>
}>
type TGeometryEntry = { value: TNativeDragGeometry; current: () => boolean }
const geometry = new WeakMap<View, TGeometryEntry>()
const validRect = (rect: TNativeDragRect) =>
  [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.width >= 0 && rect.height >= 0

// The owned native action supplies an original, current geometry cohort. A
// logical/virtual item without a materialized native target has no rectangle.
export const publishNativeDragGeometry = (root: View, value: TNativeDragGeometry, current: () => boolean) => {
  if (
    !current() ||
    !value.windowId ||
    !Number.isSafeInteger(value.epoch) ||
    value.epoch < 1 ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    !validRect(value.root) ||
    [...value.items.values()].some((rect) => !validRect(rect))
  )
    throw new Error("Native drag geometry requires a complete current native cohort")
  const old = geometry.get(root)
  if (
    old?.current() &&
    old.value.windowId === value.windowId &&
    old.value.epoch === value.epoch &&
    old.value.revision >= value.revision
  )
    throw new Error("Native drag geometry rejected a stale native revision")
  const snapshot = Object.freeze({
    ...value,
    root: Object.freeze({ ...value.root }),
    items: new Map([...value.items].map(([key, rect]) => [key, Object.freeze({ ...rect })])),
  })
  const entry = { value: snapshot, current }
  geometry.set(root, entry)
  return () => {
    if (geometry.get(root) === entry) geometry.delete(root)
  }
}

export const readNativeDragGeometry = (root: View) => {
  const entry = geometry.get(root)
  if (!entry || !entry.current()) throw new Error("Native drag geometry has no current original native cohort")
  return entry.value
}
