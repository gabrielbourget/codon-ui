"use client"

import useEmblaCarousel from "embla-carousel-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import styles from "./CarouselStyles.module.css"
import type {
  TBaseCarouselItem,
  TCarouselChromeSlot,
  TCarouselContext,
  TCarouselProps,
  TCarouselState,
} from "./helpers"
import {
  calibrateComponent,
  CAROUSEL_ALIGNMENT_AXIS__X,
  CAROUSEL_ALIGNMENT_AXIS__Y,
  CAROUSEL_CHROME_OVERLAY_STRATEGY__OVERLAY,
  CAROUSEL_KEYBOARD_NAV_TARGET__ROOT,
  CAROUSEL_KEYBOARD_NAV_TARGET__VIEWPORT,
  CarouselContext,
  clamp,
  computeEmblaOptions,
  DEFAULT_CAROUSEL_ARIA_LABEL,
  DEFAULT_CAROUSEL_CHROME_OVERLAY_STRATEGY,
  DEFAULT_CAROUSEL_ITEM_INDEX,
  DEFAULT_CAROUSEL_KEYBOARD_NAV_STATUS,
  DEFAULT_CAROUSEL_KEYBOARD_NAV_TARGET,
  DEFAULT_ENABLE_HOME_END_KEYS_STATUS,
  initState,
  resolveCarouselLabels,
  useHandleKeyDown,
} from "./helpers"

