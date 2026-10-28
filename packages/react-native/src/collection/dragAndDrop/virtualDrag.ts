/* Copyright Adobe. Apache-2.0; see ../LICENSE.react-aria.md. Native-owned adaptation of DragManager/useDroppableCollection. */
import { AccessibilityInfo, findNodeHandle, Platform } from "react-native"
import type { View } from "react-native"

import { registerNativeActivationPolicy } from "../../input/activation"
import { containsNativeView, focusNativeTarget, getNativeFocusedTarget, subscribeNativeFocus } from "../../input/focus"
import type { TNativeKeyboardEvent } from "../../input/types"
import type { TNativeCollectionKey } from "../snapshot"

import type { TNativeDropKeyboardDelegate } from "./keyboardNavigation"
import type { TNativeDragMessageFormatter } from "./messages"
import type { NativeCollectionDragBinding } from "./NativeCollectionDragBinding"
import { nativeDragRuntime } from "./runtime"
import type { TNativeDragItem, TNativeDropTarget, TNativeDropOperation, TNativeTextDropItem } from "./types"
import { nativeVirtualDropTargetForKey, nextNativeVirtualDropTarget } from "./virtualNavigation"

type TEndpoint = {
  root: NativeCollectionDragBinding
  target: TNativeDropTarget
  view: () => View | null
  activate: () => View | null
  label?: () => string
}
type TSession = {
  id: string
  source: NativeCollectionDragBinding
  key: TNativeCollectionKey
  sourceKind: "source" | "handle"
  sourceView: View
  items: TNativeDragItem[]
  operations: TNativeDropOperation[]
  types: Set<string>
  formatter: TNativeDragMessageFormatter
  root: NativeCollectionDragBinding | null
  target: TNativeDropTarget | null
  generation: number
  pending: "drop" | "cancel" | null
  requested: string | null
  firstAnnounced: boolean
  unsubscribeFocus: () => void
  unsubscribeActivation: () => void
}
const roots = new Set<NativeCollectionDragBinding>(),
  endpoints = new Map<object, TEndpoint>(),
  listeners = new Set<() => void>()
const handled = new WeakMap<object, Set<boolean>>()
let session: TSession | null = null,
  revision = 0,
  serial = 0,
  start = 0,
  restoring = false
const changed = () => {
  revision++
  for (const listener of listeners) listener()
}
const announce = (message: string, polite = false) => {
  if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: polite })
  else AccessibilityInfo.announceForAccessibility(message)
}
const equal = (a: TNativeDropTarget | null, b: TNativeDropTarget | null) =>
  a?.type === b?.type &&
  (a?.type !== "item" || (b?.type === "item" && a.key === b.key && a.dropPosition === b.dropPosition))
const originalSource = (current: TSession) =>
  current.source.current() &&
  (current.sourceKind === "handle" ? current.source.handleView(current.key) : current.source.rowView(current.key)) ===
    current.sourceView
const delegate = (root: NativeCollectionDragBinding): TNativeDropKeyboardDelegate => {
  if (root.dropOptions.keyboardDelegate) return root.dropOptions.keyboardDelegate
  const collection = root.target!.collection,
    keys: TNativeCollectionKey[] = [],
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
) =>
  root.target
    ? nextNativeVirtualDropTarget(
        root.target.collection,
        delegate(root),
        target,
        (target) => root.operation(target, current.types, current.operations, current.source) !== "cancel",
        direction,
        root.dropOptions.direction === "rtl",
        wrap,
      )
    : null
const eligible = (current: TSession) =>
  [...roots].filter(
    (root) =>
      root.current() &&
      !!root.target &&
      !root.target.isDisabled &&
      root.scope?.window().windowId === current.source.scope?.window().windowId &&
      !!validNext(current, root, null),
  )
const selectedEndpoint = (current: TSession) =>
  [...endpoints.values()].find(
    (entry) => entry.root === current.root && equal(entry.target, current.target) && entry.view(),
  )
