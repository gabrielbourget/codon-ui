import type { ViewStyle } from "react-native"
import { I18nManager, Platform } from "react-native"

import { complex } from "../kernel/engine/value/types/complex"
import { buildNativeMotionTransform } from "../visual/nativeTransform"
import type { TNativeMotionTransform, TNativeMotionTransformTemplate } from "../visual/types"

import type { IProjectionNode } from "./node/types"
import type { Delta, NativeProjectionStyle, Point, ResolvedValues } from "./types"

// Pinned Motion12.40.0 scale-box-shadow, including its complex/multiple-shadow fallthrough.
const correctShadowString = (source: string, scaleX: number, scaleY: number) => {
  const values = complex.parse(source)
  if (values.length > 5) return source
  const transform = complex.createTransformer(source)
  const offset = typeof values[0] === "number" ? 0 : 1
  values[offset] = (values[offset] as number) / scaleX
  values[offset + 1] = (values[offset + 1] as number) / scaleY
  const average = (scaleX + scaleY) / 2
  if (typeof values[offset + 2] === "number") values[offset + 2] = (values[offset + 2] as number) / average
  if (typeof values[offset + 3] === "number") values[offset + 3] = (values[offset + 3] as number) / average
  return transform(values)
}
const correctShadowLength = (source: number | string, scale: number) => {
  if (typeof source === "number") return source / scale
  const match = /^([+-]?\d*\.?\d+)(px)?$/.exec(source)
  return match && (match[2] || Number(match[1]) === 0) ? Number(match[1]) / scale : source
}

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
  { x: number; y: number } | null
>
type TRadiusContext = {
  direction?: "ltr" | "rtl"
  platform?: "ios" | "android"
  swapLeftAndRight?: boolean
}
// Exact elliptical corrections need a native drawing receiver; scalar RN radii cannot represent unequal axes.
export const nativeProjectionStyles = (
  node: IProjectionNode,
  authored: NativeProjectionStyle,
  template?: TNativeMotionTransformTemplate,
  elliptical?: (radii: TNativeProjectionRadii) => void,
  radiusContext?: TRadiusContext,
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
  const readRadius = (key: keyof ViewStyle) => values[key] ?? authored[key]
  if (
    radiusContext &&
    !radiusContext.direction &&
    Object.keys({ ...authored, ...values }).some(
      (key) => key.startsWith("border") && key.endsWith("Radius") && readRadius(key as keyof ViewStyle) !== undefined,
    )
  )
    throw new Error("Native projection: actual native layout direction unavailable")
  const rtl = (radiusContext?.direction ?? (I18nManager.isRTL ? "rtl" : "ltr")) === "rtl"
  const android = (radiusContext?.platform ?? Platform.OS) === "android"
  const swap = rtl && (radiusContext?.swapLeftAndRight ?? I18nManager.doLeftAndRightSwapInRTL)
  // Preserve each locked platform's precedence, including Android's RTL aliases.
  const aliases = android
    ? rtl
      ? [
          ["borderEndStartRadius", "borderTopEndRadius", swap ? "borderTopRightRadius" : "borderTopLeftRadius"],
          ["borderStartStartRadius", "borderTopStartRadius", swap ? "borderTopLeftRadius" : "borderTopRightRadius"],
          [
            "borderEndEndRadius",
            swap ? "borderBottomEndRadius" : "borderBottomStartRadius",
            swap ? "borderBottomRightRadius" : "borderBottomLeftRadius",
          ],
          [
            "borderStartEndRadius",
            swap ? "borderBottomStartRadius" : "borderBottomEndRadius",
            swap ? "borderBottomLeftRadius" : "borderBottomRightRadius",
          ],
        ]
      : [
          ["borderStartStartRadius", "borderTopStartRadius", "borderTopLeftRadius"],
          ["borderEndStartRadius", "borderTopEndRadius", "borderTopRightRadius"],
          ["borderStartEndRadius", "borderBottomStartRadius", "borderBottomLeftRadius"],
          ["borderEndEndRadius", "borderBottomEndRadius", "borderBottomRightRadius"],
        ]
    : [
        [
          "borderTopLeftRadius",
          rtl ? "borderTopEndRadius" : "borderTopStartRadius",
          rtl ? "borderStartEndRadius" : "borderStartStartRadius",
        ],
        [
          "borderTopRightRadius",
          rtl ? "borderTopStartRadius" : "borderTopEndRadius",
          rtl ? "borderStartStartRadius" : "borderStartEndRadius",
        ],
        [
          "borderBottomLeftRadius",
          rtl ? "borderBottomEndRadius" : "borderBottomStartRadius",
          rtl ? "borderEndEndRadius" : "borderEndStartRadius",
        ],
        [
          "borderBottomRightRadius",
          rtl ? "borderBottomStartRadius" : "borderBottomEndRadius",
          rtl ? "borderEndStartRadius" : "borderEndEndRadius",
        ],
      ]
  const logicalRadius = aliases.some((keys) =>
    keys.some(
      (key) =>
        !["borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius"].includes(
          key,
        ) && readRadius(key as keyof ViewStyle) !== undefined,
    ),
  )
  let hasRadius = false
  for (const [index, [name, key]] of (
    [
      ["topLeft", "borderTopLeftRadius"],
      ["topRight", "borderTopRightRadius"],
      ["bottomLeft", "borderBottomLeftRadius"],
      ["bottomRight", "borderBottomRightRadius"],
    ] as const
  ).entries()) {
    const value =
      aliases[index].map((alias) => readRadius(alias as keyof ViewStyle)).find((item) => item !== undefined) ??
      readRadius("borderRadius")
    if (value === undefined) {
      radii[name] = null
      continue
    }
    if (typeof value === "string" && value.endsWith("%")) {
      style[key] = value as `${number}%`
      radii[name] = null
      continue
    }
    if (typeof value !== "number") throw new Error("Native projection: native numeric/percentage radius required")
    hasRadius = true
    radii[name] = { x: value / sx, y: value / sy }
    if (Math.abs(sx - sy) < 0.0000001) style[key] = value / sx
  }
  if (hasRadius && (logicalRadius || Math.abs(sx - sy) >= 0.0000001)) {
    if (!elliptical) throw new Error("Native projection: exact elliptical radius receiver unavailable")
    elliptical(radii)
  }
  if (authored.shadowOffset)
    style.shadowOffset = { width: authored.shadowOffset.width / sx, height: authored.shadowOffset.height / sy }
  if (authored.shadowRadius !== undefined) style.shadowRadius = authored.shadowRadius / ((sx + sy) / 2)
  const boxShadow = values.boxShadow ?? lead.options.visualElement?.props.style?.boxShadow ?? authored.boxShadow
  if (typeof boxShadow === "string") style.boxShadow = correctShadowString(boxShadow, sx, sy)
  else if (Array.isArray(boxShadow))
    style.boxShadow = boxShadow.map((shadow) => ({
      ...shadow,
      offsetX: correctShadowLength(shadow.offsetX, sx),
      offsetY: correctShadowLength(shadow.offsetY, sy),
      ...(shadow.blurRadius === undefined ? {} : { blurRadius: correctShadowLength(shadow.blurRadius, (sx + sy) / 2) }),
      ...(shadow.spreadDistance === undefined
        ? {}
        : { spreadDistance: correctShadowLength(shadow.spreadDistance, (sx + sy) / 2) }),
    })) as ViewStyle["boxShadow"]
  return style
}
