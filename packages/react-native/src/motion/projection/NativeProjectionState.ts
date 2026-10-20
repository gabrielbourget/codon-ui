import type { RefObject } from "react"
import type { View } from "react-native"

import { observeNativeMotionGeometry } from "../../input/motionGeometry"
import type { TNativeMotionGeometryRecord } from "../../input/motionGeometry"
import { cancelFrame, frame } from "../kernel"
import type { NativeMotionOwner } from "../owner/NativeMotionOwner"
import type { TNativePopFrame, TNativePopRoot } from "../presence/context"
import { createNativePopRoot } from "../presence/nativePopFrame"
import type { TNativeMotionTransformTemplate } from "../visual/types"

import { NativeMotionLayoutCallbacks } from "./layoutCallbacks"
import { getValueTransition } from "./native-transition"
import { cancelNativeProjectionMicrotask, microtask } from "./nativeRuntime"
import { nativeProjectionStyles } from "./nativeStyles"
import type { TNativeProjectionRadii } from "./nativeStyles"
import { createProjectionNode } from "./node/create-projection-node"
import type { IProjectionNode, ProjectionNodeOptions } from "./node/types"
import type { Box, NativeProjectionInstance, NativeProjectionStyle, Transition, VisualElement } from "./types"

const NativeProjectionNode = createProjectionNode({
  measureScroll: (instance) => instance.measureScroll(),
  checkIsScrollRoot: (instance) => instance.isScrollRoot(),
})
type TSnapshot = Readonly<{ style: NativeProjectionStyle; visible: boolean; radii: string }>
export const EMPTY_NATIVE_PROJECTION: TSnapshot = Object.freeze({ style: Object.freeze({}), visible: true, radii: "" })
type TCohort = {
  before: Map<NativeProjectionState, TNativeMotionGeometryRecord>
  after: Map<NativeProjectionState, TNativeMotionGeometryRecord>
  timer: ReturnType<typeof setTimeout>
}
const roots = new Map<string, NativeProjectionWindow>()
const rectBox = (rect: readonly number[]): Box => ({
  x: { min: rect[0], max: rect[0] + rect[2] },
  y: { min: rect[1], max: rect[1] + rect[3] },
})

class NativeProjectionWindow {
  readonly members = new Set<NativeProjectionState>()
  readonly pending = new Set<NativeProjectionState>()
  readonly node: IProjectionNode
  private readonly cohorts = new Map<string, TCohort>()
  phase?: { cohort: TCohort; kind: "before" | "after" }
  private windowRecord: TNativeMotionGeometryRecord
  constructor(
    readonly key: string,
    record: TNativeMotionGeometryRecord,
  ) {
    this.windowRecord = record
    const members = this.members
    const instance: NativeProjectionInstance = {
      get isConnected() {
        return [...members].some((member) => member.current())
      },
      isCurrent: () => [...this.members].some((member) => member.current()),
      windowWidth: () => this.windowRecord.snapshot!.root.box[2],
      measureNative: () => ({
        measuredBox: rectBox(this.windowRecord.snapshot!.root.box),
        layoutBox: rectBox(this.windowRecord.snapshot!.root.box),
      }),
      measureScroll: () => ({ x: 0, y: 0 }),
      isScrollRoot: () => true,
      applyNativeProjection: () => {},
    }
    this.node = new NativeProjectionNode({})
    this.node.mount(instance)
    this.node.setOptions({ layoutScroll: true })
  }
  add = (member: NativeProjectionState) => {
    this.members.add(member)
  }
  request = (member: NativeProjectionState) => {
    this.pending.add(member)
  }
  receive = (member: NativeProjectionState, record: TNativeMotionGeometryRecord) => {
    this.windowRecord = record
    if (
      !this.pending.size ||
      !record.transactionId ||
      (record.kind !== "mount-before" && record.kind !== "mount-after")
    )
      return
    let cohort = this.cohorts.get(record.transactionId)
    if (!cohort) {
      const transaction = record.transactionId
      cohort = {
        before: new Map(),
        after: new Map(),
        timer: setTimeout(() => {
          this.cohorts.delete(transaction)
          if (this.pending.size)
            for (const actor of this.pending)
              actor.fail(new Error("Native projection: matching mount cohort exceeded 5000ms"))
        }, 5000),
      }
      this.cohorts.set(transaction, cohort)
    }
    cohort[record.kind === "mount-before" ? "before" : "after"].set(member, record)
    microtask.read(this.process)
  }
  private process = () => {
    for (const [id, cohort] of this.cohorts) {
      const members = [...this.members].filter((actor) => actor.current())
      if (!members.every((actor) => cohort.after.has(actor) && (cohort.before.has(actor) || actor.bornIn === id)))
        continue
      if (![...this.pending].every((actor) => !actor.current() || actor.accepts(cohort.after.get(actor)))) continue
      try {
        this.phase = { cohort, kind: "before" }
        for (const actor of this.pending) if (actor.current()) actor.beforeUpdate()
        this.phase = { cohort, kind: "after" }
        this.node.update()
        const completed = [...this.pending]
        this.pending.clear()
        for (const actor of completed) actor.applied()
      } catch (error) {
        for (const actor of this.pending) actor.fail(error)
      } finally {
        this.phase = undefined
        clearTimeout(cohort.timer)
        this.cohorts.delete(id)
      }
    }
  }
  measurement = (actor: NativeProjectionState) => this.phase?.cohort[this.phase.kind].get(actor) ?? actor.record
  remove = (member: NativeProjectionState) => {
    this.members.delete(member)
    this.pending.delete(member)
    if (this.members.size) {
      microtask.read(this.process)
      return
    }
    for (const cohort of this.cohorts.values()) clearTimeout(cohort.timer)
    this.cohorts.clear()
    cancelNativeProjectionMicrotask(this.process)
    this.node.resetTree()
    this.node.unmount()
    roots.delete(this.key)
  }
}

