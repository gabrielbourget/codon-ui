import classNames from "classnames"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEventHandler,
  type MutableRefObject,
} from "react"

import { clamp, DEFAULT_CAROUSEL_LABELS, type TCarouselDotsLabels } from "../../helpers"

import styles from "./CarouselDotsStyles.module.css"

export const CAROUSEL_DOTS_ACTIVATION_MODE__MANUAL = "manual"
export const CAROUSEL_DOTS_ACTIVATION_MODE__AUTO = "auto"
export const AVAILABLE_CAROUSEL_DOTS_ACTIVATION_MODES = [
  CAROUSEL_DOTS_ACTIVATION_MODE__MANUAL,
  CAROUSEL_DOTS_ACTIVATION_MODE__AUTO,
] as const

export const CAROUSEL_DOTS_EDGE_BIAS__LEFT = "left"
export const CAROUSEL_DOTS_EDGE_BIAS__RIGHT = "right"
export const AVAILABLE_CAROUSEL_DOTS_EGE_BIASES = [
  CAROUSEL_DOTS_EDGE_BIAS__LEFT,
  CAROUSEL_DOTS_EDGE_BIAS__RIGHT,
] as const

export const DOT_VARIANT__ACTIVE = "active"
export const DOT_VARIANT__NEAR = "near"
export const DOT_VARIANT__FAR = "far"
export const DOT_VARIANT__HIDDEN = "hidden"
export const DOT_VARIANT__DEFAULT = "default"
export const DOT_VARIANT__SENTINEL = "sentinel"
export const DOT_VARIANT__RAISED = "raised"
export const AVAILABLE_DOT_VARIANTS = [
  DOT_VARIANT__ACTIVE,
  DOT_VARIANT__NEAR,
  DOT_VARIANT__FAR,
  DOT_VARIANT__HIDDEN,
  DOT_VARIANT__DEFAULT,
  DOT_VARIANT__SENTINEL,
  DOT_VARIANT__RAISED,
] as const

export const DEFAULT_MAX_VISIBLE_DOTS = 7
export const DEFAULT_SHOW_OVERFLOW_SENTINELS = false
export const DEFAULT_CAROUSEL_DOTS_ACTIVATION_MODE = CAROUSEL_DOTS_ACTIVATION_MODE__AUTO
export const DEFAULT_INTERACTIVITY_STATUS = true
export const DEFAULT_DOTS_RAISED_STATUS = false
export const DEFAULT_LARGE_ZONE_SIZE = 3
export const DEFAULT_NUM_NEIGHBORS = 2

export type TCarouselDotsActivationModes = (typeof AVAILABLE_CAROUSEL_DOTS_ACTIVATION_MODES)[number]
export type TCarouselDotsEdgeBias = (typeof AVAILABLE_CAROUSEL_DOTS_EGE_BIASES)[number]
export type TDotVariant = (typeof AVAILABLE_DOT_VARIANTS)[number]
export type TDotDistanceThresholds = { near: number; far: number; tiny: number }

export type TCarouselDotsProps = {
  interactive?: boolean
  activationMode?: TCarouselDotsActivationModes
  maxVisible?: number
  showOverflowSentinels?: boolean
  ariaLabel?: string
  labels?: Partial<TCarouselDotsLabels>
  raised?: boolean
  className?: string
  style?: CSSProperties
  customClassName?: string
  customStyles?: CSSProperties
}

const computeBorrowedZone = (params: {
  selectedIndex: number
  windowStart: number
  visibleCount: number
  largeZoneCount: number
}) => {
  const { selectedIndex, windowStart, visibleCount, largeZoneCount } = params
  const windowEnd = windowStart + visibleCount - 1
  const edge = Math.floor((largeZoneCount - 1) / 2)

  const leftSpace = selectedIndex - windowStart
  const rightSpace = windowEnd - selectedIndex

  let zoneLeft = Math.min(edge, leftSpace)
  const zoneRight = Math.min(largeZoneCount - 1 - zoneLeft, rightSpace)

  if (zoneLeft + zoneRight < largeZoneCount - 1) {
    zoneLeft = Math.min(largeZoneCount - 1 - zoneRight, leftSpace)
  }

  const largeZoneStart = selectedIndex - zoneLeft
  const largeZoneEnd = selectedIndex + zoneRight
  return { largeZoneStart, largeZoneEnd, windowEnd }
}

