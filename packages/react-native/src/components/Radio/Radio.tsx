import { forwardRef, useContext } from "react"
import { Pressable, View, type ViewStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { getNativeButtonContent as getNativeControlContent } from "../Button/content"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { NativeContentContext } from "../NativeContentContext"
import { NativeRadioGroupContext } from "../RadioGroup/context"
import {
  getNativeControlRadius,
  getNativeControlRootStyle,
  useNativeControlHitSlop,
  useNativeSelectionInteraction,
} from "../selection"

import { useNativeRadioShape } from "./motion"
import type { TNativeRadioProps, TNativeRadioRef, TNativeRadioRenderState } from "./types"

export const Radio = forwardRef<TNativeRadioRef, TNativeRadioProps>((props, ref) => {
  const {
    children,
    render,
    value,
    isDisabled: ownDisabled = false,
    width,
    height,
    geometry = "rounded",
    color,
    order,
    enableFocusStyle = true,
    offsetFocusRing = true,
    customStyles,
    style,
    customShapeStyles,
    testID,
    accessibilityLabel,
    accessibilityState,
    "data-testid": aliasTestID,
    "aria-label": aliasLabel,
    ...rest
  } = props
  const group = useContext(NativeRadioGroupContext)
  if (!group) throw new TypeError("Radio: a RadioGroup ancestor is required")
  if (typeof value !== "string") throw new TypeError("Radio: value must be a string")
  const label = accessibilityLabel ?? aliasLabel
  if (typeof label !== "string" || !label.trim())
    throw new TypeError("Radio: a nonempty accessibilityLabel or aria-label is required")
  validateNativeColor(color, "Radio", "color")
  const theme = useNativeTheme()
  const isDisabled = ownDisabled || group.isDisabled
  const isReadOnly = group.isReadOnly
  const { flags, handlers } = useNativeSelectionInteraction(rest, isDisabled, isReadOnly, () => group.change(value))
  const state: TNativeRadioRenderState = { ...flags, isSelected: group.value === value }
  const hitRegion = useNativeControlHitSlop(rest.onLayout, rest.hitSlop)
  const action = order ? theme.actions[order] : undefined
  const background = state.isSelected
    ? (color ?? action?.background ?? theme.colors.controlSelectedBackground)
    : state.isPressed
      ? (action?.outlinePressedBackground ?? theme.colors.controlPressedBackground)
      : state.isHovered
        ? (action?.outlineHoverBackground ?? theme.colors.controlHoverBackground)
        : theme.colors.controlBackground
  const shapeStyle = resolveNativeStyle<ViewStyle>(
    [
      {
        width: 20,
        height: 20,
        flexShrink: 0,
        backgroundColor: background,
        borderWidth: 2,
        borderColor: color ?? action?.border ?? theme.colors.controlBorder,
        borderRadius: getNativeControlRadius(theme, geometry),
        ...(enableFocusStyle && state.isFocused
          ? { outlineColor: theme.colors.focusRing, outlineWidth: 1.5, outlineOffset: offsetFocusRing ? 1.5 : 0 }
          : {}),
      },
      customShapeStyles,
    ],
    "Radio",
    "customShapeStyles",
  )
  const paintedShape = useNativeRadioShape(shapeStyle)
  const rootStyle = getNativeControlRootStyle(
    "Radio",
    {
      width,
      height,
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
  const identity = testID ?? aliasTestID ?? "radio"
  const element = (
    <Pressable
      {...rest}
      {...handlers}
      {...hitRegion}
      ref={ref}
      accessible
      role="radio"
      accessibilityRole="radio"
      aria-selected={undefined}
      disabled={isDisabled}
      focusable={!isDisabled}
      aria-disabled={isDisabled}
      aria-checked={state.isSelected}
      accessibilityState={{ ...accessibilityState, checked: state.isSelected, disabled: isDisabled }}
      accessibilityLabel={label}
      testID={identity}
      style={rootStyle}
    >
      <View
        testID={`${identity}-shape`}
        style={paintedShape}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      {getNativeControlContent(rendered, { flexShrink: 1 })}
    </Pressable>
  )
  return (
    <NativeContentContext.Provider value={{ foregroundColor: theme.colors.foreground, isButton: true }}>
      {render ? render(element.props, state) : element}
    </NativeContentContext.Provider>
  )
})
Radio.displayName = "Radio"
