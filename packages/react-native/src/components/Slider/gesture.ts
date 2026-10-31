import { useLayoutEffect, useRef } from "react"
import type { GestureResponderEvent, View, ViewProps } from "react-native"

import { closestSliderThumb } from "./model"
import type { useNativeSliderState } from "./state"
import type { TNativeSliderDirection, TNativeSliderOrientation } from "./types"

type TPoint = { id: string; x: number; y: number }
type TRect = { x: number; y: number; width: number; height: number }
type TCycle = {
  token: number
  revision: number
  points: TPoint[]
  ended: boolean
  index?: number
  frame?: TRect
  first?: TPoint
  startPercent?: number
  thumb: boolean
  thumbRevisions: Map<number, number>
}
const points = (event: GestureResponderEvent): TPoint[] => {
  const touches = event.nativeEvent.changedTouches?.length ? event.nativeEvent.changedTouches : [event.nativeEvent]
  return touches
    .filter((touch) => Number.isFinite(touch.pageX) && Number.isFinite(touch.pageY))
    .map((touch) => ({ id: String(touch.identifier ?? 0), x: touch.pageX, y: touch.pageY }))
}
const contains = (rect: TRect, point: TPoint) =>
  point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
export const sliderInset = (extent: number, target: number) => (extent > target ? target / 2 : 0)

