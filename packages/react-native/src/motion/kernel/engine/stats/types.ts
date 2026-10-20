// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
import type { StepNames } from "../frameloop/order"

export interface Summary {
  min: number
  max: number
  avg: number
}

type FrameloopStatNames = "rate" | StepNames

export interface Stats<T> {
  frameloop: {
    [key in FrameloopStatNames]: T
  }
  animations: {
    mainThread: T
    waapi: T
    layout: T
  }
  layoutProjection: {
    nodes: T
    calculatedTargetDeltas: T
    calculatedProjections: T
  }
}

export type StatsBuffer = number[]

export type FrameStats = Stats<number>

export type StatsRecording = Stats<StatsBuffer>

export type StatsSummary = Stats<Summary>
