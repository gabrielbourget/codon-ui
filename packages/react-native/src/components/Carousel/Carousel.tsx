import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
} from "react"
import {
  AppState,
  findNodeHandle,
  I18nManager,
  useColorScheme,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type TextStyle,
  type StyleProp,
} from "react-native"

import { nativeAccessibilityIDs } from "../../input/accessibilityReferences"
import { nativeKeyTokens } from "../../input/keyScope"
import { NativeFocusHost } from "../../input/NativeFocusView"
import {
  useNativeKeyboardObservation,
  useNativeKeyPolicy,
  useNativeKeyScope,
  useNativeWindowPointers,
} from "../../input/NativeKeyboardScope"
import type { TNativeKeyboardEvent } from "../../input/types"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { resolveNativeStyle } from "../colors"
import { useNativeLoaderReducedMotion } from "../Loaders/motion"

import { CarouselContent } from "./CarouselContent"
import { NativeCarouselContext, resolveNativeCarouselLabels } from "./CarouselContext"
import type { TNativeBaseCarouselItem, TNativeCarouselContext, TNativeCarouselProps } from "./carouselTypes"
import { NativeCarouselControlsContext } from "./context"
import EmblaCarousel, { type EmblaCarouselType } from "./engine/EmblaCarousel"
import {
  createNativeCarouselEnvironment,
  createNativeCarouselEvents,
  type TNativeCarouselNodeBinding,
  type TNativeCarouselContainerBinding,
  type TNativeCarouselPointerEvent,
} from "./engine/nativeEnvironment"

type THostProps = Omit<ComponentProps<typeof NativeFocusHost>, "style"> & {
  style?: StyleProp<TextStyle>
  identity: string
  attach: (identity: string, binding: TNativeCarouselNodeBinding | null) => void
  invalidate: () => void
  core?: boolean
}
// Each binding retains the original Fabric host and the actual event which invalidated its geometry.
const CarouselHost = ({
  identity,
  attach,
  invalidate,
  core = false,
  style,
  onLayout,
  children,
  ...props
}: THostProps) => {
  const node = useRef<View | null>(null)
  const latestStyle = useRef(style)
  const [events] = useState(createNativeCarouselEvents)
  useInsertionEffect(() => {
    latestStyle.current = style
  })
  const ref = useCallback(
    (value: View | null) => {
      node.current = value
      attach(
        identity,
        value
          ? { node: value, events, style: () => latestStyle.current, isCurrent: () => node.current === value }
          : null,
      )
    },
    [identity, attach, events],
  )
  const layout: NonNullable<THostProps["onLayout"]> = (event) => {
    onLayout?.(event)
    events.emit("layout", event)
    invalidate()
  }
  const { onFocus: _onFocus, onBlur: _onBlur, ...coreProps } = props
  return (
    <CarouselContent
      style={resolveNativeStyle(style, "Carousel", identity)}
      render={(viewStyle, content) =>
        core ? (
          <View {...coreProps} ref={ref} style={viewStyle} onLayout={layout}>
            {content}
          </View>
        ) : (
          <NativeFocusHost
            {...props}
            ref={ref}
            style={viewStyle}
            onLayout={layout}
            nativeFocusWithinObservation
            nativeOnFocusWithin={(event) => {
              props.nativeOnFocusWithin?.(event)
              if (event.nativeEvent.within) events.emit("focus", event)
            }}
          >
            {content}
          </NativeFocusHost>
        )
      }
    >
      {children}
    </CarouselContent>
  )
}
const unmodifiedTokens = (key: string) =>
  nativeKeyTokens(key).filter((token) => token.startsWith("0000:") || token.startsWith("1000:"))
const nothing = () => () => {}

