// Adapted from Embla Carousel8.6.0; MIT notice in LICENSE.
import type { EngineType } from "./Engine"
import { Engine } from "./Engine"
import type { EventHandlerType } from "./EventHandler"
import { EventHandler } from "./EventHandler"
import type { TNativeCarouselDocument, TNativeCarouselNode } from "./nativeEnvironment"
import type { EmblaOptionsType, OptionsType } from "./Options"
import { defaultOptions } from "./Options"
import { OptionsHandler } from "./OptionsHandler"
import type { EmblaPluginsType, EmblaPluginType } from "./Plugins"
import { PluginsHandler } from "./PluginsHandler"

export type EmblaCarouselType = {
  canScrollNext: () => boolean
  canScrollPrev: () => boolean
  containerNode: () => TNativeCarouselNode
  internalEngine: () => EngineType
  destroy: () => void
  off: EventHandlerType["off"]
  on: EventHandlerType["on"]
  emit: EventHandlerType["emit"]
  plugins: () => EmblaPluginsType
  previousScrollSnap: () => number
  reInit: (options?: EmblaOptionsType, plugins?: EmblaPluginType[]) => void
  rootNode: () => TNativeCarouselNode
  scrollNext: (jump?: boolean) => void
  scrollPrev: (jump?: boolean) => void
  scrollProgress: () => number
  scrollSnapList: () => number[]
  scrollTo: (index: number, jump?: boolean) => void
  selectedScrollSnap: () => number
  slideNodes: () => TNativeCarouselNode[]
  slidesInView: () => number[]
  slidesNotInView: () => number[]
}

