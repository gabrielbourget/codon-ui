import { forwardRef } from "react"
import { Easing, View } from "react-native"

import { nativeAccessibilityIDs } from "../../input/accessibilityReferences"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { CircularProgress } from "../CircularProgress/CircularProgress"
import type { TNativeCircularProgressRootStyle } from "../CircularProgress/types"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"
import { useNativeLinkColor } from "../Link/motion"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { NativeText as Text } from "../Text/Text"

import { getNativeCounterStatus } from "./model"
import type { TNativeCounterProps, TNativeCounterRef } from "./types"

const counterColorEasing = Easing.bezier(0.42, 0, 0.58, 1)

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
  const foreground = useNativeLinkColor(
    rootColor ?? context?.foregroundColor ?? theme.colors.foreground,
    250,
    counterColorEasing,
  )
  const textStyle = resolveNativeStyle(
    [{ color: statusColor ?? color }, customTextStyles],
    "Counter",
    "customTextStyles",
  )
  const ownedTextColor = useNativeLinkColor(
    textStyle.color ?? rootColor ?? context?.foregroundColor ?? theme.colors.foreground,
    250,
    counterColorEasing,
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
      <NativeFocusHost
        {...rootProps}
        ref={ref}
        focusable={rootProps.tabIndex !== undefined ? rootProps.tabIndex === 0 : (rootProps.focusable ?? false)}
        onBubbledFocus={rootProps.onFocus}
        onBubbledBlur={rootProps.onBlur}
        accessibilityLabel={label}
        nativeLabelledBy={nativeAccessibilityIDs(labelledBy)}
        nativeDescribedBy={nativeAccessibilityIDs(nativeDescribedBy ?? ariaDescribedBy)}
        nativeDetailsBy={nativeAccessibilityIDs(nativeDetails ?? ariaDetails)}
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
          <Text testID={`${identity}-value`} customStyles={{ ...textStyle, color: textColor }} nativeColorIsAnimated>
            {value}
          </Text>
          {showMaxValue && maxValue ? (
            <Text
              testID={`${identity}-max`}
              customStyles={{ ...textStyle, color: textColor }}
              nativeColorIsAnimated
            >{`/${maxValue}`}</Text>
          ) : null}
        </View>
        {getNativeButtonContent(children)}
      </NativeFocusHost>
    </NativeContentContext.Provider>
  )
})
Counter.displayName = "Counter"
