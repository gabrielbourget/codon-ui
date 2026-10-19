// Received from pinned Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import type { TNativeMotionAnimationOwner, TNativeMotionDynamicOption } from "./types"

export function calcChildStagger(
  children: Set<TNativeMotionAnimationOwner>,
  child: TNativeMotionAnimationOwner,
  delayChildren?: number | TNativeMotionDynamicOption<number>,
  staggerChildren: number = 0,
  staggerDirection: number = 1,
): number {
  const index = Array.from(children)
    .sort((a, b) => a.sortNodePosition(b))
    .indexOf(child)
  const numChildren = children.size
  const maxStaggerDuration = (numChildren - 1) * staggerChildren
  const delayIsFunction = typeof delayChildren === "function"

  return delayIsFunction
    ? delayChildren(index, numChildren)
    : staggerDirection === 1
      ? index * staggerChildren
      : maxStaggerDuration - index * staggerChildren
}
