import type { TNativeMotionOwnerProps } from "./NativeMotionOwner"

// Pinned full-renderer feature predicates. Instances survive prop removal until their owner retires.
export const NATIVE_MOTION_FEATURE_PROPS = {
  animation: ["animate", "variants", "whileHover", "whileTap", "exit", "whileInView", "whileFocus", "whileDrag"],
  exit: ["exit"],
  drag: ["drag", "dragControls"],
  focus: ["whileFocus"],
  hover: ["whileHover", "onHoverStart", "onHoverEnd"],
  tap: ["whileTap", "onTap", "onTapStart", "onTapCancel"],
  pan: ["onPan", "onPanStart", "onPanSessionStart", "onPanEnd"],
  inView: ["whileInView", "onViewportEnter", "onViewportLeave"],
  layout: ["layout", "layoutId"],
} as const satisfies Record<string, readonly (keyof TNativeMotionOwnerProps)[]>
export type TNativeMotionFeature = keyof typeof NATIVE_MOTION_FEATURE_PROPS
const enabled = (feature: TNativeMotionFeature, props: TNativeMotionOwnerProps) =>
  NATIVE_MOTION_FEATURE_PROPS[feature].some((name) => Boolean(props[name]))

export class NativeMotionFeatures {
  private readonly mounted = new Set<TNativeMotionFeature>()
  update = (props: TNativeMotionOwnerProps, isStatic: boolean) => {
    if (isStatic) return
    for (const feature of Object.keys(NATIVE_MOTION_FEATURE_PROPS) as TNativeMotionFeature[]) {
      if (enabled(feature, props)) this.mounted.add(feature)
    }
  }
  has = (feature: TNativeMotionFeature, props: TNativeMotionOwnerProps, isStatic: boolean) =>
    !isStatic && (this.mounted.has(feature) || enabled(feature, props))
  snapshot = () => [...this.mounted]
}