export const useNativeSliderGesture = (
  numeric: ReturnType<typeof useNativeSliderState>,
  track: { current: View | null },
  targets: { current: Map<number, View> },
  bodies: { current: Map<number, View> },
  orientation: TNativeSliderOrientation,
  direction: TNativeSliderDirection,
  targetExtent: number,
  layoutKey: string,
) => {
  const latest = useRef({ numeric, orientation, direction, targetExtent })
  latest.current = { numeric, orientation, direction, targetExtent }
  const cycles = useRef(new Map<string, TCycle>())
  const token = useRef(0)
  const mounted = useRef(true)
  const config = `${orientation}:${direction}:${targetExtent}:${layoutKey}`
  const previous = useRef({ config, revision: numeric.revision.current })
  const retire = () => {
    cycles.current.clear()
    token.current++
    latest.current.numeric.cancel()
  }
  useLayoutEffect(() => {
    if (
      cycles.current.size &&
      (previous.current.config !== config ||
        previous.current.revision !== numeric.revision.current ||
        numeric.state.isDisabled)
    )
      retire()
    previous.current = { config, revision: numeric.revision.current }
  })
  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      cycles.current.clear()
      token.current++
    }
  }, [])
  const valid = (cycle: TCycle, id: string) => {
    if (!mounted.current || cycles.current.get(id) !== cycle) return false
    const numeric = latest.current.numeric
    if (
      cycle.revision !== numeric.revision.current ||
      numeric.state.isDisabled ||
      (cycle.index !== undefined &&
        (cycle.thumbRevisions.get(cycle.index) ?? 0) !== (numeric.thumbRevisions.current.get(cycle.index) ?? 0))
    ) {
      cycles.current.delete(id)
      return false
    }
    return true
  }
  const finish = (cycle: TCycle, id: string) => {
    if (!valid(cycle, id) || cycle.index === undefined) return
    cycles.current.delete(id)
    latest.current.numeric.state.setThumbDragging(cycle.index, false)
  }
  const apply = (cycle: TCycle, point: TPoint) => {
    if (!valid(cycle, point.id) || !cycle.frame || cycle.index === undefined || !cycle.first) return
    const { state } = latest.current.numeric
    if (!state.isThumbEditable(cycle.index)) {
      cycles.current.delete(point.id)
      latest.current.numeric.cancelThumb(cycle.index)
      return
    }
    const vertical = latest.current.orientation === "vertical"
    const extent = vertical ? cycle.frame.height : cycle.frame.width
    const inset = sliderInset(extent, latest.current.targetExtent)
    const span = extent - 2 * inset
    if (!(span > 0)) return
    const reverse = vertical || latest.current.direction === "rtl"
    const delta = (vertical ? point.y - cycle.first.y : point.x - cycle.first.x) / span
    const percent = cycle.startPercent! + (reverse ? -delta : delta)
    state.setThumbPercent(cycle.index, Math.min(1, Math.max(0, percent)))
  }
  const start = (event: GestureResponderEvent) => {
    if (latest.current.numeric.state.isDisabled || !track.current) return
    for (const point of points(event)) {
      const existing = cycles.current.get(point.id)
      if (existing && !existing.ended && valid(existing, point.id)) continue
      if (existing) cycles.current.delete(point.id)
      const cycle: TCycle = {
        token: ++token.current,
        revision: latest.current.numeric.revision.current,
        points: [],
        ended: false,
        thumb: false,
        thumbRevisions: new Map(latest.current.numeric.thumbRevisions.current),
      }
      cycles.current.set(point.id, cycle)
      const hits: { index: number; visual: boolean; rect: TRect }[] = []
      let remaining = targets.current.size + bodies.current.size + 1
      let measured: TRect | undefined
      const done = () => {
        if (--remaining || !valid(cycle, point.id) || !measured) return
        const { state } = latest.current.numeric
        const vertical = latest.current.orientation === "vertical"
        const extent = vertical ? measured.height : measured.width
        const inset = sliderInset(extent, latest.current.targetExtent)
        if (!(extent - 2 * inset > 0) || !state.values.length) {
          cycles.current.delete(point.id)
          return
        }
        const reverse = vertical || latest.current.direction === "rtl"
        let percent = ((vertical ? point.y - measured.y : point.x - measured.x) - inset) / (extent - 2 * inset)
        if (reverse) percent = 1 - percent
        percent = Math.min(1, Math.max(0, percent))
        const visual = hits.filter((hit) => hit.visual).sort((a, b) => b.index - a.index)
        const targetHits = hits
          .filter((hit) => !hit.visual)
          .sort((a, b) => {
            const position = (rect: TRect) => (vertical ? rect.y + rect.height / 2 : rect.x + rect.width / 2)
            return (
              Math.abs(position(a.rect) - (vertical ? point.y : point.x)) -
                Math.abs(position(b.rect) - (vertical ? point.y : point.x)) || b.index - a.index
            )
          })
        const hit = visual[0] ?? targetHits[0]
        const index = hit?.index ?? closestSliderThumb(state.values, state.getPercentValue(percent))
        if (
          index < 0 ||
          !state.isThumbEditable(index) ||
          (cycle.thumbRevisions.get(index) ?? 0) !== (latest.current.numeric.thumbRevisions.current.get(index) ?? 0) ||
          state.isThumbDragging(index) ||
          (!hit && state.values.some((_, i) => state.isThumbDragging(i)))
        ) {
          cycles.current.delete(point.id)
          return
        }
        cycle.index = index
        cycle.frame = measured
        cycle.first = point
        cycle.thumb = !!hit
        cycle.startPercent = hit ? state.getThumbPercent(index) : percent
        state.setFocusedThumb(index)
        state.setThumbDragging(index, true)
        if (!hit) state.setThumbPercent(index, percent)
        for (const pending of cycle.points) apply(cycle, pending)
        cycle.points = []
        if (cycle.ended) finish(cycle, point.id)
      }
      const measure = (node: View, index?: number, visual = false) =>
        node.measure((_x, _y, width, height, x, y) => {
          if (!valid(cycle, point.id)) return
          if (![x, y, width, height].every(Number.isFinite)) {
            cycles.current.delete(point.id)
            return
          }
          const rect = { x, y, width, height }
          if (index === undefined) measured = rect
          else if (contains(rect, point)) hits.push({ index, visual, rect })
          done()
        })
      measure(track.current)
      for (const [index, node] of targets.current) measure(node, index)
      for (const [index, node] of bodies.current) measure(node, index, true)
    }
  }
  const move = (event: GestureResponderEvent, ended = false) => {
    for (const point of points(event)) {
      const cycle = cycles.current.get(point.id)
      if (!cycle || !valid(cycle, point.id)) continue
      if (cycle.frame) apply(cycle, point)
      else cycle.points.push(point)
      if (ended) {
        cycle.ended = true
        if (cycle.frame) finish(cycle, point.id)
      }
    }
  }
  const handlers: Pick<
    ViewProps,
    | "onStartShouldSetResponderCapture"
    | "onMoveShouldSetResponderCapture"
    | "onResponderGrant"
    | "onResponderStart"
    | "onResponderMove"
    | "onResponderEnd"
    | "onResponderRelease"
    | "onResponderTerminate"
    | "onResponderTerminationRequest"
  > = {
    onStartShouldSetResponderCapture: () =>
      !latest.current.numeric.state.isDisabled &&
      latest.current.numeric.state.values.some((_, index) => latest.current.numeric.state.isThumbEditable(index)),
    onMoveShouldSetResponderCapture: () => cycles.current.size > 0,
    onResponderGrant: (event) => {
      start(event)
      // RN consumes this return value to block native ScrollView interception.
      return cycles.current.size > 0
    },
    onResponderStart: start,
    onResponderMove: (event) => move(event),
    onResponderEnd: (event) => move(event, true),
    onResponderRelease: (event) => move(event, true),
    onResponderTerminate: () => {
      for (const [id, cycle] of cycles.current) {
        if (cycle.frame) finish(cycle, id)
        else cycles.current.delete(id)
      }
    },
    onResponderTerminationRequest: () => cycles.current.size === 0,
  }
  return { handlers, retire }
}
