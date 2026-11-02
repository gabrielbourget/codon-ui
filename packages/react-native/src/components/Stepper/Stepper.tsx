import {
  forwardRef,
  useContext,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { AccessibilityInfo, findNodeHandle, Platform, View, TextInput, type ColorValue } from "react-native"

import { useNativeCollectionRefs } from "../../collection/context"
import { nativeFieldAccessibilityProps } from "../../form/semantics"
import { useNativeFieldSemantics } from "../../form/useFieldSemantics"
import { useNativeNumberFieldForm } from "../../form/useNumberField"
import { NativeKeyboardScope, useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { NativeButtonPressContext } from "../../input/nativePressCycle"
import { useNativeOriginalEditorFocusBinding } from "../../input/ordinaryEditorKeys"
import { useNativeOriginalEditorWheelPolicy } from "../../input/originalEditorWheel"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { useNativeTheme } from "../../theme"
import { NativeButton as Button } from "../Button/Button"
import { NativeInput as Input } from "../Input/Input"
import { stepperValueText } from "../NumberInput/stepperNumber"
import { useNativeStepperNumberFieldState } from "../NumberInput/stepperState"

import { useNativeStepperKeys } from "./keys"
import { useStepperRepeat } from "./repeat"
import { getNativeStepperStyles, useNativeStepperPaint } from "./styles"
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

type TStepperControlsProps = {
  props: TNativeStepperProps
  numeric: ReturnType<typeof useNativeStepperNumberFieldState>
  resolved: ReturnType<typeof getNativeStepperStyles>
  testID: string
  label: string
  groupLabel: string
  focusPart: (part: string, active: boolean) => void
}

const StepperControls = forwardRef<TNativeStepperRef, TStepperControlsProps>(
  ({ props, numeric, resolved, testID, label, groupLabel, focusPart }, ref) => {
    const {
      isDisabled = false,
      isReadOnly = false,
      geometry = "round",
      textSize = "medium",
      PlusIcon,
      MinusIcon,
      incrementLabel,
      decrementLabel,
      inputProps = {},
      placeholder,
    } = props
    const { color: _groupColor, ...groupStyle } = resolved.group
    const inputStyle = resolved.input
    const owner = useId()
    const originalRef = useRef<TextInput | null>(null)
    const [original, setOriginal] = useState<TextInput | null>(null)
    const bindOriginal = useCallback((target: TextInput | null) => {
      originalRef.current = target
      setOriginal(target)
    }, [])
    const groupRef = useRef<View | null>(null)
    const [group, setGroup] = useState<View | null>(null)
    const bindGroup = useCallback((target: View | null) => {
      groupRef.current = target
      setGroup(target)
    }, [])
    const editorRef = useNativeCollectionRefs(bindOriginal, ref)
    const scope = useNativeKeyScope()
    const floatingScope = useContext(NativeFloatingScopeContext)
    const windowActive = useContext(NativeFloatingWindowContext)
    const originalField = useMemo(
      () => (original ? { editor: original, target: findNodeHandle(original) ?? 0 } : null),
      [original],
    )
    const invalid = !!props.errorState || numeric.displayValidation.isInvalid
    const semanticBinding = useNativeFieldSemantics({
      labels: { role: "Number field" },
      text: {},
      flags: { disabled: isDisabled, readOnly: isReadOnly, required: numeric.isRequired, invalid, expanded: false },
      activeDescendant: null,
    })
    const accessibility = nativeFieldAccessibilityProps(semanticBinding, label, inputProps.accessibilityHint)
    const field = useNativeNumberFieldForm(
      props,
      numeric,
      originalField,
      () => originalRef.current,
      () => originalRef.current === original && original?.isFocused() === true,
      semanticBinding,
    )
    const spokenValue = stepperValueText(props.locale ?? "en-US", numeric.formatValue(numeric.formValue))
    const previousSpokenValue = useRef(spokenValue)
    useEffect(() => {
      const changed = previousSpokenValue.current !== spokenValue
      previousSpokenValue.current = spokenValue
      if (
        changed &&
        numeric.isInputFocused &&
        !isDisabled &&
        original &&
        originalRef.current === original &&
        original.isFocused() &&
        floatingScope?.canAct() !== false &&
        windowActive?.() !== false &&
        scope?.isNativeReady() &&
        scope.isWindowActive()
      )
        AccessibilityInfo.announceForAccessibility(spokenValue)
    }, [spokenValue, numeric.isInputFocused, isDisabled, original, scope, floatingScope, windowActive])
    const lifetimeKey = JSON.stringify([owner, numeric.configurationKey, isDisabled, isReadOnly])
    useNativeOriginalEditorWheelPolicy(original, {
      enabled:
        !isDisabled &&
        !isReadOnly &&
        !props.isWheelDisabled &&
        floatingScope?.canAct() !== false &&
        windowActive?.() !== false,
      lifetimeKey,
      group,
      current: () => originalRef.current,
      currentGroup: () => groupRef.current,
      canAct: () =>
        !isDisabled &&
        !isReadOnly &&
        !props.isWheelDisabled &&
        scope?.isWindowActive() === true &&
        floatingScope?.canAct() !== false &&
        windowActive?.() !== false,
      onAction: (direction) => numeric.step(direction),
    })
    useNativeOriginalEditorFocusBinding(original, !isDisabled, lifetimeKey, {
      current: () => originalRef.current,
      canAct: () => !isDisabled && originalRef.current === original,
    })
    const receiveOriginalKey = useNativeStepperKeys({
      props,
      numeric,
      original,
      currentOriginal: () => originalRef.current,
      lifetimeKey,
    })
    const repeat = useStepperRepeat(numeric, isDisabled || isReadOnly, {
      lifetimeKey,
      originalEditor: () => originalRef.current,
    })
    const renderButton = (direction: -1 | 1) => {
      const increment = direction === 1
      const icon = increment ? PlusIcon : MinusIcon
      return (
        <NativeButtonPressContext.Provider
          value={{
            lifetimeKey: `${lifetimeKey}:${direction}`,
            originalEditor: () => originalRef.current,
            canAct: () => repeat.canAct(direction),
            onPressStart: (event, admission) => repeat.start(direction, event, admission),
          }}
        >
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
            onPressStart={(event) => repeat.prepare(direction, event)}
            onPressUp={() => repeat.up(direction)}
            onPressEnd={repeat.end}
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
        </NativeButtonPressContext.Provider>
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
      <>
        <View
          ref={bindGroup}
          collapsable={false}
          testID={`${testID}-group`}
          accessible={false}
          accessibilityLabel={groupLabel}
          style={groupStyle}
        >
          {renderButton(-1)}
          <Input
            ref={editorRef}
            testID={`${testID}-input`}
            accessibilityLabel={[
              accessibility.accessibilityLabel,
              invalid && numeric.displayValidation.validationErrors.join(" "),
            ]
              .filter(Boolean)
              .join(", ")}
            accessibilityHint={accessibility.accessibilityHint}
            accessibilityValue={{
              min: numeric.minValue,
              max: numeric.maxValue,
              now: numeric.formValue ?? undefined,
              text: spokenValue,
            }}
            value={numeric.inputValue}
            onChangeText={numeric.change}
            isDisabled={isDisabled}
            isReadOnly={isReadOnly}
            placeholder={placeholder}
            textSize={textSize}
            geometry={geometry}
            customStyles={inputStyle}
            enableFocusStyle={false}
            nativeAnimate={false}
            nativeRender={(native) => {
              const hostProps = { ...native, onNativeOrdinaryEditorKey: receiveOriginalKey }
              return <TextInput {...hostProps} />
            }}
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
            onChange={inputProps.onChange}
            onSelectionChange={inputProps.onSelectionChange}
            onFocus={(event) => {
              numeric.setFocused(true)
              numeric.begin()
              focusPart("input", true)
              inputProps.onFocus?.(event)
            }}
            onBlur={(event) => {
              numeric.setFocused(false)
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
        {field.metadata}
      </>
    )
  },
)

StepperControls.displayName = "StepperControls"

export const Stepper = forwardRef<TNativeStepperRef, TNativeStepperProps>((props, ref) => {
  const theme = useNativeTheme()
  const numeric = useNativeStepperNumberFieldState(props)
  const { isDisabled = false, isReadOnly = false, errorState = false, incrementLabel, decrementLabel } = props
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
    isInvalid: errorState || numeric.displayValidation.isInvalid,
  }
  const resolved = useNativeStepperPaint(
    theme,
    getNativeStepperStyles(theme, { ...props, errorState: state.isInvalid }, state),
  )
  const { color: _rootColor, ...rootStyle } = resolved.root
  const groupLabel = props.labels?.inputButtonGroupAriaLabel ?? "Stepper Input Button Group"
  if (typeof groupLabel !== "string") throw new TypeError("Stepper: group label must be a string")
  return (
    <NativeKeyboardScope
      captureEnabled
      testID={testID}
      nativeID={props.nativeID}
      id={props.id}
      onLayout={props.onLayout}
      pointerEvents={props.pointerEvents}
      collapsable={props.collapsable}
      accessible={false}
      style={rootStyle}
    >
      <StepperControls
        ref={ref}
        props={props}
        numeric={numeric}
        resolved={resolved}
        testID={testID}
        label={label!}
        groupLabel={groupLabel}
        focusPart={focusPart}
      />
    </NativeKeyboardScope>
  )
})
Stepper.displayName = "Stepper"
