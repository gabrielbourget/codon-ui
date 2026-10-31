/* Copyright Adobe. Apache-2.0; see ../LICENSE.react-aria.md. Received collection keyboard drop-target rules. */
import type { TNativeCollectionKey } from "../snapshot"

import { navigateNativeDropTarget } from "./keyboardNavigation"
import type { TNativeDropKeyboardDelegate } from "./keyboardNavigation"
import type { TNativeDragCollection, TNativeDropTarget } from "./types"

export const nextNativeVirtualDropTarget = (
  collection: TNativeDragCollection,
  delegate: TNativeDropKeyboardDelegate,
  target: TNativeDropTarget | null,
  valid: (target: TNativeDropTarget) => boolean,
  direction: "left" | "right" | "up" | "down" = "down",
  rtl = false,
  wrap = true,
): TNativeDropTarget | null => {
  const visited = new Set<string>()
  for (;;) {
    const next = navigateNativeDropTarget(delegate, collection, target, direction, rtl, wrap)
    if (!next || visited.has(JSON.stringify(next))) return null
    visited.add(JSON.stringify(next))
    if (valid(next)) return next
    target = next
  }
}
export const nativeVirtualDropTargetForKey = (
  key: string,
  collection: TNativeDragCollection,
  delegate: TNativeDropKeyboardDelegate,
  target: TNativeDropTarget | null,
  valid: (target: TNativeDropTarget) => boolean,
  rtl = false,
): TNativeDropTarget | null | undefined => {
  const next = (from: TNativeDropTarget | null, direction: "left" | "right" | "up" | "down", wrap = true) =>
    nextNativeVirtualDropTarget(collection, delegate, from, valid, direction, rtl, wrap)
  switch (key) {
    case "ArrowDown":
      return delegate.getKeyBelow ? next(target, "down") : undefined
    case "ArrowUp":
      return delegate.getKeyAbove ? next(target, "up") : undefined
    case "ArrowLeft":
      return delegate.getKeyLeftOf ? next(target, "left") : undefined
    case "ArrowRight":
      return delegate.getKeyRightOf ? next(target, "right") : undefined
    case "Home":
      return delegate.getFirstKey ? next(null, "down") : undefined
    case "End":
      return delegate.getLastKey ? next(null, "up") : undefined
    case "PageDown": {
      if (!delegate.getKeyPageBelow) return undefined
      if (!target) return next(null, "down")
      const from = target.type === "item" ? target.key : delegate.getFirstKey?.()
      let key: TNativeCollectionKey | null = from != null ? delegate.getKeyPageBelow(from) : null
      let dropPosition = target.type === "item" ? target.dropPosition : ("after" as const)
      if (key == null || (target.type === "item" && target.key === delegate.getLastKey?.())) {
        key = delegate.getLastKey?.() ?? null
        dropPosition = "after"
      }
      if (key == null) return undefined
      const result: TNativeDropTarget = { type: "item", key, dropPosition }
      return (valid(result) ? result : (next(result, "down", false) ?? next(result, "up", false))) ?? target
    }
    case "PageUp": {
      if (!delegate.getKeyPageAbove) return undefined
      if (!target) return next(null, "up")
      if (target.type === "root") return target
      let result: TNativeDropTarget
      if (target.key === delegate.getFirstKey?.()) result = { type: "root" }
      else {
        let key = delegate.getKeyPageAbove(target.key)
        let dropPosition = target.dropPosition
        if (key == null) {
          key = delegate.getFirstKey?.() ?? null
          dropPosition = "before"
        }
        if (key == null) return undefined
        result = { type: "item", key, dropPosition }
      }
      return (valid(result) ? result : (next(result, "up", false) ?? next(result, "down", false))) ?? target
    }
  }
}
