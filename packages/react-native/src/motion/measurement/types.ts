import type { View } from "react-native"

import type { TNativeMotionGeometryRecord } from "../../input/motionGeometry"
import type { TNativeMotionResolutionToken, TNativeResolvedKeyframes } from "../value/types"

export type TNativeMotionMeasurementSnapshot = Readonly<{
  values: Readonly<Record<string, unknown>> | null
  revision?: string
}>
// A real native implementation must keep temporary model layouts out of the
// presented tree and restore/release on every terminal path. This interface
// does not establish that such an implementation is installed.
export type TNativeMotionAtomicLayoutSession = {
  target: View
  release: (restored: TNativeMotionGeometryRecord) => Promise<void>
  abort: () => Promise<void>
}
export type TNativeMotionAtomicLayoutProvider = {
  begin: (target: View, token: TNativeMotionResolutionToken) => Promise<TNativeMotionAtomicLayoutSession>
}
export type TNativeMotionMeasurementMetric = (record: TNativeMotionGeometryRecord) => unknown
export type TNativeMotionMeasurementRequest = {
  name: string
  keyframes: readonly unknown[]
  token: TNativeMotionResolutionToken
  metric: TNativeMotionMeasurementMetric
  onProbe?: (value: unknown, phase: "initial" | "target" | "restored") => void
}
export type TNativeMotionMeasurementResult = TNativeResolvedKeyframes
