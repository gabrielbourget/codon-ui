import type { ViewStyle } from "react-native"

import { buildNativeMotionTransform } from "../visual/nativeTransform"
import type { TNativeMotionTransform, TNativeMotionTransformTemplate } from "../visual/types"

import type { IProjectionNode } from "./node/types"
import type { Delta, NativeProjectionStyle, Point, ResolvedValues } from "./types"

export const buildNativeProjectionTransform = (
  delta: Delta,
  treeScale: Point,
  values: ResolvedValues,
): TNativeMotionTransform => {
  const result: Array<TNativeMotionTransform[number]> = []
  const x = delta.x.translate / treeScale.x,
    y = delta.y.translate / treeScale.y,
    z = Number(values.z || 0)
  if (values.transformPerspective) result.push({ perspective: Number(values.transformPerspective) })
  if (x || y || z) {
    result.push({ translateX: x }, { translateY: y })
    if (z) result.push({ matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, z, 1] })
  }
  if (treeScale.x !== 1 || treeScale.y !== 1) result.push({ scaleX: 1 / treeScale.x }, { scaleY: 1 / treeScale.y })
  const zRotations = Object.fromEntries(
    ["rotate", "pathRotation"].filter((key) => values[key]).map((key) => [key, values[key]]),
  )
  result.push(...buildNativeMotionTransform(zRotations))
  const rotations = Object.fromEntries(
    ["rotateX", "rotateY", "skewX", "skewY"].filter((key) => values[key]).map((key) => [key, values[key]]),
  )
  result.push(...buildNativeMotionTransform(rotations))
  const scaleX = delta.x.scale * treeScale.x,
    scaleY = delta.y.scale * treeScale.y
  if (scaleX !== 1 || scaleY !== 1) result.push({ scaleX }, { scaleY })
  return result
}
export type TNativeProjectionRadii = Record<
  "topLeft" | "topRight" | "bottomLeft" | "bottomRight",
  { x: number; y: number }
>
// Exact elliptical corrections need a native drawing receiver; scalar RN radii cannot represent unequal axes.
export const nativeProjectionStyles = (
  node: IProjectionNode,
  authored: NativeProjectionStyle,
  template?: TNativeMotionTransformTemplate,
  elliptical?: (radii: TNativeProjectionRadii) => void,
): NativeProjectionStyle => {
  if (!node.isVisible) return {}
  if (node.needsReset) {
    node.needsReset = false
    return {}
  }
  const lead = node.getLead()
  if (!node.projectionDelta || !node.layout || !lead.target) {
    return node.options.layoutId
      ? { opacity: Number(node.latestValues.opacity ?? 1), pointerEvents: authored.pointerEvents }
      : {}
  }
  node.applyTransformsToTarget()
  const values = lead.animationValues || lead.latestValues
  let transform = buildNativeProjectionTransform(node.projectionDeltaWithTransform!, node.treeScale!, values)
  if (template) transform = template(values, transform)
  const style: NativeProjectionStyle = {
    transform,
    transformOrigin: [`${node.projectionDelta.x.origin * 100}%`, `${node.projectionDelta.y.origin * 100}%`, 0],
    opacity: lead.animationValues
      ? Number(
          lead === node
            ? (values.opacity ?? node.latestValues.opacity ?? 1)
            : node.preserveOpacity
              ? (node.latestValues.opacity ?? 1)
              : (values.opacityExit ?? 0),
        )
      : Number(lead === node ? (values.opacity ?? authored.opacity ?? 1) : (values.opacityExit ?? 0)),
  }
  if (node.options.layoutId) style.pointerEvents = lead === node ? authored.pointerEvents : "none"
  const sx = node.projectionDelta.x.scale * node.treeScale!.x,
    sy = node.projectionDelta.y.scale * node.treeScale!.y
  const radii = {} as TNativeProjectionRadii
  let hasRadius = false
  for (const [name, key] of [
    ["topLeft", "borderTopLeftRadius"],
    ["topRight", "borderTopRightRadius"],
    ["bottomLeft", "borderBottomLeftRadius"],
    ["bottomRight", "borderBottomRightRadius"],
  ] as const) {
    const value = values[key] ?? values.borderRadius ?? authored[key] ?? authored.borderRadius
    if (value === undefined) {
      radii[name] = { x: 0, y: 0 }
      continue
    }
    if (typeof value === "string" && value.endsWith("%")) {
      style[key] = value as `${number}%`
      radii[name] = { x: 0, y: 0 }
      continue
    }
    if (typeof value !== "number") throw new Error("Native projection: native numeric/percentage radius required")
    hasRadius = true
    radii[name] = { x: value / sx, y: value / sy }
    if (Math.abs(sx - sy) < 0.0000001) style[key] = value / sx
  }
  if (hasRadius && Math.abs(sx - sy) >= 0.0000001) {
    if (!elliptical) throw new Error("Native projection: exact elliptical radius receiver unavailable")
    elliptical(radii)
  }
  if (authored.shadowOffset)
    style.shadowOffset = { width: authored.shadowOffset.width / sx, height: authored.shadowOffset.height / sy }
  if (authored.shadowRadius !== undefined) style.shadowRadius = authored.shadowRadius / ((sx + sy) / 2)
  if (Array.isArray(authored.boxShadow))
    style.boxShadow = authored.boxShadow.map((shadow) => ({
      ...shadow,
      offsetX: typeof shadow.offsetX === "number" ? shadow.offsetX / sx : shadow.offsetX,
      offsetY: typeof shadow.offsetY === "number" ? shadow.offsetY / sy : shadow.offsetY,
      blurRadius: typeof shadow.blurRadius === "number" ? shadow.blurRadius / ((sx + sy) / 2) : shadow.blurRadius,
      spreadDistance:
        typeof shadow.spreadDistance === "number" ? shadow.spreadDistance / ((sx + sy) / 2) : shadow.spreadDistance,
    })) as ViewStyle["boxShadow"]
  return style
}
