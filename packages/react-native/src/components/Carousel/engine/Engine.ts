// Adapted from Embla Carousel8.6.0; MIT notice in LICENSE.
import { Alignment } from "./Alignment"
import type { AnimationsType, AnimationsUpdateType, AnimationsRenderType } from "./Animations"
import { Animations } from "./Animations"
import type { AxisType } from "./Axis"
import { Axis } from "./Axis"
import type { CounterType } from "./Counter"
import { Counter } from "./Counter"
import type { DragHandlerType } from "./DragHandler"
import { DragHandler } from "./DragHandler"
import { DragTracker } from "./DragTracker"
import type { EventHandlerType } from "./EventHandler"
import type { EventStoreType } from "./EventStore"
import { EventStore } from "./EventStore"
import type { LimitType } from "./Limit"
import type { TNativeCarouselDocument, TNativeCarouselNode } from "./nativeEnvironment"
import type { NodeRectType } from "./NodeRects"
import { NodeRects } from "./NodeRects"
import type { OptionsType } from "./Options"
import type { PercentOfViewType } from "./PercentOfView"
import { PercentOfView } from "./PercentOfView"
import type { ResizeHandlerType } from "./ResizeHandler"
import { ResizeHandler } from "./ResizeHandler"
import type { ScrollBodyType } from "./ScrollBody"
import { ScrollBody } from "./ScrollBody"
import type { ScrollBoundsType } from "./ScrollBounds"
import { ScrollBounds } from "./ScrollBounds"
import { ScrollContain } from "./ScrollContain"
import { ScrollLimit } from "./ScrollLimit"
import type { ScrollLooperType } from "./ScrollLooper"
import { ScrollLooper } from "./ScrollLooper"
import type { ScrollProgressType } from "./ScrollProgress"
import { ScrollProgress } from "./ScrollProgress"
import { ScrollSnaps } from "./ScrollSnaps"
import type { ScrollTargetType } from "./ScrollTarget"
import { ScrollTarget } from "./ScrollTarget"
import type { ScrollToType } from "./ScrollTo"
import { ScrollTo } from "./ScrollTo"
import type { SlideFocusType } from "./SlideFocus"
import { SlideFocus } from "./SlideFocus"
import type { SlideLooperType } from "./SlideLooper"
import { SlideLooper } from "./SlideLooper"
import { SlideRegistry } from "./SlideRegistry"
import type { SlideRegistryType } from "./SlideRegistry"
import type { SlidesHandlerType } from "./SlidesHandler"
import { SlidesHandler } from "./SlidesHandler"
import type { SlidesInViewType } from "./SlidesInView"
import { SlidesInView } from "./SlidesInView"
import { SlideSizes } from "./SlideSizes"
import type { SlidesToScrollType } from "./SlidesToScroll"
import { SlidesToScroll } from "./SlidesToScroll"
import type { TranslateType } from "./Translate"
import { Translate } from "./Translate"
import type { WindowType } from "./utils"
import { arrayKeys, arrayLast, arrayLastIndex } from "./utils"
import type { Vector1DType } from "./Vector1d"
import { Vector1D } from "./Vector1d"

export type EngineType = {
  ownerDocument: TNativeCarouselDocument
  ownerWindow: WindowType
  eventHandler: EventHandlerType
  axis: AxisType
  animation: AnimationsType
  scrollBounds: ScrollBoundsType
  scrollLooper: ScrollLooperType
  scrollProgress: ScrollProgressType
  index: CounterType
  indexPrevious: CounterType
  limit: LimitType
  location: Vector1DType
  offsetLocation: Vector1DType
  previousLocation: Vector1DType
  options: OptionsType
  percentOfView: PercentOfViewType
  scrollBody: ScrollBodyType
  dragHandler: DragHandlerType
  eventStore: EventStoreType
  slideLooper: SlideLooperType
  slidesInView: SlidesInViewType
  slidesToScroll: SlidesToScrollType
  target: Vector1DType
  translate: TranslateType
  resizeHandler: ResizeHandlerType
  slidesHandler: SlidesHandlerType
  scrollTo: ScrollToType
  scrollTarget: ScrollTargetType
  scrollSnapList: number[]
  scrollSnaps: number[]
  slideIndexes: number[]
  slideFocus: SlideFocusType
  slideRegistry: SlideRegistryType["slideRegistry"]
  containerRect: NodeRectType
  slideRects: NodeRectType[]
}