export const Carousel = <TItem extends TNativeBaseCarouselItem>(props: TNativeCarouselProps<TItem>) => {
  const {
    items,
    initialIndex = 0,
    loopEnabled = true,
    axis = "x",
    align = "center",
    renderCarouselItem,
    onIndexChange,
    onViewportRefChange,
    getItemID,
    chromeSlot,
    chromeOverlayStrategy = "overlay",
    keyboardNavigationTarget = "viewport",
    enableKeyboardNavigation = true,
    enableHomeEndKeys = true,
  } = props
  const keyScope = useNativeKeyScope()
  const pointers = useNativeWindowPointers()
  const floatingScope = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const owner = useId()
  const dimensions = useWindowDimensions()
  const scheme = useColorScheme()
  const colorScheme = scheme === "light" || scheme === "dark" ? scheme : null
  const reducedMotion = useNativeLoaderReducedMotion()
  const [appActive, setAppActive] = useState(
    AppState.currentState !== "background" && AppState.currentState !== "inactive",
  )
  const [events] = useState(createNativeCarouselEvents)
  const bindings = useRef(new Map<string, TNativeCarouselNodeBinding>())
  const mounted = useRef(true)
  const [revision, setRevision] = useState(0)
  const invalidate = useCallback(() => {
    if (mounted.current) setRevision((value) => value + 1)
  }, [])
  const attach = useCallback(
    (identity: string, binding: TNativeCarouselNodeBinding | null) => {
      if (binding) bindings.current.set(identity, binding)
      else bindings.current.delete(identity)
      invalidate()
    },
    [invalidate],
  )
  const [api, setApi] = useState<EmblaCarouselType | null>(null)
  const activeEngine = useRef<{ api: EmblaCarouselType; viewport: View; options: string; nodes: View[] } | null>(null)
  const [selection, setSelection] = useState({ selectedIndex: 0, canScrollPrev: false, canScrollNext: false })
  useSyncExternalStore(keyScope?.subscribe ?? nothing, keyScope?.snapshot ?? (() => 0), () => 0)
  const session = keyScope?.acknowledgedSession()
  const active =
    appActive && keyScope?.isWindowActive() !== false && floatingScope?.canAct() !== false && windowActive?.() !== false
  const live = useRef({
    active,
    window: {
      ...dimensions,
      windowId: session?.windowId ?? "",
      epoch: session?.epoch ?? 0,
      isRTL: I18nManager.isRTL,
      colorScheme,
      reducedMotion,
    },
  })
  useInsertionEffect(() => {
    live.current = {
      active,
      window: {
        ...dimensions,
        windowId: session?.windowId ?? "",
        epoch: session?.epoch ?? 0,
        isRTL: I18nManager.isRTL,
        colorScheme,
        reducedMotion,
      },
    }
  })
  const canAct = useCallback(() => mounted.current && live.current.active, [])
  const keys = items.map((item, index) => String(item.ID ?? item.publicId ?? index))
  const slideIdentities = keys.map((key) => `slide:${key}`)
  const viewportCallback = useCallback(
    (identity: string, binding: TNativeCarouselNodeBinding | null) => {
      attach(identity, binding)
      onViewportRefChange?.(binding?.node ?? null)
    },
    [attach, onViewportRefChange],
  )
  useLayoutEffect(() => {
    const viewport = bindings.current.get("viewport"),
      container = bindings.current.get("container")
    const slides = slideIdentities.map((identity) => bindings.current.get(identity))
    if (!viewport || !container || slides.some((slide) => !slide)) return
    const nodes = slides as TNativeCarouselNodeBinding[]
    const width = Reflect.get(viewport.node, "offsetWidth"),
      height = Reflect.get(viewport.node, "offsetHeight")
    if (!(typeof width === "number" && typeof height === "number") || (axis === "x" ? width : height) <= 0) return
    const options = JSON.stringify([loopEnabled, axis, align])
    const currentNodes = () => {
      const root = bindings.current.get("viewport"),
        parent = bindings.current.get("container")
      if (!root || !parent) throw new Error("Carousel: native host detached")
      const children = () => currentSlides.current.flatMap((identity) => bindings.current.get(identity) ?? [])
      const containerBinding: TNativeCarouselContainerBinding = { ...parent, children }
      return { root, container: containerBinding, slides: children() }
    }
    let current = activeEngine.current
    if (current?.viewport !== viewport.node) {
      current?.api.destroy()
      const environment = createNativeCarouselEnvironment({
        nodes: currentNodes,
        window: () => live.current.window,
        active: canAct,
        events,
      })
      const next = EmblaCarousel(viewport.node, environment.document, {
        loop: loopEnabled,
        axis,
        align,
        dragFree: false,
        skipSnaps: false,
      })
      next.on("reInit", invalidate)
      current = { api: next, viewport: viewport.node, options, nodes: nodes.map(({ node }) => node) }
      activeEngine.current = current
      setApi(next)
    } else if (current.options !== options) {
      current.options = options
      current.nodes = nodes.map(({ node }) => node)
      current.api.reInit({ loop: loopEnabled, axis, align, dragFree: false, skipSnaps: false })
    } else if (
      current.nodes.length !== nodes.length ||
      current.nodes.some((node, index) => node !== nodes[index].node)
    ) {
      const previousNodes = current.nodes
      current.nodes = nodes.map(({ node }) => node)
      containerEvents.current?.emit("mutations", [{ target: container.node, previousNodes, nodes: current.nodes }])
    }
  })
  const currentSlides = useRef(slideIdentities)
  currentSlides.current = slideIdentities
  // The container event source also receives genuine React child-list commits.
  const containerEvents = useRef<ReturnType<typeof createNativeCarouselEvents> | null>(null)
  const attachContainer = useCallback(
    (identity: string, binding: TNativeCarouselNodeBinding | null) => {
      containerEvents.current = binding?.events as ReturnType<typeof createNativeCarouselEvents> | null
      attach(identity, binding)
    },
    [attach],
  )
  const requested = useRef<{ api: EmblaCarouselType; index: number; count: number } | null>(null)
  useEffect(() => {
    if (!api) return
    const previous = requested.current
    if (previous?.api === api && Object.is(previous.index, initialIndex) && previous.count === items.length) return
    const actual = api.slideNodes()
    if (
      actual.length !== items.length ||
      actual.some((node, index) => node !== bindings.current.get(currentSlides.current[index])?.node)
    )
      return
    requested.current = { api, index: initialIndex, count: items.length }
    api.scrollTo(Math.max(0, Math.min(items.length - 1, initialIndex)), true)
  }, [api, initialIndex, items.length, revision])
  useEffect(() => {
    if (!api) return
    const select = () => {
      const selectedIndex = api.selectedScrollSnap()
      setSelection({ selectedIndex, canScrollPrev: api.canScrollPrev(), canScrollNext: api.canScrollNext() })
      onIndexChange?.(selectedIndex)
    }
    select()
    api.on("select", select).on("reInit", select)
    return () => {
      api.off("select", select).off("reInit", select)
    }
  }, [api, onIndexChange])
  useEffect(() => {
    events.emit("window", live.current.window)
    events.emit("visibility", live.current.active)
  }, [
    events,
    active,
    appActive,
    dimensions,
    colorScheme,
    reducedMotion,
    session?.windowId,
    session?.epoch,
    keyScope?.snapshot(),
  ])
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setAppActive(state === "active"))
    return () => subscription.remove()
  }, [])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      activeEngine.current?.api.destroy()
      activeEngine.current = null
      events.clear()
    }
  }, [events])
  const inputDriver = useRef<"window" | "touch" | null>(null)
  const pointer = useCallback(
    (event: TNativeCarouselPointerEvent, phase: "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel") => {
      if (!canAct()) return
      const viewportEvents = bindings.current.get("viewport")?.events as
        | ReturnType<typeof createNativeCarouselEvents>
        | undefined
      if (phase === "pointerDown") viewportEvents?.emit(phase, event)
      events.emit(phase, event)
    },
    [canAct, events],
  )
  useLayoutEffect(() => {
    const viewport = bindings.current.get("viewport")?.node,
      targetTag = viewport && findNodeHandle(viewport)
    if (!pointers || !targetTag || !api) return
    const remove = pointers.register(owner, {
      targetTag,
      global: false,
      stopPropagation: false,
      current: canAct,
      start: (event) => {
        if (inputDriver.current === "touch") return false
        inputDriver.current = "window"
        pointer(event, "pointerDown")
        return true
      },
      move: (event) => pointer(event, "pointerMove"),
      end: (event, success) => {
        pointer(event, success ? "pointerUp" : "pointerCancel")
        inputDriver.current = null
      },
      activate: () => {},
      retire: () => {
        api.internalEngine().dragHandler.retire()
        inputDriver.current = null
      },
    })
    pointers.flush()
    return () => {
      remove()
      pointers.flush()
    }
  }, [api, pointers, owner, pointer, canAct])
  const touch = (
    event: GestureResponderEvent,
    phase: "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel",
  ) => {
    if (inputDriver.current === "window") {
      if (phase === "pointerDown" && event.nativeEvent.touches.length > 1) events.emit("pointerDown", event)
      return
    }
    if (phase === "pointerDown") inputDriver.current = "touch"
    if (inputDriver.current !== "touch") return
    pointer(event, phase)
    if (phase === "pointerUp" || phase === "pointerCancel") inputDriver.current = null
  }
  const targetTag = bindings.current.get(keyboardNavigationTarget)?.node
  const keyboardTargetTag = targetTag ? (findNodeHandle(targetTag) ?? undefined) : undefined
  const handleKey = (event: TNativeKeyboardEvent) => {
    if (
      !api ||
      !canAct() ||
      !enableKeyboardNavigation ||
      event.nativeEvent.altKey ||
      event.nativeEvent.ctrlKey ||
      event.nativeEvent.metaKey
    )
      return
    const key = event.nativeEvent.key
    if (key === (axis === "x" ? "ArrowLeft" : "ArrowUp")) {
      event.preventDefault()
      api.scrollPrev()
    } else if (key === (axis === "x" ? "ArrowRight" : "ArrowDown")) {
      event.preventDefault()
      api.scrollNext()
    } else if (enableHomeEndKeys && (key === "Home" || key === "End")) {
      event.preventDefault()
      api.scrollTo(key === "Home" ? 0 : items.length - 1)
    }
  }
  useNativeKeyPolicy({
    tokens: [
      ...(axis === "x" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"]),
      ...(enableHomeEndKeys ? ["Home", "End"] : []),
    ].flatMap(unmodifiedTokens),
    excludeEditable: true,
    excludeComposing: false,
    isEnabled: !!api && !!keyboardTargetTag && enableKeyboardNavigation,
    targetTag: keyboardTargetTag,
    lifetimeKey: owner,
    canAct,
    onKey: handleKey,
  })
  useNativeKeyboardObservation({
    isEnabled: !!api,
    lifetimeKey: owner,
    canAct,
    onKeyDown: (event) => events.emit("keyDown", event),
  })
  const labels = useMemo(
    () => resolveNativeCarouselLabels(props.ariaLabel, props.labels),
    [props.ariaLabel, props.labels],
  )
  const scrollPrev = useCallback(() => api?.scrollPrev(), [api])
  const scrollNext = useCallback(() => api?.scrollNext(), [api])
  const scrollTo = useCallback((index: number) => api?.scrollTo(index), [api])
  const getItemIDForIndex = useCallback(
    (index: number) => getItemID?.(index) ?? `carousel-item-index-${index + 1}`,
    [getItemID],
  )
  const context = useMemo<TNativeCarouselContext>(
    () => ({
      emblaApi: api,
      ...selection,
      itemCount: items.length,
      scrollPrev,
      scrollNext,
      scrollTo,
      getItemIDForIndex,
      labels,
    }),
    [api, selection, items.length, scrollPrev, scrollNext, scrollTo, getItemIDForIndex, labels],
  )
  const controls = useMemo(() => ({ ...context, labels: labels.controls }), [context, labels])
  const chrome = typeof chromeSlot === "function" ? chromeSlot({ context, slot: "custom" }) : chromeSlot
  const rootStyle = resolveNativeStyle(
    [{ overflow: "hidden", width: "100%", height: "100%" }, props.customStyles, props.style],
    "Carousel",
    "style",
  )
  const viewportStyle = resolveNativeStyle(
    [{ overflow: "hidden", width: "100%", height: "100%" }, props.customViewportStyles],
    "Carousel",
    "customViewportStyles",
  )
  const containerStyle = resolveNativeStyle(
    [{ flexDirection: "row", height: "100%" }, props.customContainerStyles],
    "Carousel",
    "customContainerStyles",
  )
  const itemStyle = resolveNativeStyle(
    [
      {
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: "100%",
        minWidth: 0,
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
      },
      props.customItemStyles,
    ],
    "Carousel",
    "customItemStyles",
  )
  return (
    <NativeCarouselContext.Provider value={context}>
      <NativeCarouselControlsContext.Provider value={controls}>
        <CarouselHost
          identity="root"
          attach={attach}
          invalidate={invalidate}
          testID={props.testID ?? props["data-testid"] ?? "carousel"}
          role="region"
          accessibilityRole="summary"
          accessibilityLabel={labels.root.ariaLabel}
          accessibilityHint={labels.root.ariaRoleDescription}
          nativeNavigation
          nativeNavigationLabel={labels.root.ariaRoleDescription}
          nativeLabelledBy={nativeAccessibilityIDs(props.dialogTitleID)}
          focusable={false}
          nativeTabStop={false}
          style={rootStyle}
        >
          <View
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={labels.root.liveRegionText({
              itemNumber: selection.selectedIndex + 1,
              itemCount: items.length,
            })}
            style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}
          />
          <CarouselHost
            identity="viewport"
            attach={viewportCallback}
            invalidate={invalidate}
            testID="carousel-viewport"
            style={viewportStyle}
            focusable={keyboardNavigationTarget === "viewport"}
            nativeTabStop={keyboardNavigationTarget === "viewport"}
            onTouchStart={(event) => touch(event, "pointerDown")}
            onTouchMove={(event) => touch(event, "pointerMove")}
            onTouchEnd={(event) => touch(event, "pointerUp")}
            onTouchCancel={(event) => touch(event, "pointerCancel")}
            onMoveShouldSetResponderCapture={(event) =>
              api
                ?.internalEngine()
                .dragHandler.shouldClaim(
                  event.nativeEvent.pageX,
                  event.nativeEvent.pageY,
                  event.nativeEvent.touches.length,
                ) ?? false
            }
            onResponderTerminationRequest={() => false}
          >
            <CarouselHost
              core
              identity="container"
              attach={attachContainer}
              invalidate={invalidate}
              style={containerStyle}
              testID="carousel-container"
            >
              {items.map((item, index) => (
                <CarouselHost
                  key={keys[index]}
                  identity={slideIdentities[index]}
                  attach={attach}
                  invalidate={invalidate}
                  nativeID={getItemIDForIndex(index)}
                  role="group"
                  accessibilityHint={labels.item.ariaRoleDescription}
                  accessibilityLabel={labels.item.ariaLabel({ itemNumber: index + 1, itemCount: items.length })}
                  accessibilityState={{ selected: index === selection.selectedIndex }}
                  focusable={false}
                  nativeTabStop={false}
                  style={itemStyle}
                >
                  {renderCarouselItem({ item, index, isSelected: index === selection.selectedIndex })}
                </CarouselHost>
              ))}
            </CarouselHost>
          </CarouselHost>
          {chromeSlot ? (
            chromeOverlayStrategy === "overlay" ? (
              <CarouselHost
                core
                identity="chrome"
                attach={attach}
                invalidate={invalidate}
                testID="carousel-chrome"
                pointerEvents="box-none"
                style={resolveNativeStyle(
                  [{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }, props.customChromeStyles],
                  "Carousel",
                  "customChromeStyles",
                )}
              >
                {chrome}
              </CarouselHost>
            ) : (
              chrome
            )
          ) : null}
        </CarouselHost>
      </NativeCarouselControlsContext.Provider>
    </NativeCarouselContext.Provider>
  )
}
