import { forwardRef, useContext, useState } from "react"
import { Pressable, View, type ViewStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { getNativeButtonContent as getNativeControlContent } from "../Button/content"
import { NativeCheckboxGroupContext } from "../CheckboxGroup/context"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { NativeContentContext } from "../NativeContentContext"
import {
  getNativeControlRadius,
  getNativeControlRootStyle,
  useNativeControlHitSlop,
  useNativeSelectionInteraction,
  validateNativeControlDimension,
} from "../selection"

import type { TNativeCheckboxProps, TNativeCheckboxRef, TNativeCheckboxRenderState } from "./types"

export const Checkbox = forwardRef<TNativeCheckboxRef, TNativeCheckboxProps>((props, ref) => {
  const {
    children,
    value,
    isSelected,
    defaultSelected = false,
    onChange,
    isDisabled: ownDisabled = false,
    isReadOnly: ownReadOnly = false,
    isIndeterminate = false,
    showIcon = true,
    width = 20,
    height = 20,
    geometry = "rounded",
    color,
    order,
    raised = false,
    enableFocusStyle = true,
    offsetFocusRing = true,
    customStyles,
    style,
    testID,
    accessibilityLabel,
    accessibilityState,
    "data-testid": aliasTestID,
    "aria-label": aliasLabel,
    ...rest
  } = props
  validateNativeControlDimension(width, "Checkbox", "width")
  validateNativeControlDimension(height, "Checkbox", "height")
  validateNativeColor(color, "Checkbox", "color")
  const theme = useNativeTheme()
  const group = useContext(NativeCheckboxGroupContext)
  const [localSelected, setLocalSelected] = useState(defaultSelected)
  const member = group !== undefined && value !== undefined
  const selected = member ? group.value.includes(value) : (isSelected ?? localSelected)
  const isDisabled = ownDisabled || (group?.isDisabled ?? false)
  const isReadOnly = ownReadOnly || (group?.isReadOnly ?? false)
  const { flags, handlers } = useNativeSelectionInteraction(rest, isDisabled, isReadOnly, () => {
    if (member) group.change(value, !selected)
    else if (isSelected === undefined) setLocalSelected(!selected)
    onChange?.(!selected)
  })
  const state: TNativeCheckboxRenderState = { ...flags, isSelected: selected, isIndeterminate }
  const hitRegion = useNativeControlHitSlop(rest.onLayout, rest.hitSlop)
  const action = order ? theme.actions[order] : undefined
  const filled = selected || isIndeterminate
  let background = filled
    ? (color ?? action?.background ?? theme.colors.controlSelectedBackground)
    : theme.colors.controlBackground
  if (state.isPressed)
    background = filled
      ? (color ?? action?.pressedBackground ?? theme.colors.controlSelectedPressedBackground)
      : (action?.outlinePressedBackground ?? theme.colors.controlPressedBackground)
  else if (state.isHovered)
    background = filled
      ? (color ?? action?.hoverBackground ?? theme.colors.controlSelectedHoverBackground)
      : (action?.outlineHoverBackground ?? theme.colors.controlHoverBackground)
  const foreground = action?.foreground ?? theme.colors.controlSelectedForeground
  validateNativeColor(foreground, "Checkbox", "iconColor")
  const shapeStyle = resolveNativeStyle<ViewStyle>(
    {
      width,
      height,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: background,
      borderWidth: 2,
      borderColor:
        color ?? action?.border ?? (filled ? theme.colors.controlSelectedBackground : theme.colors.controlBorder),
      borderRadius: getNativeControlRadius(theme, geometry),
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
        ? { outlineColor: theme.colors.focusRing, outlineWidth: 1.5, outlineOffset: offsetFocusRing ? 1.5 : 0 }
        : {}),
    },
    "Checkbox",
    "shapeStyle",
  )
  const rootStyle = getNativeControlRootStyle(
    "Checkbox",
    {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.unit,
      opacity: isDisabled ? theme.opacity.disabled : 1,
    } as ViewStyle,
    customStyles,
    style,
    state,
  )
  const rendered = typeof children === "function" ? children({ ...state, defaultChildren: undefined }) : children
  const identity = testID ?? aliasTestID ?? "checkbox"
  return (
    <NativeContentContext.Provider value={{ foregroundColor: theme.colors.foreground, isButton: true }}>
      <Pressable
        {...rest}
        {...handlers}
        {...hitRegion}
        ref={ref}
        accessible
        role="checkbox"
        accessibilityRole="checkbox"
        aria-selected={undefined}
        disabled={isDisabled}
        focusable={!isDisabled}
        aria-disabled={isDisabled}
        aria-checked={isIndeterminate ? "mixed" : selected}
        accessibilityState={{
          ...accessibilityState,
          checked: isIndeterminate ? "mixed" : selected,
          disabled: isDisabled,
        }}
        accessibilityLabel={accessibilityLabel ?? aliasLabel}
        testID={identity}
        style={rootStyle}
      >
        <View
          testID={`${identity}-shape`}
          style={shapeStyle}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {isIndeterminate ? (
            <View testID={`${identity}-mixed`} style={{ width: "70%", height: 3, backgroundColor: foreground }} />
          ) : selected && showIcon ? (
            <View
              testID={`${identity}-check`}
              style={{
                width: width * 0.3,
                height: height * 0.55,
                borderRightWidth: 2,
                borderBottomWidth: 2,
                borderColor: foreground,
                transform: [{ rotate: "45deg" }],
                marginTop: -height * 0.15,
              }}
            />
          ) : null}
        </View>
        {getNativeControlContent(rendered)}
      </Pressable>
    </NativeContentContext.Provider>
  )
})
Checkbox.displayName = "Checkbox"
