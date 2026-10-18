import { forwardRef } from "react"
import { View } from "react-native"

import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { CircularProgress } from "../CircularProgress/CircularProgress"
import type { TNativeCircularProgressRootStyle } from "../CircularProgress/types"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"
import { useNativeLinkColor } from "../Link/motion"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { Text } from "../Text/Text"

import { getNativeCounterStatus } from "./model"
import type { TNativeCounterProps, TNativeCounterRef } from "./types"

export const Counter = forwardRef<TNativeCounterRef, TNativeCounterProps>((props, ref) => {
  const {
    value,
    maxValue,
    showMaxValue = false,
    showProgressIndicator = false,
    warningPercentageThreshold: _warning,
    errorOrDangerPercentageThreshold: _danger,
    height,
    width,
    color,
    children,
    customStyles,
    style,
    customTextStyles,
    customProgressIndicatorStyles,
    accessibilityLabel,
    "aria-label": nativeLabel,
    ariaLabel,
    accessibilityLabelledBy,
    "aria-labelledby": nativeLabelledBy,
    ariaLabelledBy,
    ariaDescribedBy,
    ariaDetails,
    "aria-describedby": nativeDescribedBy,
    "aria-details": nativeDetails,
    testID,
    "data-testid": aliasID,
    ...rootProps
  } = props
  if ([ariaDescribedBy, ariaDetails, nativeDescribedBy, nativeDetails].some((value) => value !== undefined))
    throw new TypeError("Counter: browser description/details relationships are not implemented")
  validateNativeColor(color, "Counter", "color")
  validateNativeDisplayDimension(height, "Counter", "height")
  validateNativeDisplayDimension(width, "Counter", "width")
  const theme = useNativeTheme()
  const context = useNativeContentContext()
  const status = getNativeCounterStatus(props)
  const statusColor =
    status === "danger" ? theme.colors.statusDanger : status === "warning" ? theme.colors.statusWarning : undefined
  const { color: rootColor, ...viewStyle } = resolveNativeStyle<TNativeCircularProgressRootStyle>(
    [
      {
        flexDirection: "row",
        gap: theme.spacing.unit,
        alignItems: "center",
        justifyContent: "center",
        height,
        width,
        color,
      },
      customStyles,
      style,
    ],
    "Counter",
    "style",
  )
  const foreground = useNativeLinkColor(rootColor ?? context?.foregroundColor ?? theme.colors.foreground)
  const textStyle = resolveNativeStyle(
    [{ color: statusColor ?? color }, customTextStyles],
    "Counter",
    "customTextStyles",
  )
  const ownedTextColor = useNativeLinkColor(
    textStyle.color ?? rootColor ?? context?.foregroundColor ?? theme.colors.foreground,
  )
  const textColor = textStyle.color === undefined ? foreground : ownedTextColor
  const indicatorStyle = resolveNativeStyle(
    [{ color }, customProgressIndicatorStyles],
    "Counter",
    "customProgressIndicatorStyles",
  )
  const label = accessibilityLabel ?? nativeLabel ?? ariaLabel
  const labelledBy = accessibilityLabelledBy ?? nativeLabelledBy ?? ariaLabelledBy
  const identity = testID ?? aliasID ?? "counter"
  return (
    <NativeContentContext.Provider value={{ foregroundColor: foreground, isButton: context?.isButton ?? false }}>
      <View
        {...rootProps}
        ref={ref}
        accessibilityLabel={label}
        accessibilityLabelledBy={labelledBy}
        testID={identity}
        style={viewStyle}
      >
        {showProgressIndicator && maxValue ? (
          <CircularProgress
            width={12}
            height={12}
            value={(Number(value) / Number(maxValue)) * 100}
            pathColor={statusColor}
            customStyles={indicatorStyle}
            accessibilityLabel={label ? `${label} Progress` : "Progress"}
            accessibilityLabelledBy={labelledBy}
            testID={`${identity}-progress`}
          />
        ) : null}
        <View
          testID={`${identity}-text-row`}
          style={{ height: "100%", flexDirection: "row", justifyContent: "center", alignItems: "center" }}
        >
          <Text testID={`${identity}-value`} customStyles={{ ...textStyle, color: textColor }}>
            {value}
          </Text>
          {showMaxValue && maxValue ? (
            <Text testID={`${identity}-max`} customStyles={{ ...textStyle, color: textColor }}>{`/${maxValue}`}</Text>
          ) : null}
        </View>
        {getNativeButtonContent(children)}
      </View>
    </NativeContentContext.Provider>
  )
})
Counter.displayName = "Counter"
