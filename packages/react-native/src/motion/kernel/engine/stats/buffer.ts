// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
import type { StatsRecording } from "./types"

export type InactiveStatsBuffer = {
  value: null
  addProjectionMetrics: null
}

export type ActiveStatsBuffer = {
  value: StatsRecording
  addProjectionMetrics: (metrics: {
    nodes: number
    calculatedTargetDeltas: number
    calculatedProjections: number
  }) => void
}

export const statsBuffer: InactiveStatsBuffer | ActiveStatsBuffer = {
  value: null,
  addProjectionMetrics: null,
}
