import { nativeAnimationControls } from "../animation"
import type { TNativeMotionAnimationProps, TNativeMotionTargetResolver } from "../animation"
import { nativeMotionValue, useNativeMotionValueEvent } from "../animation/hooks"

export const mixed = nativeMotionValue<readonly (string | number)[]>(Object.freeze([0, "untouched"]))
mixed.set(Object.freeze([1, "retained"]))
export const resolver: TNativeMotionTargetResolver = (custom, current, velocity) => ({
  x: custom,
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