const requestFocus = (view: View | null) => {
  if (!view || getNativeFocusedTarget() === view) return
  restoring = true
  try {
    focusNativeTarget(view)
  } finally {
    restoring = false
  }
}
const focus = (current: TSession) => {
  if (session !== current || !originalSource(current)) return
  if (!current.root || !current.target) {
    requestFocus(current.sourceView)
    return
  }
  const root = current.root,
    target = current.target,
    endpoint = selectedEndpoint(current)
  const view = endpoint?.view() ?? (target.type === "root" ? root.root.current : null)
  if (view) {
    current.requested = null
    requestFocus(view)
    if (!current.firstAnnounced && endpoint?.label?.()) {
      current.firstAnnounced = true
      const label = endpoint.label()
      nativeDragRuntime.requestAnimationFrame(() => {
        if (session === current) announce(label, true)
      })
    }
  } else if (target.type === "item") {
    const request = JSON.stringify([root.id, target, current.generation])
    if (current.requested === request) return
    current.requested = request
    root.dropOptions.layoutDelegate?.requestRendering?.(target.key)
    const pending = root.dropOptions.layoutDelegate?.scrollToKey?.(target.key)
    if (pending && typeof pending.then === "function")
      pending.catch((error) => {
        if (session === current && current.requested === request) root.fail(error)
      })
  }
}
const select = (current: TSession, root: NativeCollectionDragBinding | null, target: TNativeDropTarget | null) => {
  if (session !== current || current.pending || (current.root === root && equal(current.target, target))) return
  if (current.root && current.root !== root)
    current.root.virtualTarget(current.id, null, current.types, current.operations)
  current.root = root
  current.target = target
  current.generation++
  current.requested = null
  if (root) root.virtualTarget(current.id, target, current.types, current.operations)
  changed()
  focus(current)
}
const observeFocus = (current: TSession) => {
  if (session !== current || restoring || current.pending || !originalSource(current)) return
  const view = getNativeFocusedTarget()
  if (view === current.sourceView || view === selectedEndpoint(current)?.activate()) return
  const endpoint = [...endpoints.values()].find(
    (entry) =>
      entry.view() === view &&
      entry.root.operation(entry.target, current.types, current.operations, current.source) !== "cancel",
  )
  if (endpoint) select(current, endpoint.root, endpoint.target)
  else focus(current)
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
const clear = (current: TSession) => {
  current.unsubscribeFocus()
  current.unsubscribeActivation()
  if (session === current) session = null
}
const finish = (current: TSession, operation: TNativeDropOperation, x: number, y: number) => {
  if (session !== current) return
  clear(current)
  try {
    current.source.controller.end(current.id, { x, y }, operation)
  } finally {
    if (current.root && current.root !== current.source) current.root.controller.end(current.id, { x, y }, operation)
    changed()
  }
}
const failure = (current: TSession, error: unknown) => {
  if (session !== current) return
  clear(current)
  current.source.controller.retire(current.source.identity)
  if (current.root && current.root !== current.source) current.root.controller.retireSession(current.id)
  changed()
  current.source.fail(error)
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
      clear(session)
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
    if (session && !session.pending) focus(session)
  },
  start: async (
    source: NativeCollectionDragBinding,
    key: TNativeCollectionKey,
    formatter: TNativeDragMessageFormatter,
    modality: "keyboard" | "virtual",
    sourceKind: "source" | "handle" = "source",
  ) => {
    if (session) throw new Error("Cannot begin dragging while already dragging")
    if (!source.source || source.source.isDisabled || source.source.selectionManager.isDisabled(key) || !source.ready())
      return
    const view = sourceKind === "handle" ? source.handleView(key) : source.rowView(key)
    if (!view) throw new Error("Native virtual drag requires its original source view")
    const intent = ++start,
      deadline = nativeDragRuntime.performance.now() + 1000,
      bounds = await source.measure(key, sourceKind)
    if (
      intent !== start ||
      !source.ready() ||
      nativeDragRuntime.performance.now() >= deadline ||
      (sourceKind === "handle" ? source.handleView(key) : source.rowView(key)) !== view
    )
      return
    const id = `${source.id}:virtual:${++serial}`,
      lifted = source.controller.lift(
        id,
        source.sourceOwner(),
        key,
        { type: "dragstart", x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        true,
      )
    const current: TSession = {
      id,
      source,
      key,
      sourceKind,
      sourceView: view,
      items: lifted.items,
      operations: lifted.allowedOperations,
      types: new Set(lifted.items.flatMap((item) => Object.keys(item))),
      formatter,
      root: null,
      target: null,
      generation: 0,
      pending: null,
      requested: null,
      firstAnnounced: false,
      unsubscribeFocus: () => {},
      unsubscribeActivation: () => {},
    }
    session = current
    current.unsubscribeFocus = subscribeNativeFocus(() => observeFocus(current))
    current.unsubscribeActivation = registerNativeActivationPolicy((view, event) => {
      if (
        session !== current ||
        !originalSource(current) ||
        event.nativeEvent.windowId !== current.source.scope?.window().windowId
      )
        return false
      const actor = [current.source, ...roots].find((root) => root.scope?.ownerId === event.nativeEvent.scopeOwnerId)
      if (actor && actor.scope?.window().epoch !== event.nativeEvent.epoch) return true
      if (current.pending) return true
      const allowed = [...endpoints.values()].filter(
        (entry) =>
          entry.root.current() &&
          entry.root.operation(entry.target, current.types, current.operations, current.source) !== "cancel",
      )
      const activation = allowed.find((entry) => {
        const button = entry.activate()
        return button && containsNativeView(button, view)
      })
      if (activation && nativeVirtualDrag.choose(activation.root, activation.target))
        nativeVirtualDrag.activate().catch((error) => current.source.fail(error))
      else if (view === current.sourceView) nativeVirtualDrag.cancel().catch((error) => current.source.fail(error))
      else {
        const endpoint = allowed.reduce<TEndpoint | null>((selected, entry) => {
          const target = entry.view()
          return target &&
            containsNativeView(target, view) &&
            (!selected || containsNativeView(selected.view()!, target))
            ? entry
            : selected
        }, null)
        if (endpoint && nativeVirtualDrag.choose(endpoint.root, endpoint.target))
          nativeVirtualDrag.drop().catch((error) => current.source.fail(error))
      }
      return true
    })
    changed()
    nativeDragRuntime.requestAnimationFrame(() => {
      if (session !== current) return
      announce(formatter.format(modality === "keyboard" ? "dragStartedKeyboard" : "dragStartedVirtual"))
      if (modality === "keyboard") nativeVirtualDrag.cycle(1)
    })
  },
  cycle: (direction: 1 | -1) => {
    const current = session
    if (!current || current.pending) return
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
      current.pending ||
      !root.current() ||
      root.operation(target, current.types, current.operations, current.source) === "cancel"
    )
      return false
    select(current, root, target)
    return true
  },
  cancel: async () => {
    start++
    const current = session
    if (!current || current.pending === "cancel") return
    current.pending = "cancel"
    try {
      const bounds = await current.source.measure(current.key, current.sourceKind)
      if (session !== current || !originalSource(current)) return
      finish(current, "cancel", bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
      if (originalSource(current)) requestFocus(current.sourceView)
      announce(current.formatter.format("dropCanceled"))
    } catch (error) {
      failure(current, error)
    }
  },
  drop: async () => {
    const current = session,
      root = current?.root,
      target = current?.target
    if (!current || current.pending) return
    if (!root || !target) {
      await nativeVirtualDrag.cancel()
      return
    }
    current.pending = "drop"
    const generation = current.generation
    try {
      const bounds = await root.measure(null)
      if (
        session !== current ||
        current.pending !== "drop" ||
        current.generation !== generation ||
        !root.current() ||
        !originalSource(current)
      )
        return
      const operation = root.operation(target, current.types, current.operations, current.source)
      if (operation === "cancel") {
        current.pending = null
        await nativeVirtualDrag.cancel()
        return
      }
      root.virtualTarget(current.id, target, current.types, current.operations)
      const items: TNativeTextDropItem[] = current.items.map((value) => {
        let live = true
        const types = new Set(Object.keys(value))
        return {
          kind: "text",
          types: new Set(types),
          release: () => {
            live = false
          },
          getText: (type) => {
            if (!live || !types.has(type))
              return Promise.reject(
                new Error("Native virtual drag data: original representation released or unavailable"),
              )
            return Promise.resolve(value[type])
          },
        }
      })
      const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      const pending = root.virtualDrop(current.id, items, point)
      finish(current, operation, point.x, point.y)
      announce(current.formatter.format("dropComplete"))
      await pending
    } catch (error) {
      if (session === current) failure(current, error)
      else root.fail(error)
    }
  },
  key: (event: TNativeKeyboardEvent, up = false) => {
    const current = session
    if (!current) return false
    const phases = handled.get(event) ?? new Set<boolean>()
    if (phases.has(up)) return true
    phases.add(up)
    handled.set(event, phases)
    event.preventDefault()
    event.stopPropagation()
    if (current.pending) return true
    const data = event.nativeEvent
    if (up) {
      if (data.key === "Enter") {
        const activate = selectedEndpoint(current)?.activate()
        if (data.altKey || (activate && findNodeHandle(activate) === data.target))
          nativeVirtualDrag.activate().catch((error) => current.source.fail(error))
        else nativeVirtualDrag.drop().catch((error) => current.source.fail(error))
      }
      return true
    }
    if (data.key === "Escape") {
      nativeVirtualDrag.cancel().catch((error) => current.source.fail(error))
      return true
    }
    if (data.key === "Tab" && !data.altKey && !data.ctrlKey && !data.metaKey)
      nativeVirtualDrag.cycle(data.shiftKey ? -1 : 1)
    const root = current.root
    if (root?.target) {
      const target = nativeVirtualDropTargetForKey(
        data.key,
        root.target.collection,
        delegate(root),
        current.target,
        (target) => root.operation(target, current.types, current.operations, current.source) !== "cancel",
        root.dropOptions.direction === "rtl",
      )
      if (target !== undefined) select(current, root, target)
      root.dropOptions.onKeyDown?.(event)
    }
    return true
  },
  activate: async () => {
    const current = session,
      root = current?.root,
      target = current?.target
    if (!current || current.pending || !root || target?.type !== "item" || target.dropPosition !== "on") return
    const generation = current.generation,
      bounds = await root.measure(null)
    if (session === current && current.generation === generation && root.current())
      root.virtualActivate(current.id, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 })
  },
  focus,
}
