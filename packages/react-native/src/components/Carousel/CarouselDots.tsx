import { useEffect, useId, useRef, useState } from "react"
import type { View } from "react-native"
import { findNodeHandle } from "react-native"

import { focusNativeTarget } from "../../input/focus"
import { nativeKeyTokens } from "../../input/keyScope"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyPolicy } from "../../input/NativeKeyboardScope"
import { NativePressable } from "../../input/NativePressable"
import { useNativeTheme } from "../../theme"
import { resolveNativeStyle } from "../colors"
import { nativeControlTarget } from "../selection"

import { useNativeCarouselContext } from "./CarouselContext"
import type { TNativeCarouselDotsProps } from "./carouselTypes"
import { handleNativeCarouselDotKey } from "./dotsKeyPolicy"
import { getNativeCarouselDotsCalibration, getNativeCarouselDotVariant } from "./dotsModel"
import { NativeCarouselDotsViewport } from "./NativeCarouselDotsVisualStrip"
import { NativeCarouselDotVisual } from "./NativeCarouselDotVisual"
import { useNativeCarouselDotsWindow } from "./useDotsWindow"

const DotButton = ({
  index,
  selected,
  tabStop,
  label,
  controlsID,
  variant,
  raised,
  activate,
  attach,
}: {
  index: number
  selected: boolean
  tabStop: boolean
  label: string
  controlsID: string
  variant: Parameters<typeof NativeCarouselDotVisual>[0]["variant"]
  raised: boolean
  activate: (index: number) => void
  attach: (index: number, node: View | null) => void
}) => {
  const [focusVisible, setFocusVisible] = useState(false)
  const size = nativeControlTarget()
  return (
    <NativePressable
      ref={(node) => attach(index, node)}
      nativeTabStop={tabStop}
      nativeProgrammaticFocusable
      accessible
      role="radio"
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityActions={controlsID ? [{ name: `show-item:${controlsID}`, label }] : undefined}
      onAccessibilityAction={(event) => {
        if (controlsID && event.nativeEvent.actionName === `show-item:${controlsID}`) activate(index)
      }}
      onFocusVisibilityChange={setFocusVisible}
      onPress={() => activate(index)}
      onKeyDown={(event) => {
        if (["Enter", " ", "Spacebar"].includes(event.nativeEvent.key)) {
          event.preventDefault()
          activate(index)
        }
      }}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10000,
        backgroundColor: "transparent",
        cursor: "pointer",
      }}
    >
      <NativeCarouselDotVisual variant={variant} raised={raised} focusVisible={focusVisible} />
    </NativePressable>
  )
}

export const CarouselDots = (props: TNativeCarouselDotsProps) => {
  const {
    interactive = true,
    activationMode = "auto",
    raised = false,
    showOverflowSentinels = false,
    testID = "carousel-dots",
  } = props
  const context = useNativeCarouselContext()
  const { itemCount, selectedIndex, scrollTo } = context
  const theme = useNativeTheme()
  const [focusIndex, setFocusIndex] = useState(selectedIndex)
  const [group, setGroup] = useState<View | null>(null)
  const buttonRefs = useRef(new Map<number, View>())
  const owner = useId()
  const calibration = getNativeCarouselDotsCalibration({ ...props, itemCount, selectedIndex, focusIndex })
  const controller = useNativeCarouselDotsWindow({ ...calibration, itemCount, selectedIndex })
  const { visibleCount, minPinned, neighbors, largeZoneCount, maxStart, anchorIndex } = calibration
  const { windowStart, currDir, isFlipCooldownActive } = controller
  const allVisible = itemCount <= visibleCount
  const pinnedLeft = !allVisible && selectedIndex <= minPinned
  const pinnedRight = !allVisible && selectedIndex >= itemCount - minPinned - 1
  const zoneStart = windowStart + neighbors
  const edgeBias =
    anchorIndex > minPinned &&
    anchorIndex < itemCount - minPinned - 1 &&
    anchorIndex >= zoneStart &&
    anchorIndex <= zoneStart + largeZoneCount - 1 &&
    !isFlipCooldownActive
      ? currDir > 0
        ? "right"
        : currDir < 0
          ? "left"
          : null
      : null
  const requestFocus = (index: number) => {
    const node = buttonRefs.current.get(index)
    if (node) focusNativeTarget(node)
  }
  useEffect(() => {
    setFocusIndex(selectedIndex)
    if (interactive && activationMode !== "auto") requestFocus(selectedIndex)
  }, [selectedIndex, interactive, activationMode])
  useNativeKeyPolicy({
    tokens: ["ArrowLeft", "ArrowRight", "Home", "End"].flatMap(nativeKeyTokens),
    excludeEditable: false,
    excludeComposing: false,
    isEnabled: interactive && itemCount > 1 && !!group,
    targetTag: group ? (findNodeHandle(group) ?? undefined) : undefined,
    lifetimeKey: owner,
    canAct: () => true,
    onKey: (event) =>
      handleNativeCarouselDotKey(
        { interactive, activationMode, focusIndex, itemCount, setFocusIndex, requestFocus, scrollTo },
        event,
      ),
  })
  if (itemCount <= 1) return null
  const labels = { ...context.labels.dots, ...props.labels }
  return (
    <NativeFocusHost
      ref={setGroup}
      testID={testID}
      role={interactive ? "radiogroup" : undefined}
      accessibilityRole={interactive ? "radiogroup" : undefined}
      accessibilityLabel={
        interactive
          ? (props.ariaLabel ?? props.labels?.navigationAriaLabel ?? context.labels.dots.navigationAriaLabel)
          : undefined
      }
      focusable={false}
      nativeTabStop={false}
      accessibilityElementsHidden={!interactive}
      importantForAccessibility={interactive ? "auto" : "no-hide-descendants"}
      style={resolveNativeStyle(
        [
          { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: theme.spacing.unit },
          props.customStyles,
          props.style,
        ],
        "CarouselDots",
        "style",
      )}
    >
      <NativeCarouselDotsViewport
        visibleCount={visibleCount}
        windowStart={windowStart}
        noTransition={controller.noTransition || controller.wrappedThisRender}
        cellSize={interactive ? nativeControlTarget() : 8}
        testID={testID}
      >
        {Array.from({ length: itemCount }, (_, index) => {
          const variant = getNativeCarouselDotVariant({
            index,
            selectedIndex,
            windowStart,
            visibleCount,
            largeZoneCount,
            isPinnedLeft: pinnedLeft,
            isPinnedRight: pinnedRight,
            edgeBias,
          })
          return interactive ? (
            <DotButton
              key={index}
              index={index}
              selected={selectedIndex === index}
              tabStop={focusIndex === index}
              label={labels.dotButtonLabel({ itemNumber: index + 1, itemCount })}
              controlsID={context.getItemIDForIndex(index) ?? `carousel-item-${index}`}
              variant={variant}
              raised={raised}
              activate={scrollTo}
              attach={(index, node) => {
                if (node) buttonRefs.current.set(index, node)
                else buttonRefs.current.delete(index)
              }}
            />
          ) : (
            <NativeCarouselDotVisual key={index} variant={variant} raised={raised} shrink />
          )
        })}
      </NativeCarouselDotsViewport>
      {showOverflowSentinels && windowStart > 0 ? <NativeCarouselDotVisual variant="sentinel" shrink /> : null}
      {showOverflowSentinels && windowStart < maxStart ? <NativeCarouselDotVisual variant="sentinel" shrink /> : null}
    </NativeFocusHost>
  )
}
