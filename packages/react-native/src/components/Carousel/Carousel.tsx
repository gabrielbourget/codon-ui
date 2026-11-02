import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
} from "react"
import { AppState, findNodeHandle, I18nManager, ScrollView, View, type StyleProp, type TextStyle } from "react-native"

import { nativeAccessibilityIDs } from "../../input/accessibilityReferences"
import { nativeKeyTokens } from "../../input/keyScope"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyboardObservation, useNativeKeyPolicy, useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeKeyboardEvent } from "../../input/types"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { resolveNativeStyle } from "../colors"
import { useNativeLoaderReducedMotion } from "../Loaders/motion"

import { CarouselContent } from "./CarouselContent"
import { NativeCarouselContext, resolveNativeCarouselLabels } from "./CarouselContext"
import type { TNativeBaseCarouselItem, TNativeCarouselContext, TNativeCarouselProps } from "./carouselTypes"
import { NativeCarouselControlsContext } from "./context"
import { useNativeCarouselPaging } from "./useNativeCarouselPaging"

type THostProps = Omit<ComponentProps<typeof NativeFocusHost>, "style"> & {
  style?: StyleProp<TextStyle>
  core?: boolean
}
const CarouselHost = forwardRef<View, THostProps>(({ core = false, style, children, ...props }, ref) => {
  const { onFocus: _onFocus, onBlur: _onBlur, ...coreProps } = props
  return (
    <CarouselContent
      style={resolveNativeStyle(style, "Carousel", "host")}
      render={(viewStyle, content) =>
        core ? (
          <View {...coreProps} ref={ref} style={viewStyle}>
            {content}
          </View>
        ) : (
          <NativeFocusHost {...props} ref={ref} style={viewStyle}>
            {content}
          </NativeFocusHost>
        )
      }
    >
      {children}
    </CarouselContent>
  )
})
CarouselHost.displayName = "CarouselHost"

const CarouselSlide = ({
  identity,
  paging,
  ...props
}: THostProps & { identity: string; paging: ReturnType<typeof useNativeCarouselPaging> }) => {
  const original = useRef<View | null>(null)
  const attachItem = paging.attachItem
  const attach = useCallback(
    (node: View | null) => {
      original.current = node
      attachItem(identity, node)
    },
    [attachItem, identity],
  )
  return (
    <CarouselHost
      {...props}
      ref={attach}
      onLayout={(event) => {
        if (original.current) paging.measureItem(identity, original.current, event.nativeEvent.layout)
      }}
    />
  )
}
const unmodifiedTokens = (key: string) =>
  nativeKeyTokens(key).filter((token) => token.startsWith("0000:") || token.startsWith("1000:"))
const nothing = () => () => {}

