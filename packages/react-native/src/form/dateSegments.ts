import type { View } from "react-native"

import type { NativeDateSegmentData } from "../input/specs/CUIDateSegmentNativeComponent"

export type TNativeDateSegmentFormIdentity = Readonly<
  Pick<
    NativeDateSegmentData,
    "ownerId" | "segmentId" | "bindingRevision" | "target" | "nativeInstance" | "surfaceId" | "windowId" | "epoch"
  >
>
export type TNativeDateSegmentFormTarget = Readonly<{ original: View; identity: TNativeDateSegmentFormIdentity }>
export type TNativeDateFieldFormBinding = Readonly<{
  kind: "date-field"
  rootTarget: number
  segments: readonly TNativeDateSegmentFormIdentity[]
}>

const invalid = (): never => {
  throw new Error("invalid-owned-date-field-binding")
}
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : invalid()
const text = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : invalid())
const integer = (value: unknown, tag = false) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 && (!tag || value <= 2147483647)
    ? value
    : invalid()

export const decodeNativeDateFieldBinding = (encoded: string): TNativeDateFieldFormBinding => {
  const value = object(JSON.parse(encoded))
  if (value.kind !== "date-field" || !Array.isArray(value.segments) || value.segments.length === 0) invalid()
  const targets = new Set<number>(),
    ids = new Set<string>()
  const segments = (value.segments as unknown[]).map((item) => {
    const row = object(item)
    if (Object.keys(row).length !== 8) invalid()
    const result = Object.freeze({
      ownerId: text(row.ownerId),
      segmentId: text(row.segmentId),
      bindingRevision: text(row.bindingRevision),
      target: integer(row.target, true),
      nativeInstance: text(row.nativeInstance),
      surfaceId: integer(row.surfaceId, true),
      windowId: text(row.windowId),
      epoch: integer(row.epoch),
    })
    if (targets.has(result.target) || ids.has(result.segmentId)) invalid()
    targets.add(result.target)
    ids.add(result.segmentId)
    return result
  })
  if (
    segments.some(
      (row) =>
        row.ownerId !== segments[0].ownerId ||
        row.windowId !== segments[0].windowId ||
        row.surfaceId !== segments[0].surfaceId,
    )
  )
    invalid()
  return Object.freeze({
    kind: "date-field",
    rootTarget: integer(value.rootTarget, true),
    segments: Object.freeze(segments),
  })
}

export const nativeDateSegmentFormIdentity = (data: NativeDateSegmentData): TNativeDateSegmentFormIdentity =>
  Object.freeze({
    ownerId: data.ownerId,
    segmentId: data.segmentId,
    bindingRevision: data.bindingRevision,
    target: data.target,
    nativeInstance: data.nativeInstance,
    surfaceId: data.surfaceId,
    windowId: data.windowId,
    epoch: data.epoch,
  })
export const encodeNativeDateFieldBinding = (rootTarget: number, segments: readonly TNativeDateSegmentFormTarget[]) => {
  const encoded = JSON.stringify({ kind: "date-field", rootTarget, segments: segments.map((row) => row.identity) })
  decodeNativeDateFieldBinding(encoded)
  return encoded
}
export const sameNativeDateFieldTargets = (
  expected: readonly TNativeDateSegmentFormTarget[],
  current: readonly TNativeDateSegmentFormTarget[],
) =>
  expected.length === current.length &&
  expected.every(
    (target, index) =>
      target.original === current[index].original &&
      Object.entries(target.identity).every(
        ([key, value]) => current[index].identity[key as keyof TNativeDateSegmentFormIdentity] === value,
      ),
  )
