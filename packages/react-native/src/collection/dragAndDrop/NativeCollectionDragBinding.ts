import type { RefObject } from "react"
import { findNodeHandle } from "react-native"
import type { View } from "react-native"

import { encodeCollectionKey } from "../../components/collection"
import { focusNativeTarget } from "../../input/focus"
import type { TNativeDragActionPacket, TNativeDragActions, TNativeDragViewBinding } from "../../input/nativeDragActions"
import NativeModule from "../../input/specs/NativeCUIDragAndDrop"
import type { TNativeKeyboardEvent } from "../../input/types"
import type { TNativeCollectionScrollHost, TNativeCollectionLayoutDelegate } from "../renderer"
import type { TNativeCollectionKey } from "../snapshot"

import { NativeDragController } from "./controller"
import type { TNativeDragSourceOwner, TNativeDragTargetOwner } from "./controller"
import type { TNativeDropFocusSnapshot } from "./dropFocus"
import { captureNativeDropFocus, reconcileNativeDropFocus } from "./dropFocus"
import { publishNativeDragGeometry, readNativeDragGeometry } from "./geometry"
import type { TNativeDragRect } from "./geometry"
import type { TNativeDropKeyboardDelegate } from "./keyboardNavigation"
import { NativeDragDataBinding } from "./nativeData"
import { NativeListDropTargetDelegate } from "./NativeListDropTargetDelegate"
import { nativeDragRuntime } from "./runtime"
import { NATIVE_DIRECTORY_DRAG_TYPE, AVAILABLE_NATIVE_DROP_OPERATIONS } from "./types"
import type {
  TNativeDragPoint,
  TNativeDragTypes,
  TNativeDroppableCollectionProps,
  TNativeDropOperation,
  TNativeDropTarget,
  TNativeDropItem,
  TNativeDropTargetDelegate,
} from "./types"
import type { TNativeDraggableCollectionState } from "./useNativeDraggableCollectionState"
import type { TNativeDroppableCollectionState } from "./useNativeDroppableCollectionState"
import { nativeVirtualDrag } from "./virtualDrag"

type TRow = {
  key: TNativeCollectionKey
  instanceId: string
  owners: Map<object, { view: View; role: "source" | "target" }>
  handle: View | null
  lastView: View | null
}
export type TNativeDropCollectionOptions = TNativeDroppableCollectionProps & {
  dropTargetDelegate?: TNativeDropTargetDelegate
  layoutDelegate?: TNativeCollectionLayoutDelegate
  direction?: "ltr" | "rtl"
  onKeyDown?: (event: TNativeKeyboardEvent) => void
  keyboardDelegate?: TNativeDropKeyboardDelegate
  focusKey?: (key: TNativeCollectionKey) => void
  rootLabel?: string
  scrollRef?: RefObject<TNativeCollectionScrollHost | null>
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Native drag binding: invalid original native record")
  return value as Record<string, unknown>
}
const rect = (value: unknown): TNativeDragRect => {
  const record = object(value)
  for (const key of ["x", "y", "width", "height"])
    if (typeof record[key] !== "number" || !Number.isFinite(record[key]))
      throw new Error("Native drag binding: invalid original rectangle")
  if ((record.width as number) < 0 || (record.height as number) < 0)
    throw new Error("Native drag binding: negative original rectangle")
  return record as TNativeDragRect
}
const offered = (value: unknown): TNativeDropOperation[] => {
  if (!Array.isArray(value) || value.some((item) => !AVAILABLE_NATIVE_DROP_OPERATIONS.includes(item)))
    throw new Error("Native drag binding: invalid original operations")
  return value as TNativeDropOperation[]
}
let serial = 0