function EmblaCarousel(
  root: TNativeCarouselNode,
  ownerDocument: TNativeCarouselDocument,
  userOptions?: EmblaOptionsType,
  userPlugins?: EmblaPluginType[],
): EmblaCarouselType {
  const ownerWindow = ownerDocument.environment.window
  const optionsHandler = OptionsHandler(ownerWindow)
  const pluginsHandler = PluginsHandler(optionsHandler)
  const mediaHandlers = new Set<() => void>()
  const eventHandler = EventHandler()
  const { mergeOptions, optionsAtMedia, optionsMediaQueries } = optionsHandler
  const { on, off, emit } = eventHandler
  const reInit = reActivate

  let destroyed = false
  let initialEvent: ReturnType<typeof setTimeout> | undefined
  let engine: EngineType
  let optionsBase = mergeOptions(defaultOptions)
  let options = mergeOptions(optionsBase)
  let pluginList: EmblaPluginType[] = []
  let pluginApis: EmblaPluginsType

  let container: TNativeCarouselNode
  let slides: TNativeCarouselNode[]

  function storeElements(): void {
    const nodes = ownerDocument.environment.nodes()
    const selectedContainer = typeof options.container === "function" ? options.container(nodes) : options.container
    const containerBinding = selectedContainer ?? nodes.container
    if (!containerBinding || !containerBinding.node || typeof containerBinding.children !== "function")
      throw new TypeError("Carousel: a native container needs its original-node, children, style and event binding")
    ownerDocument.environment.register(containerBinding)
    container = containerBinding.node
    const selectedSlides = typeof options.slides === "function" ? options.slides(containerBinding) : options.slides
    const slideBindings = selectedSlides ?? containerBinding.children()
    for (const binding of slideBindings) ownerDocument.environment.register(binding)
    slides = slideBindings.map((binding) => binding.node)
  }

  function createEngine(options: OptionsType): EngineType {
    const engine = Engine(root, container, slides, ownerDocument, ownerWindow, options, eventHandler)

    if (options.loop && !engine.slideLooper.canLoop()) {
      const optionsWithoutLoop = Object.assign({}, options, { loop: false })
      return createEngine(optionsWithoutLoop)
    }
    return engine
  }

  function activate(withOptions?: EmblaOptionsType, withPlugins?: EmblaPluginType[]): void {
    if (destroyed) return

    optionsBase = mergeOptions(optionsBase, withOptions)
    options = optionsAtMedia(optionsBase)
    pluginList = withPlugins || pluginList

    storeElements()

    engine = createEngine(options)

    optionsMediaQueries([optionsBase, ...pluginList.map(({ options }) => options)]).forEach((query) =>
      mediaHandlers.add(query.subscribe(() => reActivate())),
    )

    if (!options.active) return

    engine.translate.to(engine.location.get())
    engine.animation.init()
    engine.slidesInView.init()
    engine.slideFocus.init(self)
    engine.eventHandler.init(self)
    engine.resizeHandler.init(self)
    engine.slidesHandler.init(self)

    if (engine.options.loop) engine.slideLooper.loop()
    if (Reflect.get(container, "offsetParent") !== null && slides.length) engine.dragHandler.init(self)

    pluginApis = pluginsHandler.init(self, pluginList)
  }

  function reActivate(withOptions?: EmblaOptionsType, withPlugins?: EmblaPluginType[]): void {
    if (destroyed) return
    const startIndex = selectedScrollSnap()
    deActivate()
    activate(mergeOptions({ startIndex }, withOptions), withPlugins)
    eventHandler.emit("reInit")
  }

  function deActivate(): void {
    engine.dragHandler.destroy()
    engine.eventStore.clear()
    engine.translate.clear()
    engine.slideLooper.clear()
    engine.resizeHandler.destroy()
    engine.slidesHandler.destroy()
    engine.slidesInView.destroy()
    engine.animation.destroy()
    pluginsHandler.destroy()
    mediaHandlers.forEach((remove) => remove())
    mediaHandlers.clear()
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true
    clearTimeout(initialEvent)
    mediaHandlers.forEach((remove) => remove())
    mediaHandlers.clear()
    deActivate()
    eventHandler.emit("destroy")
    eventHandler.clear()
  }

  function scrollTo(index: number, jump?: boolean, direction?: number): void {
    if (!options.active || destroyed) return
    engine.scrollBody.useBaseFriction().useDuration(jump === true ? 0 : options.duration)
    engine.scrollTo.index(index, direction || 0)
  }

  function scrollNext(jump?: boolean): void {
    const next = engine.index.add(1).get()
    scrollTo(next, jump, -1)
  }

  function scrollPrev(jump?: boolean): void {
    const prev = engine.index.add(-1).get()
    scrollTo(prev, jump, 1)
  }

  function canScrollNext(): boolean {
    const next = engine.index.add(1).get()
    return next !== selectedScrollSnap()
  }

  function canScrollPrev(): boolean {
    const prev = engine.index.add(-1).get()
    return prev !== selectedScrollSnap()
  }

  function scrollSnapList(): number[] {
    return engine.scrollSnapList
  }

  function scrollProgress(): number {
    return engine.scrollProgress.get(engine.offsetLocation.get())
  }

  function selectedScrollSnap(): number {
    return engine.index.get()
  }

  function previousScrollSnap(): number {
    return engine.indexPrevious.get()
  }

  function slidesInView(): number[] {
    return engine.slidesInView.get()
  }

  function slidesNotInView(): number[] {
    return engine.slidesInView.get(false)
  }

  function plugins(): EmblaPluginsType {
    return pluginApis
  }

  function internalEngine(): EngineType {
    return engine
  }

  function rootNode(): TNativeCarouselNode {
    return root
  }

  function containerNode(): TNativeCarouselNode {
    return container
  }

  function slideNodes(): TNativeCarouselNode[] {
    return slides
  }

  const self: EmblaCarouselType = {
    canScrollNext,
    canScrollPrev,
    containerNode,
    internalEngine,
    destroy,
    off,
    on,
    emit,
    plugins,
    previousScrollSnap,
    reInit,
    rootNode,
    scrollNext,
    scrollPrev,
    scrollProgress,
    scrollSnapList,
    scrollTo,
    selectedScrollSnap,
    slideNodes,
    slidesInView,
    slidesNotInView,
  }

  activate(userOptions, userPlugins)
  if (!destroyed)
    initialEvent = setTimeout(() => {
      if (!destroyed) eventHandler.emit("init")
    }, 0)
  return self
}

export default EmblaCarousel
