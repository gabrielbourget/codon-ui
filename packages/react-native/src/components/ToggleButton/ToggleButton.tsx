import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react"

import { useControlledState } from "../../collection/state/useControlledState"
import { focusNativeTarget } from "../../input/focus"
import { useNativeTheme } from "../../theme"
import { Button } from "../Button/Button"
import type { TNativeButtonRootStyle } from "../Button/types"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"
import { nativeControlTarget } from "../selection"

import type { TNativeToggleButtonProps, TNativeToggleButtonRef, TNativeToggleButtonSelectionState } from "./types"

export const ToggleButton = forwardRef<TNativeToggleButtonRef, TNativeToggleButtonProps>((props, ref) => {
  const {
    isSelected,
    defaultSelected,
    onChange,
    onPress,
    children,
    color,
    order,
    raised = false,
    width,
    height,
    customStyles,
    style,
    autoFocus = false,
    isDisabled = false,
    accessibilityState,
    testID,
    "data-testid": aliasID,
    ...rest
  } = props
  for (const value of [isSelected, defaultSelected])
    if (value !== undefined && typeof value !== "boolean")
      throw new TypeError("ToggleButton: selection must be boolean")
  if (width !== undefined) validateNativeDisplayDimension(width, "ToggleButton", "width")
  if (height !== undefined) validateNativeDisplayDimension(height, "ToggleButton", "height")
  validateNativeColor(color, "ToggleButton", "color")
  const theme = useNativeTheme()
  const [selected, requestSelected] = useControlledState(isSelected, defaultSelected ?? false, onChange)
  const [initialSelected] = useState(selected)
  const setSelected = (next: boolean) => {
    if (typeof next !== "boolean") throw new TypeError("ToggleButton: selection must be boolean")
    requestSelected(next)
  }
  const state: TNativeToggleButtonSelectionState = {
    isSelected: selected,
    defaultSelected: defaultSelected ?? initialSelected,
    setSelected,
    toggle: () => setSelected(!selected),
  }
  const root = useRef<TNativeToggleButtonRef>(null)
  useImperativeHandle(ref, () => root.current!)
  const disabled = useRef(isDisabled)
  useLayoutEffect(() => {
    disabled.current = isDisabled
  })
  const initialAutoFocus = useRef(autoFocus && !isDisabled)
  useEffect(() => {
    if (!initialAutoFocus.current) return
    const frame = requestAnimationFrame(() => {
      if (!disabled.current) focusNativeTarget(root.current)
    })
    return () => cancelAnimationFrame(frame)
  }, [])
  const action = order ? theme.actions[order] : undefined
  return (
    <Button
      {...rest}
      slot={null}
      ref={root}
      aria-checked={undefined}
      aria-selected={undefined}
      isDisabled={isDisabled}
      raised={raised}
      width={width}
      height={height}
      accessibilityState={{ ...accessibilityState, checked: selected, selected: undefined }}
      testID={testID ?? aliasID ?? "toggle-button"}
      onPress={(event) => {
        state.toggle()
        onPress?.(event)
      }}
      style={({ isPending: _pending, ...interaction }) => {
        const current = { ...interaction, isSelected: selected, state }
        const background =
          color ??
          (selected
            ? interaction.isPressed
              ? (action?.pressedBackground ?? theme.colors.controlSelectedPressedBackground)
              : interaction.isHovered
                ? (action?.hoverBackground ?? theme.colors.controlSelectedHoverBackground)
                : (action?.background ?? theme.colors.controlSelectedBackground)
            : interaction.isPressed
              ? (action?.outlinePressedBackground ?? theme.colors.controlPressedBackground)
              : interaction.isHovered
                ? (action?.outlineHoverBackground ?? theme.colors.controlHoverBackground)
                : theme.colors.controlBackground)
        const foreground =
          color === undefined && selected
            ? (action?.foreground ?? theme.colors.controlSelectedForeground)
            : theme.colors.controlForeground
        const base: TNativeButtonRootStyle = {
          ...interaction.defaultStyle,
          borderWidth: 1,
          borderColor:
            color === undefined && selected
              ? (action?.border ?? theme.colors.controlSelectedBackground)
              : theme.colors.controlBorder,
          backgroundColor: background,
          color: foreground,
        }
        const custom = resolveNativeStyle(customStyles, "ToggleButton", "customStyles")
        const target = nativeControlTarget()
        const baseline = {
          ...base,
          minWidth: (custom.width ?? width) === undefined ? target : undefined,
          minHeight: (custom.height ?? height) === undefined ? target : undefined,
          ...custom,
        }
        const final = resolveNativeStyle(
          typeof style === "function"
            ? style({ ...current, foregroundColor: baseline.color ?? foreground, defaultStyle: baseline })
            : style,
          "ToggleButton",
          "style",
        )
        return {
          ...base,
          minWidth: (final.width ?? custom.width ?? width) === undefined ? target : undefined,
          minHeight: (final.height ?? custom.height ?? height) === undefined ? target : undefined,
          ...custom,
          ...final,
        }
      }}
    >
      {({ isPending: _pending, ...interaction }) =>
        typeof children === "function" ? children({ ...interaction, isSelected: selected, state }) : children
      }
    </Button>
  )
})
ToggleButton.displayName = "ToggleButton"
