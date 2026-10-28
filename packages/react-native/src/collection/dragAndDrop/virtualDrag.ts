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
  return root.keyboardDelegate()
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
  [...roots].filter((root) => {
    const window = root.scope?.window(),
      sourceWindow = current.source.scope?.window()
    return (
      root.current() &&
      !!root.target &&
      !root.target.isDisabled &&
      window?.available === true &&
      window?.canDrop === true &&
      window.windowId === sourceWindow?.windowId &&
      !!validNext(current, root, null)
    )
  })
// RN's original ReadOnlyElement reads transformed native geometry synchronously.
// Keep the pinned nearest-origin rotation, including registration-order ties.
const orderedRoots = (current: TSession) => {
  const valid = eligible(current)
  if (!valid.length) return valid
  const source = current.sourceView
  const bounds = (view: View) => {
    if (typeof view.getBoundingClientRect !== "function")
      throw new Error("Native virtual drag: original target rectangle unavailable")
    const rect = view.getBoundingClientRect()
    if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width < 0 || rect.height < 0)
      throw new Error("Native virtual drag: invalid original target rectangle")
    return rect
  }
  const origin = bounds(source)
  let nearest = 0,
    distance = Infinity
  for (let index = 0; index < valid.length; index++) {
    const root = valid[index],
      view = root.root.current!
    const window = root.scope!.window()
    const rect = bounds(view)
    const after = root.scope!.window()
    if (
      !root.current() ||
      root.root.current !== view ||
      !originalSource(current) ||
      session !== current ||
      after.windowId !== window.windowId ||
      after.epoch !== window.epoch ||
      !after.canDrop
    )
      throw new Error("Native virtual drag: target changed during geometry read")
    const squared = (rect.x - origin.x) ** 2 + (rect.y - origin.y) ** 2
    if (squared < distance) {
      distance = squared
      nearest = index
    }
  }
  return [...valid.slice(nearest), ...valid.slice(0, nearest)]
}
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
  const activation = selectedEndpoint(current)?.activate()
  if (view === current.sourceView || (view && activation && containsNativeView(activation, view))) return
  const valid = eligible(current)
  const endpoint = [...endpoints.values()].reduce<TEndpoint | null>((selected, entry) => {
    const target = entry.view()
    return view &&
      target &&
      valid.includes(entry.root) &&
      containsNativeView(target, view) &&
      entry.root.operation(entry.target, current.types, current.operations, current.source) !== "cancel" &&
      (!selected || containsNativeView(selected.view()!, target))
      ? entry
      : selected
  }, null)
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
      const current = session
      current.root = null
      current.target = null
      current.generation++
      const replacement = orderedRoots(current).find((candidate) => candidate !== root)
      if (replacement) select(current, replacement, initial(current, replacement))
      else {
        changed()
        focus(current)
      }
    }
  },
  reconcile: (root: NativeCollectionDragBinding) => {
    const current = session
    if (!current || current.pending) return
    if (!originalSource(current)) {
      nativeVirtualDrag.retire(current.source)
      if (current.source.current()) current.source.controller.endSourceOnUnmount(current.source.identity)
      return
    }
    if (current.root !== root) return
    if (!eligible(current).includes(root)) {
      const replacement = orderedRoots(current)[0]
      select(current, replacement ?? null, replacement ? initial(current, replacement) : null)
    } else if (
      current.target &&
      root.operation(current.target, current.types, current.operations, current.source) === "cancel"
    )
      select(current, root, initial(current, root))
    else focus(current)
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
      if (event.nativeEvent.target !== findNodeHandle(view)) return true
      const actor = [current.source, ...roots].find((root) => root.scope?.ownerId === event.nativeEvent.scopeOwnerId)
      const keyboard = actor?.scope?.activationSession()
      if (actor && (keyboard?.windowId !== event.nativeEvent.windowId || keyboard.epoch !== event.nativeEvent.epoch))
        return true
      if (current.pending) return true
      const valid = eligible(current)
      const allowed = [...endpoints.values()].filter(
        (entry) =>
          valid.includes(entry.root) &&
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
      if (modality === "keyboard") {
        try {
          nativeVirtualDrag.cycle(1)
        } catch (error) {
          failure(current, error)
        }
      }
    })
  },
  cycle: (direction: 1 | -1) => {
    const current = session
    if (!current || current.pending) return
    if (!originalSource(current)) {
      nativeVirtualDrag.retire(current.source)
      return
    }
    const ordered = orderedRoots(current)
    const previous = current.root ? ordered.indexOf(current.root) : -1
    const index = previous >= 0 ? previous + direction : direction > 0 ? 0 : ordered.length - 1
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
      !eligible(current).includes(root) ||
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
