/* Copyright Adobe. Apache-2.0; see ../LICENSE.react-aria.md. Native-owned adaptation of DragManager/useDroppableCollection. */
import { AccessibilityInfo, Platform } from "react-native"
import type { View } from "react-native"

import { focusNativeTarget } from "../../input/focus"
import type { TNativeKeyboardEvent } from "../../input/types"
import type { TNativeCollectionKey } from "../snapshot"

import { navigateNativeDropTarget } from "./keyboardNavigation"
import type { TNativeDropKeyboardDelegate } from "./keyboardNavigation"
import type { TNativeDragMessageFormatter } from "./messages"
import type { NativeCollectionDragBinding } from "./NativeCollectionDragBinding"
import { nativeDragRuntime } from "./runtime"
import type { TNativeDragItem, TNativeDropTarget, TNativeDropOperation, TNativeTextDropItem } from "./types"

type TEndpoint = {
  root: NativeCollectionDragBinding
  target: TNativeDropTarget
  view: () => View | null
  activate: () => View | null
}
type TSession = {
  id: string
  source: NativeCollectionDragBinding
  key: TNativeCollectionKey
  items: TNativeDragItem[]
  operations: TNativeDropOperation[]
  types: Set<string>
  formatter: TNativeDragMessageFormatter
  root: NativeCollectionDragBinding | null
  target: TNativeDropTarget | null
  generation: number
}
const roots = new Set<NativeCollectionDragBinding>(),
  endpoints = new Map<object, TEndpoint>(),
  listeners = new Set<() => void>()
let session: TSession | null = null,
  revision = 0,
  serial = 0,
  start = 0
const changed = () => {
  revision++
  for (const listener of listeners) listener()
}
const announce = (message: string) => {
  if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: false })
  else AccessibilityInfo.announceForAccessibility(message)
}
const equal = (a: TNativeDropTarget | null, b: TNativeDropTarget | null) =>
  a?.type === b?.type &&
  (a?.type !== "item" || (b?.type === "item" && a.key === b.key && a.dropPosition === b.dropPosition))
const delegate = (root: NativeCollectionDragBinding): TNativeDropKeyboardDelegate => {
  if (root.dropOptions.keyboardDelegate) return root.dropOptions.keyboardDelegate
  const collection = root.target!.collection
  const keys: TNativeCollectionKey[] = [],
    seen = new Set<TNativeCollectionKey>()
  for (let key = collection.getFirstKey(); key != null && !seen.has(key); key = collection.getKeyAfter(key)) {
    seen.add(key)
    if (collection.getItem(key)?.type === "item") keys.push(key)
  }
  return {
    getFirstKey: () => keys[0] ?? null,
    getLastKey: () => keys.at(-1) ?? null,
    getKeyAbove: (key) => keys[keys.indexOf(key) - 1] ?? null,
    getKeyBelow: (key) => keys[keys.indexOf(key) + 1] ?? null,
  }
}
const validNext = (
  current: TSession,
  root: NativeCollectionDragBinding,
  target: TNativeDropTarget | null,
  direction: "left" | "right" | "up" | "down" = "down",
  wrap = true,
) => {
  if (!root.target) return null
  const visited = new Set<string>()
  for (;;) {
    const next = navigateNativeDropTarget(
      delegate(root),
      root.target.collection,
      target,
      direction,
      root.dropOptions.direction === "rtl",
      wrap,
    )
    if (!next) return null
    const signature = JSON.stringify(next)
    if (visited.has(signature)) return null
    visited.add(signature)
    if (root.operation(next, current.types, current.operations, current.source) !== "cancel") return next
    target = next
  }
}
const eligible = (current: TSession) =>
  [...roots].filter(
    (root) =>
      root.current() &&
      !!root.target &&
      !root.target.isDisabled &&
      root.scope?.window().windowId === current.source.scope?.window().windowId &&
      !!validNext(current, root, null),
  )
