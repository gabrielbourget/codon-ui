import type { View } from "react-native"

import type { NativeDateSegmentData } from "../input/specs/CUIDateSegmentNativeComponent"

export type TNativeDateSegmentFormIdentity = Readonly<
  Pick<
    NativeDateSegmentData,
    "ownerId" | "segmentId" | "bindingRevision" | "target" | "nativeInstance" | "surfaceId" | "windowId" | "epoch"
  >
>
export type TNativeDateSegmentFormTarget = Readonly<{ original: View; identity: TNativeDateSegmentFormIdentity }>
export const NATIVE_DATE_INPUT_SLOTS = ["value", "start", "end"] as const
export type TNativeDateInputSlot = (typeof NATIVE_DATE_INPUT_SLOTS)[number]
export type TNativeDateInputGroup = Readonly<{
  slot: TNativeDateInputSlot
  target: number
  segmentIds: readonly string[]
}>
export type TNativeDateFieldFormBinding = Readonly<{
  kind: "date-field"
  rootTarget: number
  segments: readonly TNativeDateSegmentFormIdentity[]
  groups?: readonly TNativeDateInputGroup[]
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
  const rootTarget = integer(value.rootTarget, true)
  let groups: readonly TNativeDateInputGroup[] | undefined
  if (value.groups !== undefined) {
    if (!Array.isArray(value.groups)) invalid()
    const supplied = value.groups as unknown[]
    if (supplied.length !== 1 && supplied.length !== 2) invalid()
    const groupTargets = new Set<number>()
    groups = Object.freeze(
      supplied.map((item, index) => {
        const row = object(item)
        const slot = supplied.length === 1 ? "value" : index === 0 ? "start" : "end"
        if (
          Object.keys(row).length !== 3 ||
          row.slot !== slot ||
          !Array.isArray(row.segmentIds) ||
          !row.segmentIds.length
        )
          invalid()
        const target = integer(row.target, true)
        if (target === rootTarget || targets.has(target) || groupTargets.has(target)) invalid()
        groupTargets.add(target)
        return Object.freeze({ slot, target, segmentIds: Object.freeze((row.segmentIds as unknown[]).map(text)) })
      }),
    )
    const groupedIds = groups.flatMap((group) => group.segmentIds)
    if (groupedIds.length !== segments.length || groupedIds.some((id, index) => id !== segments[index].segmentId))
      invalid()
  }
  return Object.freeze({
    kind: "date-field",
    rootTarget,
    segments: Object.freeze(segments),
    ...(groups ? { groups } : {}),
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
export const encodeNativeDateFieldBinding = (
  rootTarget: number,
  segments: readonly TNativeDateSegmentFormTarget[],
  groups?: readonly TNativeDateInputGroup[],
) => {
  const encoded = JSON.stringify({
    kind: "date-field",
    rootTarget,
    segments: segments.map((row) => row.identity),
    ...(groups ? { groups } : {}),
  })
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
