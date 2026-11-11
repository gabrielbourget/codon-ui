import { forwardRef, useContext, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react"

import { useNativeContextProps } from "../../collection/context"
import { useControlledState } from "../../collection/state/useControlledState"
import { focusNativeTarget } from "../../input/focus"
import { useNativeTheme } from "../../theme"
import { NativeButton as Button } from "../Button/Button"
import type { TNativeButtonRootStyle } from "../Button/types"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"
import { nativeControlTarget } from "../selection"
import { NativeSelectionIndicatorProvider } from "../SelectionIndicator/context"
import { NativeToggleButtonGroupStateContext } from "../ToggleButtonGroup/context"

import { NativeToggleButtonContext } from "./context"
import type { TNativeToggleButtonProps, TNativeToggleButtonRef, TNativeToggleButtonSelectionState } from "./types"

export const ToggleButton = forwardRef<TNativeToggleButtonRef, TNativeToggleButtonProps>((ownProps, forwardedRef) => {
  const [props, ref] = useNativeContextProps(ownProps, forwardedRef, NativeToggleButtonContext)
  const group = useContext(NativeToggleButtonGroupStateContext)
  const {
    id,
    slot: _slot,
    nativeID,
    isSelected,
    defaultSelected,
    onChange,
    onPress,
    children,
    render,
    color,
    order,
    raised = false,
    width,
    height,
    customStyles,
    style,
    autoFocus = false,
    preventFocusOnPress = false,
    isDisabled: authoredDisabled = false,
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
  const member = group !== null && id != null
  const isDisabled = authoredDisabled || (member && group.isDisabled)
  const initialDefault = member ? undefined : defaultSelected
  const [selected, requestSelected] = useControlledState(
    member ? group.selectedKeys.has(id) : isSelected,
    initialDefault ?? false,
    member ? (next: boolean) => group.setSelected(id, next) : onChange,
  )
  const [initialSelected] = useState(selected)
  const setSelected = (next: boolean) => {
    if (typeof next !== "boolean") throw new TypeError("ToggleButton: selection must be boolean")
    requestSelected(next)
  }
  const state: TNativeToggleButtonSelectionState = {
    isSelected: selected,
    defaultSelected: initialDefault ?? initialSelected,
    setSelected,
    toggle: () =>
      !member && isSelected === undefined ? requestSelected((current) => !current) : setSelected(!selected),
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
    <NativeSelectionIndicatorProvider isSelected={selected}>
      <Button
        {...rest}
        slot={null}
        nativeAnimate="colors"
        nativeRole={member && group.selectionMode === "single" ? "radio" : "button"}
        nativeRender={
          render
            ? (props, { isPending: _pending, isFocusVisible: _focusVisible, ...interaction }) =>
                render(props, { ...interaction, isSelected: selected, state })
            : undefined
        }
        nativeFocusOnPress={!preventFocusOnPress}
        ref={root}
        nativeID={nativeID ?? (!member && id !== undefined ? String(id) : undefined)}
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
        {({ isPending: _pending, isFocusVisible: _focusVisible, ...interaction }) =>
          typeof children === "function" ? children({ ...interaction, isSelected: selected, state }) : children
        }
      </Button>
    </NativeSelectionIndicatorProvider>
  )
})
ToggleButton.displayName = "ToggleButton"
