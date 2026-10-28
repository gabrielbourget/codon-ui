import type { TNativeCollectionKey } from "../snapshot"

import { dispatchNativeCollectionDrop } from "./drop"
import { retireNativeDragState } from "./retirement"
import { AVAILABLE_NATIVE_DROP_OPERATIONS } from "./types"
import type {
  TNativeDragItem,
  TNativeDragMoveEvent,
  TNativeDragPoint,
  TNativeDropEvent,
  TNativeDragStartEvent,
  TNativeDragTypes,
  TNativeDroppableCollectionProps,
  TNativeDropItem,
  TNativeDropOperation,
  TNativeDropTarget,
} from "./types"
import type { TNativeDraggableCollectionState } from "./useNativeDraggableCollectionState"
import type { TNativeDroppableCollectionState } from "./useNativeDroppableCollectionState"

export type TNativeDragSourceOwner = {
  identity: object
  current: () => boolean
  state: TNativeDraggableCollectionState
}
export type TNativeDragTargetOwner = {
  identity: object
  current: () => boolean
  state: TNativeDroppableCollectionState
  props: TNativeDroppableCollectionProps
  prepareDrop?: (
    target: TNativeDropTarget,
    internal: boolean,
    keys: Set<TNativeCollectionKey>,
  ) => { ready: boolean | Promise<boolean>; finish: () => void }
  beginDrop?: (event: TNativeDropEvent, internal: boolean, keys: Set<TNativeCollectionKey>) => () => void
}
export type TNativeDragSession = Readonly<{
  id: string
  source: TNativeDragSourceOwner | null
  keys: Set<TNativeCollectionKey>
  virtual: boolean
  allowedOperations: readonly TNativeDropOperation[]
}>
type TTarget = {
  owner: TNativeDragTargetOwner
  target: TNativeDropTarget
  operation: TNativeDropOperation
  generation: number
}
const point = (event: TNativeDragPoint) => Number.isFinite(event.x) && Number.isFinite(event.y)
const operations = (values: readonly TNativeDropOperation[]): TNativeDropOperation[] => {
  if (!Array.isArray(values) || values.some((value) => !AVAILABLE_NATIVE_DROP_OPERATIONS.includes(value)))
    throw new Error("Native drag action: invalid original drop operation")
  return [...values]
}
const items = (values: TNativeDragItem[]) => {
  if (!Array.isArray(values)) throw new Error("Native drag action: getItems must return an array")
  return values.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Native drag action: getItems must return representation maps")
    const entries = Object.entries(value)
    if (entries.some(([, data]) => typeof data !== "string"))
      throw new Error("Native drag action: each original representation must be a string")
    // Read each authored representation only at lift, exactly once, after start.
    return Object.fromEntries(entries)
  })
}

export class NativeDragController {
  private session: TNativeDragSession | null = null
  private target: TTarget | null = null
  private lastDrop: { session: TNativeDragSession; identity: object; operation: TNativeDropOperation } | null = null
  private generation = 0
  private revision = 0
  private listeners = new Set<() => void>()
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  readonly snapshot = () => this.revision
  readonly isVirtualDragging = () => this.session?.virtual ?? false
  readonly activeSession = () => this.session

  private changed() {
    this.revision++
    for (const listener of [...this.listeners]) listener()
  }

  private current(session: TNativeDragSession) {
    return this.session === session && (!session.source || session.source.current())
  }

  lift(
    id: string,
    source: TNativeDragSourceOwner,
    key: TNativeCollectionKey,
    event: TNativeDragStartEvent,
    virtual = false,
  ) {
    if (
      !id ||
      this.session ||
      !source.current() ||
      source.state.isDisabled ||
      !point(event) ||
      !source.state.collection.getItem(key)
    )
      throw new Error("Native drag action: original lift authority is unavailable")
    let session: TNativeDragSession = {
      id,
      source,
      keys: new Set(),
      virtual,
      allowedOperations: [],
    }
    this.session = session
    try {
      source.state.startDrag(key, event)
      if (!this.current(session)) throw new Error("Native drag action: owner retired during onDragStart")
      const originalItems = source.state.getItems(key)
      if (!Array.isArray(originalItems)) throw new Error("Native drag action: getItems must return an array")
      const payload = virtual ? null : items(originalItems)
      if (!this.current(session)) throw new Error("Native drag action: owner retired during getItems")
      const lookup = source.state.getAllowedDropOperations
      const allowed = operations(lookup ? lookup() : virtual ? ["move", "copy", "link"] : ["copy", "link", "move"])
      if (!this.current(session)) throw new Error("Native drag action: owner retired during operation lookup")
      session = { ...session, keys: source.state.draggingKeys, allowedOperations: allowed }
      this.session = session
      this.changed()
      return { session, items: originalItems, transferItems: payload, allowedOperations: allowed }
    } catch (error) {
      if (this.session === session) this.session = null
      retireNativeDragState(source.state)
      this.changed()
      throw error
    }
  }

  external(id: string, allowedOperations: readonly TNativeDropOperation[]) {
    if (!id || this.session) throw new Error("Native drag action: external session conflicts with an original drag")
    const session: TNativeDragSession = {
      id,
      source: null,
      keys: new Set(),
      virtual: false,
      allowedOperations: operations(allowedOperations),
    }
    this.session = session
    this.changed()
    return session
  }

  move(id: string, event: TNativeDragMoveEvent) {
    const session = this.session
    if (!session || session.id !== id || !this.current(session) || !point(event)) return false
    session.source?.state.moveDrag(event)
    return this.current(session)
  }

  private clearTarget(notify = true) {
    const old = this.target
    this.target = null
    if (!old) return
    if (notify && old.owner.current()) old.owner.state.setTarget(null)
    else retireNativeDragState(old.owner.state)
  }