export const computeDotStyles = (params: { variant: TDotVariant; raised: boolean }) => {
  const { variant, raised } = params

  return classNames(styles.carouselDots__dot, raised ? styles["carouselDots__dot--raised"] : undefined, {
    [styles["carouselDots__dot--active"]]: variant === DOT_VARIANT__ACTIVE,
    [styles["carouselDots__dot--near"]]: variant === DOT_VARIANT__NEAR,
    [styles["carouselDots__dot--far"]]: variant === DOT_VARIANT__FAR,
    [styles["carouselDots__dot--hidden"]]: variant === DOT_VARIANT__HIDDEN,
    [styles["carouselDots__dot--sentinel"]]: variant === DOT_VARIANT__SENTINEL,
  })
}

export const computeDotVariantForIndex = (params: {
  index: number
  selectedIndex: number
  windowStart: number
  visibleCount: number
  largeZoneCount?: number
  isPinnedLeft?: boolean
  isPinnedRight?: boolean
  edgeBias?: TCarouselDotsEdgeBias | null
}): TDotVariant => {
  const {
    index,
    selectedIndex,
    windowStart,
    visibleCount,
    largeZoneCount = DEFAULT_LARGE_ZONE_SIZE,
    isPinnedLeft = false,
    isPinnedRight = false,
    edgeBias = null,
  } = params

  const windowEnd = windowStart + visibleCount - 1
  if (index < windowStart || index > windowEnd) return DOT_VARIANT__HIDDEN
  if (index === selectedIndex) return DOT_VARIANT__ACTIVE

  const neighbors = DEFAULT_NUM_NEIGHBORS
  const fixedZoneStart = windowStart + neighbors
  const fixedZoneEnd = fixedZoneStart + (largeZoneCount - 1)

  let zoneStart = fixedZoneStart
  let zoneEnd = fixedZoneEnd

  if (isPinnedLeft || isPinnedRight) {
    const { largeZoneStart, largeZoneEnd } = computeBorrowedZone({
      selectedIndex,
      windowStart,
      visibleCount,
      largeZoneCount,
    })
    zoneStart = largeZoneStart
    zoneEnd = largeZoneEnd
  } else if (edgeBias === CAROUSEL_DOTS_EDGE_BIAS__RIGHT) {
    const startDesired = selectedIndex - (largeZoneCount - 1)
    zoneStart = Math.max(windowStart, startDesired)
    zoneEnd = Math.min(windowEnd, zoneStart + (largeZoneCount - 1))
  } else if (edgeBias === CAROUSEL_DOTS_EDGE_BIAS__LEFT) {
    const startDesired = selectedIndex
    const maxStart = windowEnd - (largeZoneCount - 1)
    zoneStart = Math.min(startDesired, maxStart)
    zoneStart = Math.max(windowStart, zoneStart)
    zoneEnd = zoneStart + (largeZoneCount - 1)
  }

  if (index >= zoneStart && index <= zoneEnd) return DOT_VARIANT__DEFAULT

  const onLeft = index < zoneStart
  const distance = onLeft ? zoneStart - index : index - zoneEnd
  const maxLeft = Math.min(neighbors, Math.max(0, zoneStart - windowStart))
  const maxRight = Math.min(neighbors, Math.max(0, windowEnd - zoneEnd))
  const slotsOnSide = onLeft ? (isPinnedLeft ? 0 : maxLeft) : isPinnedRight ? 0 : maxRight

  if (distance === 1 && slotsOnSide >= 1) return DOT_VARIANT__NEAR
  if (distance === 2 && slotsOnSide >= 2) return DOT_VARIANT__FAR
  return DOT_VARIANT__HIDDEN
}

export const computeClassNameForItemIndex = (params: {
  index: number
  selectedIndex: number
  raised?: boolean
  windowStart: number
  visibleCount: number
  largeZoneCount?: number
  isPinnedLeft?: boolean
  isPinnedRight?: boolean
  edgeBias?: TCarouselDotsEdgeBias | null
}) => {
  const { raised = false, ...rest } = params
  const variant = computeDotVariantForIndex(rest)
  return computeDotStyles({ variant, raised })
}

