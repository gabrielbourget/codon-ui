import { forwardRef } from "react"
import { Animated, View } from "react-native"
import Svg, { Circle, Path, Text as SVGText } from "react-native-svg"

import { useNativeTheme } from "../../theme"
import { useNativeContentContext } from "../NativeContentContext"

import { getNativeCircularGeometry } from "./model"
import { useNativeCircularOffset } from "./motion"
import { getNativeCircularStyles, nativeCircularPresentation } from "./styles"
import type { TNativeCircularProgressProps, TNativeCircularProgressRef } from "./types"

const AnimatedPath = Animated.createAnimatedComponent(Path)

export const CircularProgress = forwardRef<TNativeCircularProgressRef, TNativeCircularProgressProps>((props, ref) => {
  const {
    value: _value,
    minValue = 0,
    maxValue = 100,
    valueLabel,
    isIndeterminate = false,
    locale,
    formatOptions = { style: "percent" },
    height: _height,
    width: _width,
    backgroundColor,
    pathColor: _pathColor,
    trackColor: _trackColor,
    order: _order,
    circleRatio: _circleRatio,
    backgroundPadding: _backgroundPadding,
    strokeWidth = 6,
    strokeLineCap: _strokeLineCap,
    counterClockwise: _counterClockwise,
    text,
    customStyles: _customStyles,
    style: _style,
    customSVGStyles: _svgStyles,
    customTrackStyles: _trackStyles,
    customPathStyles: _pathStyles,
    customTextStyles: _textStyles,
    customBackgroundStyles: _backgroundStyles,
    children: _children,
    accessibilityLabel,
    "aria-label": aliasLabel,
    accessibilityLabelledBy,
    "aria-labelledby": aliasLabelledBy,
    "aria-describedby": describedBy,
    "aria-details": details,
    "aria-valuemin": _ariaMin,
    "aria-valuemax": _ariaMax,
    "aria-valuenow": _ariaNow,
    "aria-valuetext": _ariaText,
    testID,
    "data-testid": aliasID,
    ...rootProps
  } = props
  if (describedBy !== undefined || details !== undefined)
    throw new TypeError("CircularProgress: browser description/details relationships are not implemented")
  const theme = useNativeTheme()
  const context = useNativeContentContext()
  const geometry = getNativeCircularGeometry(props)
  const valueText = isIndeterminate
    ? undefined
    : valueLabel
      ? valueLabel
      : new Intl.NumberFormat(locale, formatOptions).format(
          formatOptions.style === "percent" ? geometry.percentage / 100 : geometry.bounded,
        )
  const state = { percentage: isIndeterminate ? undefined : geometry.percentage, valueText, isIndeterminate }
  const styles = getNativeCircularStyles(theme, props, state)
  const semanticValueText = valueText === undefined ? undefined : String(valueText)
  const { color: rootColor, ...rootStyle } = styles.root
  const dashOffset = useNativeCircularOffset(geometry.canDrawPath ? geometry.pathOffset : undefined)
  const identity = testID ?? aliasID ?? "circular-progress"
  const hasStroke = Number.isFinite(strokeWidth) && strokeWidth >= 0
  const range = geometry.hasNativeRange ? { min: minValue, max: maxValue } : {}
  return (
    <View
      {...rootProps}
      ref={ref}
      accessible
      role="progressbar"
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? aliasLabel}
      accessibilityLabelledBy={accessibilityLabelledBy ?? aliasLabelledBy}
      accessibilityValue={{
        ...range,
        ...(!isIndeterminate && geometry.hasNativeRange ? { now: geometry.bounded } : {}),
        text: semanticValueText,
      }}
      aria-valuemin={geometry.hasNativeRange ? minValue : undefined}
      aria-valuemax={geometry.hasNativeRange ? maxValue : undefined}
      aria-valuenow={!isIndeterminate && geometry.hasNativeRange ? geometry.bounded : undefined}
      aria-valuetext={semanticValueText}
      testID={identity}
      style={rootStyle}
    >
      <Svg
        color={rootColor ?? context?.foregroundColor ?? theme.colors.foreground}
        {...nativeCircularPresentation(styles.svg)}
        width={styles.svg.width ?? "100%"}
        height={styles.svg.height ?? "100%"}
        viewBox="0 0 100 100"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        testID={`${identity}-svg`}
      >
        {backgroundColor ? (
          <Circle
            cx={50}
            cy={50}
            r={50}
            {...nativeCircularPresentation(styles.background)}
            testID={`${identity}-background`}
          />
        ) : null}
        {geometry.canDrawTrack && hasStroke ? (
          <Path
            fillOpacity={0}
            strokeWidth={strokeWidth}
            {...nativeCircularPresentation(styles.track)}
            d={geometry.description}
            strokeDasharray={[geometry.circumference, geometry.circumference]}
            strokeDashoffset={geometry.trackOffset}
            testID={`${identity}-track`}
          />
        ) : null}
        {geometry.canDrawPath && hasStroke ? (
          <AnimatedPath
            fillOpacity={0}
            strokeWidth={strokeWidth}
            {...nativeCircularPresentation(styles.path)}
            d={geometry.description}
            strokeDasharray={[geometry.circumference, geometry.circumference]}
            strokeDashoffset={dashOffset}
            testID={`${identity}-path`}
          />
        ) : null}
        {text ? (
          <SVGText x={50} y={50} {...nativeCircularPresentation(styles.text)} testID={`${identity}-text`}>
            {text}
          </SVGText>
        ) : null}
      </Svg>
    </View>
  )
})
CircularProgress.displayName = "CircularProgress"
