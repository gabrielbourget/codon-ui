import { forwardRef } from "react"
import { ActivityIndicator, Animated, View, type ViewStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import type { TNativeLinearProgressProps } from "../LinearProgress/types"
import type { TNativeMeterProps } from "../Meter/types"
import { getNativeControlRadius } from "../selection"

import { useRangeAnimation } from "./useRangeAnimation"

type TRangeIndicatorProps =
  | { component: "LinearProgress"; indicatorProps: TNativeLinearProgressProps }
  | { component: "Meter"; indicatorProps: TNativeMeterProps }

export const RangeIndicator = forwardRef<View, TRangeIndicatorProps>((props, ref) => {
  const { component, indicatorProps } = props
  const {
    value,
    minValue = 0,
    maxValue = 100,
    valueLabel,
    locale,
    formatOptions = { style: "percent" },
    isIndeterminate: requestedIndeterminate = false,
    height,
    width,
    orientation = "horizontal",
    direction,
    barColor,
    trackColor,
    barGeometry = "round",
    trackGeometry = "round",
    order,
    raised = false,
    customStyles,
    customTrackStyles,
    customBarStyles,
    style,
    accessibilityLabel,
    "aria-label": aliasLabel,
    testID,
    "data-testid": aliasTestID,
    ...rest
  } = indicatorProps
  const isIndeterminate = component === "LinearProgress" && requestedIndeterminate
  const theme = useNativeTheme()
  const label = accessibilityLabel ?? aliasLabel
  if (typeof label !== "string" || !label.trim())
    throw new TypeError(`${component}: a nonempty accessibilityLabel or aria-label is required`)
  if (![value, minValue, maxValue].every(Number.isFinite) || maxValue <= minValue)
    throw new RangeError(`${component}: value and bounds must be finite, with maxValue greater than minValue`)
  if (valueLabel !== undefined && typeof valueLabel !== "string")
    throw new TypeError(`${component}: valueLabel must be a string`)

  const boundedValue = Math.min(maxValue, Math.max(minValue, value))
  const span = maxValue - minValue
  const percentage =
    (Number.isFinite(span)
      ? (boundedValue - minValue) / span
      : (boundedValue / 2 - minValue / 2) / (maxValue / 2 - minValue / 2)) * 100
  const valueText = isIndeterminate
    ? undefined
    : (valueLabel ??
      new Intl.NumberFormat(locale, formatOptions).format(
        formatOptions.style === "percent" ? percentage / 100 : boundedValue,
      ))
  const visiblePercentage = isIndeterminate ? undefined : percentage
  const { animatedFill, reduceMotion } = useRangeAnimation(visiblePercentage)
  const vertical = orientation === "vertical"
  const componentID = component === "Meter" ? "meter" : "linear-progress"
  const identity = testID ?? aliasTestID ?? componentID
  const custom = resolveNativeStyle(customStyles, component, "customStyles")
  const baseline: ViewStyle = {
    position: "relative",
    width: width === undefined ? (vertical ? 10 : 150) : width,
    height: height === undefined ? (vertical ? 150 : 10) : height,
    ...custom,
  }
  const resolveRootOverride = () => {
    if (typeof style !== "function") return style
    if (props.component === "LinearProgress") {
      const authored = props.indicatorProps.style
      return typeof authored === "function"
        ? authored({ percentage: visiblePercentage, valueText, isIndeterminate, defaultStyle: baseline })
        : authored
    }
    const authored = props.indicatorProps.style
    return typeof authored === "function"
      ? authored({ percentage, valueText: valueText ?? "", defaultStyle: baseline })
      : authored
  }
  const rootStyle = resolveNativeStyle([baseline, resolveRootOverride()], component, "style")
  const fillColor = barColor ?? (order ? theme.actions[order].background : theme.colors.controlSelectedBackground)
  validateNativeColor(fillColor, component, "barColor")
  validateNativeColor(trackColor, component, "trackColor")
  const trackStyle = resolveNativeStyle(
    [
      {
        width: "100%",
        height: "100%",
        borderWidth: 1,
        borderColor: theme.colors.controlBorder,
        backgroundColor: trackColor ?? theme.colors.background,
        borderRadius: getNativeControlRadius(theme, trackGeometry),
        ...(raised
          ? {
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.24,
              shadowRadius: 3,
              elevation: 2,
            }
          : {}),
      },
      customTrackStyles,
    ],
    component,
    "customTrackStyles",
  )
  const barStyle = resolveNativeStyle(
    [
      {
        position: "absolute",
        backgroundColor: fillColor,
        borderRadius: getNativeControlRadius(theme, barGeometry),
        ...(vertical
          ? { left: 0, ...(direction === "down" ? { top: 0 } : { bottom: 0 }) }
          : { top: 0, ...(direction === "left" ? { right: 0 } : { left: 0 }) }),
      },
      customBarStyles,
    ],
    component,
    "customBarStyles",
  )
  return (
    <View
      {...rest}
      ref={ref}
      accessible
      role={component === "Meter" ? "meter" : "progressbar"}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={isIndeterminate ? {} : { min: minValue, max: maxValue, now: boundedValue, text: valueText }}
      aria-valuemin={isIndeterminate ? undefined : minValue}
      aria-valuemax={isIndeterminate ? undefined : maxValue}
      aria-valuenow={isIndeterminate ? undefined : boundedValue}
      aria-valuetext={valueText}
      testID={identity}
      style={rootStyle}
    >
      <View testID={`${identity}-track`} accessible={false} style={trackStyle}>
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={{ flex: 1, overflow: "hidden", borderRadius: trackStyle.borderRadius, direction: "ltr" }}
        >
          {isIndeterminate ? (
            <ActivityIndicator
              accessible={false}
              testID={`${identity}-indeterminate`}
              animating={!reduceMotion}
              hidesWhenStopped={false}
              size="small"
              color={barStyle.backgroundColor}
              style={{ flex: 1, transform: [{ scale: 0.4 }] }}
            />
          ) : (
            <Animated.View
              accessible={false}
              testID={`${identity}-bar`}
              style={[
                vertical ? { width: "100%", height: animatedFill } : { height: "100%", width: animatedFill },
                barStyle,
              ]}
            />
          )}
        </View>
      </View>
    </View>
  )
})
RangeIndicator.displayName = "RangeIndicator"
