import { forwardRef, useState } from "react"
import { Pressable, View, type ViewStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { getNativeButtonContent as getNativeControlContent } from "../Button/content"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { NativeContentContext } from "../NativeContentContext"
import {
  getNativeControlRadius,
  getNativeControlRootStyle,
  useNativeControlHitSlop,
  useNativeSelectionInteraction,
  validateNativeControlDimension,
} from "../selection"
import { Text } from "../Text/Text"

import type { TNativeSwitchProps, TNativeSwitchRef, TNativeSwitchRenderState } from "./types"

export const Switch = forwardRef<TNativeSwitchRef, TNativeSwitchProps>((props, ref) => {
  const {
    isSelected,
    defaultSelected = false,
    onChange,
    isDisabled = false,
    isReadOnly = false,
    width,
    height = 15,
    trackColor,
    indicatorColor,
    invertColorsOnToggle = false,
    showBorder = false,
    geometry = "round",
    order,
    raised = true,
    enableFocusStyle = true,
    offsetFocusRing = true,
    iconOn,
    iconOff,
    showOnOffIcons = false,
    leftContent,
    rightContent,
    customStyles,
    customTrackStyles,
    customIndicatorStyles,
    style,
    testID,
    accessibilityLabel,
    accessibilityState,
    "data-testid": aliasTestID,
    "aria-label": aliasLabel,
    ...rest
  } = props
  validateNativeControlDimension(width, "Switch", "width")
  validateNativeControlDimension(height, "Switch", "height")
  validateNativeColor(trackColor, "Switch", "trackColor")
  validateNativeColor(indicatorColor, "Switch", "indicatorColor")
  const theme = useNativeTheme()
  const [localSelected, setLocalSelected] = useState(defaultSelected)
  const selected = isSelected ?? localSelected
  const { flags, handlers } = useNativeSelectionInteraction(rest, isDisabled, isReadOnly, () => {
    if (isSelected === undefined) setLocalSelected(!selected)
    onChange?.(!selected)
  })
  const state: TNativeSwitchRenderState = { ...flags, isSelected: selected }
  const hitRegion = useNativeControlHitSlop(rest.onLayout, rest.hitSlop)
  const [trackBounds, setTrackBounds] = useState<{ width: number; height: number }>()
  const [indicatorWidth, setIndicatorWidth] = useState<number>()
  const radius = getNativeControlRadius(theme, geometry)
  let background = trackColor ?? theme.colors.controlTrackBackground
  if (selected) {
    background =
      trackColor ??
      (invertColorsOnToggle && showBorder && !order
        ? theme.colors.controlTrackInvertedBackground
        : order
          ? theme.actions[order].background
          : theme.colors.controlSelectedBackground)
  }
  if (state.isPressed) background = theme.colors.controlPressedBackground
  const trackStyle = resolveNativeStyle<ViewStyle>(
    [
      {
        width: width ?? height * 2,
        height,
        backgroundColor: background,
        borderRadius: radius,
        borderWidth: showBorder ? 1.5 : 0,
        borderColor:
          selected && invertColorsOnToggle
            ? order
              ? theme.actions[order].border
              : theme.colors.controlSelectedBackground
            : theme.colors.controlBorder,
      },
      resolveNativeStyle(customTrackStyles, "Switch", "customTrackStyles"),
    ],
    "Switch",
    "trackStyle",
  )
  const thumbSize = trackBounds?.height ?? Math.max(0, height - (showBorder ? 3 : 0))
  const thumbStyle = resolveNativeStyle<ViewStyle>(
    [
      {
        position: "absolute",
        top: 0,
        left: selected ? Math.max(0, (trackBounds?.width ?? width ?? height * 2) - (indicatorWidth ?? thumbSize)) : 0,
        width: thumbSize,
        height: thumbSize,
        borderRadius: radius,
        backgroundColor:
          indicatorColor ??
          (selected && invertColorsOnToggle
            ? theme.colors.controlSelectedBackground
            : theme.colors.controlSelectedForeground),
        ...(raised
          ? {
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.24,
              shadowRadius: 3,
              elevation: 2,
            }
          : {}),
        ...(enableFocusStyle && state.isFocused
          ? { outlineColor: theme.colors.focusRing, outlineWidth: 2, outlineOffset: offsetFocusRing ? 3.5 : 0 }
          : {}),
      },
      resolveNativeStyle(customIndicatorStyles, "Switch", "customIndicatorStyles"),
    ],
    "Switch",
    "indicatorStyle",
  )
  const rootStyle = getNativeControlRootStyle(
    "Switch",
    {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.unit,
      opacity: isDisabled ? theme.opacity.disabled : 1,
    } as ViewStyle,
    customStyles,
    style,
    state,
  )
  const icons = showOnOffIcons || iconOn !== undefined || iconOff !== undefined

  return (
    <NativeContentContext.Provider value={{ foregroundColor: theme.colors.foreground, isButton: true }}>
      <Pressable
        {...rest}
        {...handlers}
        {...hitRegion}
        ref={ref}
        accessible
        role="switch"
        accessibilityRole="switch"
        aria-selected={undefined}
        disabled={isDisabled}
        focusable={!isDisabled}
        aria-checked={selected}
        aria-disabled={isDisabled}
        accessibilityState={{ ...accessibilityState, checked: selected, disabled: isDisabled }}
        accessibilityLabel={accessibilityLabel ?? aliasLabel}
        testID={testID ?? aliasTestID ?? "switch"}
        style={rootStyle}
      >
        {getNativeControlContent(leftContent)}
        <View
          testID={`${testID ?? aliasTestID ?? "switch"}-track`}
          style={trackStyle}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View
            testID={`${testID ?? aliasTestID ?? "switch"}-track-content`}
            style={{ flex: 1, position: "relative" }}
            onLayout={({ nativeEvent: { layout } }) =>
              setTrackBounds((current) =>
                current?.width === layout.width && current.height === layout.height
                  ? current
                  : { width: layout.width, height: layout.height },
              )
            }
          >
            {icons ? (
              <View style={{ flexDirection: "row", height: "100%" }}>
                <View style={{ width: "50%", justifyContent: "center", alignItems: "flex-start", paddingLeft: 3 }}>
                  {iconOn === undefined ? (
                    <Text
                      selectable={false}
                      color={theme.colors.controlSelectedForeground}
                      customStyles={{ fontSize: 10 }}
                    >
                      ✓
                    </Text>
                  ) : (
                    getNativeControlContent(iconOn)
                  )}
                </View>
                <View style={{ width: "50%", justifyContent: "center", alignItems: "flex-end", paddingRight: 3 }}>
                  {iconOff === undefined ? (
                    <Text
                      selectable={false}
                      color={theme.colors.controlSelectedForeground}
                      customStyles={{ fontSize: 10 }}
                    >
                      ×
                    </Text>
                  ) : (
                    getNativeControlContent(iconOff)
                  )}
                </View>
              </View>
            ) : null}
            <View
              testID={`${testID ?? aliasTestID ?? "switch"}-indicator`}
              style={thumbStyle}
              onLayout={({ nativeEvent: { layout } }) =>
                setIndicatorWidth((current) => (current === layout.width ? current : layout.width))
              }
            />
          </View>
        </View>
        {getNativeControlContent(rightContent)}
      </Pressable>
    </NativeContentContext.Provider>
  )
})

Switch.displayName = "Switch"
