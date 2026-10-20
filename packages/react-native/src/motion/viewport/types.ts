import type { RefObject } from "react"
import type { ScrollView, View } from "react-native"

type TNativeViewportRectData = Readonly<{
  x: number
  y: number
  width: number
  height: number
  top: number
  right: number
  bottom: number
  left: number
}>
export type TNativeViewportRect = TNativeViewportRectData & { toJSON: () => TNativeViewportRectData }
export type TNativeViewportEntry = Readonly<{
  target: View
  time: number
  rootBounds: TNativeViewportRect | null
  boundingClientRect: TNativeViewportRect
  intersectionRect: TNativeViewportRect
  intersectionRatio: number
  isIntersecting: boolean
}>
export type TNativeViewportOptions = {
  root?: RefObject<View | ScrollView | null>
  margin?: string
  amount?: "some" | "all" | number
  once?: boolean
}
export type TNativeMotionViewportProps = {
  viewport?: TNativeViewportOptions
  onViewportEnter?: (entry: TNativeViewportEntry) => void
  onViewportLeave?: (entry: TNativeViewportEntry) => void
}
export type TNativeViewportMargin = Readonly<{ value: number; percent: boolean }>

export const nativeViewportMargins = (margin = "0px"): readonly TNativeViewportMargin[] => {
  const tokens = margin.trim() ? margin.trim().split(/\s+/) : []
  if (!tokens.length) tokens.push("0px")
  if (tokens.length > 4) throw new SyntaxError("Native viewport: one to four px/% margins required")
  const values = tokens.map((token) => {
    const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(px|%)$/i.exec(token)
    if (!match || !Number.isFinite(Number(match[1]))) throw new SyntaxError("Native viewport: px/% margins required")
    return Object.freeze({ value: Number(match[1]), percent: match[2] === "%" })
  })
  return Object.freeze([values[0], values[1] ?? values[0], values[2] ?? values[0], values[3] ?? values[1] ?? values[0]])
}
export const nativeViewportThreshold = (amount: TNativeViewportOptions["amount"] = "some") => {
  const threshold = amount === "some" ? 0 : amount === "all" ? 1 : amount
  if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold < 0 || threshold > 1)
    throw new RangeError("Native viewport: amount must be some/all or a finite ratio in [0,1]")
  return threshold
}
