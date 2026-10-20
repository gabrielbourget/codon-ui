import type { TNativeMotionOwnerProps } from "../../motion/owner/NativeMotionOwner"

// Keep the split exhaustive as inherited groups grow, so motion callbacks never reach a native prop receiver.
const NATIVE_CARD_MOTION_FIELDS = {
  initial: true,
  animate: true,
  exit: true,
  whileInView: true,
  whileFocus: true,
  whileHover: true,
  whileTap: true,
  whileDrag: true,
  custom: true,
  inherit: true,
  variants: true,
  transition: true,
  onAnimationStart: true,
  onAnimationComplete: true,
  onPanSessionStart: true,
  onPanStart: true,
  onPan: true,
  onPanEnd: true,
  onTapStart: true,
  onTap: true,
  onTapCancel: true,
  onHoverStart: true,
  onHoverEnd: true,
  drag: true,
  dragListener: true,
  dragDirectionLock: true,
  dragPropagation: true,
  dragConstraints: true,
  dragElastic: true,
  dragMomentum: true,
  dragSnapToOrigin: true,
  dragTransition: true,
  dragControls: true,
  _dragX: true,
  _dragY: true,
  onDragStart: true,
  onDrag: true,
  onDragEnd: true,
  onDirectionLock: true,
  onMeasureDragConstraints: true,
  onDragTransitionEnd: true,
  layout: true,
  layoutId: true,
  layoutDependency: true,
  layoutScroll: true,
  layoutRoot: true,
  layoutAnchor: true,
  layoutCrossfade: true,
  nativeLayoutPortal: true,
  onBeforeLayoutMeasure: true,
  onLayoutMeasure: true,
  onLayoutAnimationStart: true,
  onLayoutAnimationComplete: true,
  viewport: true,
  onViewportEnter: true,
  onViewportLeave: true,
} as const satisfies Record<keyof TNativeMotionOwnerProps, true>

export const splitNativeCardMotionProps = <T extends TNativeMotionOwnerProps>(props: T) => {
  const nativeProps = { ...props }
  const motion: TNativeMotionOwnerProps = {}
  for (const key of Object.keys(NATIVE_CARD_MOTION_FIELDS) as (keyof TNativeMotionOwnerProps)[]) {
    if (Object.hasOwn(props, key)) Object.assign(motion, { [key]: props[key] })
    delete nativeProps[key]
  }
  return { motion, nativeProps: nativeProps as Omit<T, keyof TNativeMotionOwnerProps> }
}
