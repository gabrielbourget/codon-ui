import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  findNodeHandle,
  processColor,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type TextStyle,
} from "react-native"

import { Button, Input, Text, useNativeTheme, type TNativeInputRef } from "@codon-ui/react-native"

export const INPUT_ACTIONS = [
  "default",
  "empty",
  "decline",
  "disabled",
  "readonly",
  "selection",
  "retired",
  "fresh",
] as const
export const INPUT_STYLES = [
  "baseline",
  "error",
  "warning",
  "success",
  "custom",
  "final",
  "long-narrow",
  "dark",
  "light-restored",
] as const
type TMode = "actions" | "styles" | "lifetime"
type TEvent = {
  phase: string
  generation: number
  target: number | null
  currentTarget: number | null
  nativeEvent: object
}
const tag = (value: unknown): number | null =>
  typeof value === "number" ? value : value == null ? null : findNodeHandle(value as TextInput)

export const InputG08Fixture = () => {
  const theme = useNativeTheme(),
    dimensions = useWindowDimensions()
  const [mode, setMode] = useState<TMode>("actions"),
    [index, setIndex] = useState(0)
  const [value, setValue] = useState(""),
    [generation, setGeneration] = useState(0)
  const [visible, setVisible] = useState(true),
    [border, setBorder] = useState(false)
  const [rootTag, setRootTag] = useState<number | null>(null)
  const [events, setEvents] = useState<TEvent[]>([]),
    [changes, setChanges] = useState<{ value: string; generation: number }[]>([])
  const [refs, setRefs] = useState<(number | null)[]>([]),
    [layouts, setLayouts] = useState<object[]>([])
  const [motionEvents, setMotionEvents] = useState<boolean[]>([])
  const [referenceAtOrigin, setReferenceAtOrigin] = useState(false)
  const [selectionRequest, setSelectionRequest] = useState<{ generation: number; rootTag: number } | null>(null)
  const editor = useRef<TNativeInputRef | null>(null),
    pendingFrame = useRef<number | null>(null)
  const bind = useCallback((next: TNativeInputRef | null) => {
    editor.current = next
    const current = tag(next)
    setRootTag(current)
    setRefs((old) => [...old, current])
  }, [])
  useEffect(() => {
    let active = true
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", (next) => {
      if (active) setMotionEvents((old) => [...old, next])
    })
    void AccessibilityInfo.isReduceMotionEnabled().then((next) => {
      if (active) setMotionEvents((old) => (old.length ? old : [next]))
    })
    return () => {
      active = false
      listener.remove()
      if (pendingFrame.current != null) cancelAnimationFrame(pendingFrame.current)
    }
  }, [])
  const name =
    mode === "actions" ? INPUT_ACTIONS[index] : mode === "styles" ? INPUT_STYLES[index] : border ? "second" : "first"
  const currentOwner = useRef({ mode, name, value, generation, rootTag })
  useLayoutEffect(() => {
    currentOwner.current = { mode, name, value, generation, rootTag }
  }, [mode, name, value, generation, rootTag])
  const selectionArmed =
    mode === "actions" &&
    name === "selection" &&
    value === "Selectable" &&
    rootTag != null &&
    selectionRequest?.generation === generation &&
    selectionRequest.rootTag === rootTag
  const disabled = mode === "actions" && name === "disabled",
    readOnly = mode === "actions" && name === "readonly"
  const narrow = mode === "styles" && name === "long-narrow"
  const invalid = mode === "styles" && name === "error"
  const warning = mode === "styles" && ["error", "warning"].includes(name)
  const success = mode === "styles" && ["error", "warning", "success"].includes(name)
  const expectedBorder =
    mode === "lifetime"
      ? border
        ? "#117733"
        : "#bb3322"
      : name === "final"
        ? "#117733"
        : name === "custom"
          ? "#7a3bba"
          : invalid
            ? theme.colors.validationErrorBorder
            : warning
              ? theme.colors.validationWarningBorder
              : success
                ? theme.colors.validationSuccessBorder
                : theme.colors.controlBorder
  const fontSize = narrow ? 24 : theme.typography.fontSizes.b10
  const base: TextStyle = {
    width: narrow ? 190 : 240,
    height: narrow ? 64 : 48,
    padding: theme.spacing.unit,
    paddingHorizontal: theme.spacing.unit,
    backgroundColor: theme.colors.controlBackground,
    color: theme.colors.controlForeground,
    fontFamily: theme.typography.fontFamilies.body,
    fontWeight: theme.typography.fontWeights.regular,
    fontSize,
    lineHeight: theme.typography.lineHeight,
    borderWidth: 1,
    borderColor: expectedBorder,
    borderRadius: theme.radius.rounded,
    opacity: 1,
  }
  const record = (phase: string, event: { target: unknown; currentTarget: unknown; nativeEvent: object }) => {
    const frozen = {
      phase,
      generation,
      target: tag(event.target),
      currentTarget: tag(event.currentTarget),
      nativeEvent: JSON.parse(JSON.stringify(event.nativeEvent)) as object,
    }
    setEvents((old) => [...old, frozen])
    return frozen
  }
  const changeMode = (next: TMode) => {
    editor.current?.blur()
    setMode(next)
    setIndex(0)
    setVisible(true)
    setBorder(false)
    setReferenceAtOrigin(false)
    setSelectionRequest(null)
    setGeneration((old) => old + 1)
    setValue(next === "styles" ? "Input" : "")
  }
  const next = () => {
    editor.current?.blur()
    const nextIndex = index + 1
    setIndex(nextIndex)
    setReferenceAtOrigin(false)
    setSelectionRequest(null)
    if (mode === "actions") {
      const nextName = INPUT_ACTIONS[nextIndex]
      if (nextName === "empty") setValue("")
      if (nextName === "decline") setValue("owner")
      if (nextName === "selection") setValue("Selectable")
      if (nextName === "retired") setVisible(false)
      if (nextName === "fresh") {
        setGeneration((old) => old + 1)
        setVisible(true)
        setValue("fresh")
      }
    } else if (INPUT_STYLES[nextIndex] === "long-narrow") setValue("Long English / Renseignements français détaillés")
    else setValue("Input")
  }
  const action = (label: string, onPress: () => void) => (
    <Button key={label} raised={false} accessibilityLabel={label} onPress={onPress}>
      {label}
    </Button>
  )
  const state = {
    mode,
    case: name,
    value,
    generation,
    visible,
    rootTag,
    events,
    changes,
    refs,
    layouts,
    motionEvents,
    referenceAtOrigin,
    selectionArmed,
    disabled,
    readOnly,
    invalid,
    narrow,
    expectedBorder,
    expectedBorderNativeColor: processColor(expectedBorder),
    fontSize,
    themeMode: theme.mode,
    dimensions,
  }
  return (
    <View style={{ gap: 8 }}>
      <Text testID="input-native-state" accessible accessibilityLabel={JSON.stringify(state)}>
        Input: {mode} / {name}
      </Text>
      <View testID="input-native-pair" style={{ height: 114 }}>
        <View
          testID="input-native-parent"
          collapsable={false}
          style={{
            position: "absolute",
            top: 22,
            left: 0,
            width: 272,
            height: 88,
            padding: 12,
            backgroundColor: "#ffffff",
          }}
        >
          {visible && (
            <Input
              key={generation}
              ref={bind}
              testID="input-native-editor"
              accessibilityLabel="Public Input editor"
              defaultValue={mode === "actions" && name === "default" ? "Seed" : undefined}
              value={mode === "actions" && name === "default" ? undefined : value}
              isDisabled={disabled}
              isReadOnly={readOnly}
              errorState={invalid}
              warningState={warning}
              successState={success}
              width={base.width}
              height={base.height}
              textSize={narrow ? "large" : "medium"}
              selection={selectionArmed ? { start: 2, end: 5 } : undefined}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              placeholder="Empty editor"
              onChange={(event) => record("change", event)}
              onChangeText={(requested) => {
                setChanges((old) => [...old, { value: requested, generation }])
                if (name !== "decline") setValue(requested)
              }}
              onFocus={(event) => {
                const focused = record("focus", event)
                const owner = currentOwner.current
                if (
                  mode === "actions" &&
                  name === "selection" &&
                  value === "Selectable" &&
                  owner.mode === mode &&
                  owner.name === name &&
                  owner.value === value &&
                  owner.generation === generation &&
                  owner.rootTag === rootTag &&
                  rootTag != null &&
                  focused.target === rootTag &&
                  focused.currentTarget === rootTag &&
                  (focused.nativeEvent as { target?: number }).target === rootTag &&
                  (focused.nativeEvent as { text?: string }).text === value
                )
                  setSelectionRequest({ generation, rootTag })
              }}
              onBlur={(event) => {
                record("blur", event)
                setSelectionRequest(null)
              }}
              onSelectionChange={(event) => record("selection", event)}
              onSubmitEditing={(event) => record("submit", event)}
              onEndEditing={(event) => record("end", event)}
              onLayout={(event) => {
                const frozen = {
                  target: tag(event.target),
                  currentTarget: tag(event.currentTarget),
                  layout: { ...event.nativeEvent.layout },
                }
                setLayouts((old) => [...old, frozen])
              }}
              customStyles={
                name === "custom" || name === "final"
                  ? { borderColor: "#7a3bba", backgroundColor: "#ddeeff" }
                  : undefined
              }
              style={
                mode === "lifetime"
                  ? { borderColor: expectedBorder }
                  : narrow
                    ? { fontSize, height: 64 }
                    : name === "final"
                      ? { borderColor: "#117733", backgroundColor: "#ffffff" }
                      : undefined
              }
              render={(props, current) => (
                <>
                  <TextInput
                    {...props}
                    nativeID={`input-public-${current.isReadOnly ? "readonly" : "editable"}`}
                    accessibilityHint={JSON.stringify(current)}
                  />
                  <Text
                    testID="input-native-painted-state"
                    accessible
                    accessibilityLabel={JSON.stringify({
                      generation,
                      borderColor: processColor(StyleSheet.flatten(props.style).borderColor),
                      ...current,
                    })}
                    style={{
                      position: "absolute",
                      top: -22,
                      left: 0,
                      width: 272,
                      height: 20,
                      fontSize: 8,
                      lineHeight: 10,
                    }}
                  >
                    Input painted state
                  </Text>
                </>
              )}
            />
          )}
        </View>
        {mode !== "actions" && (
          <View
            testID="input-native-reference-parent"
            collapsable={false}
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 22,
              left: referenceAtOrigin ? 0 : 1000,
              width: 272,
              height: 88,
              padding: 12,
              backgroundColor: "#ffffff",
            }}
          >
            {visible && (
              <TextInput
                testID="input-native-reference"
                accessibilityLabel="Independent raw reference"
                editable
                readOnly={false}
                value={value}
                placeholder="Empty editor"
                placeholderTextColor={theme.colors.controlPlaceholder}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="done"
                multiline={false}
                style={{ ...base, ...(name === "custom" ? { backgroundColor: "#ddeeff" } : {}) }}
              />
            )}
          </View>
        )}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {action("Input actions checks", () => changeMode("actions"))}
        {action("Input styles checks", () => changeMode("styles"))}
        {action("Input lifetime checks", () => changeMode("lifetime"))}
        {action("Focus Input", () => editor.current?.focus())}
        {action("Blur Input", () => editor.current?.blur())}
        {mode !== "lifetime" &&
          index < (mode === "actions" ? INPUT_ACTIONS.length : INPUT_STYLES.length) - 1 &&
          action("Next Input check", next)}
        {mode !== "actions" && action("Show Input component", () => setReferenceAtOrigin(false))}
        {mode !== "actions" && action("Show Input reference", () => setReferenceAtOrigin(true))}
        {mode === "lifetime" && (
          <>
            {action("First Input border", () => setBorder(false))}
            {action("Second Input border", () => setBorder(true))}
            {action("Interrupt Input border", () => {
              setBorder(false)
              pendingFrame.current = requestAnimationFrame(() => {
                pendingFrame.current = null
                setBorder(true)
              })
            })}
            {action("Retire Input", () => setVisible(false))}
            {action("Fresh Input", () => {
              setGeneration((old) => old + 1)
              setVisible(true)
            })}
          </>
        )}
      </View>
    </View>
  )
}
