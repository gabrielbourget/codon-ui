import { forwardRef } from "react"
import { Easing, Pressable } from "react-native"

import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { validateNativeColor } from "../colors"
import { useNativeLinkColor } from "../Link/motion"
import { NativeContentContext } from "../NativeContentContext"
import { validateSelectKey } from "../Select/collection"
import { getNativeControlRootStyle, useNativeSelectionInteraction } from "../selection"

import type {
  TNativeListBoxItemProps,
  TNativeListBoxItemRef,
  TNativeListBoxItemRenderState,
  TNativeListBoxItemRootStyle,
} from "./types"

const backgroundEasing = Easing.bezier(0.42, 0, 0.58, 1)

export const ListBoxItem = forwardRef<TNativeListBoxItemRef, TNativeListBoxItemProps>((props, ref) => {
  const {
    render,
    id,
    textValue,
    isSelected = false,
    isDisabled = false,
    isReadOnly = false,
    children,
    textSize = "medium",
    customStyles,
    style,
    testID,
    "data-testid": aliasTestID,
    accessibilityState,
    ...rest
  } = props
  validateSelectKey(id, "ListBoxItem id")
  if (typeof textValue !== "string" || !textValue.trim())
    throw new TypeError("ListBoxItem: textValue must not be empty")
  const theme = useNativeTheme()
  const { flags, handlers } = useNativeSelectionInteraction(rest, isDisabled, isReadOnly, () => undefined)
  const state: TNativeListBoxItemRenderState = { ...flags, isSelected }
  const foreground = isSelected ? theme.colors.controlSelectedForeground : theme.colors.controlForeground
  validateNativeColor(foreground, "ListBoxItem", "foreground")
  const background = isSelected
    ? state.isPressed
      ? theme.colors.controlSelectedPressedBackground
      : state.isHovered
        ? theme.colors.controlSelectedHoverBackground
        : theme.colors.controlSelectedBackground
    : state.isPressed
      ? theme.colors.controlPressedBackground
      : state.isHovered
        ? theme.colors.controlHoverBackground
        : theme.colors.controlBackground
  const resolved = getNativeControlRootStyle(
    "ListBoxItem",
    {
      justifyContent: "center",
      padding: theme.spacing.unit * 2,
      borderRadius: theme.radius.rounded,
      backgroundColor: background,
      color: foreground,
      cursor: !isDisabled && state.isHovered ? "pointer" : "auto",
      opacity: isDisabled ? theme.opacity.disabled : 1,
      ...(state.isFocused ? { outlineColor: theme.colors.focusRing, outlineWidth: 1.5, outlineOffset: 1.5 } : {}),
    } as TNativeListBoxItemRootStyle,
    customStyles,
    style,
    state,
  )
  const { color: contentForeground = foreground, ...rootStyle } = resolved
  const backgroundColor = useNativeLinkColor(rootStyle.backgroundColor ?? "transparent", 250, backgroundEasing)
  const content =
    typeof children === "function" ? children({ ...state, defaultChildren: undefined }) : (children ?? textValue)
  const element = (
    <Pressable
      {...rest}
      {...handlers}
      ref={ref}
      testID={testID ?? aliasTestID ?? "list-box-item"}
      accessible
      accessibilityLabel={textValue}
      role="radio"
      accessibilityRole="radio"
      disabled={isDisabled}
      focusable={!isDisabled}
      aria-label={undefined}
      aria-selected={undefined}
      aria-checked={isSelected}
      aria-disabled={isDisabled}
      accessibilityState={{ ...accessibilityState, checked: isSelected, disabled: isDisabled }}
      style={{ ...rootStyle, backgroundColor }}
    >
      {getNativeButtonContent(content, {
        flexShrink: 1,
        fontSize: theme.typography.fontSizes[textSize === "small" ? "b11" : textSize === "large" ? "b9" : "b10"],
      })}
    </Pressable>
  )
  return (
    <NativeContentContext.Provider value={{ foregroundColor: contentForeground, isButton: true }}>
      {render ? render(element.props, state) : element}
    </NativeContentContext.Provider>
  )
})
ListBoxItem.displayName = "ListBoxItem"
