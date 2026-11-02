import type { View } from "react-native"

import { decodeNativeDateFieldBinding, encodeNativeDateFieldBinding, sameNativeDateFieldTargets } from "../dateSegments"

const segment = (target: number, segmentId: string) => ({
  ownerId: "time-owner",
  segmentId,
  bindingRevision: "wire:1",
  target,
  nativeInstance: `native:${target}`,
  surfaceId: 11,
  windowId: "window:1",
  epoch: 5,
})
const binding = () => ({ kind: "date-field", rootTarget: 4, segments: [segment(6, "hour"), segment(8, "minute")] })

it("retires the whole set for a non-primary object, epoch, window, revision or root target replacement", () => {
  const targets = binding().segments.map((identity) => ({ original: {} as View, identity }))
  const encoded = encodeNativeDateFieldBinding(4, targets)
  expect(decodeNativeDateFieldBinding(encoded)).toEqual(binding())
  expect(sameNativeDateFieldTargets(targets, [...targets])).toBe(true)
  expect(sameNativeDateFieldTargets(targets, [targets[0]])).toBe(false)
  expect(sameNativeDateFieldTargets(targets, [targets[0], { ...targets[1], original: {} as View }])).toBe(false)
  for (const identity of [
    { ...targets[1].identity, epoch: 6 },
    { ...targets[1].identity, windowId: "window:2" },
    { ...targets[1].identity, bindingRevision: "wire:2" },
    { ...targets[1].identity, nativeInstance: "native:new" },
  ])
    expect(sameNativeDateFieldTargets(targets, [targets[0], { ...targets[1], identity }])).toBe(false)
})
it.each([
  null,
  [],
  {},
  { ...binding(), segments: [] },
  { ...binding(), segments: [{ ...segment(6, "hour"), text: "13" }] },
])("rejects malformed or business-value-bearing descriptor %j", (value) => {
  expect(() => decodeNativeDateFieldBinding(JSON.stringify(value))).toThrow()
})
