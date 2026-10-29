import { forwardRef, useContext } from "react"
import { Pressable, View, type ViewStyle } from "react-native"

import { useControlledState } from "../../collection/state/useControlledState"
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

import { useNativeCheckboxMotion } from "./motion"
import type {
  TNativeCheckboxProps,
  TNativeCheckboxRef,
  TNativeCheckboxRenderState,
  TNativeCheckboxRootStyle,
} from "./types"

export const Checkbox = forwardRef<TNativeCheckboxRef, TNativeCheckboxProps>((props, ref) => {
  const {
    children,
    render,
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
  const [localSelected, setLocalSelected] = useControlledState(isSelected, defaultSelected, onChange)
  const member = group !== undefined && value !== undefined
  const selected = member ? group.value.includes(value) : localSelected
  const isDisabled = ownDisabled || (group?.isDisabled ?? false)
  const isReadOnly = ownReadOnly || (group?.isReadOnly ?? false)
  const { flags, handlers } = useNativeSelectionInteraction(rest, isDisabled, isReadOnly, () => {
    if (member) {
      group.change(value, !selected)
      onChange?.(!selected)
    } else setLocalSelected(!selected)
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
      cursor: "pointer",
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
  const motion = useNativeCheckboxMotion(shapeStyle, foreground, filled)
  const paintedWidth = typeof motion.shape.width === "number" ? motion.shape.width : width
  const paintedHeight = typeof motion.shape.height === "number" ? motion.shape.height : height
  const checkWidth = paintedWidth * 0.3
  const checkHeight = paintedHeight * 0.55
  const checkBounds = (checkWidth + checkHeight) * Math.SQRT1_2
  const checkInset = (paintedWidth - checkBounds) / 2
  const rootStyle = getNativeControlRootStyle(
    "Checkbox",
    {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.unit,
      opacity: isDisabled ? theme.opacity.disabled : 1,
      color: theme.colors.foreground,
    } as TNativeCheckboxRootStyle,
    customStyles,
    style,
    state,
  )
  const { color: labelForeground = theme.colors.foreground, ...viewStyle } = rootStyle
  const rendered = typeof children === "function" ? children({ ...state, defaultChildren: undefined }) : children
  const identity = testID ?? aliasTestID ?? "checkbox"
  const element = (
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
      style={viewStyle}
    >
      <View
        testID={`${identity}-shape`}
        style={motion.shape}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {isIndeterminate ? (
          <View
            testID={`${identity}-mixed`}
            style={{ width: "70%", height: 3, backgroundColor: motion.glyphForeground }}
          />
        ) : showIcon && (selected || motion.ink > 0) ? (
          <View pointerEvents="none" style={{ width: paintedWidth, height: paintedHeight }}>
            <View
              testID={`${identity}-ink`}
              style={{
                position: "absolute",
                left: checkInset,
                width: checkBounds * Math.max(0, Math.min(1, motion.ink)),
                height: paintedHeight,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  left: -checkInset,
                  width: paintedWidth,
                  height: paintedHeight,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  testID={`${identity}-check`}
                  style={{
                    width: checkWidth,
                    height: checkHeight,
                    borderRightWidth: 2,
                    borderBottomWidth: 2,
                    borderColor: motion.glyphForeground,
                    transform: [{ rotate: "45deg" }],
                    marginTop: -paintedHeight * 0.15,
                  }}
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>
      {getNativeControlContent(rendered, { flexShrink: 1 })}
    </Pressable>
  )
  return (
    <NativeContentContext.Provider value={{ foregroundColor: labelForeground, isButton: true }}>
      {render ? render(element.props, state) : element}
    </NativeContentContext.Provider>
  )
})
Checkbox.displayName = "Checkbox"