export class NativeProjectionState implements TNativePopRoot {
  private readonly layoutCallbacks = new NativeMotionLayoutCallbacks()
  record?: TNativeMotionGeometryRecord
  node?: IProjectionNode
  bornIn?: string
  private root?: NativeProjectionWindow
  private target?: View
  private lease: () => boolean = () => false
  private readonly latest: Record<string, number | string> = {}
  private snapshot: TSnapshot = EMPTY_NATIVE_PROJECTION
  private readonly listeners = new Set<() => void>()
  private stopGeometry?: () => void
  private stopValues?: () => void
  private releaseGroup?: () => void
  private group?: { add: (node: IProjectionNode) => void; remove: (node: IProjectionNode) => void }
  private namespace?: string
  private intent = ""
  private dependency: unknown
  private wasPresent?: boolean
  private wantsUpdate = true
  private authored: NativeProjectionStyle = {}
  private template?: TNativeMotionTransformTemplate
  private readonly popRoot = createNativePopRoot(() => this.target, {
    isCurrent: () => Boolean(this.target && this.owner.current === this.target && this.lease()),
  })
  private writer?: (snapshot: TSnapshot) => void
  private safeToRemove?: () => void
  private readonly children = new Set<NativeProjectionState>()
  constructor(
    readonly owner: NativeMotionOwner,
    private readonly parent: NativeProjectionState | undefined,
    private readonly error: (error: unknown) => void,
  ) {
    owner.nativeProjection = this
  }
  current = () => Boolean(this.target && this.owner.current === this.target && this.lease() && this.record?.attached)
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  attachWriter = (writer: (snapshot: TSnapshot) => void) => {
    this.writer = writer
    return () => {
      if (this.writer === writer) this.writer = undefined
    }
  }
  private publish = (style: NativeProjectionStyle, visible = true, radii?: TNativeProjectionRadii) => {
    if (!this.current()) return
    this.snapshot = Object.freeze({
      style: Object.freeze({ ...style }),
      visible,
      radii: radii ? JSON.stringify(radii) : "",
    })
    this.writer?.(this.snapshot)
    this.listeners.forEach((listener) => listener())
  }
  private updateValues = () => {
    const values = { ...this.authored, ...this.owner.latestValues }
    for (const key of Object.keys(this.latest)) if (!(key in values)) delete this.latest[key]
    for (const [key, value] of Object.entries(values))
      if (typeof value === "string" || typeof value === "number") this.latest[key] = value
    if (this.node) {
      this.node.isTransformDirty = true
      this.node.root?.scheduleUpdateProjection()
      this.node.scheduleRender()
    }
  }
  private options = (): ProjectionNodeOptions => {
    const props = this.owner.getProps()
    return {
      layout: props.layout,
      layoutId: props.layoutId ? (this.namespace ? `${this.namespace}-${props.layoutId}` : props.layoutId) : undefined,
      layoutDependency: props.layoutDependency,
      layoutAnchor: props.layoutAnchor,
      layoutScroll: props.layoutScroll,
      layoutRoot: props.layoutRoot,
      crossfade: props.layoutCrossfade,
      animationType: typeof props.layout === "string" ? props.layout : "both",
      animate: !this.owner.isStatic(),
      alwaysMeasureLayout: Boolean(props.drag && props.dragConstraints),
      onExitComplete: () => this.safeToRemove?.(),
    }
  }
  configure = (
    intent: string,
    authored: NativeProjectionStyle,
    template: TNativeMotionTransformTemplate | undefined,
    group: NativeProjectionState["group"],
    namespace: string | undefined,
    safeToRemove?: () => void,
  ) => {
    const props = this.owner.getProps(),
      present = this.owner.presenceContext?.isPresent
    if (this.target && !this.lease()) {
      this.detachNode()
      this.record = undefined
      this.popRoot.dispose()
      this.lease = this.owner.captureVisualLease()
    }
    this.wantsUpdate = Boolean(
      props.drag ||
      props.layoutDependency === undefined ||
      this.dependency !== props.layoutDependency ||
      this.wasPresent !== present,
    )
    this.dependency = props.layoutDependency
    this.wasPresent = present
    this.authored = authored
    this.template = template
    this.safeToRemove = safeToRemove
    if (this.group !== group) {
      this.releaseGroup?.()
      this.group = group
      if (this.node && group) {
        group.add(this.node)
        this.releaseGroup = () => group.remove(this.node!)
      }
    }
    this.namespace = namespace
    this.intent = intent
    this.updateValues()
    if (this.node) {
      this.node.setOptions(this.options())
      this.node.isPresent = present !== false
    }
    if (this.root && (props.layout || props.layoutId || props.drag)) this.root.request(this)
    if (!this.wantsUpdate) this.safeToRemove?.()
    const transition = this.node?.options.transition ?? (this.owner.getDefaultTransition() as Transition | undefined)
    const reduce = getValueTransition(transition, "layout").reduceMotion
    if (this.owner.shouldSkipAnimations || reduce === true || (reduce !== false && this.owner.shouldReduceMotion))
      this.node?.currentAnimation?.complete()
  }
  attach = (target: View) => {
    this.detach()
    this.parent?.children.add(this)
    this.target = target
    this.lease = this.owner.captureVisualLease()
    this.stopGeometry = observeNativeMotionGeometry(target, this.receive)
    this.stopValues = this.owner.subscribeProjectionValues(this.updateValues)
    return () => {
      if (this.target === target) this.detach()
    }
  }
  private receive = (record: TNativeMotionGeometryRecord | undefined) => {
    if (!record?.attached || !record.snapshot || !this.lease()) {
      if (this.node) this.detachNode()
      this.record = undefined
      this.popRoot.dispose()
      return
    }
    const key = `${record.windowId}/${record.snapshot.rootIdentity}`
    if (
      this.record &&
      (this.record.windowId !== record.windowId ||
        this.record.epoch !== record.epoch ||
        this.record.bindingId !== record.bindingId ||
        this.record.attachmentRevision !== record.attachmentRevision)
    )
      this.popRoot.dispose()
    if (this.root && this.root.key !== key) this.detachNode()
    this.record = record
    this.popRoot.retireIfChanged()
    this.ensureNode()
    this.root?.receive(this, record)
    for (const child of this.children) child.ensureNode()
  }
  private ensureNode = () => {
    if (this.node || !this.record?.snapshot || !this.current() || this.owner.isStatic()) return
    if (this.parent?.target && !this.parent.record && !this.owner.getProps().nativeLayoutPortal) return
    const record = this.record,
      key = `${record.windowId}/${record.snapshot!.rootIdentity}`
    this.root = roots.get(key) ?? new NativeProjectionWindow(key, record)
    roots.set(key, this.root)
    this.root.add(this)
    this.bornIn = record.kind === "mount-after" ? record.transactionId : undefined
    const nativeParent =
      !this.owner.getProps().nativeLayoutPortal && this.parent?.root === this.root ? this.parent.node : undefined
    const current = this.current
    const instance: NativeProjectionInstance = {
      get isConnected() {
        return current()
      },
      isCurrent: this.current,
      windowWidth: () => this.record!.snapshot!.root.box[2],
      measureNative: () => this.measure(),
      shouldSkipAnimations: () => this.owner.shouldSkipAnimations,
      measureScroll: () => {
        const scroll = this.record!.snapshot!.ancestors[0].scroll
        return { x: scroll[0], y: scroll[1] }
      },
      isScrollRoot: () => Boolean(this.owner.getProps().layoutRoot),
      applyNativeProjection: (node) => {
        let radii: TNativeProjectionRadii | undefined
        const direction = this.record!.snapshot!.ancestors[0].layoutDirection
        const style = nativeProjectionStyles(
          node,
          this.authored,
          this.template,
          (correction) => {
            radii = correction
          },
          { direction },
        )
        this.publish(style, node.isVisible, radii)
      },
    }
    const getStyle = () => this.authored
    const getReducedMotion = () => this.owner.shouldReduceMotion
    const visual: VisualElement = {
      props: {
        get style() {
          return getStyle()
        },
      },
      current: instance,
      latestValues: this.latest,
      get shouldReduceMotion() {
        return getReducedMotion()
      },
      getProps: () => this.owner.getProps(),
      getDefaultTransition: () => this.owner.getDefaultTransition() as Transition | undefined,
      getTransformPagePoint: this.owner.getTransformPagePoint,
      getValue: this.owner.getValue.bind(this.owner),
      mount: () => {},
      setStaticValue: () => {
        throw new Error("Native projection: mounted transform probes are forbidden")
      },
      render: this.render,
      scheduleRender: () => {
        frame.render(this.render)
      },
      notify: (event, ...args) => {
        if (!this.current() || this.node?.options.visualElement !== visual) return
        this.layoutCallbacks.update(this.owner.getProps())
        this.layoutCallbacks.notify(event, ...args)
      },
    }
    this.node = new NativeProjectionNode(this.latest, nativeParent ?? this.root.node)
    this.node.setOptions({ ...this.options(), visualElement: visual })
    this.node.mount(instance)
    this.node.path.forEach((ancestor) => ancestor.updateScroll("measure"))
    this.node.updateScroll("measure")
    this.node.layout = this.node.measure(false)
    this.owner.setProjection(this.node)
    if (this.group) {
      this.group.add(this.node)
      this.releaseGroup = () => this.group?.remove(this.node!)
    }
    if (this.owner.getProps().layout || this.owner.getProps().layoutId || this.owner.getProps().drag)
      this.root.request(this)
  }
  accepts = (record: TNativeMotionGeometryRecord | undefined) =>
    record?.snapshot?.ancestors[0].projectionRevision === this.intent
  beforeUpdate = () => {
    if (!this.node || !this.wantsUpdate) return
    this.node.isPresent = this.owner.presenceContext?.isPresent !== false
    this.node.willUpdate()
    if (!this.node.isPresent) this.node.relegate()
    else this.node.promote()
  }
  applied = () => {
    this.wantsUpdate = false
    if (this.isSettled()) this.safeToRemove?.()
  }
  isSettled = () =>
    Boolean(
      this.node &&
      !this.root?.pending.has(this) &&
      !this.node.currentAnimation &&
      !this.node.pendingAnimation &&
      this.node.isLead(),
    )
  private measure = () => {
    const record = this.root?.measurement(this) ?? this.record
    if (!record?.snapshot || !this.current())
      throw new Error("Native projection: matching actual native geometry unavailable")
    const transform = this.owner.getTransformPagePoint()
    const convert = (box: Box) => {
      if (!transform) return box
      const min = transform({ x: box.x.min, y: box.y.min }),
        max = transform({ x: box.x.max, y: box.y.max })
      if (![min.x, min.y, max.x, max.y].every(Number.isFinite))
        throw new Error("Native projection: invalid native point transform")
      return { x: { min: min.x, max: max.x }, y: { min: min.y, max: max.y } }
    }
    return {
      measuredBox: convert(rectBox(record.snapshot.model.box)),
      layoutBox: convert(rectBox(record.snapshot.untransformed.box)),
    }
  }
  render = () => {
    if (!this.current()) return
    try {
      if (this.node) this.node.applyProjectionStyles({}, this.authored)
    } catch (error) {
      this.fail(error)
    }
  }
  fail = (error: unknown) => {
    if (this.current()) this.error(error)
  }
  read = (root?: RefObject<View | null>): TNativePopFrame => {
    return this.popRoot.read(root)
  }
  freeze = (frame: TNativePopFrame, anchorX: "left" | "right", anchorY: "top" | "bottom") => {
    return this.popRoot.freeze(frame, anchorX, anchorY)
  }
  isCurrent = (frame: TNativePopFrame) => this.popRoot.isCurrent(frame)
  private detachNode = () => {
    this.layoutCallbacks.clear()
    this.releaseGroup?.()
    this.releaseGroup = undefined
    const node = this.node,
      root = this.root
    this.node = undefined
    this.root = undefined
    if (node) {
      node.currentAnimation?.stop()
      node.unmount()
    }
    if (this.owner.projection === node) this.owner.setProjection(undefined)
    root?.remove(this)
    cancelFrame(this.render)
    this.snapshot = EMPTY_NATIVE_PROJECTION
    this.listeners.forEach((listener) => listener())
  }
  detach = () => {
    this.popRoot.dispose()
    this.parent?.children.delete(this)
    this.detachNode()
    this.stopGeometry?.()
    this.stopGeometry = undefined
    this.stopValues?.()
    this.stopValues = undefined
    this.target = undefined
    this.record = undefined
    this.snapshot = EMPTY_NATIVE_PROJECTION
    this.writer = undefined
  }
}
