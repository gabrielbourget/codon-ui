import type { View } from "react-native"

import { nativeDateSegmentFormIdentity, type TNativeDateSegmentFormIdentity } from "../../form/dateSegments"
import type { NativeDateSegmentData } from "../../input/specs/CUIDateSegmentNativeComponent"
import type { DateSegment } from "../state/useDateFieldState"

import type { TNativeDateFieldFocusRow, TNativeDateFieldFocusSnapshot } from "./focus"

type THost = { original: View; frame: Readonly<{ identity: TNativeDateSegmentFormIdentity; active: boolean }> | null }
export const nativeDateFieldSegmentId = (segment: DateSegment, index: number) => `${index}:${segment.type}`

// Only accepted original-host observations supply physical identities. A render
// cannot turn an attached ref into a mounted/active native form target.
export class NativeDateFieldHostSet {
  constructor(private readonly slot?: string) {}
  segmentId = (segment: DateSegment, index: number) =>
    this.slot ? `${this.slot}:${nativeDateFieldSegmentId(segment, index)}` : nativeDateFieldSegmentId(segment, index)
  #root: View | null = null
  #rootTarget = 0
  #hosts = new Map<string, THost>()
  #listeners = new Set<() => void>()
  #version = 0
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }
  version = () => this.#version
  #changed = () => {
    this.#version++
    for (const listener of this.#listeners) listener()
  }
  root = (original: View | null, target: number) => {
    if (original === this.#root && target === this.#rootTarget) return
    this.#root = original
    this.#rootTarget = target
    this.#changed()
  }
  attach = (id: string, original: View) => {
    if (this.#hosts.get(id)?.original === original) return
    this.#hosts.set(id, { original, frame: null })
    this.#changed()
  }
  detach = (id: string, original: View) => {
    if (this.#hosts.get(id)?.original !== original) return
    this.#hosts.delete(id)
    this.#changed()
  }
  receive = (id: string, original: View, packet: NativeDateSegmentData) => {
    const host = this.#hosts.get(id)
    if (!host || host.original !== original || packet.segmentId !== id) return
    const previous = host.frame
    const identity = nativeDateSegmentFormIdentity(packet)
    host.frame = Object.freeze({ identity, active: packet.active })
    if (
      !previous ||
      previous.active !== packet.active ||
      JSON.stringify(previous.identity) !== JSON.stringify(identity)
    )
      this.#changed()
  }
  snapshot = (segments: readonly DateSegment[]): TNativeDateFieldFocusSnapshot | null => {
    if (!this.#root || !Number.isSafeInteger(this.#rootTarget) || this.#rootTarget <= 0) return null
    const rows: TNativeDateFieldFocusRow[] = []
    for (const [index, segment] of segments.entries()) {
      if (segment.type === "literal") continue
      const host = this.#hosts.get(this.segmentId(segment, index)),
        frame = host?.frame
      if (!host || !frame?.active || !frame.identity.windowId) return null
      rows.push({
        original: host.original,
        identity: frame.identity,
        isPlaceholder: segment.isPlaceholder,
      })
    }
    const first = rows[0]?.identity
    if (
      !first ||
      rows.some(
        (row) =>
          row.identity.windowId !== first.windowId ||
          row.identity.surfaceId !== first.surfaceId ||
          row.identity.ownerId !== first.ownerId,
      )
    )
      return null
    return { root: this.#root, rootTarget: this.#rootTarget, rows }
  }
}
