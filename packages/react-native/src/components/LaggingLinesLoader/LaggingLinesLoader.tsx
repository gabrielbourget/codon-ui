import { forwardRef, useState } from "react"
import { Animated, Easing, View, type ViewStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"
import { resolveNativeLoaderDuration, useNativeLoaderLoop, useNativeLoaderReducedMotion } from "../Loaders/motion"
import type { TNativeLoaderRootStyle } from "../Loaders/types"
import { useNativeContentContext } from "../NativeContentContext"

import type { TNativeLaggingLinesLoaderProps, TNativeLaggingLinesLoaderRef } from "./types"

const LINE_RECIPES = [
  { opacity: 0.4, scaleX: 1.2, delay: 200 },
  { opacity: 0.6, scaleX: 1.1, delay: 100 },
  { opacity: 0.9, scaleX: 1, delay: 0 },
] as const
const SLIDE_EASING = Easing.bezier(0.42, 0, 0.58, 1)

const MovingLine = ({
  index,
  width,
  duration,
  enabled,
  visualStyle,
  identity,
}: {
  index: number
  width: number
  duration: number
  enabled: boolean
  visualStyle: ViewStyle
  identity: string
}) => {
  const recipe = LINE_RECIPES[index]
  const phase = useNativeLoaderLoop(duration, recipe.delay, SLIDE_EASING, enabled, true)
  return (
    <Animated.View
      accessible={false}
      testID={identity + "-motion-" + index}
      style={{
        position: "absolute",
        width: "20%",
        transform: [{ translateX: phase.interpolate({ inputRange: [0, 1], outputRange: [0, width] }) }],
      }}
    >
      <View
        accessible={false}
        testID={identity + "-slide-" + index}
        style={[
          { width: "100%", height: 5, opacity: recipe.opacity, transform: [{ scaleX: recipe.scaleX }] },
          visualStyle,
        ]}
      />
    </Animated.View>
  )
}

export const LaggingLinesLoader = forwardRef<TNativeLaggingLinesLoaderRef, TNativeLaggingLinesLoaderProps>(
  (props, ref) => {
    const {
      width = 150,
      color,
      duration = 3000,
      customStyles,
      style,
      accessible,
      accessibilityLabel,
      "aria-label": aliasLabel,
      ariaLabel,
      accessibilityLiveRegion = "polite",
      testID,
      "data-testid": aliasID,
      ...rest
    } = props
    const theme = useNativeTheme()
    const content = useNativeContentContext()
    const exposed = accessible ?? !content?.isButton
    const label = accessibilityLabel ?? aliasLabel ?? ariaLabel ?? "Loading"
    if (typeof label !== "string" || (exposed && !label.trim()))
      throw new TypeError("LaggingLinesLoader: an exposed loader requires a nonempty accessible name")
    validateNativeDisplayDimension(width, "LaggingLinesLoader", "width")
    validateNativeColor(color, "LaggingLinesLoader", "color")
    const {
      animationDuration,
      color: customForeground,
      ...customSlide
    } = resolveNativeStyle(customStyles, "LaggingLinesLoader", "customStyles")
    const milliseconds = resolveNativeLoaderDuration(animationDuration ?? duration, "LaggingLinesLoader")
    const reduced = useNativeLoaderReducedMotion()
    const [measuredWidth, setMeasuredWidth] = useState(0)
    const isMotionEnabled = !reduced && milliseconds > 0 && measuredWidth > 0
    const baseline: TNativeLoaderRootStyle = {
      width,
      height: 50,
      alignSelf: "center",
      justifyContent: "center",
      color: content?.foregroundColor ?? theme.colors.foreground,
    }
    const { color: foreground, ...rootStyle } = resolveNativeStyle(
      [
        baseline,
        typeof style === "function"
          ? style({ duration: milliseconds, isMotionEnabled, defaultStyle: baseline })
          : style,
      ],
      "LaggingLinesLoader",
      "style",
    )
    const slideStyle = resolveNativeStyle(
      [{ backgroundColor: color ?? customForeground ?? foreground ?? theme.colors.foreground }, customSlide],
      "LaggingLinesLoader",
      "slideStyle",
    )
    const identity = testID ?? aliasID ?? "lagging-lines-loader"
    return (
      <View
        {...rest}
        ref={ref}
        accessible={exposed}
        accessibilityLabel={label}
        role="progressbar"
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        aria-busy
        accessibilityLiveRegion={accessibilityLiveRegion}
        accessibilityValue={{}}
        aria-valuemin={undefined}
        aria-valuemax={undefined}
        aria-valuenow={undefined}
        aria-valuetext={undefined}
        testID={identity}
        style={rootStyle}
      >
        <View
          testID={identity + "-track"}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={{ width: "100%", height: 0 }}
          onLayout={({ nativeEvent }) => {
            const next = nativeEvent.layout.width
            if (Number.isFinite(next) && next >= 0) setMeasuredWidth((current) => (current === next ? current : next))
          }}
        >
          {LINE_RECIPES.map((_recipe, index) => (
            <MovingLine
              key={index}
              index={index}
              width={measuredWidth}
              duration={milliseconds}
              enabled={isMotionEnabled}
              visualStyle={slideStyle}
              identity={identity}
            />
          ))}
        </View>
      </View>
    )
  },
)
LaggingLinesLoader.displayName = "LaggingLinesLoader"
