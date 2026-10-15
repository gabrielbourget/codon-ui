import { forwardRef, useLayoutEffect, useRef, useState } from "react"
import { Platform, View, type ColorValue, type TextStyle, type ViewStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { Button } from "../Button/Button"
import { resolveNativeStyle } from "../colors"
import { Input } from "../Input/Input"
import { getNativeControlRadius } from "../selection"

import { useNumberInputState } from "./state"
import type { TNativeNumberInputProps, TNativeNumberInputRef, TNativeNumberInputRenderState } from "./types"

const Glyph = ({ plus, color }: { plus: boolean; color: ColorValue }) => (
  <View
    accessible={false}
    pointerEvents="none"
    style={{ width: 15, height: 15, justifyContent: "center", alignItems: "center" }}
  >
    <View style={{ width: 15, height: 2, backgroundColor: color }} />
    {plus ? <View style={{ position: "absolute", width: 2, height: 15, backgroundColor: color }} /> : null}
  </View>
)

export const NumberInput = forwardRef<TNativeNumberInputRef, TNativeNumberInputProps>((props, ref) => {
  const theme = useNativeTheme()
  const numeric = useNumberInputState(props)
  const {
    isDisabled = false,
    isReadOnly = false,
    errorState = false,
    warningState = false,
    successState = false,
    geometry = "rounded",
    textSize = "medium",
    enableFocusStyle = true,
    offsetFocusRing = true,
    width,
    height,
    customStyles,
    style,
    customGroupStyles,
    customInputStyles,
    customButtonStyles,
    IncrementIcon,
    DecrementIcon,
    incrementLabel,
    decrementLabel,
    inputProps = {},
    placeholder,
  } = props
  const label = props.accessibilityLabel ?? props["aria-label"]
  for (const [field, text] of [
    ["accessibilityLabel", label],
    ["incrementLabel", incrementLabel],
    ["decrementLabel", decrementLabel],
  ])
    if (typeof text !== "string" || !text.trim()) throw new TypeError(`NumberInput: ${field} must be nonempty`)
  const testID = props.testID ?? props["data-testid"] ?? "number-input"
  const [focused, setFocused] = useState(false)
  const focusedParts = useRef(new Set<string>())
  const focusPart = (part: string, active: boolean) => {
    if (active && !isDisabled) focusedParts.current.add(part)
    else focusedParts.current.delete(part)
    setFocused(focusedParts.current.size > 0)
  }
  useLayoutEffect(() => {
    if (isDisabled) {
      focusedParts.current.clear()
      setFocused(false)
    }
  }, [isDisabled])
  const state: TNativeNumberInputRenderState = {
    value: numeric.value,
    inputValue: numeric.inputValue,
    canIncrement: numeric.canIncrement,
    canDecrement: numeric.canDecrement,
    isFocused: focused && !isDisabled,
    isDisabled,
    isReadOnly,
    isInvalid: errorState,
  }
  const border = errorState
    ? theme.colors.validationErrorBorder
    : warningState
      ? theme.colors.validationWarningBorder
      : successState
        ? theme.colors.validationSuccessBorder
        : theme.colors.controlBorder
  const base: ViewStyle = {
    width,
    height,
    borderWidth: 1,
    borderColor: border,
    borderRadius: getNativeControlRadius(theme, geometry),
    backgroundColor: theme.colors.controlBackground,
    ...(enableFocusStyle && state.isFocused
      ? { outlineColor: theme.colors.focusRing, outlineWidth: 1.5, outlineOffset: offsetFocusRing ? 1.5 : 0 }
      : {}),
  }
  const baseline = { ...base, ...resolveNativeStyle(customStyles, "NumberInput", "customStyles") }
  const rootStyle = resolveNativeStyle(
    [baseline, typeof style === "function" ? style({ ...state, defaultStyle: baseline }) : style],
    "NumberInput",
    "style",
  )
  const groupStyle = resolveNativeStyle(
    [{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: theme.spacing.unit }, customGroupStyles],
    "NumberInput",
    "customGroupStyles",
  )
  const inputStyle = resolveNativeStyle<TextStyle>(
    [{ flexGrow: 1, flexShrink: 1, flexBasis: 112, borderWidth: 0, backgroundColor: "transparent" }, customInputStyles],
    "NumberInput",
    "customInputStyles",
  )
  const buttonStyle = resolveNativeStyle(
    [{ color: theme.colors.controlForeground, backgroundColor: theme.colors.controlBackground }, customButtonStyles],
    "NumberInput",
    "customButtonStyles",
  )
  const actions =
    isDisabled || isReadOnly
      ? []
      : [
          ...(numeric.canIncrement ? [{ name: "incrementValue", label: incrementLabel }] : []),
          ...(numeric.canDecrement ? [{ name: "decrementValue", label: decrementLabel }] : []),
        ]
  return (
    <View
      testID={testID}
      nativeID={props.nativeID}
      id={props.id}
      onLayout={props.onLayout}
      pointerEvents={props.pointerEvents}
      collapsable={props.collapsable}
      accessible={false}
      style={rootStyle}
    >
      <View accessible={false} style={groupStyle}>
        <Input
          ref={ref}
          testID={`${testID}-input`}
          accessibilityLabel={label}
          value={numeric.inputValue}
          onChangeText={numeric.change}
          isDisabled={isDisabled}
          isReadOnly={isReadOnly}
          placeholder={placeholder}
          textSize={textSize}
          geometry={geometry}
          customStyles={inputStyle}
          enableFocusStyle={false}
          submitBehavior="blurAndSubmit"
          keyboardType={inputProps.keyboardType ?? (Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric")}
          returnKeyType={inputProps.returnKeyType}
          autoFocus={inputProps.autoFocus}
          selection={inputProps.selection}
          selectTextOnFocus={inputProps.selectTextOnFocus}
          allowFontScaling={inputProps.allowFontScaling}
          maxFontSizeMultiplier={inputProps.maxFontSizeMultiplier}
          placeholderTextColor={inputProps.placeholderTextColor}
          selectionColor={inputProps.selectionColor}
          selectionHandleColor={inputProps.selectionHandleColor}
          cursorColor={inputProps.cursorColor}
          underlineColorAndroid={inputProps.underlineColorAndroid}
          accessibilityHint={inputProps.accessibilityHint}
          onChange={inputProps.onChange}
          onSelectionChange={inputProps.onSelectionChange}
          onFocus={(event) => {
            numeric.begin()
            focusPart("input", true)
            inputProps.onFocus?.(event)
          }}
          onBlur={(event) => {
            focusPart("input", false)
            inputProps.onBlur?.(event)
          }}
          onSubmitEditing={(event) => {
            numeric.commit(event.nativeEvent.text)
            inputProps.onSubmitEditing?.(event)
          }}
          onEndEditing={(event) => {
            numeric.commit(event.nativeEvent.text)
            inputProps.onEndEditing?.(event)
          }}
          accessibilityActions={actions}
          onAccessibilityAction={({ nativeEvent: { actionName } }) => {
            if (actionName === "incrementValue" && numeric.canIncrement) numeric.step(1)
            if (actionName === "decrementValue" && numeric.canDecrement) numeric.step(-1)
          }}
        />
        {([-1, 1] as const).map((direction) => {
          const increment = direction === 1
          const icon = increment ? IncrementIcon : DecrementIcon
          return (
            <Button
              key={direction}
              testID={`${testID}-${increment ? "increment" : "decrement"}`}
              accessibilityLabel={increment ? incrementLabel : decrementLabel}
              isDisabled={isDisabled || !(increment ? numeric.canIncrement : numeric.canDecrement)}
              raised={false}
              geometry={geometry}
              enableFocusStyle={false}
              customStyles={buttonStyle}
              onFocus={() => focusPart(increment ? "increment" : "decrement", true)}
              onBlur={() => focusPart(increment ? "increment" : "decrement", false)}
              onPressStart={numeric.pressStart}
              onPress={() => numeric.step(direction, true)}
            >
              {({ foregroundColor }) => (
                <View
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  pointerEvents="none"
                >
                  {icon === undefined ? <Glyph plus={increment} color={foregroundColor} /> : icon}
                </View>
              )}
            </Button>
          )
        })}
      </View>
    </View>
  )
})
NumberInput.displayName = "NumberInput"
