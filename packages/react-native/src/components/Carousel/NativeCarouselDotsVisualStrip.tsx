import type { ReactNode } from "react"
import { Animated, View, type StyleProp, type ViewStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { resolveNativeStyle } from "../colors"
import { useNativeLoaderReducedMotion } from "../Loaders/motion"

import {
  getNativeCarouselDotsCalibration,
  getNativeCarouselDotsViewport,
  getNativeCarouselDotVariant,
} from "./dotsModel"
import { useNativeCarouselDotScalar } from "./dotsMotion"
import { NativeCarouselDotVisual } from "./NativeCarouselDotVisual"
import { useNativeCarouselDotsWindow } from "./useDotsWindow"

export const NativeCarouselDotsViewport = ({
  visibleCount,
  windowStart,
  noTransition,
  cellSize = 8,
  testID,
  children,
}: {
  visibleCount: number
  windowStart: number
  noTransition: boolean
  cellSize?: number
  testID: string
  children: ReactNode
}) => {
  const theme = useNativeTheme()
  const reduced = useNativeLoaderReducedMotion()
  const viewport = getNativeCarouselDotsViewport(visibleCount, windowStart, theme.spacing.unit, cellSize)
  const translateX = useNativeCarouselDotScalar(viewport.translateX, reduced, noTransition)
  return (
    <View
      testID={`${testID}-viewport`}
      style={{
        width: viewport.width,
        paddingVertical: viewport.paddingVertical,
        flexShrink: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Animated.View
        testID={`${testID}-track`}
        style={{
          width: viewport.width,
          flexShrink: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.unit,
          transform: [{ translateX }],
        }}
      >
        {children}
      </Animated.View>
    </View>
  )
}

// Only the canonical passive branch is composed here; radio targets retain their separate contract.
export const NativeCarouselDotsVisualStrip = ({
  itemCount,
  selectedIndex,
  maxVisible,
  showOverflowSentinels = false,
  raised = false,
  customStyles,
  style,
  testID = "carousel-dots-visual-strip",
}: {
  itemCount: number
  selectedIndex: number
  maxVisible?: number
  showOverflowSentinels?: boolean
  raised?: boolean
  customStyles?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
  testID?: string
}) => {
  const theme = useNativeTheme()
  const calibration = getNativeCarouselDotsCalibration({
    itemCount,
    selectedIndex,
    focusIndex: selectedIndex,
    interactive: false,
    maxVisible,
  })
  const controller = useNativeCarouselDotsWindow({ ...calibration, selectedIndex, itemCount })
  const { visibleCount, neighbors, largeZoneCount, minPinned, maxStart } = calibration
  const { windowStart, currDir, isFlipCooldownActive } = controller
  const fullyVisible = itemCount <= visibleCount
  const zoneStart = windowStart + neighbors
  const interior = selectedIndex > minPinned && selectedIndex < itemCount - minPinned - 1
  const insideZone = selectedIndex >= zoneStart && selectedIndex <= zoneStart + largeZoneCount - 1
  const edgeBias =
    interior && insideZone && !isFlipCooldownActive ? (currDir > 0 ? "right" : currDir < 0 ? "left" : null) : null
  if (itemCount <= 1) return null
  return (
    <View
      testID={testID}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={resolveNativeStyle(
        [
          { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: theme.spacing.unit },
          customStyles,
          style,
        ],
        "CarouselDots",
        "style",
      )}
    >
      <NativeCarouselDotsViewport
        visibleCount={visibleCount}
        windowStart={windowStart}
        noTransition={controller.noTransition || controller.wrappedThisRender}
        testID={testID}
      >
        {Array.from({ length: itemCount }, (_, index) => (
          <NativeCarouselDotVisual
            key={index}
            testID={`${testID}-dot-${index}`}
            shrink
            raised={raised}
            variant={getNativeCarouselDotVariant({
              index,
              selectedIndex,
              windowStart,
              visibleCount,
              largeZoneCount,
              edgeBias,
              isPinnedLeft: !fullyVisible && selectedIndex <= minPinned,
              isPinnedRight: !fullyVisible && selectedIndex >= itemCount - minPinned - 1,
            })}
          />
        ))}
      </NativeCarouselDotsViewport>
      {showOverflowSentinels && windowStart > 0 ? (
        <NativeCarouselDotVisual variant="sentinel" shrink testID={`${testID}-left-sentinel`} />
      ) : null}
      {showOverflowSentinels && windowStart < maxStart ? (
        <NativeCarouselDotVisual variant="sentinel" shrink testID={`${testID}-right-sentinel`} />
      ) : null}
    </View>
  )
}