export const useDotsWindowController = (params: {
  selectedIndex: number
  itemCount: number
  largeZoneCount: number
  neighbors: number
  minPinned: number
  maxStart: number
  initialWindowStart: number
}) => {
  const { selectedIndex, itemCount, largeZoneCount, neighbors, minPinned, maxStart, initialWindowStart } = params

  const [windowStart, setWindowStart] = useState(initialWindowStart)
  const [noTransition, setNoTransition] = useState(false)

  const prevSelectedRef = useRef<number>(selectedIndex)
  const lastDirRef = useRef<1 | -1 | 0>(0)
  const flipCooldownRef = useRef<number>(0)

  const prevSelected = prevSelectedRef.current
  const delta = selectedIndex - prevSelected
  const currDir: 1 | -1 | 0 = delta > 0 ? 1 : delta < 0 ? -1 : lastDirRef.current
  const wrappedThisRender = itemCount > 1 && (delta === itemCount - 1 || delta === -(itemCount - 1))

  const reversing = lastDirRef.current !== 0 && currDir !== 0 && currDir !== lastDirRef.current
  if (reversing) {
    flipCooldownRef.current = 2
  }

  useEffect(() => {
    if (wrappedThisRender) {
      const target = selectedIndex <= minPinned ? 0 : maxStart
      if (windowStart !== target) setWindowStart(target)

      setNoTransition(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setNoTransition(false)))

      prevSelectedRef.current = selectedIndex
      if (delta !== 0) lastDirRef.current = currDir
      return
    }

    if (selectedIndex <= minPinned) {
      if (windowStart !== 0) setWindowStart(0)
    } else if (selectedIndex >= itemCount - minPinned - 1) {
      if (windowStart !== maxStart) setWindowStart(maxStart)
    } else {
      const zoneStart = windowStart + neighbors
      const zoneEnd = zoneStart + (largeZoneCount - 1)

      if (flipCooldownRef.current === 0) {
        if (currDir > 0 && selectedIndex >= zoneStart && selectedIndex <= zoneEnd) {
          const targetStart = clamp({
            number: selectedIndex - (largeZoneCount - 1) - neighbors,
            min: 0,
            max: maxStart,
          })
          if (targetStart !== windowStart) setWindowStart(targetStart)
        } else if (currDir < 0 && selectedIndex >= zoneStart && selectedIndex <= zoneEnd) {
          const targetStart = clamp({
            number: selectedIndex - neighbors,
            min: 0,
            max: maxStart,
          })
          if (targetStart !== windowStart) setWindowStart(targetStart)
        }
      }

      if (selectedIndex > zoneEnd) {
        setWindowStart(
          clamp({
            number: selectedIndex - (largeZoneCount - 1) - neighbors,
            min: 0,
            max: maxStart,
          }),
        )
      } else if (selectedIndex < zoneStart) {
        setWindowStart(
          clamp({
            number: selectedIndex - neighbors,
            min: 0,
            max: maxStart,
          }),
        )
      }
    }

    prevSelectedRef.current = selectedIndex
    if (delta !== 0) {
      lastDirRef.current = currDir
      if (flipCooldownRef.current > 0) {
        flipCooldownRef.current = flipCooldownRef.current - 1
      }
    }
  }, [
    selectedIndex,
    itemCount,
    windowStart,
    largeZoneCount,
    neighbors,
    minPinned,
    maxStart,
    wrappedThisRender,
    currDir,
    delta,
  ])

  useEffect(() => {
    if (windowStart > maxStart) setWindowStart(maxStart)
  }, [windowStart, maxStart])

  return {
    windowStart,
    setWindowStart,
    noTransition,
    wrappedThisRender,
    currDir,
    isFlipCooldownActive: flipCooldownRef.current > 0,
  }
}

export const useCarouselDotsKeyDownHandler = (params: {
  interactive: boolean
  focusIndex: number
  setFocusIndex: (i: number) => void
  itemCount: number
  activationMode: TCarouselDotsActivationModes
  scrollTo: (i: number) => void
  buttonRefs: MutableRefObject<(HTMLButtonElement | null)[]>
}): KeyboardEventHandler<HTMLButtonElement> => {
  return (event) => {
    const { interactive, focusIndex, setFocusIndex, itemCount, activationMode, scrollTo, buttonRefs } = params
    if (!interactive) return

    let next = focusIndex

    switch (event.key) {
      case "ArrowLeft":
        next = clamp({ number: focusIndex - 1, min: 0, max: itemCount - 1 })
        event.preventDefault()
        event.stopPropagation()
        break
      case "ArrowRight":
        next = clamp({ number: focusIndex + 1, min: 0, max: itemCount - 1 })
        event.preventDefault()
        event.stopPropagation()
        break
      case "Home":
        next = 0
        event.preventDefault()
        event.stopPropagation()
        break
      case "End":
        next = itemCount - 1
        event.preventDefault()
        event.stopPropagation()
        break
      case "Enter":
      case " ":
      case "Spacebar":
        event.preventDefault()
        scrollTo(focusIndex)
        return
      default:
        return
    }

    setFocusIndex(next)
    buttonRefs.current[next]?.focus()
    if (activationMode === CAROUSEL_DOTS_ACTIVATION_MODE__AUTO) scrollTo(next)
  }
}