const Carousel = <TItem extends TBaseCarouselItem>(props: TCarouselProps<TItem>) => {
  const {
    "data-testid": dataTestID,
    items,
    initialIndex = DEFAULT_CAROUSEL_ITEM_INDEX,
    renderCarouselItem,
    onIndexChange,
    chromeSlot,
    chromeOverlayStrategy = DEFAULT_CAROUSEL_CHROME_OVERLAY_STRATEGY,
    enableKeyboardNavigation = DEFAULT_CAROUSEL_KEYBOARD_NAV_STATUS,
    enableHomeEndKeys = DEFAULT_ENABLE_HOME_END_KEYS_STATUS,
    keyboardNavigationTarget = DEFAULT_CAROUSEL_KEYBOARD_NAV_TARGET,
    ariaLabel = DEFAULT_CAROUSEL_ARIA_LABEL,
    labels,
    dialogTitleID,
    getItemID,
    onViewportRefChange,
  } = props

  const [state, setState] = useState<TCarouselState>(initState)
  const {
    carouselStyles,
    carouselStyle,
    viewportStyles,
    viewportStyle,
    containerStyles,
    containerStyle,
    chromeStyles,
    chromeStyle,
    itemStyles,
    itemStyle,
  } = calibrateComponent(props)

  const emblaOptions = computeEmblaOptions(props)
  const [emblaRef, emblaApi] = useEmblaCarousel(emblaOptions)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const alignmentAxis = emblaOptions.axis === "y" ? CAROUSEL_ALIGNMENT_AXIS__Y : CAROUSEL_ALIGNMENT_AXIS__X

  const setViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node
      emblaRef(node)
      onViewportRefChange?.(node)
    },
    [emblaRef, onViewportRefChange],
  )

  // -> Navigate to the requested starting item when Embla is ready.
  useEffect(() => {
    if (!emblaApi) return

    const clampedIndex = clamp({ number: initialIndex, min: 0, max: items.length - 1 })
    emblaApi.scrollTo(clampedIndex, true)
  }, [emblaApi, initialIndex, items.length])

  // -> Subscribe and react to selection changes.
  useEffect(() => {
    if (!emblaApi) return

    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap()
      setState((prev) => ({
        ...prev,
        selectedIndex: index,
        canScrollPrev: emblaApi.canScrollPrev(),
        canScrollNext: emblaApi.canScrollNext(),
      }))
      if (onIndexChange) onIndexChange(index)
    }

    onSelect()
    emblaApi.on("select", onSelect)
    emblaApi.on("reInit", onSelect)

    return () => {
      emblaApi.off("select", onSelect)
      emblaApi.off("reInit", onSelect)
    }
  }, [emblaApi, onIndexChange])

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])
  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi])
  const resolvedLabels = useMemo(() => resolveCarouselLabels({ ariaLabel, labels }), [ariaLabel, labels])

  const getItemIDForIndex = useCallback(
    (index: number) => getItemID?.(index) ?? `carousel-item-index-${index + 1}`,
    [getItemID],
  )

  const carouselContextValue = useMemo<TCarouselContext>(
    () => ({
      emblaApi: emblaApi ?? null,
      selectedIndex: state.selectedIndex,
      itemCount: items.length,
      canScrollPrev: state.canScrollPrev,
      canScrollNext: state.canScrollNext,
      scrollPrev,
      scrollNext,
      scrollTo,
      getItemIDForIndex,
      labels: resolvedLabels,
    }),
    [
      emblaApi,
      state.selectedIndex,
      items.length,
      state.canScrollPrev,
      state.canScrollNext,
      scrollPrev,
      scrollNext,
      scrollTo,
      getItemIDForIndex,
      resolvedLabels,
    ],
  )

  const handleKeyDown = useHandleKeyDown({
    items,
    enableHomeEndKeys,
    enableKeyboardNavigation,
    alignmentAxis,
    emblaApi,
  })

  const rootA11yProps = {
    role: "region",
    "aria-roledescription": resolvedLabels.root.ariaRoleDescription,
    "aria-label": resolvedLabels.root.ariaLabel,
  }

  const viewportA11yProps =
    keyboardNavigationTarget === CAROUSEL_KEYBOARD_NAV_TARGET__VIEWPORT ? { tabIndex: 0, onKeyDown: handleKeyDown } : {}

  const rootKeydownProps =
    keyboardNavigationTarget === CAROUSEL_KEYBOARD_NAV_TARGET__ROOT ? { onKeyDown: handleKeyDown } : {}

  const normalizedChromeSlot =
    typeof chromeSlot === "function"
      ? chromeSlot({ context: carouselContextValue, slot: "custom" as TCarouselChromeSlot })
      : chromeSlot

  const { selectedIndex } = state

  return (
    <CarouselContext.Provider value={carouselContextValue}>
      <section
        className={carouselStyles}
        style={carouselStyle}
        aria-labelledby={dialogTitleID}
        data-testid={dataTestID ?? "carousel"}
        {...rootA11yProps}
        {...rootKeydownProps}
      >
        <div className={styles["sr-only"]}>
          <div aria-live="polite" aria-atomic="true">
            {resolvedLabels.root.liveRegionText({ itemNumber: state.selectedIndex + 1, itemCount: items.length })}
          </div>
        </div>
        <div className={viewportStyles} style={viewportStyle} ref={setViewportRef} {...viewportA11yProps}>
          <div className={containerStyles} style={containerStyle}>
            {items.map((item, index) => {
              const itemID = getItemIDForIndex(index)
              const isSelected = index === selectedIndex

              return (
                <div
                  key={item.ID ?? item.publicId ?? index}
                  id={itemID}
                  role="group"
                  aria-roledescription={resolvedLabels.item.ariaRoleDescription}
                  aria-label={resolvedLabels.item.ariaLabel({ itemNumber: index + 1, itemCount: items.length })}
                  aria-current={isSelected ? "true" : undefined}
                  className={itemStyles}
                  style={itemStyle}
                >
                  {renderCarouselItem({ item, index, isSelected })}
                </div>
              )
            })}
          </div>
        </div>

        {chromeSlot ? (
          chromeOverlayStrategy === CAROUSEL_CHROME_OVERLAY_STRATEGY__OVERLAY ? (
            <div className={chromeStyles} style={chromeStyle}>
              {normalizedChromeSlot}
            </div>
          ) : (
            normalizedChromeSlot
          )
        ) : null}
      </section>
    </CarouselContext.Provider>
  )
}

export default Carousel
