// Motion12.40 InViewFeature lifecycle adapted to immutable native Fabric input.
import type { HostInstance, View } from "react-native"

import { observeNativeMotionGeometry } from "../../input/motionGeometry"
import type { TNativeMotionGeometryRecord } from "../../input/motionGeometry"
import { cancelFrame, frame } from "../kernel"
import type { NativeMotionOwner } from "../owner/NativeMotionOwner"

import { readNativeViewport, resolveNativeViewportRoot } from "./nativeViewport"
import { nativeViewportMargins, nativeViewportThreshold } from "./types"
import type { TNativeViewportEntry, TNativeViewportOptions } from "./types"

export class NativeMotionViewport {
  private target?: View
  private stop?: () => void
  private lease: () => boolean = () => false
  private options?: TNativeViewportOptions
  private root?: HostInstance | null
  private threshold = 0
  private margins = nativeViewportMargins()
  private once = false
  private isInView = false
  private hasEnteredView = false
  private thresholdIndex = -1
  private wasIntersecting?: boolean
  private started = false
  private generation = 0
  private latestRecord?: TNativeMotionGeometryRecord
  private queued: { entry: TNativeViewportEntry; current: () => boolean }[] = []
  constructor(
    private readonly owner: NativeMotionOwner,
    private readonly error: (error: unknown) => void,
  ) {}
  refresh = () => {
    const props = this.owner.getProps()
    if (this.owner.isStatic() || !this.owner.current) {
      this.detach()
      return
    }
    if (
      !this.started &&
      props.whileInView === undefined &&
      props.onViewportEnter === undefined &&
      props.onViewportLeave === undefined
    )
      return
    const next = props.viewport ?? {}
    if (
      this.target === this.owner.current &&
      this.lease() &&
      this.options &&
      ["amount", "margin", "root"].every(
        (key) => this.options?.[key as keyof TNativeViewportOptions] === next[key as keyof TNativeViewportOptions],
      )
    )
      return
    const sameAttachment = this.target === this.owner.current && this.lease()
    this.stopObservation()
    if (!sameAttachment) {
      this.isInView = false
      this.hasEnteredView = false
    }
    this.started = true
    this.target = this.owner.current
    this.lease = this.owner.captureVisualLease()
    try {
      this.root = resolveNativeViewportRoot(next.root?.current)
    } catch (error) {
      this.options = undefined
      this.root = undefined
      this.error(error)
      return
    }
    this.options = { ...next }
    this.once = next.once ?? false
    this.threshold = nativeViewportThreshold(next.amount)
    this.margins = nativeViewportMargins(next.margin)
    const target = this.target,
      generation = this.generation
    const current = () => this.target === target && this.generation === generation && this.lease()
    this.stop = observeNativeMotionGeometry(target, (record) => {
      if (!current()) return
      this.latestRecord = record
      if (!record?.attached) return
      try {
        const entry = readNativeViewport(
          target,
          this.root,
          record,
          this.margins,
          () => current() && this.latestRecord === record,
        )
        // IO queues on initial observation, threshold bucket changes, or a
        // geometric intersecting-state change. Motion separately deduplicates.
        const index = entry.intersectionRatio >= this.threshold ? 1 : 0
        if (this.thresholdIndex !== index || this.wasIntersecting !== entry.isIntersecting) {
          this.thresholdIndex = index
          this.wasIntersecting = entry.isIntersecting
          this.queued.push({ entry, current })
          frame.postRender(this.flush)
        }
      } catch (error) {
        if (current()) this.error(error)
      }
    })
  }
  private flush = () => {
    const pending = this.queued
    this.queued = []
    for (const { entry, current } of pending) {
      if (!current() || entry.isIntersecting === this.isInView) continue
      this.isInView = entry.isIntersecting
      if (this.once && !entry.isIntersecting && this.hasEnteredView) continue
      if (entry.isIntersecting) this.hasEnteredView = true
      try {
        void this.owner.animationState.setActive("whileInView", entry.isIntersecting).catch((error: unknown) => {
          if (current()) this.error(error)
        })
        const props = this.owner.getProps()
        const callback = entry.isIntersecting ? props.onViewportEnter : props.onViewportLeave
        callback?.(entry)
      } catch (error) {
        if (current()) this.error(error)
      }
    }
  }
  private stopObservation = () => {
    this.generation++
    this.stop?.()
    this.stop = undefined
    this.latestRecord = undefined
    this.queued = []
    this.thresholdIndex = -1
    this.wasIntersecting = undefined
    cancelFrame(this.flush)
  }
  detach = () => {
    this.stopObservation()
    this.target = undefined
    this.options = undefined
    this.isInView = false
    this.hasEnteredView = false
    this.started = false
  }
}
