import type { ViewStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"

export const NATIVE_CAROUSEL_DOT_VARIANTS = ["active", "default", "near", "far", "hidden", "sentinel"] as const
export type TNativeCarouselDotVariant = (typeof NATIVE_CAROUSEL_DOT_VARIANTS)[number]
export type TNativeCarouselDotEdgeBias = "left" | "right" | null
export type TNativeCarouselDotVariantInput = Readonly<{
  index: number
  selectedIndex: number
  windowStart: number
  visibleCount: number
  largeZoneCount?: number
  isPinnedLeft?: boolean
  isPinnedRight?: boolean
  edgeBias?: TNativeCarouselDotEdgeBias
}>

const clamp = (value: number, maximum: number) => Math.max(0, Math.min(maximum, value))

export const getNativeCarouselDotsCalibration = (input: {
  itemCount: number
  selectedIndex: number
  focusIndex: number
  interactive?: boolean
  activationMode?: "manual" | "auto"
  maxVisible?: number
}) => {
  const { itemCount, selectedIndex, focusIndex, interactive = true, activationMode = "auto", maxVisible = 7 } = input
  const anchorIndex = interactive && activationMode === "auto" ? focusIndex : selectedIndex
  const largeZoneCount = 3
  const neighbors = 2
  const edgeGuard = Math.floor((largeZoneCount - 1) / 2)
  const minVisible = largeZoneCount + neighbors * 2
  const visibleCount = Math.min(Math.max(minVisible, maxVisible ?? minVisible), itemCount)
  const maxStart = Math.max(0, itemCount - visibleCount)
  return {
    anchorIndex,
    largeZoneCount,
    neighbors,
    minPinned: edgeGuard,
    visibleCount,
    maxStart,
    initialWindowStart: clamp(anchorIndex - (neighbors + edgeGuard), maxStart),
  }
}

export const getNativeCarouselDotVariant = (input: TNativeCarouselDotVariantInput): TNativeCarouselDotVariant => {
  const {
    index,
    selectedIndex,
    windowStart,
    visibleCount,
    largeZoneCount = 3,
    isPinnedLeft = false,
    isPinnedRight = false,
    edgeBias = null,
  } = input
  const windowEnd = windowStart + visibleCount - 1
  if (index < windowStart || index > windowEnd) return "hidden"
  if (index === selectedIndex) return "active"
  const neighbors = 2
  let zoneStart = windowStart + neighbors
  let zoneEnd = zoneStart + largeZoneCount - 1
  if (isPinnedLeft || isPinnedRight) {
    const leftSpace = selectedIndex - windowStart
    const rightSpace = windowEnd - selectedIndex
    let zoneLeft = Math.min(Math.floor((largeZoneCount - 1) / 2), leftSpace)
    const zoneRight = Math.min(largeZoneCount - 1 - zoneLeft, rightSpace)
    if (zoneLeft + zoneRight < largeZoneCount - 1) zoneLeft = Math.min(largeZoneCount - 1 - zoneRight, leftSpace)
    zoneStart = selectedIndex - zoneLeft
    zoneEnd = selectedIndex + zoneRight
  } else if (edgeBias === "right") {
    zoneStart = Math.max(windowStart, selectedIndex - (largeZoneCount - 1))
    zoneEnd = Math.min(windowEnd, zoneStart + largeZoneCount - 1)
  } else if (edgeBias === "left") {
    zoneStart = Math.max(windowStart, Math.min(selectedIndex, windowEnd - (largeZoneCount - 1)))
    zoneEnd = zoneStart + largeZoneCount - 1
  }
  if (index >= zoneStart && index <= zoneEnd) return "default"
  const onLeft = index < zoneStart
  const distance = onLeft ? zoneStart - index : index - zoneEnd
  const available = onLeft
    ? isPinnedLeft
      ? 0
      : Math.min(neighbors, Math.max(0, zoneStart - windowStart))
    : isPinnedRight
      ? 0
      : Math.min(neighbors, Math.max(0, windowEnd - zoneEnd))
  if (distance === 1 && available >= 1) return "near"
  if (distance === 2 && available >= 2) return "far"
  return "hidden"
}

export const getNativeCarouselDotMotionTarget = (variant: TNativeCarouselDotVariant) => ({
  opacity: variant === "hidden" ? 0 : variant === "far" ? 0.9 : variant === "sentinel" ? 0.4 : 1,
  scale:
    variant === "active" ? 1.15 : variant === "near" ? 0.8 : variant === "far" ? 0.65 : variant === "hidden" ? 0.4 : 1,
})

export const getNativeCarouselDotStyle = (
  theme: TNativeTheme,
  variant: TNativeCarouselDotVariant,
  raised = false,
): ViewStyle => ({
  width: variant === "sentinel" ? 6 : 8,
  height: variant === "sentinel" ? 6 : 8,
  borderRadius: 10000,
  backgroundColor:
    variant === "sentinel"
      ? "#ffffff"
      : variant === "active"
        ? theme.colors.controlSelectedBackground
        : theme.colors.controlBorder,
  opacity: getNativeCarouselDotMotionTarget(variant).opacity,
  transform: [{ scale: getNativeCarouselDotMotionTarget(variant).scale }],
  ...(raised
    ? {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.24,
        shadowRadius: 3,
        elevation: 2,
      }
    : {}),
})

export const getNativeCarouselDotsViewport = (visibleCount: number, windowStart: number, gap: number) => ({
  width: Math.max(0, visibleCount * (8 + gap) - gap),
  translateX: -windowStart * (8 + gap),
  paddingVertical: gap,
})