  targetAt(
    id: string,
    owner: TNativeDragTargetOwner,
    target: TNativeDropTarget | null,
    types: TNativeDragTypes,
    offered: readonly TNativeDropOperation[],
  ) {
    const session = this.session
    if (!session || session.id !== id || !this.current(session) || !owner.current() || owner.state.isDisabled)
      return "cancel" as const
    const allowedOperations = operations(offered).filter((operation) => session.allowedOperations.includes(operation))
    const operation = target
      ? owner.state.getDropOperation({
          target,
          types,
          allowedOperations,
          isInternal: session.source?.identity === owner.identity,
          draggingKeys: session.keys,
        })
      : "cancel"
    if (!this.current(session) || !owner.current()) return "cancel" as const
    if (!target || operation === "cancel" || !allowedOperations.includes(operation)) {
      this.clearTarget()
      this.changed()
      return "cancel" as const
    }
    if (this.target?.owner.identity !== owner.identity) this.clearTarget()
    if (!this.current(session) || !owner.current()) return "cancel" as const
    if (
      this.target?.owner.identity === owner.identity &&
      this.target.operation === operation &&
      owner.state.isDropTarget(target)
    )
      return operation
    owner.state.setTarget(target)
    if (!this.current(session) || !owner.current()) return "cancel" as const
    this.target = { owner, target, operation, generation: ++this.generation }
    this.changed()
    return operation
  }

  dropTarget() {
    return this.target?.target ?? null
  }

  activate(id: string, event: TNativeDragPoint) {
    const session = this.session
    const target = this.target
    if (!session || session.id !== id || !this.current(session) || !target?.owner.current() || !point(event))
      return false
    target.owner.props.onDropActivate?.({ ...event, type: "dropactivate", target: target.target })
    return this.current(session) && target.owner.current()
  }

  leave(id: string, owner: TNativeDragTargetOwner) {
    if (this.session?.id !== id || this.target?.owner.identity !== owner.identity) return
    this.clearTarget()
    this.changed()
  }

  async drop(id: string, data: TNativeDropItem[] | Promise<TNativeDropItem[]>, eventPoint: TNativeDragPoint) {
    const session = this.session
    const target = this.target
    if (!session || session.id !== id || !this.current(session) || !target?.owner.current() || !point(eventPoint))
      throw new Error("Native drop action: original target authority is unavailable")
    this.lastDrop = { session, identity: target.owner.identity, operation: target.operation }
    const internal = session.source?.identity === target.owner.identity
    let admission: ReturnType<NonNullable<TNativeDragTargetOwner["prepareDrop"]>> | undefined
    try {
      admission = target.owner.prepareDrop?.(target.target, internal, session.keys)
      const resolved = Array.isArray(data) ? data : await data
      const admitted = !admission || (typeof admission.ready === "boolean" ? admission.ready : await admission.ready)
      if (!admitted || !target.owner.current()) {
        for (const item of resolved) item.release()
        return
      }
      // Async business callbacks and retained transfer values outlive OS drag
      // end. Original collection/window authority, rather than drag visibility,
      // guards subsequent specialized callbacks after each awaited handler.
      const event: TNativeDropEvent = {
        ...eventPoint,
        type: "drop",
        target: target.target,
        dropOperation: target.operation,
        items: resolved,
      }
      const dispatched = target.owner.beginDrop?.(event, internal, session.keys)
      const pending = dispatchNativeCollectionDrop(
        target.owner.props,
        event,
        internal,
        session.keys,
        target.owner.current,
      )
      dispatched?.()
      await pending
    } finally {
      admission?.finish()
      if (this.target?.generation === target.generation) {
        this.clearTarget()
        this.changed()
      }
    }
  }

  end(id: string, event: TNativeDragPoint, dropOperation: TNativeDropOperation) {
    const session = this.session
    if (!session || session.id !== id || !point(event)) return false
    operations([dropOperation])
    const isInternal =
      !!session.source && this.lastDrop?.session === session && this.lastDrop.identity === session.source.identity
    try {
      if (session.source?.current())
        session.source.state.endDrag({
          ...event,
          type: "dragend",
          dropOperation,
          keys: session.keys,
          isInternal,
        })
    } finally {
      if (session.source) retireNativeDragState(session.source.state)
      if (this.session === session) this.session = null
      this.clearTarget()
      if (this.lastDrop?.session === session) this.lastDrop = null
      this.changed()
    }
    return true
  }

  endSourceOnUnmount(identity: object) {
    const session = this.session
    if (!session?.source || session.source.identity !== identity) return false
    const drop = this.lastDrop?.session === session ? this.lastDrop : null
    try {
      session.source.state.endDrag({
        type: "dragend",
        x: 0,
        y: 0,
        keys: session.keys,
        dropOperation: drop?.operation ?? "cancel",
        isInternal: !!drop && drop.identity === identity,
      })
    } finally {
      this.retireSession(session.id)
    }
    return true
  }

  retireSession(id: string) {
    const session = this.session
    if (!session || session.id !== id) return
    if (session.source) retireNativeDragState(session.source.state)
    this.clearTarget(false)
    this.session = null
    if (this.lastDrop?.session === session) this.lastDrop = null
    this.changed()
  }

  retire(identity: object) {
    if (this.target?.owner.identity === identity) this.clearTarget(false)
    if (this.session?.source?.identity === identity) {
      retireNativeDragState(this.session.source.state)
      this.session = null
      this.clearTarget()
    }
    if (this.lastDrop?.identity === identity || this.lastDrop?.session.source?.identity === identity)
      this.lastDrop = null
    this.changed()
  }
}
