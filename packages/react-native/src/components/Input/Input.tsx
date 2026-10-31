import {
  forwardRef,
  useEffect,
  useState,
  type ForwardRefExoticComponent,
  type ReactElement,
  type RefAttributes,
} from "react"
import { TextInput, type TextInputProps, type TextStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { validateNativeColor } from "../colors"
import { getNativeControlRadius, getNativeControlRootStyle } from "../selection"

import { useNativeInputBorder } from "./motion"
import type { TNativeInputProps, TNativeInputRef, TNativeInputRenderState } from "./types"

export type TNativeInputHostRender = (
  props: TextInputProps & RefAttributes<TNativeInputRef>,
  state: TNativeInputRenderState,
) => ReactElement

type TNativeInputInternalProps = TNativeInputProps & { nativeRender?: TNativeInputHostRender; nativeAnimate?: boolean }

export const NativeInput = forwardRef<TNativeInputRef, TNativeInputInternalProps>((props, ref) => {
  const {
    isDisabled = false,
    isReadOnly = false,
    textSize = "medium",
    geometry = "rounded",
    width,
    height,
    enableFocusStyle = true,
    offsetFocusRing = true,
    errorState = false,
    warningState = false,
    successState = false,
    customStyles,
    style,
    placeholderTextColor,
    testID,
    accessibilityLabel,
    accessibilityState,
    onChangeText,
    onChange,
    onFocus,
    onBlur,
    nativeRender,
    nativeAnimate = true,
    render,
    "data-testid": aliasTestID,
    "aria-label": aliasLabel,
    ...rest
  } = props
  const theme = useNativeTheme()
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (isDisabled) setFocused(false)
  }, [isDisabled])
  const state: TNativeInputRenderState = {
    isFocused: focused && !isDisabled,
    isDisabled,
    isReadOnly,
    isInvalid: errorState,
  }
  const placeholder = placeholderTextColor ?? theme.colors.controlPlaceholder
  validateNativeColor(placeholder, "Input", "placeholderTextColor")
  for (const field of ["selectionColor", "selectionHandleColor", "cursorColor", "underlineColorAndroid"] as const)
    validateNativeColor(rest[field], "Input", field)
  const border = errorState
    ? theme.colors.validationErrorBorder
    : warningState
      ? theme.colors.validationWarningBorder
      : successState
        ? theme.colors.validationSuccessBorder
        : theme.colors.controlBorder
  const baseline: TextStyle = {
    width,
    height,
    padding: theme.spacing.unit,
    paddingHorizontal: geometry === "round" ? 7 : theme.spacing.unit,
    backgroundColor: theme.colors.controlBackground,
    color: theme.colors.controlForeground,
    fontFamily: theme.typography.fontFamilies.body,
    fontWeight: theme.typography.fontWeights.regular,
    fontSize: theme.typography.fontSizes[textSize === "small" ? "b11" : textSize === "large" ? "b9" : "b10"],
    lineHeight: theme.typography.lineHeight,
    borderWidth: 1,
    borderColor: border,
    borderRadius: getNativeControlRadius(theme, geometry),
    opacity: isDisabled ? theme.opacity.disabled : 1,
    ...(enableFocusStyle && state.isFocused
      ? { outlineColor: theme.colors.focusRing, outlineWidth: 1.5, outlineOffset: offsetFocusRing ? 1.5 : 0 }
      : {}),
  }
  const resolved = getNativeControlRootStyle("Input", baseline, customStyles, style, state)
  const painted = useNativeInputBorder(resolved, nativeAnimate)
  const blocked = isDisabled || isReadOnly
  const native: TextInputProps & RefAttributes<TNativeInputRef> = {
    ...rest,
    ref,
    multiline: false,
    editable: !blocked,
    readOnly: blocked,
    focusable: !isDisabled,
    "aria-disabled": isDisabled,
    accessibilityState: { ...accessibilityState, disabled: isDisabled },
    accessibilityLabel: accessibilityLabel ?? aliasLabel,
    testID: testID ?? aliasTestID ?? "input",
    placeholderTextColor: placeholder,
    underlineColorAndroid: rest.underlineColorAndroid ?? "transparent",
    style: painted,
    onChangeText: (value) => {
      if (!blocked) onChangeText?.(value)
    },
    onChange: (event) => {
      if (!blocked) onChange?.(event)
    },
    onFocus: (event) => {
      if (!isDisabled) {
        setFocused(true)
        onFocus?.(event)
      }
    },
    onBlur: (event) => {
      setFocused(false)
      onBlur?.(event)
    },
  }
  return nativeRender ? nativeRender(native, state) : render ? render(native, state) : <TextInput {...native} />
})
NativeInput.displayName = "NativeInput"
export const Input: ForwardRefExoticComponent<TNativeInputProps & RefAttributes<TNativeInputRef>> = NativeInput
Input.displayName = "Input"
