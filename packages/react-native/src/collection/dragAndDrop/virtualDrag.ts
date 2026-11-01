/* Copyright Adobe. Apache-2.0; see ../LICENSE.react-aria.md. Native-owned collection drop requests. */
import { AccessibilityInfo, findNodeHandle, Platform } from "react-native"
import type { View } from "react-native"

import { focusNativeTarget } from "../../input/focus"
import type { TNativeKeyboardEvent } from "../../input/types"
import type { TNativeCollectionKey } from "../snapshot"

import type { TNativeDragMessageFormatter } from "./messages"
import type { NativeCollectionDragBinding } from "./NativeCollectionDragBinding"
import { nativeDragRuntime } from "./runtime"
import type { TNativeDragItem, TNativeDropTarget, TNativeDropOperation, TNativeTextDropItem } from "./types"

export type TNativeAccessibleDropChoice = {
  id: string
  root: NativeCollectionDragBinding
  target: TNativeDropTarget
  label: string
  current: () => boolean
}
type TEndpoint = {
  root: NativeCollectionDragBinding
  target: TNativeDropTarget
  view: () => View | null
  activate: () => View | null
  label?: () => string
}
export type TNativeAccessibleDropRequest = {
  id: string
  source: NativeCollectionDragBinding
  key: TNativeCollectionKey
  sourceKind: "source" | "handle"
  sourceView: View
  formatter: TNativeDragMessageFormatter
  phase: "choosing" | "closing" | "waiting" | "running"
  choices: TNativeAccessibleDropChoice[]
  selected: TNativeAccessibleDropChoice | null
  sourceCurrent: () => boolean
  windowId: string
  surfaceId: number
  scopeTarget: number
  modalDismissed: boolean
  outcome: "drop" | "cancel" | null
  release: () => void
}
type TSession = {
  id: string
  source: NativeCollectionDragBinding
  sourceView: View
  key: TNativeCollectionKey
  sourceKind: "source" | "handle"
  items: TNativeDragItem[]
  operations: TNativeDropOperation[]
  types: Set<string>
  root: NativeCollectionDragBinding
  target: TNativeDropTarget
  pending: "drop" | "cancel"
  point: { x: number; y: number }
}
const roots = new Set<NativeCollectionDragBinding>()
const endpoints = new Map<object, TEndpoint>()
const listeners = new Set<() => void>()
let request: TNativeAccessibleDropRequest | null = null
let session: TSession | null = null
let revision = 0
let serial = 0
const changed = () => {
  revision++
  for (const listener of listeners) listener()
}
const announce = (message: string) => {
  if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true })
  else AccessibilityInfo.announceForAccessibility(message)
}
const equal = (left: TNativeDropTarget, right: TNativeDropTarget) =>
  left.type === right.type &&
  (left.type !== "item" ||
    (right.type === "item" && left.key === right.key && left.dropPosition === right.dropPosition))
const originalSource = (current: TNativeAccessibleDropRequest) => {
  const window = current.source.scope?.window()
  return (
    current.sourceCurrent() &&
    window?.windowId === current.windowId &&
    window.surfaceId === current.surfaceId &&
    window.scopeTarget === current.scopeTarget
  )
}
const clear = (current: TNativeAccessibleDropRequest) => {
  if (request !== current) return
  current.outcome ??= "cancel"
  current.release()
  request = null
  if (session?.id === current.id) {
    current.source.controller.retire(current.source.identity)
    if (session.root !== current.source) session.root.controller.retireSession(current.id)
    session = null
  }
  changed()
}
const textValue = (root: NativeCollectionDragBinding, key: TNativeCollectionKey) =>
  root.target?.collection.getTextValue?.(key) ?? root.target?.collection.getItem(key)?.textValue ?? ""
