import { forwardRef } from "react"
import { Animated, Easing, View } from "react-native"

import { useNativeTheme } from "../../theme"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"
import { resolveNativeLoaderDuration, useNativeLoaderLoop, useNativeLoaderReducedMotion } from "../Loaders/motion"
import type { TNativeLoaderRootStyle } from "../Loaders/types"
import { useNativeContentContext } from "../NativeContentContext"

import type { TNativeCircleLoaderProps, TNativeCircleLoaderRef } from "./types"

export const CircleLoader = forwardRef<TNativeCircleLoaderRef, TNativeCircleLoaderProps>((props, ref) => {
  const {
    spinnerColor,
    spinnerTrackWidth = 3,
    spinnerTrackColor = "rgba(127, 127, 127, 0.22)",
    spinnerTrackIsTransparent = false,
    duration = 850,
    size = 25,
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
    throw new TypeError("CircleLoader: an exposed loader requires a nonempty accessible name")
  const milliseconds = resolveNativeLoaderDuration(duration, "CircleLoader")
  validateNativeDisplayDimension(size, "CircleLoader", "size")
  if (!Number.isFinite(spinnerTrackWidth) || spinnerTrackWidth < 0)
    throw new TypeError("CircleLoader: spinnerTrackWidth must be finite and nonnegative")
  const reduced = useNativeLoaderReducedMotion()
  const isMotionEnabled = !reduced && milliseconds > 0
  const phase = useNativeLoaderLoop(milliseconds, 0, Easing.linear, isMotionEnabled)
  const baseline: TNativeLoaderRootStyle = {
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    color: content?.foregroundColor ?? theme.colors.foreground,
    ...resolveNativeStyle(customStyles, "CircleLoader", "customStyles"),
  }
  const { color: foreground, ...rootStyle } = resolveNativeStyle(
    [
      baseline,
      typeof style === "function" ? style({ duration: milliseconds, isMotionEnabled, defaultStyle: baseline }) : style,
    ],
    "CircleLoader",
    "style",
  )
  const fill = spinnerColor ?? foreground ?? theme.colors.foreground
  const track = spinnerTrackIsTransparent ? "transparent" : spinnerTrackColor
  validateNativeColor(fill, "CircleLoader", "spinnerColor")
  validateNativeColor(track, "CircleLoader", "spinnerTrackColor")
  const identity = testID ?? aliasID ?? "circle-loader"
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
      <Animated.View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        testID={identity + "-spinner"}
        style={{
          width: size,
          height: size,
          borderRadius: theme.radius.round,
          borderWidth: spinnerTrackWidth,
          borderColor: track,
          borderTopColor: fill,
          borderRightColor: fill,
          transform: [{ rotate: phase.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }],
        }}
      />
    </View>
  )
})
CircleLoader.displayName = "CircleLoader"