export const Carousel = <TItem extends TNativeBaseCarouselItem>(props: TNativeCarouselProps<TItem>) => {
  const {
    items,
    initialIndex = 0,
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
  if (props.loopEnabled) throw new TypeError("Carousel: native paging is finite; loopEnabled must be false")
  const keyScope = useNativeKeyScope()
  const floatingScope = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const owner = useId()
  const reducedMotion = useNativeLoaderReducedMotion()
  const [appActive, setAppActive] = useState(
    AppState.currentState !== "background" && AppState.currentState !== "inactive",
  )
  useSyncExternalStore(keyScope?.subscribe ?? nothing, keyScope?.snapshot ?? (() => 0), () => 0)
  const session = keyScope?.acknowledgedSession()
  const active =
    appActive && keyScope?.isWindowActive() !== false && floatingScope?.canAct() !== false && windowActive?.() !== false
  const keys = items.map((item, index) => String(item.ID ?? item.publicId ?? index))
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
    [{ flexDirection: axis === "x" ? "row" : "column" }, props.customContainerStyles],
    "Carousel",
    "customContainerStyles",
  )
  const direction = [containerStyle.direction, viewportStyle.direction, rootStyle.direction].find(
    (value) => value === "ltr" || value === "rtl",
  )
  const isRTL = direction === "rtl" || (direction !== "ltr" && I18nManager.isRTL)
  const paging = useNativeCarouselPaging({
    keys,
    initialIndex,
    axis,
    align,
    isRTL,
    active,
    session: JSON.stringify([session?.windowId, session?.epoch]),
    reducedMotion,
    onIndexChange,
  })
  const [root, setRoot] = useState<View | null>(null)
  const [viewport, setViewport] = useState<View | null>(null)
  const viewportCallback = useCallback(
    (node: View | null) => {
      setViewport(node)
      onViewportRefChange?.(node)
    },
    [onViewportRefChange],
  )
  const horizontal = useRef<ScrollView | null>(null)
  const vertical = useRef<ScrollView | null>(null)
  const scrolling = paging.scrollView
  const attachHorizontal = useCallback(
    (node: ScrollView | null) => {
      horizontal.current = node
      if (axis === "x") scrolling.current = node
    },
    [axis, scrolling],
  )
  const attachVertical = useCallback(
    (node: ScrollView | null) => {
      vertical.current = node
      if (axis === "y") scrolling.current = node
    },
    [axis, scrolling],
  )
  useLayoutEffect(() => {
    const inactive = axis === "x" ? vertical.current : horizontal.current
    inactive?.scrollTo({ x: 0, y: 0, animated: false })
  }, [axis])
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setAppActive(state === "active"))
    return () => subscription.remove()
  }, [])
  const target = keyboardNavigationTarget === "root" ? root : viewport
  const handleKey = (event: TNativeKeyboardEvent) => {
    if (
      !paging.canAct() ||
      !enableKeyboardNavigation ||
      event.nativeEvent.altKey ||
      event.nativeEvent.ctrlKey ||
      event.nativeEvent.metaKey
    )
      return
    const key = event.nativeEvent.key
    if (key === (axis === "x" ? "ArrowLeft" : "ArrowUp")) {
      event.preventDefault()
      paging.scrollPrev()
    } else if (key === (axis === "x" ? "ArrowRight" : "ArrowDown")) {
      event.preventDefault()
      paging.scrollNext()
    } else if (enableHomeEndKeys && (key === "Home" || key === "End")) {
      event.preventDefault()
      paging.scrollTo(key === "Home" ? 0 : items.length - 1)
    }
  }
  useNativeKeyPolicy({
    tokens: [
      ...(axis === "x" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"]),
      ...(enableHomeEndKeys ? ["Home", "End"] : []),
    ].flatMap(unmodifiedTokens),
    excludeEditable: true,
    excludeComposing: false,
    isEnabled: !!target && !!paging.snapOffsets.length && enableKeyboardNavigation,
    targetTag: target ? (findNodeHandle(target) ?? undefined) : undefined,
    lifetimeKey: owner,
    canAct: paging.canAct,
    onKey: handleKey,
  })
  const lastTab = useRef(Number.NEGATIVE_INFINITY)
  useNativeKeyboardObservation({
    isEnabled: !!paging.snapOffsets.length,
    lifetimeKey: owner,
    canAct: paging.canAct,
    onKeyDown: (event) => {
      if (event.nativeEvent.key === "Tab") lastTab.current = Date.now()
    },
  })
  const labels = useMemo(
    () => resolveNativeCarouselLabels(props.ariaLabel, props.labels),
    [props.ariaLabel, props.labels],
  )
  const getItemIDForIndex = useCallback(
    (index: number) => getItemID?.(index) ?? `carousel-item-index-${index + 1}`,
    [getItemID],
  )
  const context: TNativeCarouselContext = {
    selectedIndex: paging.selectedIndex,
    itemCount: items.length,
    canScrollPrev: paging.canScrollPrev,
    canScrollNext: paging.canScrollNext,
    scrollPrev: paging.scrollPrev,
    scrollNext: paging.scrollNext,
    scrollTo: paging.scrollTo,
    getItemIDForIndex,
    labels,
  }
  const chrome = typeof chromeSlot === "function" ? chromeSlot({ context, slot: "custom" }) : chromeSlot
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
  const extent = axis === "x" ? paging.viewport.width : paging.viewport.height
  // Percent page sizes are relative to the viewport, not the unbounded scrolling content.
  if (typeof itemStyle.flexBasis === "string" && itemStyle.flexBasis.endsWith("%"))
    itemStyle.flexBasis = (Number.parseFloat(itemStyle.flexBasis) * extent) / 100
  const scrollProps = {
    scrollEventThrottle: 16,
    showsHorizontalScrollIndicator: false,
    showsVerticalScrollIndicator: false,
    nestedScrollEnabled: true,
    decelerationRate: "fast" as const,
    keyboardShouldPersistTaps: "handled" as const,
    removeClippedSubviews: false,
    scrollsChildToFocus: false,
    bounces: false,
    overScrollMode: "never" as const,
  }
  const observationProps = {
    onScroll: paging.onScroll,
    onScrollBeginDrag: paging.onScrollBeginDrag,
    onScrollEndDrag: paging.onScrollEndDrag,
    onMomentumScrollEnd: paging.onMomentumScrollEnd,
    onContentSizeChange: paging.measureContent,
    snapToOffsets: paging.snapOffsets.length ? [...paging.snapOffsets] : undefined,
  }
  return (
    <NativeCarouselContext.Provider value={context}>
      <NativeCarouselControlsContext.Provider value={{ ...context, labels: labels.controls }}>
        <CarouselHost
          ref={setRoot}
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
              itemNumber: paging.selectedIndex + 1,
              itemCount: items.length,
            })}
            style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}
          />
          <CarouselHost
            ref={viewportCallback}
            testID="carousel-viewport"
            style={viewportStyle}
            focusable={keyboardNavigationTarget === "viewport"}
            nativeTabStop={keyboardNavigationTarget === "viewport"}
          >
            {/* Fixed native scroller types preserve the original item subtree when the axis changes. */}
            <ScrollView
              {...scrollProps}
              {...(axis === "y" ? observationProps : {})}
              ref={attachVertical}
              testID="carousel-scroll-y"
              onLayout={(event) => paging.measureViewport(event.nativeEvent.layout)}
              scrollEnabled={active && axis === "y" && !!paging.snapOffsets.length}
              style={{ width: "100%", height: "100%", direction: "ltr" }}
              contentContainerStyle={{ flexGrow: 1, direction: "ltr" }}
            >
              <ScrollView
                {...scrollProps}
                {...(axis === "x" ? observationProps : {})}
                ref={attachHorizontal}
                horizontal
                testID="carousel-scroll-x"
                scrollEnabled={active && axis === "x" && !!paging.snapOffsets.length}
                style={{
                  flexGrow: 0,
                  flexShrink: 0,
                  width: paging.viewport.width || "100%",
                  height: axis === "x" ? paging.viewport.height || "100%" : undefined,
                  direction: "ltr",
                }}
                contentContainerStyle={{ flexGrow: 1, direction: "ltr" }}
              >
                <CarouselHost
                  core
                  testID="carousel-container"
                  onLayout={(event) => paging.measureContainer(event.nativeEvent.layout)}
                  style={[
                    {
                      minWidth: paging.viewport.width,
                      minHeight: paging.viewport.height,
                      ...(axis === "x" ? { height: paging.viewport.height } : { width: paging.viewport.width }),
                      direction: isRTL ? "rtl" : "ltr",
                    },
                    containerStyle,
                    { direction: isRTL ? "rtl" : "ltr" },
                  ]}
                >
                  {items.map((item, index) => (
                    <CarouselSlide
                      key={keys[index]}
                      identity={keys[index]}
                      paging={paging}
                      nativeID={getItemIDForIndex(index)}
                      role="group"
                      accessibilityHint={labels.item.ariaRoleDescription}
                      accessibilityLabel={labels.item.ariaLabel({ itemNumber: index + 1, itemCount: items.length })}
                      accessibilityState={{ selected: index === paging.selectedIndex }}
                      focusable={false}
                      nativeTabStop={false}
                      nativeFocusWithinObservation
                      nativeOnFocusWithin={(event) => {
                        if (event.nativeEvent.within && Date.now() - lastTab.current <= 10)
                          paging.scrollTo(index, { animated: false })
                      }}
                      style={itemStyle}
                    >
                      {renderCarouselItem({ item, index, isSelected: index === paging.selectedIndex })}
                    </CarouselSlide>
                  ))}
                </CarouselHost>
              </ScrollView>
            </ScrollView>
          </CarouselHost>
          {chromeSlot ? (
            chromeOverlayStrategy === "overlay" ? (
              <CarouselHost
                core
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
