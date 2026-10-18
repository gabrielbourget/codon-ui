import type { RefObject } from "react"
import type { View } from "react-native"

import type { TNativeFloatingRect } from "./placement"

export type TNativeFloatingMeasurable = Pick<View, "measureInWindow">
type TTarget = "host" | "anchor" | "content" | "boundary"
type TRefs = {
  host: RefObject<TNativeFloatingMeasurable | null>
  anchor: RefObject<TNativeFloatingMeasurable | null>
  content: RefObject<TNativeFloatingMeasurable | null>
  boundary?: RefObject<TNativeFloatingMeasurable | null>
}
export type TNativeFloatingMeasurements = {
  host: TNativeFloatingRect
  anchor: TNativeFloatingRect
  content: TNativeFloatingRect
  boundary?: TNativeFloatingRect
}
const valid = ({ x, y, width, height }: TNativeFloatingRect) =>
  [x, y, width, height, x + width, y + height].every(Number.isFinite) && width >= 0 && height >= 0

export const createNativeFloatingMeasurement = () => {
  let generation = 0
  let pending = false
  let live = true
  let pendingTargets: {
    name: TTarget
    ref: RefObject<TNativeFloatingMeasurable | null>
    node: TNativeFloatingMeasurable | null
  }[] = []
  let pendingCurrent: (() => boolean) | null = null
  const invalidate = () => {
    generation++
    pending = false
    pendingTargets = []
    pendingCurrent = null
  }
  return {
    invalidate,
    isPending: () => pending,
    dispose: () => {
      live = false
      invalidate()
    },
    read: (refs: TRefs, isCurrent: () => boolean, publish: (measurements: TNativeFloatingMeasurements) => void) => {
      if (!live || !isCurrent()) {
        invalidate()
        return false
      }
      if (pending) {
        const sameTargets =
          pendingTargets.every(({ name, ref, node }) => refs[name] === ref && ref.current === node) &&
          !!refs.boundary === pendingTargets.some(({ name }) => name === "boundary")
        if (sameTargets && pendingCurrent?.()) return false
        invalidate()
      }
      const names: TTarget[] = refs.boundary ? ["host", "anchor", "content", "boundary"] : ["host", "anchor", "content"]
      const targets = names.map((name) => ({ name, ref: refs[name]!, node: refs[name]!.current }))
      if (targets.some(({ node }) => node === null)) return false
      const token = ++generation
      pending = true
      pendingTargets = targets
      pendingCurrent = isCurrent
      const result: Partial<Record<TTarget, TNativeFloatingRect>> = {}
      const current = () =>
        live && generation === token && isCurrent() && targets.every(({ ref, node }) => ref.current === node)
      try {
        for (const { name, node } of targets) {
          node!.measureInWindow((x, y, width, height) => {
            if (generation !== token) return
            if (!current()) {
              invalidate()
              return
            }
            if (result[name]) return
            const rect = { x, y, width, height }
            if (!valid(rect)) {
              invalidate()
              return
            }
            result[name] = rect
            if (!targets.every(({ name }) => result[name])) return
            pending = false
            pendingTargets = []
            pendingCurrent = null
            publish({ host: result.host!, anchor: result.anchor!, content: result.content!, boundary: result.boundary })
          })
          if (generation !== token) break
        }
      } catch (error) {
        invalidate()
        throw error
      }
      return true
    },
  }
}