export const useCalibratedComponent = (
  props: TCarouselDotsProps,
  contextInfo: { itemCount: number; selectedIndex: number },
) => {
  const {
    maxVisible = DEFAULT_MAX_VISIBLE_DOTS,
    interactive = DEFAULT_INTERACTIVITY_STATUS,
    ariaLabel = DEFAULT_CAROUSEL_LABELS.dots.navigationAriaLabel,
    activationMode = DEFAULT_CAROUSEL_DOTS_ACTIVATION_MODE,
    className,
    customClassName,
  } = props
  const { itemCount, selectedIndex } = contextInfo

  const carouselDotsStyles = classNames(styles.carouselDots, customClassName, className)
  const sentinelDotStyles = classNames(styles.carouselDots__dot, styles["carouselDots__dot--sentinel"])

  const [focusIndex, setFocusIndex] = useState(selectedIndex)

  const anchorIndex = interactive && activationMode === CAROUSEL_DOTS_ACTIVATION_MODE__AUTO ? focusIndex : selectedIndex
  const largeZoneCount = DEFAULT_LARGE_ZONE_SIZE
  const edgeGuard = Math.floor((largeZoneCount - 1) / 2)
  const neighbors = DEFAULT_NUM_NEIGHBORS
  const minVisible = largeZoneCount + neighbors * 2
  const targetVisible = maxVisible ?? minVisible
  const visibleCount = Math.min(Math.max(minVisible, targetVisible), itemCount)
  const maxStart = useMemo(() => Math.max(0, itemCount - visibleCount), [itemCount, visibleCount])
  const minPinned = edgeGuard

  const initialWindowStart = useMemo(() => {
    return clamp({
      number: anchorIndex - (neighbors + edgeGuard),
      min: 0,
      max: maxStart,
    })
  }, [anchorIndex, neighbors, edgeGuard, maxStart])

  const { windowStart, noTransition, wrappedThisRender, currDir, isFlipCooldownActive } = useDotsWindowController({
    selectedIndex,
    itemCount,
    largeZoneCount,
    neighbors,
    minPinned,
    maxStart,
    initialWindowStart,
  })

  const isFullyVisible = itemCount <= visibleCount
  const zoneStartNow = windowStart + neighbors
  const zoneEndNow = zoneStartNow + (largeZoneCount - 1)
  const interior = anchorIndex > minPinned && anchorIndex < itemCount - minPinned - 1
  const insideFixedZone = anchorIndex >= zoneStartNow && anchorIndex <= zoneEndNow

  let edgeBias: TCarouselDotsEdgeBias | null = null
  if (interior && insideFixedZone && !isFlipCooldownActive) {
    if (currDir > 0) edgeBias = CAROUSEL_DOTS_EDGE_BIAS__RIGHT
    else if (currDir < 0) edgeBias = CAROUSEL_DOTS_EDGE_BIAS__LEFT
  }

  const isPinnedLeft = !isFullyVisible && selectedIndex <= minPinned
  const isPinnedRight = !isFullyVisible && selectedIndex >= itemCount - minPinned - 1

  const leftOverflow = windowStart > 0
  const rightOverflow = windowStart < maxStart

  const wrapperA11yProps = interactive
    ? {
        role: "radiogroup" as const,
        "aria-label": ariaLabel,
        "aria-orientation": "horizontal" as const,
      }
    : { "aria-hidden": "true" as const }

  return {
    leftOverflow,
    rightOverflow,
    windowStart,
    visibleCount,
    focusIndex,
    setFocusIndex,
    wrapperA11yProps,
    noTransition,
    wrappedThisRender,
    carouselDotsStyles,
    sentinelDotStyles,
    edgeBias,
    isPinnedLeft,
    isPinnedRight,
  }
}
