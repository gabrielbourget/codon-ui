import { Animated, PlatformColor } from "react-native"

import { nativeAnimationControls } from "../animation"
import type {
  TNativeMotionAnimationProps,
  TNativeMotionTargetResolver,
  TNativeMotionTarget,
  TNativeMotionTransition,
} from "../animation"
import { nativeMotionValue, useNativeMotionValueEvent } from "../animation/hooks"

export const mixed = nativeMotionValue<readonly (string | number)[]>(Object.freeze([0, "untouched"]))
mixed.set(Object.freeze([1, "retained"]))
export const resolver: TNativeMotionTargetResolver = (custom, current, velocity) => ({
  x: typeof custom === "number" ? custom : 0,
  opacity: current.opacity,
  scale: velocity.scale,
})
export const props: TNativeMotionAnimationProps = {
  initial: false,
  animate: ["first", "second"],
  whileHover: "over",
  whileTap: { opacity: 1 },
  whileFocus: "focus",
  whileDrag: "drag",
  whileInView: "visible",
  exit: "gone",
  custom: 0,
  variants: { first: { x: [0, 10] }, second: resolver },
  transition: { delayChildren: (index, total) => index / total, staggerDirection: -1, repeatType: "mirror" },
}
export const controls = nativeAnimationControls()
// @ts-expect-error An actual native owner/backend protocol is required; a bare object cannot stand in for a renderer.
controls.subscribe({ getProps: () => ({}) })
// @ts-expect-error Definitions do not accept a number in place of a label/target/resolver.
controls.start(5)
// @ts-expect-error Native controls preserve typed transition timing.
controls.start("first", { duration: "100ms" })
export const useTypedEvent = () => {
  const numeric = nativeMotionValue(0)
  useNativeMotionValueEvent(numeric, "change", (latest) => latest.toFixed(2))
  // @ts-expect-error Event names are the source motion-value event names.
  useNativeMotionValueEvent(numeric, "valueChanged", () => {})
}

export const nativeDefinition: TNativeMotionTarget = {
  x: Object.freeze([null, "50%", 0] as const),
  opacity: Object.freeze([1, 0]),
  backgroundColor: PlatformColor("labelColor"),
  fontVariant: [Object.freeze(["small-caps"] as const), Object.freeze(["tabular-nums"] as const)],
  transform: [Object.freeze([{ translateX: 0 }]), Object.freeze([{ translateX: "50%" }] as const)],
  transformOrigin: [
    [0, "50%", 0],
    ["50%", 0, 0],
  ],
  transition: {
    opacity: { duration: 0.2, onUpdate: (latest) => latest.toFixed(2) },
    x: {
      type: "spring",
      onUpdate: (latest) => (typeof latest === "number" ? latest.toFixed(2) : latest.toUpperCase()),
    },
    layout: { type: "spring" },
    default: { duration: 0.1 },
  },
  transitionEnd: {
    display: "none",
    transform: Object.freeze([{ scale: 1 }]),
    transformOrigin: ["50%", "50%", 0],
    fontVariant: Object.freeze(["tabular-nums"] as const),
  },
}
controls.start(nativeDefinition)
controls.set(nativeDefinition)
export const typedDefinitionProps: TNativeMotionAnimationProps = {
  initial: true,
  animate: controls,
  exit: nativeDefinition,
  variants: { native: nativeDefinition },
  whileTap: ["native"],
}
// @ts-expect-error Native animation targets do not accept arbitrary style slots.
export const unknownTarget: TNativeMotionTarget = { unknownNativeSlot: 1 }
// @ts-expect-error Native width targets use RN dimensions rather than CSS pixels.
export const cssTarget: TNativeMotionTarget = { width: "100px" }
// @ts-expect-error Native opacity keyframes are numeric.
export const textOpacity: TNativeMotionTarget = { opacity: [0, "opaque"] }
// @ts-expect-error Native transforms keep typed descriptor values.
export const wrongTransform: TNativeMotionTarget = { transform: [{ scale: "large" }] }
// @ts-expect-error React Native Animated nodes are not source-owned motion keyframes.
export const foreignAnimation: TNativeMotionTarget = { opacity: new Animated.Value(1) }
// @ts-expect-error Final scalar values are not keyframe arrays.
export const finalKeyframes: TNativeMotionTarget = { transitionEnd: { opacity: [0, 1] } }
// @ts-expect-error Final native fields remain typed.
export const wrongFinal: TNativeMotionTarget = { transitionEnd: { width: "100px" } }
// @ts-expect-error Property overrides do not accept arbitrary dictionary names.
export const unknownOverride: TNativeMotionTransition = { unknownNativeSlot: { duration: 1 } }
export const wrongValueCallback: TNativeMotionTransition = {
  // @ts-expect-error Per-property transition callbacks use that native value type.
  opacity: { onUpdate: (latest: string) => latest.toUpperCase() },
}
// @ts-expect-error Value transition timing remains numeric inside property overrides.
export const wrongOverrideTiming: TNativeMotionTransition = { opacity: { duration: "slow" } }
// @ts-expect-error Default transitions contain value options rather than another property table.
export const wrongDefault: TNativeMotionTransition = { default: { opacity: { duration: 1 } } }
// @ts-expect-error Initial state does not accept controls.
export const initialControls: TNativeMotionAnimationProps = { initial: controls }
// @ts-expect-error Declarative animate does not accept a resolver function directly.
export const animateResolver: TNativeMotionAnimationProps = { animate: resolver }
// @ts-expect-error Gesture targets do not accept animation controls.
export const gestureControls: TNativeMotionAnimationProps = { whileTap: controls }
// @ts-expect-error Exit is a target/label declaration rather than a boolean.
export const booleanExit: TNativeMotionAnimationProps = { exit: false }