export class NativeCollectionDragBinding {
  readonly identity = {}
  readonly id = `native-drag-collection-${++serial}`
  readonly controller = new NativeDragController()
  source: TNativeDraggableCollectionState | null = null
  target: TNativeDroppableCollectionState | null = null
  dropOptions: TNativeDropCollectionOptions = {}
  sourceEnabled = false
  targetEnabled = false
  private rows = new Map<TNativeCollectionKey, TRow>()
  private handles = new Map<TNativeCollectionKey, View>()
  private scroll: { host: object; id: string } | null = null
  private preview: { view: View; id: string; x: number; y: number } | null = null
  private lease: ReturnType<TNativeDragActions["register"]> | null = null
  private bound: View | null = null
  private revision = 0
  private rowSerial = 0
  private querySerial = 0
  private dropFocus: { snapshot: TNativeDropFocusSnapshot; timer?: ReturnType<typeof setTimeout> } | null = null
  private roles = new Set<object>()
  private data: NativeDragDataBinding | null = null
  private currentOwner: () => boolean = () => true
  private failure: (error: unknown) => void = () => {}
  private nativeSource: TNativeDragSourceOwner
  private nativeTarget: TNativeDragTargetOwner

  constructor(
    readonly root: RefObject<View | null>,
    readonly scope: TNativeDragActions | null,
  ) {
    const sourceState = () => {
      if (!this.source) throw new Error("Native drag binding: original source retired")
      return this.source
    }
    const targetState = () => {
      if (!this.target) throw new Error("Native drag binding: original target retired")
      return this.target
    }
    const dropProps = () => this.dropOptions
    this.nativeSource = {
      identity: this.identity,
      current: () => this.current() && !!this.source,
      get state() {
        return sourceState()
      },
    }
    this.nativeTarget = {
      beginDrop: (event, internal, keys) => this.beginDropFocus(event.target, internal, keys),
      identity: this.identity,
      current: () => this.current() && !!this.target && this.scope?.window().canDrop === true,
      get state() {
        return targetState()
      },
      get props() {
        return dropProps()
      },
    }
  }
  configure(current: () => boolean, failure: (error: unknown) => void) {
    this.currentOwner = current
    this.failure = failure
  }
  acquire(owner: object) {
    this.roles.add(owner)
    return () => {
      this.roles.delete(owner)
      nativeDragRuntime.queueMicrotask(() => {
        if (!this.roles.size) this.detach(true)
      })
    }
  }
  logicalCurrent = () => this.roles.size > 0 && !!this.root.current && this.currentOwner()
  current = () => this.logicalCurrent() && this.root.current === this.bound && !!this.lease?.current()
  ready = () => this.current() && !!this.lease?.ready() && this.scope?.window().canLift === true
  retire = () => {
    this.preview = null
    const session = this.controller.activeSession()
    if (session) this.controller.retireSession(session.id)
    if (this.dropFocus) clearTimeout(this.dropFocus.timer)
    this.dropFocus = null
    nativeVirtualDrag.retire(this)
  }
  private view(row: TRow, role: "source" | "target" = "target") {
    const owners = [...row.owners.values()]
    return owners.find((entry) => entry.role === role)?.view ?? owners[0]?.view ?? null
  }
  member(key: TNativeCollectionKey, owner: object, view: View | null, role: "source" | "target" = "source") {
    let row = this.rows.get(key)
    if (!row && view) {
      row = {
        key,
        instanceId: `${this.id}:row:${++this.rowSerial}`,
        owners: new Map(),
        handle: this.handles.get(key) ?? null,
        lastView: view,
      }
      this.rows.set(key, row)
    }
    if (!row) return
    const previous = row.owners.get(owner)?.view ?? null
    if (view) row.owners.set(owner, { view, role })
    else row.owners.delete(owner)
    if (view && previous && previous !== view) row.instanceId = `${this.id}:row:${++this.rowSerial}`
    if (view) row.lastView = view
    if (!row.owners.size) {
      const empty = row
      nativeDragRuntime.queueMicrotask(() => {
        if (this.rows.get(key) === empty && !empty.owners.size) {
          this.rows.delete(key)
          if (this.source?.draggedKey === key) this.controller.endSourceOnUnmount(this.identity)
          this.publish()
        }
      })
    }
    this.publish()
  }
  handle(key: TNativeCollectionKey, view: View | null) {
    if (view) this.handles.set(key, view)
    else this.handles.delete(key)
    const row = this.rows.get(key)
    if (row && row.handle !== view) {
      row.handle = view
      this.publish()
    }
  }
  setPreview(view: View | null, x = 0, y = 0) {
    if (!view) this.preview = null
    else {
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Native drag preview: finite offsets required")
      this.preview = {
        view,
        id: this.preview?.view === view ? this.preview.id : `${this.id}:preview:${++this.rowSerial}`,
        x,
        y,
      }
    }
    this.publish()
  }
  private metadata(): TNativeDragViewBinding {
    const members = [...this.rows.values()].flatMap((row) => {
      const source = this.view(row, "source"),
        target = this.view(row, "target")
      const pair =
        source === target
          ? [{ view: source, role: "both" as const }]
          : [
              { view: source, role: "source" as const },
              { view: target, role: "target" as const },
            ]
      return pair.flatMap(({ view, role }) => {
        const targetTag = view ? findNodeHandle(view) : null
        return targetTag
          ? [
              {
                key: encodeCollectionKey(row.key),
                instanceId: `${row.instanceId}:${role}`,
                targetTag,
                handleTag: role !== "target" && row.handle ? (findNodeHandle(row.handle) ?? 0) : 0,
                role,
              },
            ]
          : []
      })
    })
    const scroll = this.dropOptions.scrollRef?.current
    const candidate = scroll && (scroll.getNativeScrollRef?.() ?? scroll.getScrollRef?.())
    const host = candidate && "getNativeScrollRef" in candidate ? candidate.getNativeScrollRef() : candidate
    if (host && this.scroll?.host !== host) this.scroll = { host, id: `${this.id}:scroll:${++this.rowSerial}` }
    if (!host) this.scroll = null
    return {
      draggable: this.sourceEnabled && !!this.source && !this.source.isDisabled,
      droppable: this.targetEnabled && !!this.target && !this.target.isDisabled,
      members,
      scrollTarget: this.scroll ? (findNodeHandle(this.scroll.host as View) ?? 0) : 0,
      scrollInstanceId: this.scroll?.id ?? "",
      previewTarget: this.preview ? (findNodeHandle(this.preview.view) ?? 0) : 0,
      previewInstanceId: this.preview?.id ?? "",
      previewX: this.preview?.x ?? 0,
      previewY: this.preview?.y ?? 0,
    }
  }
  publish = () => {
    if (this.dropFocus && this.target && this.target.collection !== this.dropFocus.snapshot.collection)
      this.updateDropFocus()
    if (!this.logicalCurrent()) {
      if (!this.root.current || !this.roles.size)
        nativeDragRuntime.queueMicrotask(() => {
          if (!this.root.current || !this.roles.size) this.detach(true)
        })
      else this.detach()
      return
    }
    if (!this.sourceEnabled && !this.targetEnabled) {
      this.detach()
      return
    }
    const view = this.root.current!,
      tag = findNodeHandle(view)
    if (!tag) return
    const metadata = this.metadata()
    if (!metadata.draggable && !metadata.droppable) {
      this.detach()
      return
    }
    if (!this.scope) throw new Error("Native drag/drop collections require an owned NativeKeyboardScope")
    if (this.bound !== view) {
      this.detach()
      this.bound = view
      this.revision++
    }
    if (!this.lease)
      this.lease = this.scope.register({
        bindingId: this.id,
        revision: String(this.revision),
        rootTarget: tag,
        itemTargets: new Set(metadata.members.map((member) => member.targetTag)),
        native: metadata,
        current: () => this.logicalCurrent() && this.root.current === view,
        retire: this.retire,
        dispatch: this.dispatch,
      })
    else this.lease.updateNative(metadata)
    nativeVirtualDrag.reconcile(this)
  }
  detach(unmounted = false) {
    if (!this.lease && !this.bound && !this.controller.activeSession()) return
    if (unmounted) this.controller.endSourceOnUnmount(this.identity)
    this.lease?.unregister()
    this.lease = null
    this.bound = null
    this.retire()
  }
  private rowFor(encoded: unknown, instance?: unknown) {
    if (typeof encoded !== "string") throw new Error("Native drag binding: original encoded key required")
    const row = [...this.rows.values()].find((row) => encodeCollectionKey(row.key) === encoded)
    if (
      !row ||
      (instance !== undefined &&
        ![`${row.instanceId}:both`, `${row.instanceId}:source`, `${row.instanceId}:target`].includes(String(instance)))
    )
      throw new Error("Native drag binding: original row instance retired")
    return row
  }
  private geometry(value: unknown, current: () => boolean, role: "source" | "target") {
    const data = object(value),
      items = data.items
    if (!Array.isArray(items) || typeof data.revision !== "number")
      throw new Error("Native drag binding: original geometry cohort required")
    const rectangles = new Map<TNativeCollectionKey, TNativeDragRect>()
    for (const value of items) {
      const item = object(value),
        row = this.rowFor(item.key, item.instanceId)
      if (item.role && item.role !== "both" && item.role !== role) continue
      const view = this.view(row, role)
      if (!view || findNodeHandle(view) !== item.targetTag || rectangles.has(row.key))
        throw new Error("Native drag binding: native geometry row mismatched")
      rectangles.set(row.key, rect(item.rect))
    }
    const window = this.scope!.window()
    return publishNativeDragGeometry(
      this.root.current!,
      {
        windowId: window.windowId,
        epoch: window.epoch,
        revision: data.revision,
        root: rect(data.root),
        items: rectangles,
      },
      current,
    )
  }
  async measure(
    key: TNativeCollectionKey | null,
    role: "source" | "target" | "handle" = "target",
  ): Promise<TNativeDragRect> {
    const native = NativeModule,
      window = this.scope?.window(),
      lease = this.lease,
      row = key == null ? undefined : this.rows.get(key)
    const memberRole = role === "handle" ? "source" : role
    const originalRow = row ? this.view(row, memberRole) : this.root.current
    const view = role === "handle" && key != null ? this.handleView(key) : originalRow
    if (!native || !window || !lease || !this.current() || !view)
      throw new Error("Native drag geometry: original source is unavailable")
    const requestId = `${this.id}:geometry:${++this.querySerial}`,
      sourceInstance = row?.instanceId
    const request = {
      moduleId: lease.moduleId,
      ownerId: this.scope!.ownerId,
      scopeTarget: window.scopeTarget,
      windowId: window.windowId,
      epoch: window.epoch,
      bindingId: this.id,
      revision: String(this.revision),
      rootTarget: findNodeHandle(this.root.current),
      requestId,
    }
    const response = object(JSON.parse(await native.readGeometry(JSON.stringify(request))))
    if (
      !this.current() ||
      (key != null && this.rows.get(key)?.instanceId !== sourceInstance) ||
      (role === "handle" && key != null
        ? this.handleView(key)
        : row
          ? this.view(row, memberRole)
          : this.root.current) !== view ||
      this.scope?.window().epoch !== window.epoch ||
      response.requestId !== requestId ||
      response.windowId !== window.windowId ||
      response.epoch !== window.epoch
    )
      throw new Error("Native drag geometry: original request retired")
    const geometry = object(response.geometry)
    if (key == null) return rect(geometry.root)
    if (!Array.isArray(geometry.items)) throw new Error("Native drag geometry: original item cohort missing")
    const item = geometry.items
      .map(object)
      .find(
        (item) =>
          item.key === encodeCollectionKey(key) &&
          [`${sourceInstance}:both`, `${sourceInstance}:${memberRole}`].includes(String(item.instanceId)) &&
          item.targetTag === findNodeHandle(originalRow),
      )
    if (!item) throw new Error("Native drag geometry: original source was not materialized")
    if (role === "handle" && item.handleTag !== findNodeHandle(view))
      throw new Error("Native drag geometry: original handle retired")
    return rect(role === "handle" ? item.handleRect : item.rect)
  }
  rowView(key: TNativeCollectionKey) {
    const row = this.rows.get(key)
    return row ? this.view(row, "source") : null
  }
  handleView(key: TNativeCollectionKey) {
    return this.handles.get(key) ?? null
  }
  private beginDropFocus(target: TNativeDropTarget, internal: boolean, keys: Set<TNativeCollectionKey>) {
    if (!this.target) return () => {}
    if (this.dropFocus) clearTimeout(this.dropFocus.timer)
    const pending = {
      snapshot: captureNativeDropFocus(this.target, target, internal, keys),
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
    }
    this.dropFocus = pending
    return () => {
      if (this.dropFocus === pending)
        pending.timer = setTimeout(() => {
          this.updateDropFocus()
          if (this.dropFocus === pending) this.dropFocus = null
        }, 50)
    }
  }
  private updateDropFocus() {
    if (!this.dropFocus || !this.target || !this.nativeTarget.current()) return
    const key = reconcileNativeDropFocus(this.dropFocus.snapshot, this.target)
    if (key != null) {
      if (this.dropOptions.focusKey) this.dropOptions.focusKey(key)
      else focusNativeTarget(this.rowView(key))
    }
  }
  sourceOwner() {
    return this.nativeSource
  }
  targetOwner() {
    return this.nativeTarget
  }
  fail(error: unknown) {
    if (this.logicalCurrent()) this.failure(error)
  }
  virtualTarget(
    id: string,
    target: TNativeDropTarget | null,
    types: TNativeDragTypes,
    operations: TNativeDropOperation[],
  ) {
    if (!this.nativeTarget.current() || !this.session(id, operations)) return "cancel" as const
    return this.controller.targetAt(id, this.nativeTarget, target, types, operations)
  }
  virtualDrop(id: string, items: TNativeDropItem[], point: TNativeDragPoint) {
    return this.controller.drop(id, items, point)
  }
  virtualActivate(id: string, point: TNativeDragPoint) {
    return this.controller.activate(id, point)
  }
  operation(
    target: TNativeDropTarget,
    types: TNativeDragTypes,
    operations: TNativeDropOperation[],
    source: NativeCollectionDragBinding,
  ) {
    if (!this.targetEnabled || !this.nativeTarget.current()) return "cancel" as const
    return (
      this.target?.getDropOperation({
        target,
        types,
        allowedOperations: operations,
        isInternal: source === this,
        draggingKeys: source.source?.draggingKeys ?? new Set(),
      }) ?? "cancel"
    )
  }
  private session(id: string, operations: TNativeDropOperation[]) {
    const active = this.controller.activeSession()
    if (active && active.id !== id) {
      if (active.source) return false
      this.controller.retireSession(active.id)
    }
    if (!this.controller.activeSession()) this.controller.external(id, operations)
    return true
  }
  private targetAt(id: string, point: TNativeDragPoint, types: TNativeDragTypes, allowed: TNativeDropOperation[]) {
    if (!this.target || !this.current() || !this.session(id, allowed)) return "cancel" as const
    const state = this.target,
      active = this.controller.activeSession()!
    const valid = (target: Parameters<typeof state.getDropOperation>[0]["target"]) =>
      state.getDropOperation({
        target,
        types,
        allowedOperations: allowed,
        isInternal: active.source?.identity === this.identity,
        draggingKeys: active.keys,
      }) !== "cancel"
    const visible = []
    const seen = new Set<TNativeCollectionKey>()
    for (
      let key = state.collection.getFirstKey();
      key != null && !seen.has(key);
      key = state.collection.getKeyAfter(key)
    ) {
      seen.add(key)
      const node = state.collection.getItem(key)
      if (node?.type === "item") visible.push(node)
    }
    const delegate =
      this.dropOptions.dropTargetDelegate ??
      new NativeListDropTargetDelegate(visible, this.root, { direction: this.dropOptions.direction })
    const rootRect = readNativeDragGeometry(this.root.current!).root
    let target = delegate.getDropTargetFromPoint(point.x - rootRect.x, point.y - rootRect.y, valid)
    if (target && !valid(target) && valid({ type: "root" })) target = { type: "root" }
    return this.controller.targetAt(id, this.nativeTarget, target, types, allowed)
  }
  dispatch = (packet: TNativeDragActionPacket, current: () => boolean): object => {
    const { identity, payload } = packet
    if (!current() || !this.current()) throw new Error("Native drag binding: original action retired")
    if (
      typeof payload.x !== "number" ||
      !Number.isFinite(payload.x) ||
      typeof payload.y !== "number" ||
      !Number.isFinite(payload.y)
    )
      throw new Error("Native drag binding: original point required")
    const point = { x: payload.x, y: payload.y }
    const release = this.geometry(
      payload.geometry,
      () => current() && this.current(),
      ["lift", "move", "end"].includes(identity.kind) ? "source" : "target",
    )
    try {
      if (identity.kind === "lift") {
        const row = this.rowFor(payload.key, payload.instanceId),
          source = this.source
        if (!source || source.isDisabled || source.selectionManager.isDisabled(row.key))
          return { items: [], operations: [] }
        const old = this.controller.activeSession()
        if (old && !old.source) this.controller.retireSession(old.id)
        const lifted = this.controller.lift(identity.sessionId, this.nativeSource, row.key, {
          ...point,
          type: "dragstart",
        })
        const preview = source.preview?.current
        preview?.(lifted.items, (view, x, y) => {
          if (
            this.current() &&
            (view === null || this.source?.preview?.current === preview) &&
            this.controller.activeSession() === lifted.session
          )
            this.setPreview(view, x, y)
        })
        return {
          items: lifted.transferItems!.map((item) => Object.entries(item).map(([type, data]) => ({ type, data }))),
          operations: lifted.allowedOperations,
          previewExpected: !!source.preview?.current,
        }
      }
      if (identity.kind === "move")
        return { moved: this.controller.move(identity.sessionId, { ...point, type: "dragmove" }) }
      if (identity.kind === "exit") {
        this.controller.leave(identity.sessionId, this.nativeTarget)
        return { exited: true }
      }
      if (identity.kind === "end") {
        if (payload.external && this.controller.activeSession()?.source) return { ended: false }
        const operation = offered([payload.operation])[0]
        this.setPreview(null)
        return { ended: this.controller.end(identity.sessionId, point, operation) }
      }
      if (identity.kind === "activate") {
        if (payload.expectedTarget) {
          const expected = object(payload.expectedTarget),
            target = this.controller.dropTarget()
          if (
            target?.type !== "item" ||
            encodeCollectionKey(target.key) !== expected.key ||
            target.dropPosition !== expected.position
          )
            return { activated: false }
          const row = this.rowFor(expected.key, expected.instanceId),
            view = this.view(row, "target")
          if (!view || findNodeHandle(view) !== expected.targetTag) return { activated: false }
        }
        return { activated: this.controller.activate(identity.sessionId, point) }
      }
      if (!Array.isArray(payload.types) || payload.types.some((type) => typeof type !== "string"))
        throw new Error("Native drop binding: original types required")
      const types = new Set<string | symbol>(payload.types as string[])
      if (payload.directory) types.add(NATIVE_DIRECTORY_DRAG_TYPE)
      const operation = this.targetAt(identity.sessionId, point, types, offered(payload.operations))
      if (identity.kind === "target") {
        const target = this.controller.dropTarget()
        const member =
          target?.type === "item"
            ? this.metadata().members.find(
                (member) => member.key === encodeCollectionKey(target.key) && member.role !== "source",
              )
            : null
        return {
          operation,
          target:
            member && target?.type === "item"
              ? { ...member, position: target.dropPosition, activate: !!this.dropOptions.onDropActivate }
              : null,
        }
      }
      if (operation === "cancel") return { accepted: false, operation }
      if (typeof payload.dataHandle !== "string")
        throw new Error("Native drop binding: original transfer handle required")
      const data = (this.data ??= new NativeDragDataBinding())
      const pending = this.controller.drop(
        identity.sessionId,
        data.takeItems(payload.dataHandle, this.nativeTarget.current),
        point,
      )
      pending.catch((error) => {
        if (this.logicalCurrent()) this.failure(error)
      })
      return { accepted: true, operation }
    } finally {
      release()
    }
  }
}
