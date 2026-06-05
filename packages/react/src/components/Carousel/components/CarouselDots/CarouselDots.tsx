import React, { useEffect, useRef, type CSSProperties, type FC } from "react"

import { useCarouselContext } from "../../helpers"

import styles from "./CarouselDotsStyles.module.css"
import {
  CAROUSEL_DOTS_ACTIVATION_MODE__AUTO,
  computeClassNameForItemIndex,
  DEFAULT_CAROUSEL_DOTS_ACTIVATION_MODE,
  DEFAULT_DOTS_RAISED_STATUS,
  DEFAULT_INTERACTIVITY_STATUS,
  DEFAULT_LARGE_ZONE_SIZE,
  DEFAULT_SHOW_OVERFLOW_SENTINELS,
  useCalibratedComponent,
  useCarouselDotsKeyDownHandler,
  type TCarouselDotsProps,
} from "./helpers"

const CarouselDots: FC<TCarouselDotsProps> = (props) => {
  const {
    interactive = DEFAULT_INTERACTIVITY_STATUS,
    activationMode = DEFAULT_CAROUSEL_DOTS_ACTIVATION_MODE,
    showOverflowSentinels = DEFAULT_SHOW_OVERFLOW_SENTINELS,
    raised = DEFAULT_DOTS_RAISED_STATUS,
    customStyles,
    style,
    labels,
  } = props

  const { selectedIndex, itemCount, scrollTo, getItemIDForIndex, labels: carouselLabels } = useCarouselContext()
  const resolvedLabels = {
    ...carouselLabels.dots,
    ...labels,
    navigationAriaLabel: props.ariaLabel ?? labels?.navigationAriaLabel ?? carouselLabels.dots.navigationAriaLabel,
  }
  const {
    leftOverflow,
    rightOverflow,
    windowStart,
    visibleCount,
    focusIndex,
    setFocusIndex,
    wrapperA11yProps,
    noTransition,
    wrappedThisRender,
    edgeBias,
    isPinnedLeft,
    isPinnedRight,
    carouselDotsStyles,
    sentinelDotStyles,
  } = useCalibratedComponent({ ...props, ariaLabel: resolvedLabels.navigationAriaLabel }, { itemCount, selectedIndex })

  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    // -> Keep roving focus aligned with selection if selection changes externally.
    setFocusIndex(selectedIndex)
    // -> In manual activation mode, move DOM focus too so roving tabindex stays in sync.
    if (interactive && activationMode !== CAROUSEL_DOTS_ACTIVATION_MODE__AUTO) {
      buttonRefs.current[selectedIndex]?.focus()
    }
  }, [setFocusIndex, selectedIndex, interactive, activationMode])

  const onKeyDown = useCarouselDotsKeyDownHandler({
    interactive,
    focusIndex,
    setFocusIndex,
    itemCount,
    activationMode,
    scrollTo,
    buttonRefs,
  })

  if (itemCount <= 1) return null

  const carouselDotsStyle = { ...customStyles, ...style }

  return (
    <div className={carouselDotsStyles} style={carouselDotsStyle} {...wrapperA11yProps}>
      <div className={styles.carouselDots__viewport} style={{ "--visible-count": visibleCount } as CSSProperties}>
        <div
          className={styles.carouselDots__track}
          style={
            {
              "--window-start": windowStart,
              transition: noTransition || wrappedThisRender ? "none" : undefined,
            } as CSSProperties
          }
        >
          {Array.from({ length: itemCount }).map((_, index) => {
            const isSelected = index === selectedIndex
            const controlsID = getItemIDForIndex?.(index) ?? `carousel-item-${index}`

            const computedDotStyles = computeClassNameForItemIndex({
              index,
              selectedIndex,
              raised,
              windowStart,
              visibleCount,
              largeZoneCount: DEFAULT_LARGE_ZONE_SIZE,
              isPinnedLeft,
              isPinnedRight,
              edgeBias,
            })

            if (!interactive) {
              return <span key={index} className={computedDotStyles} aria-hidden="true" />
            }

            return (
              <button
                key={index}
                ref={(el) => {
                  buttonRefs.current[index] = el
                }}
                type="button"
                role="radio"
                aria-checked={isSelected}
                {...(controlsID ? { "aria-controls": controlsID } : {})}
                tabIndex={focusIndex === index ? 0 : -1}
                onClick={() => scrollTo(index)}
                onKeyDown={onKeyDown}
                className={styles.carouselDots__button}
              >
                <span className={computedDotStyles} aria-hidden="true" />
                <span className={styles["sr-only"]}>
                  {resolvedLabels.dotButtonLabel({ itemNumber: index + 1, itemCount })}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {showOverflowSentinels && leftOverflow && <span className={sentinelDotStyles} aria-hidden="true" />}

      {showOverflowSentinels && rightOverflow && <span className={sentinelDotStyles} aria-hidden="true" />}
    </div>
  )
}

export default CarouselDots
