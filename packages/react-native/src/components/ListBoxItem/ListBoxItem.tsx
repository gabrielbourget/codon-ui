import { forwardRef } from "react"
import { Pressable, type ViewStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { NativeContentContext } from "../NativeContentContext"
import { validateSelectKey } from "../Select/collection"
import { getNativeControlRootStyle, useNativeSelectionInteraction } from "../selection"

import type { TNativeListBoxItemProps, TNativeListBoxItemRef, TNativeListBoxItemRenderState } from "./types"

export const ListBoxItem = forwardRef<TNativeListBoxItemRef, TNativeListBoxItemProps>((props, ref) => {
  const {
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
      opacity: isDisabled ? theme.opacity.disabled : 1,
      ...(state.isFocused ? { outlineColor: theme.colors.focusRing, outlineWidth: 1.5, outlineOffset: 1.5 } : {}),
    } as ViewStyle,
    customStyles,
    style,
    state,
  )
  const content = typeof children === "function" ? children(state) : (children ?? textValue)
  return (
    <NativeContentContext.Provider value={{ foregroundColor: foreground, isButton: true }}>
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
        style={resolved}
      >
        {getNativeButtonContent(content, {
          flexShrink: 1,
          fontSize: theme.typography.fontSizes[textSize === "small" ? "b11" : textSize === "large" ? "b9" : "b10"],
        })}
      </Pressable>
    </NativeContentContext.Provider>
  )
})
ListBoxItem.displayName = "ListBoxItem"