const choiceLabel = (
  root: NativeCollectionDragBinding,
  target: TNativeDropTarget,
  formatter: TNativeDragMessageFormatter,
) => {
  const authored = [...endpoints.values()]
    .find((entry) => entry.root === root && equal(entry.target, target))
    ?.label?.()
  if (authored?.trim()) return authored
  const text = target.type === "root" ? root.dropOptions.rootLabel : textValue(root, target.key)
  if (!text?.trim()) throw new Error("Native accessible drop requires a declared target label")
  return target.type === "root"
    ? `${formatter.format("dropOnRoot")} ${text}`
    : formatter.format(
        target.dropPosition === "on" ? "dropOnItem" : target.dropPosition === "before" ? "insertBefore" : "insertAfter",
        { itemText: text },
      )
}
const choicesFor = (
  source: NativeCollectionDragBinding,
  key: TNativeCollectionKey,
  formatter: TNativeDragMessageFormatter,
) => {
  const choices: TNativeAccessibleDropChoice[] = []
  const sourceWindow = source.scope?.window()
  const draggingKeys = source.source!.getKeysForDrag(key)
  for (const root of roots) {
    const window = root.scope?.window()
    if (
      !root.current() ||
      !root.canVirtualAct() ||
      !root.targetEnabled ||
      !root.target ||
      root.target.isDisabled ||
      !window?.canDrop ||
      window.windowId !== sourceWindow?.windowId
    )
      continue
    const props = root.dropOptions
    const internal = root === source
    const add = (target: TNativeDropTarget) => {
      choices.push({
        id: JSON.stringify([root.id, target]),
        root,
        target,
        label: choiceLabel(root, target, formatter),
        current: root.retainAccessibleDropTarget(target),
      })
    }
    if (props.onDrop || (!internal && props.onRootDrop)) add({ type: "root" })
    const declared = [...endpoints.values()].filter((entry) => entry.root === root)
    // A custom root-only binding declares no item destinations. Virtualized owners
    // provide their logical item layout separately from mounted endpoints.
    if (
      declared.some((entry) => entry.target.type === "root") &&
      !declared.some((entry) => entry.target.type === "item") &&
      !props.layoutDelegate
    )
      continue
    const collection = root.target.collection
    const seen = new Set<TNativeCollectionKey>()
    for (
      let targetKey = collection.getFirstKey();
      targetKey != null && !seen.has(targetKey);
      targetKey = collection.getKeyAfter(targetKey)
    ) {
      seen.add(targetKey)
      const node = collection.getItem(targetKey)
      if (!node || node.type !== "item") continue
      let excluded = false
      if (internal) {
        let parent = node.parentKey
        while (parent != null) {
          if (draggingKeys.has(parent)) {
            excluded = true
            break
          }
          parent = collection.getItem(parent)?.parentKey ?? null
        }
      }
      if (excluded) continue
      if (props.onDrop || (internal ? props.onReorder || props.onMove : props.onInsert))
        add({ type: "item", key: targetKey, dropPosition: "before" })
      if (
        (!internal || !draggingKeys.has(targetKey)) &&
        (props.onDrop || props.onItemDrop || (internal && props.onMove))
      )
        add({ type: "item", key: targetKey, dropPosition: "on" })
      if (props.onDrop || (internal ? props.onReorder || props.onMove : props.onInsert))
        add({ type: "item", key: targetKey, dropPosition: "after" })
    }
  }
  return choices
}
const ready = (current: TNativeAccessibleDropRequest) => {
  const choice = current.selected
  return (
    originalSource(current) &&
    current.source.ready() &&
    current.source.canVirtualAct() &&
    !!choice &&
    choice.current() &&
    choice.root.current() &&
    choice.root.canVirtualAct() &&
    choice.root.scope?.window().canDrop === true &&
    choice.root.scope.window().windowId === current.windowId
  )
}
const finish = (current: TSession, operation: TNativeDropOperation, x: number, y: number) => {
  if (session !== current) return
  session = null
  const pending = request
  if (pending) {
    pending.outcome = operation === "cancel" ? "cancel" : "drop"
    clear(pending)
  }
  try {
    current.source.controller.end(current.id, { x, y }, operation)
  } finally {
    if (current.root !== current.source) current.root.controller.end(current.id, { x, y }, operation)
    changed()
  }
}
const run = async (pending: TNativeAccessibleDropRequest) => {
  if (request !== pending) return
  if (!originalSource(pending) || (pending.selected && !pending.selected.current())) {
    clear(pending)
    return
  }
  if (!pending.modalDismissed || pending.phase !== "waiting" || !ready(pending)) return
  pending.phase = "running"
  changed()
  const choice = pending.selected!
  const sourceWindow = pending.source.scope!.window()
  const targetWindow = choice.root.scope!.window()
  const current = () =>
    request === pending &&
    originalSource(pending) &&
    pending.source.current() &&
    pending.source.canVirtualAct() &&
    pending.source.scope!.window().canLift &&
    choice.current() &&
    choice.root.current() &&
    choice.root.canVirtualAct() &&
    choice.root.scope!.window().canDrop &&
    pending.source.scope!.window().epoch === sourceWindow.epoch &&
    choice.root.scope!.window().epoch === targetWindow.epoch
  try {
    const deadline = nativeDragRuntime.performance.now() + 1000
    const bounds = await pending.source.measure(pending.key, pending.sourceKind)
    if (!current() || nativeDragRuntime.performance.now() >= deadline) {
      clear(pending)
      return
    }
    const lifted = pending.source.controller.lift(
      pending.id,
      pending.source.sourceOwner(),
      pending.key,
      { type: "dragstart", x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
      true,
    )
    const active: TSession = {
      id: pending.id,
      source: pending.source,
      sourceView: pending.sourceView,
      key: pending.key,
      sourceKind: pending.sourceKind,
      items: lifted.items,
      operations: lifted.allowedOperations,
      types: new Set(lifted.items.flatMap((item) => Object.keys(item))),
      root: choice.root,
      target: choice.target,
      pending: "drop",
      point: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    }
    session = active
    if (
      !current() ||
      choice.root.virtualTarget(active.id, choice.target, active.types, active.operations) === "cancel"
    ) {
      finish(active, "cancel", bounds.x, bounds.y)
      announce(pending.formatter.format("dropCanceled"))
      return
    }
    const targetBounds = await choice.root.measure(null)
    if (!current() || session !== active) {
      finish(active, "cancel", bounds.x, bounds.y)
      return
    }
    const operation = choice.root.operation(choice.target, active.types, active.operations, pending.source)
    if (operation === "cancel") {
      finish(active, "cancel", bounds.x, bounds.y)
      return
    }
    const items: TNativeTextDropItem[] = active.items.map((value) => {
      let live = true
      const types = new Set(Object.keys(value))
      return {
        kind: "text",
        types,
        release: () => {
          live = false
        },
        getText: (type) =>
          !live || !types.has(type)
            ? Promise.reject(new Error("Native virtual drag data: original representation released or unavailable"))
            : Promise.resolve(value[type]),
      }
    })
    const point = { x: targetBounds.x + targetBounds.width / 2, y: targetBounds.y + targetBounds.height / 2 }
    const dropped = choice.root.virtualDrop(active.id, items, point)
    finish(active, operation, point.x, point.y)
    await dropped
    announce(pending.formatter.format("dropComplete"))
  } catch (error) {
    if (session?.id === pending.id) {
      pending.source.controller.retire(pending.source.identity)
      if (choice.root !== pending.source) choice.root.controller.retireSession(pending.id)
      session = null
    }
    clear(pending)
    pending.source.fail(error)
  }
}
type TNativeVirtualDrag = {
  subscribe: (listener: () => void) => () => void
  snapshot: () => number
  active: () => TSession | null
  pendingRequest: () => TNativeAccessibleDropRequest | null
  isDragging: () => boolean
  pendingKeys: (root: NativeCollectionDragBinding | null) => Set<TNativeCollectionKey>
  register: (root: NativeCollectionDragBinding) => () => void
  endpoint: (owner: object, value: TEndpoint | null) => void
  start: (
    source: NativeCollectionDragBinding,
    key: TNativeCollectionKey,
    formatter: TNativeDragMessageFormatter,
    modality: "keyboard" | "virtual",
    sourceKind?: "source" | "handle",
  ) => Promise<void>
  choose: (root: NativeCollectionDragBinding, target: TNativeDropTarget, requestId?: string) => boolean
  drop: (requestId?: string) => Promise<void>
  dismissed: (id: string) => void
  reconcile: (root: NativeCollectionDragBinding) => void
  retire: (root: NativeCollectionDragBinding) => void
  cancel: () => Promise<void>
  key: (event: TNativeKeyboardEvent, up?: boolean) => boolean
}
export const nativeVirtualDrag: TNativeVirtualDrag = {
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  snapshot: () => revision,
  active: () => session,
  pendingRequest: () => request,
  isDragging: () => !!request || !!session,
  pendingKeys: (root: NativeCollectionDragBinding | null) => {
    const keys = new Set<TNativeCollectionKey>()
    if (request?.source === root) for (const key of root?.source?.getKeysForDrag(request.key) ?? []) keys.add(key)
    if (request?.selected?.root === root && request.selected.target.type === "item")
      keys.add(request.selected.target.key)
    return keys
  },
  register: (root: NativeCollectionDragBinding) => {
    roots.add(root)
    return () => {
      roots.delete(root)
      nativeVirtualDrag.retire(root)
    }
  },
  endpoint: (owner: object, value: TEndpoint | null) => {
    if (value) endpoints.set(owner, value)
    else endpoints.delete(owner)
  },
  start: async (
    source: NativeCollectionDragBinding,
    key: TNativeCollectionKey,
    formatter: TNativeDragMessageFormatter,
    _modality: "keyboard" | "virtual",
    sourceKind: "source" | "handle" = "source",
  ) => {
    if (request || session) throw new Error("Cannot begin dragging while already dragging")
    if (
      !source.source ||
      source.source.isDisabled ||
      source.source.selectionManager.isDisabled(key) ||
      !source.ready() ||
      !source.canVirtualAct()
    )
      return
    const sourceView = sourceKind === "handle" ? source.handleView(key) : source.rowView(key)
    if (!sourceView) throw new Error("Native accessible drop requires its original source view")
    const window = source.scope!.window()
    const choices = choicesFor(source, key, formatter)
    request = {
      id: `${source.id}:accessible:${++serial}`,
      source,
      key,
      sourceKind,
      sourceView,
      formatter,
      phase: "choosing",
      choices,
      selected: choices[0] ?? null,
      sourceCurrent: source.retainAccessibleDropSource(key, sourceKind),
      windowId: window.windowId,
      surfaceId: window.surfaceId,
      scopeTarget: window.scopeTarget,
      modalDismissed: false,
      outcome: null,
      release: () => {},
    }
    changed()
  },
  choose: (root: NativeCollectionDragBinding, target: TNativeDropTarget, requestId?: string) => {
    const pending = request
    if (
      !pending ||
      (requestId !== undefined && pending.id !== requestId) ||
      pending.phase !== "choosing" ||
      !originalSource(pending)
    )
      return false
    const choice = pending.choices.find((entry) => entry.root === root && equal(entry.target, target))
    if (!choice || !choice.current()) return false
    pending.selected = choice
    changed()
    return true
  },
  drop: async (requestId?: string) => {
    if (
      !request ||
      (requestId !== undefined && request.id !== requestId) ||
      request.phase !== "choosing" ||
      !request.selected ||
      !originalSource(request)
    )
      return
    if (!request.selected.current()) {
      const retired = request
      clear(retired)
      announce(retired.formatter.format("dropCanceled"))
      return
    }
    request.phase = "closing"
    changed()
  },
  dismissed: (id: string) => {
    const pending = request
    if (!pending || pending.id !== id || pending.phase !== "closing") return
    pending.modalDismissed = true
    const scopes = new Set([pending.source.scope, pending.selected?.root.scope])
    const unsubscribe = [...scopes].flatMap((scope) =>
      scope
        ? [
            scope.subscribe(() => {
              void run(pending)
            }),
          ]
        : [],
    )
    pending.release = () => {
      for (const dispose of unsubscribe) dispose()
    }
    pending.phase = "waiting"
    changed()
    void run(pending)
  },
  reconcile: (_root: NativeCollectionDragBinding) => {
    const pending = request
    if (!pending) return
    if (!originalSource(pending) || (pending.selected && !pending.selected.current())) {
      clear(pending)
      return
    }
    void run(pending)
  },
  retire: (root: NativeCollectionDragBinding) => {
    const pending = request
    if (!pending) return
    // Native window coverage retires transport leases, not the pending modal request.
    if (!originalSource(pending) || (pending.selected?.root === root && !pending.selected.current())) clear(pending)
  },
  cancel: async () => {
    const pending = request
    if (!pending) return
    if (session) {
      const current = session
      finish(current, "cancel", current.point.x, current.point.y)
    } else clear(pending)
    if (pending.sourceCurrent() && pending.source.canVirtualAct()) focusNativeTarget(pending.sourceView)
    announce(pending.formatter.format("dropCanceled"))
  },
  key: (event: TNativeKeyboardEvent, up = false) => {
    const pending = request
    if (!pending || event.nativeEvent.target !== findNodeHandle(pending.sourceView)) return false
    if (event.nativeEvent.key === "Escape" && !up) {
      event.preventDefault()
      event.stopPropagation()
      void nativeVirtualDrag.cancel().catch((error) => pending.source.fail(error))
      return true
    }
    if (event.nativeEvent.key !== "Enter") return false
    event.preventDefault()
    event.stopPropagation()
    return true
  },
}
