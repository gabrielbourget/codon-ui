// Native mapping of Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import type { StyleProp, TextStyle, ViewStyle } from "react-native"

import { resolveNativeStyle } from "../../components/colors"

import { buildNativeMotionOrigin, buildNativeMotionTransform } from "./nativeTransform"
import { NATIVE_MOTION_TRANSFORM_ORDER } from "./types"
import type { TNativeMotionTransformTemplate, TNativeMotionVisualValues } from "./types"

const TEXT_FIELDS = new Set([
  "color",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "fontVariant",
  "letterSpacing",
  "lineHeight",
  "textAlign",
  "textAlignVertical",
  "verticalAlign",
  "includeFontPadding",
  "textDecorationLine",
  "textDecorationStyle",
  "textDecorationColor",
  "textShadowColor",
  "textShadowOffset",
  "textShadowRadius",
  "textTransform",
  "writingDirection",
  "userSelect",
])
const TRANSFORM_FIELDS = new Set<string>([...NATIVE_MOTION_TRANSFORM_ORDER, "pathRotation"])
const ORIGIN_FIELDS = new Set(["originX", "originY", "originZ"])

export const resolveNativeMotionVisualStyle = (
  computed: StyleProp<TextStyle>,
  custom: StyleProp<TextStyle>,
  final: StyleProp<TextStyle>,
  latest: Readonly<TNativeMotionVisualValues>,
  template?: TNativeMotionTransformTemplate,
) => {
  const base = resolveNativeStyle([computed, custom, final], "Card", "style")
  const next = { ...base } as Record<string, unknown>
  for (const [key, value] of Object.entries(latest)) {
    if (!TRANSFORM_FIELDS.has(key) && !ORIGIN_FIELDS.has(key)) next[key] = value
  }
  if (!latest.transform && (template || Object.keys(latest).some((key) => TRANSFORM_FIELDS.has(key))))
    next.transform = buildNativeMotionTransform(latest, template)
  if (Object.keys(latest).some((key) => ORIGIN_FIELDS.has(key))) next.transformOrigin = buildNativeMotionOrigin(latest)
  const resolved = resolveNativeStyle(next as TextStyle, "Card", "motionStyle")
  const text: TextStyle = {}
  const view: ViewStyle = {}
  for (const [key, value] of Object.entries(resolved)) {
    if (TEXT_FIELDS.has(key)) {
      if (value !== undefined) Object.assign(text, { [key]: value })
    } else Object.assign(view, { [key]: value })
  }
  return { view, text }
}
