import { createRef } from "react"
import type { ScrollView, View } from "react-native"

import { nativeAnimationControls } from "../../../motion/animation"
import { NativeMotionConfig } from "../../../motion/config"
import { NativeDragControls } from "../../../motion/interactions/NativeDragControls"
import { motionValue } from "../../../motion/kernel"
import { NativeAnimatePresence } from "../../../motion/presence/NativeAnimatePresence"
import { NativeLayoutGroup } from "../../../motion/projection/NativeLayoutGroup"
import { Card } from "../Card"
import type { TNativeCardProps } from "../types"

export const card: TNativeCardProps = {
  initial: false,
  ignoreStrict: true,
  animate: ["visible", "settled"],
  exit: { opacity: 0 },
  custom: 0,
  inherit: false,
  variants: { visible: (custom) => ({ opacity: custom ? 0 : 1 }) },
  transition: { duration: 0.1, delayChildren: 0.2, staggerChildren: 0.1, when: "beforeChildren" },
  whileHover: "hover",
  whileTap: { scale: 0.95 },
  globalTapTarget: true,
  propagate: { tap: false },
  whileFocus: "focus",
  whileInView: { opacity: 1 },
  whileDrag: { scale: 1.05 },
  onAnimationStart: (definition) => void definition,
  onAnimationComplete: (definition) => void definition,
  onTap: (event, info) => {
    void event.nativeEvent
    const x: number = info.point.x
    void x
  },
  onPan: (event, info) => {
    void event.nativeEvent
    const velocity: number = info.velocity.y
    void velocity
  },
  onHoverStart: (event, info) => {
    const pointerId: number = event.nativeEvent.pointerId
    void [pointerId, info.point]
  },
  drag: "x",
  dragListener: false,
  dragDirectionLock: true,
  dragPropagation: false,
  dragElastic: { left: 0, right: 0.5 },
  dragMomentum: false,
  dragSnapToOrigin: "x",
  dragControls: new NativeDragControls(),
  dragConstraints: createRef<View>(),
  _dragX: motionValue(0),
  _dragY: motionValue(0),
  onDrag: (event, info) => void [event.nativeEvent, info.offset],
  onDirectionLock: (direction) => {
    const axis: "x" | "y" = direction
    void axis
  },
  onMeasureDragConstraints: (bounds) => ({ ...bounds, right: 100 }),
  viewport: { root: createRef<View>(), margin: "10% 0px", amount: "all", once: true },
  onViewportEnter: (entry) => {
    const actual: View = entry.target
    void [actual, entry.boundingClientRect, entry.isIntersecting]
  },
  layoutMode: "position",
  layout: true,
  layoutId: "same-card",
  layoutDependency: 0,
  layoutScroll: true,
  layoutRoot: true,
  layoutAnchor: { x: 0, y: 1 },
  layoutCrossfade: false,
  nativeLayoutPortal: true,
  onBeforeLayoutMeasure: (box) => void box.x.min,
  onLayoutMeasure: (box, previous) => void [box.x.min, previous.y.max],
  transformTemplate: (_latest, generated) => [{ scale: 1 }, ...generated],
  onUpdate: (latest) => void latest.opacity,
  width: 0,
  height: "auto",
  borderRadius: "50%",
  customStyles: { padding: 0 },
  style: [{ color: "navy" }, { width: "50%" }],
  role: "group",
  accessibilityLabel: "Native Card",
  onFocus: (event) => void event.nativeEvent,
  onKeyDown: (event) => {
    const kind: "keyboard" = event.nativeEvent.kind
    void kind
  },
}
export const ComposedPrivateCard = (
  <NativeMotionConfig reducedMotion="user" skipAnimations={false} transformPagePoint={(point) => point}>
    <NativeLayoutGroup id="cards" inherit="id">
      <NativeAnimatePresence mode="wait" custom={0}>
        <Card {...card} ref={createRef<View>()}>
          Static React content
        </Card>
      </NativeAnimatePresence>
    </NativeLayoutGroup>
  </NativeMotionConfig>
)
export const Controls = <Card animate={nativeAnimationControls()} values={{ opacity: motionValue(1) }} />
export const ScrollViewport = <Card viewport={{ root: createRef<ScrollView>() }} whileInView={{ opacity: 1 }} />
// @ts-expect-error Owned style retains its static native style contract.
export const MotionStyle = <Card style={{ opacity: motionValue(0) }} />
// @ts-expect-error Owned children retain their ReactNode contract.
export const MotionChildren = <Card>{motionValue(0)}</Card>
// @ts-expect-error DOM class plumbing is not a native styling API.
export const Class = <Card className="card" />
// @ts-expect-error Callback styles are not part of the canonical Card's owned style API.
export const CallbackStyle = <Card style={() => ({ opacity: 1 })} />
// @ts-expect-error Native dimensions do not accept CSS length strings.
export const CSSWidth = <Card width="320px" />
// @ts-expect-error Native radius has no auto keyword.
export const AutoRadius = <Card borderRadius="auto" />
// @ts-expect-error Card layoutMode remains the source's size/position union.
export const LayoutMode = <Card layoutMode="preserve-aspect" />
// @ts-expect-error Native refs remain actual View refs.
export const FakeRef = <Card ref={createRef<{ style: unknown }>()} />
// @ts-expect-error Native templates produce transform arrays.
export const CSSTransform = <Card transformTemplate={() => "translateX(10px)"} />
// @ts-expect-error Animation lifecycle callbacks do not receive press events.
export const Lifecycle = <Card onAnimationStart={(event: { nativeEvent: unknown }) => event.nativeEvent} />
// @ts-expect-error Tap callbacks preserve native events rather than browser pointer events.
export const DOMTap = <Card onTap={(event: { clientX: number }) => event.clientX} />
// @ts-expect-error Pan velocity remains numeric native point data.
export const Pan = <Card onPan={(_event, info: { velocity: string }) => info.velocity} />
// @ts-expect-error Drag constraints do not accept DOM selectors.
export const Constraints = <Card dragConstraints="#container" />
// @ts-expect-error Viewport roots remain actual native View refs.
export const Viewport = <Card viewport={{ root: createRef<{ getBoundingClientRect: () => unknown }>() }} />
// @ts-expect-error Layout callbacks retain native numeric boxes.
export const Measure = <Card onLayoutMeasure={(box: { x: string }) => box.x} />
// @ts-expect-error Native key callbacks keep the existing keyboard event shape.
export const Key = <Card onKeyDown={(event: { key: string }) => event.key} />
// @ts-expect-error Private measurement injection is not a Card caller prop.
export const Measurement = <Card resolveGeometry={() => undefined} />
// @ts-expect-error Private renderer state is not a Card caller prop.
export const PrivateOwner = <Card nativeMotionDrawingOwner />

// @ts-expect-error Propagation keeps the inherited tap option as a boolean.
export const Propagation = <Card propagate={{ tap: "false" }} />
// @ts-expect-error Global tap targeting is boolean rather than a DOM window.
export const GlobalTap = <Card globalTapTarget={globalThis} />

// @ts-expect-error Complete native target types reject CSS dimension strings.
export const AnimatedCSSWidth = <Card animate={{ width: "100px" }} />
// @ts-expect-error Full native feature accounting does not change ignoreStrict's boolean type.
export const InvalidStrict = <Card ignoreStrict="true" />