export function Engine(
  root: TNativeCarouselNode,
  container: TNativeCarouselNode,
  slides: TNativeCarouselNode[],
  ownerDocument: TNativeCarouselDocument,
  ownerWindow: WindowType,
  options: OptionsType,
  eventHandler: EventHandlerType,
): EngineType {
  // Options
  const {
    align,
    axis: scrollAxis,
    direction,
    startIndex,
    loop,
    duration,
    dragFree,
    dragThreshold,
    inViewThreshold,
    slidesToScroll: groupSlides,
    skipSnaps,
    containScroll,
    watchResize,
    watchSlides,
    watchDrag,
    watchFocus,
  } = options

  // Measurements
  const pixelTolerance = 2
  const nodeRects = NodeRects()
  const containerRect = nodeRects.measure(container)
  const slideRects = slides.map(nodeRects.measure)
  const axis = Axis(scrollAxis, direction)
  const viewSize = axis.measureSize(containerRect)
  const percentOfView = PercentOfView(viewSize)
  const alignment = Alignment(align, viewSize)
  const containSnaps = !loop && !!containScroll
  const readEdgeGap = loop || !!containScroll
  const { slideSizes, slideSizesWithGaps, startGap, endGap } = SlideSizes(
    axis,
    containerRect,
    slideRects,
    slides,
    readEdgeGap,
    ownerWindow,
  )
  const slidesToScroll = SlidesToScroll(
    axis,
    viewSize,
    groupSlides,
    loop,
    containerRect,
    slideRects,
    startGap,
    endGap,
    pixelTolerance,
  )
  const { snaps, snapsAligned } = ScrollSnaps(axis, alignment, containerRect, slideRects, slidesToScroll)
  const contentSize = -arrayLast(snaps) + arrayLast(slideSizesWithGaps)
  const { snapsContained, scrollContainLimit } = ScrollContain(
    viewSize,
    contentSize,
    snapsAligned,
    containScroll,
    pixelTolerance,
  )
  const scrollSnaps = containSnaps ? snapsContained : snapsAligned
  const { limit } = ScrollLimit(contentSize, scrollSnaps, loop)

  // Indexes
  const index = Counter(arrayLastIndex(scrollSnaps), startIndex, loop)
  const indexPrevious = index.clone()
  const slideIndexes = arrayKeys(slides)

  // Animation
  const update: AnimationsUpdateType = ({ dragHandler, scrollBody, scrollBounds, options: { loop } }) => {
    if (!loop) scrollBounds.constrain(dragHandler.pointerDown())
    scrollBody.seek()
  }

  const render: AnimationsRenderType = (
    {
      scrollBody,
      translate,
      location,
      offsetLocation,
      previousLocation,
      scrollLooper,
      slideLooper,
      dragHandler,
      animation,
      eventHandler,
      scrollBounds,
      options: { loop },
    },
    alpha,
  ) => {
    const shouldSettle = scrollBody.settled()
    const withinBounds = !scrollBounds.shouldConstrain()
    const hasSettled = loop ? shouldSettle : shouldSettle && withinBounds
    const hasSettledAndIdle = hasSettled && !dragHandler.pointerDown()

    if (hasSettledAndIdle) animation.stop()

    const interpolatedLocation = location.get() * alpha + previousLocation.get() * (1 - alpha)

    offsetLocation.set(interpolatedLocation)

    if (loop) {
      scrollLooper.loop(scrollBody.direction())
      slideLooper.loop()
    }

    translate.to(offsetLocation.get())

    if (hasSettledAndIdle) eventHandler.emit("settle")
    if (!hasSettled) eventHandler.emit("scroll")
  }

  const animation = Animations(
    ownerDocument,
    ownerWindow,
    () => update(engine),
    (alpha: number) => render(engine, alpha),
  )

  // Shared
  const friction = 0.68
  const startLocation = scrollSnaps[index.get()]
  const location = Vector1D(startLocation)
  const previousLocation = Vector1D(startLocation)
  const offsetLocation = Vector1D(startLocation)
  const target = Vector1D(startLocation)
  const scrollBody = ScrollBody(location, offsetLocation, previousLocation, target, duration, friction)
  const scrollTarget = ScrollTarget(loop, scrollSnaps, contentSize, limit, target)
  const scrollTo = ScrollTo(animation, index, indexPrevious, scrollBody, scrollTarget, target, eventHandler)
  const scrollProgress = ScrollProgress(limit)
  const eventStore = EventStore(ownerDocument.environment)
  const slidesInView = SlidesInView(container, slides, eventHandler, inViewThreshold, ownerDocument)
  const { slideRegistry } = SlideRegistry(
    containSnaps,
    containScroll,
    scrollSnaps,
    scrollContainLimit,
    slidesToScroll,
    slideIndexes,
  )
  const slideFocus = SlideFocus(
    root,
    slides,
    slideRegistry,
    scrollTo,
    scrollBody,
    eventStore,
    eventHandler,
    watchFocus,
    ownerDocument,
  )

  // Engine
  const engine: EngineType = {
    ownerDocument,
    ownerWindow,
    eventHandler,
    containerRect,
    slideRects,
    animation,
    axis,
    dragHandler: DragHandler(
      axis,
      root,
      ownerDocument,
      ownerWindow,
      target,
      DragTracker(axis, ownerWindow),
      location,
      animation,
      scrollTo,
      scrollBody,
      scrollTarget,
      index,
      eventHandler,
      percentOfView,
      dragFree,
      dragThreshold,
      skipSnaps,
      friction,
      watchDrag,
    ),
    eventStore,
    percentOfView,
    index,
    indexPrevious,
    limit,
    location,
    offsetLocation,
    previousLocation,
    options,
    resizeHandler: ResizeHandler(container, eventHandler, ownerWindow, slides, axis, watchResize, nodeRects),
    scrollBody,
    scrollBounds: ScrollBounds(limit, offsetLocation, target, scrollBody, percentOfView),
    scrollLooper: ScrollLooper(contentSize, limit, offsetLocation, [
      location,
      offsetLocation,
      previousLocation,
      target,
    ]),
    scrollProgress,
    scrollSnapList: scrollSnaps.map(scrollProgress.get),
    scrollSnaps,
    scrollTarget,
    scrollTo,
    slideLooper: SlideLooper(
      axis,
      viewSize,
      contentSize,
      slideSizes,
      slideSizesWithGaps,
      snaps,
      scrollSnaps,
      offsetLocation,
      slides,
      ownerDocument.environment,
    ),
    slideFocus,
    slidesHandler: SlidesHandler(container, eventHandler, watchSlides, ownerDocument),
    slidesInView,
    slideIndexes,
    slideRegistry,
    slidesToScroll,
    target,
    translate: Translate(axis, container, ownerDocument.environment),
  }

  return engine
}
