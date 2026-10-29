import { forwardRef, useLayoutEffect, useRef, useState } from "react"
import { Platform, View, type ColorValue } from "react-native"

import { useNativeTheme } from "../../theme"
import { NativeButton as Button } from "../Button/Button"
import { Input } from "../Input/Input"
import { useNumberInputState } from "../NumberInput/state"

import { useStepperRepeat } from "./repeat"
import { getNativeStepperStyles } from "./styles"
import type { TNativeStepperProps, TNativeStepperRef, TNativeStepperRenderState } from "./types"

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

export const Stepper = forwardRef<TNativeStepperRef, TNativeStepperProps>((props, ref) => {
  const theme = useNativeTheme()
  const numeric = useNumberInputState(props)
  const {
    isDisabled = false,
    isReadOnly = false,
    errorState = false,
    geometry = "round",
    textSize = "medium",
    PlusIcon,
    MinusIcon,
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
    if (typeof text !== "string" || !text.trim()) throw new TypeError(`Stepper: ${field} must be nonempty`)
  const testID = props.testID ?? props["data-testid"] ?? "stepper"
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
  const state: TNativeStepperRenderState = {
    value: numeric.value,
    inputValue: numeric.inputValue,
    canIncrement: numeric.canIncrement,
    canDecrement: numeric.canDecrement,
    isFocused: focused && !isDisabled,
    isDisabled,
    isReadOnly,
    isInvalid: errorState,
  }
  const resolved = getNativeStepperStyles(theme, props, state)
  const { color: _rootColor, ...rootStyle } = resolved.root
  const { color: _groupColor, ...groupStyle } = resolved.group
  const inputStyle = resolved.input
  const groupLabel = props.labels?.inputButtonGroupAriaLabel ?? "Stepper Input Button Group"
  if (typeof groupLabel !== "string") throw new TypeError("Stepper: group label must be a string")
  const repeat = useStepperRepeat(numeric, isDisabled || isReadOnly)
  const renderButton = (direction: -1 | 1) => {
    const increment = direction === 1
    const icon = increment ? PlusIcon : MinusIcon
    return (
      <Button
        slot={null}
        testID={`${testID}-${increment ? "increment" : "decrement"}`}
        accessibilityLabel={increment ? incrementLabel : decrementLabel}
        isDisabled={isDisabled || isReadOnly || !(increment ? numeric.canIncrement : numeric.canDecrement)}
        raised={resolved.buttonRaised}
        transparent={resolved.buttonTransparent}
        colorMode={resolved.buttonColorMode}
        color={props.color}
        order={props.order}
        geometry={geometry}
        enableFocusStyle={false}
        customStyles={resolved.button}
        onFocus={() => focusPart(increment ? "increment" : "decrement", true)}
        onBlur={() => focusPart(increment ? "increment" : "decrement", false)}
        onPressStart={() => repeat.start(direction)}
        onPressEnd={repeat.stop}
        onPress={() => repeat.release(direction)}
      >
        {({ foregroundColor }) => (
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
          >
            {icon || <Glyph plus={increment} color={foregroundColor} />}
          </View>
        )}
      </Button>
    )
  }
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
      <View testID={`${testID}-group`} accessible={false} accessibilityLabel={groupLabel} style={groupStyle}>
        {renderButton(-1)}
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
        {renderButton(1)}
      </View>
    </View>
  )
})
Stepper.displayName = "Stepper"