const focus = (current: TSession) => {
  if (session !== current || !current.root || !current.target) return
  const target = current.target,
    root = current.root
  const endpoint = [...endpoints.values()].find(
    (entry) => entry.root === root && equal(entry.target, target) && entry.view(),
  )
  const view = endpoint?.view() ?? (target.type === "root" ? root.root.current : null)
  if (view) focusNativeTarget(view)
  else if (target.type === "item") {
    root.dropOptions.layoutDelegate?.requestRendering?.(target.key)
    const scroll = root.dropOptions.layoutDelegate?.scrollToKey?.(target.key)
    if (scroll && typeof scroll.then === "function") scroll.catch((error) => root.fail(error))
  }
}
const select = (current: TSession, root: NativeCollectionDragBinding | null, target: TNativeDropTarget | null) => {
  if (session !== current) return
  if (current.root && current.root !== root)
    current.root.virtualTarget(current.id, null, current.types, current.operations)
  current.root = root
  current.target = target
  current.generation++
  if (root && target) root.virtualTarget(current.id, target, current.types, current.operations)
  else focusNativeTarget(current.source.rowView(current.key))
  changed()
  focus(current)
}
const initial = (current: TSession, root: NativeCollectionDragBinding) => {
  const state = root.target!,
    manager = state.selectionManager
  let key = manager.focusedKey,
    position: "before" | "after" = "after"
  const node = key != null ? state.collection.getItem(key) : null
  if (node?.type === "cell") key = node.parentKey ?? null
  if (key != null && manager.isSelected(key)) {
    if (manager.selectedKeys.size > 1 && manager.firstSelectedKey === key) position = "before"
    else key = manager.lastSelectedKey ?? null
  }
  const target: TNativeDropTarget | null = key != null ? { type: "item", key, dropPosition: position } : null
  return target && root.operation(target, current.types, current.operations, current.source) !== "cancel"
    ? target
    : ((target
        ? (validNext(current, root, target, "down", false) ?? validNext(current, root, target, "up", false))
        : null) ?? validNext(current, root, null))
}
const finish = (current: TSession, operation: TNativeDropOperation, x: number, y: number) => {
  if (session !== current) return
  session = null
  try {
    current.source.controller.end(current.id, { x, y }, operation)
  } finally {
    if (current.root && current.root !== current.source) current.root.controller.end(current.id, { x, y }, operation)
    changed()
  }
}
export const nativeVirtualDrag = {
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  snapshot: () => revision,
  active: () => session,
  isDragging: () => !!session,
  retire: (root: NativeCollectionDragBinding) => {
    if (session?.source === root) {
      start++
      session = null
      changed()
    } else if (session?.root === root) {
      session.root = null
      session.target = null
      session.generation++
      changed()
    }
  },
  register: (root: NativeCollectionDragBinding) => {
    roots.add(root)
    changed()
    return () => {
      roots.delete(root)
      nativeVirtualDrag.retire(root)
    }
  },
  endpoint: (owner: object, value: TEndpoint | null) => {
    if (value) endpoints.set(owner, value)
    else endpoints.delete(owner)
    if (session) focus(session)
  },
  start: async (
    source: NativeCollectionDragBinding,
    key: TNativeCollectionKey,
    formatter: TNativeDragMessageFormatter,
    modality: "keyboard" | "virtual",
  ) => {
    if (session) throw new Error("Cannot begin dragging while already dragging")
    if (!source.source || source.source.isDisabled || source.source.selectionManager.isDisabled(key) || !source.ready())
      return
    const intent = ++start,
      deadline = nativeDragRuntime.performance.now() + 1000,
      bounds = await source.measure(key, "source")
    if (intent !== start || !source.ready() || nativeDragRuntime.performance.now() >= deadline) return
    const id = `${source.id}:virtual:${++serial}`,
      lifted = source.controller.lift(
        id,
        source.sourceOwner(),
        key,
        { type: "dragstart", x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        true,
      )
    const types = new Set(lifted.items.flatMap((item) => Object.keys(item)))
    const current: TSession = {
      id,
      source,
      key,
      items: lifted.items,
      operations: lifted.allowedOperations,
      types,
      formatter,
      root: null,
      target: null,
      generation: 0,
    }
    session = current
    changed()
    requestAnimationFrame(() => {
      if (session !== current) return
      announce(formatter.format(modality === "keyboard" ? "dragStartedKeyboard" : "dragStartedVirtual"))
      if (modality === "keyboard") nativeVirtualDrag.cycle(1)
    })
  },
  cycle: (direction: 1 | -1) => {
    const current = session
    if (!current) return
    const valid = eligible(current),
      sourceIndex = valid.indexOf(current.source)
    const ordered = sourceIndex >= 0 ? [...valid.slice(sourceIndex), ...valid.slice(0, sourceIndex)] : valid
    const index = current.root ? ordered.indexOf(current.root) + direction : direction > 0 ? 0 : ordered.length - 1
    if (index < 0 || index >= ordered.length) {
      select(current, null, null)
      return
    }
    const root = ordered[index]
    select(current, root, initial(current, root))
  },
  choose: (root: NativeCollectionDragBinding, target: TNativeDropTarget) => {
    const current = session
    if (
      !current ||
      !root.current() ||
      root.operation(target, current.types, current.operations, current.source) === "cancel"
    )
      return false
    select(current, root, target)
    return true
  },
  cancel: () => {
    start++
    const current = session
    if (!current) return
    select(current, null, null)
    finish(current, "cancel", 0, 0)
    focusNativeTarget(current.source.rowView(current.key))
    announce(current.formatter.format("dropCanceled"))
  },
  drop: async () => {
    const current = session,
      root = current?.root,
      target = current?.target
    if (!current) return
    if (!root || !target) {
      nativeVirtualDrag.cancel()
      return
    }
    const generation = current.generation,
      bounds = await root.measure(target.type === "root" ? null : target.key)
    if (session !== current || current.generation !== generation || !root.current()) return
    const operation = root.operation(target, current.types, current.operations, current.source)
    if (operation === "cancel") {
      nativeVirtualDrag.cancel()
      return
    }
    root.virtualTarget(current.id, target, current.types, current.operations)
    const items: TNativeTextDropItem[] = current.items.map((value) => {
      let live = true
      const available = new Set(Object.keys(value))
      return {
        kind: "text",
        types: new Set(available),
        release: () => {
          live = false
        },
        getText: (type) => {
          if (!live || !available.has(type))
            return Promise.reject(
              new Error("Native virtual drag data: original representation released or unavailable"),
            )
          return Promise.resolve(value[type])
        },
      }
    })
    const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
    const pending = root.virtualDrop(current.id, items, point)
    // Native business drops may be async. End the visible drag in source order.
    finish(current, operation, point.x, point.y)
    announce(current.formatter.format("dropComplete"))
    await pending
  },
  key: (event: TNativeKeyboardEvent, up = false) => {
    const current = session
    if (!current) return false
    event.preventDefault()
    event.stopPropagation()
    const data = event.nativeEvent
    if (up) {
      if (data.key === "Enter") {
        if (data.altKey) nativeVirtualDrag.activate()
        else nativeVirtualDrag.drop().catch((error) => current.source.fail(error))
      }
      return true
    }
    if (data.key === "Escape") {
      nativeVirtualDrag.cancel()
      return true
    }
    if (data.key === "Tab" && !data.altKey && !data.ctrlKey && !data.metaKey) {
      nativeVirtualDrag.cycle(data.shiftKey ? -1 : 1)
      return true
    }
    const root = current.root
    if (!root || !root.target) return true
    const direction =
      data.key === "ArrowUp" ? "up" : data.key === "ArrowLeft" ? "left" : data.key === "ArrowRight" ? "right" : "down"
    if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(data.key)) {
      const from = data.key === "Home" || data.key === "End" ? null : current.target
      const target = validNext(current, root, from, data.key === "End" ? "up" : direction)
      if (target) select(current, root, target)
    } else if (data.key === "PageDown" || data.key === "PageUp") {
      const keyboard = delegate(root),
        page = data.key === "PageDown" ? keyboard.getKeyPageBelow : keyboard.getKeyPageAbove
      if (page && current.target?.type === "item") {
        const key = page(current.target.key)
        const target: TNativeDropTarget | null =
          key != null
            ? { ...current.target, key }
            : validNext(current, root, null, data.key === "PageDown" ? "up" : "down")
        if (target && root.operation(target, current.types, current.operations, current.source) !== "cancel")
          select(current, root, target)
      }
    }
    return true
  },
  activate: () => {
    const current = session
    if (current?.root && current.target?.type === "item" && current.target.dropPosition === "on")
      current.root.virtualActivate(current.id, { x: 0, y: 0 })
  },
  focus,
}
