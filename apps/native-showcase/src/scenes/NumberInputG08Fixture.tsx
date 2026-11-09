import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  findNodeHandle,
  processColor,
  StyleSheet,
  View,
  type ViewProps,
  type ViewStyle,
} from "react-native"

import {
  Button,
  NumberInput,
  Text,
  useNativeTheme,
  type TNativeNumberInputRef,
  type TNativeNumberInputRenderState,
} from "@codon-ui/react-native"

import { NUMBER_INTL_PREPARATION } from "../runtime/number-format"

export const NUMBER_ACTION_CASES = [
  "empty",
  "invalid",
  "veto",
  "default",
  "bound",
  "french",
  "selection",
  "guard",
  "disabled",
  "readonly",
  "restored",
  "retired",
  "fresh",
] as const
export const NUMBER_STYLE_CASES = [
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
  nativeEvent: Record<string, unknown>
}
type TRequest = { value: number | null; generation: number; stale: boolean }
const tag = (value: unknown): number | null =>
  typeof value === "number" ? value : value == null ? null : findNodeHandle(value as TNativeNumberInputRef)
export const snapshotNumberEvent = (
  phase: string,
  generation: number,
  event: { target: unknown; currentTarget: unknown; nativeEvent: object },
): TEvent => ({
  phase,
  generation,
  target: tag(event.target),
  currentTarget: tag(event.currentTarget),
  nativeEvent: JSON.parse(JSON.stringify(event.nativeEvent)) as Record<string, unknown>,
})

const RootProbe = ({
  nativeProps,
  current,
  generation,
  bind,
  painted,
}: {
  nativeProps: ViewProps
  current: TNativeNumberInputRenderState
  generation: number
  bind: (value: View | null) => void
  painted: (value: TNativeNumberInputRenderState) => void
}) => {
  useLayoutEffect(
    () => painted(current),
    [
      painted,
      current.value,
      current.inputValue,
      current.canIncrement,
      current.canDecrement,
      current.isFocused,
      current.isDisabled,
      current.isReadOnly,
      current.isInvalid,
    ],
  )
  return (
    <>
      <View {...nativeProps} ref={bind} />
      <Text
        testID="number-native-painted"
        accessible
        accessibilityLabel={JSON.stringify({
          ...current,
          generation,
          borderColor: processColor(StyleSheet.flatten(nativeProps.style).borderColor),
        })}
        style={{ position: "absolute", top: -20, height: 16, width: 292, fontSize: 8 }}
      >
        Number painted state
      </Text>
    </>
  )
}

export const NumberInputG08Fixture = () => {
  const theme = useNativeTheme()
  const [mode, setMode] = useState<TMode>("actions"),
    [index, setIndex] = useState(0),
    [generation, setGeneration] = useState(0)
  const [ownerValue, setOwnerValue] = useState<number | null>(null),
    [defaultValue, setDefaultValue] = useState(0),
    [tick, setTick] = useState(0)
  const [visible, setVisible] = useState(true),
    [border, setBorder] = useState(false),
    [referenceAtOrigin, setReferenceAtOrigin] = useState(false)
  const [guardTakeover, setGuardTakeover] = useState(false)
  const [inputTag, setInputTag] = useState<number | null>(null),
    [rootTag, setRootTag] = useState<number | null>(null)
  const [refs, setRefs] = useState<{ generation: number; input: number | null }[]>([]),
    [layouts, setLayouts] = useState<
      {
        generation: number
        target: number | null
        currentTarget: number | null
        layout: { x: number; y: number; width: number; height: number }
      }[]
    >([])
  const [events, setEvents] = useState<TEvent[]>([]),
    [requests, setRequests] = useState<TRequest[]>([]),
    [rawChanges, setRawChanges] = useState<{ value: string; generation: number; stale: boolean }[]>([])
  const [rendered, setRendered] = useState<TNativeNumberInputRenderState | null>(null),
    [motionEvents, setMotionEvents] = useState<boolean[]>([])
  const [selection, setSelection] = useState<{
    start: number
    end: number
    generation: number
    inputTag: number
  } | null>(null)
  const editor = useRef<TNativeNumberInputRef | null>(null),
    focusAcknowledged = useRef<{ generation: number; inputTag: number } | null>(null),
    pendingFrame = useRef<number | null>(null)
  const live = useRef({ generation, visible })
  useLayoutEffect(() => {
    live.current = { generation, visible }
  }, [generation, visible])
  const bindInput = useCallback(
    (value: TNativeNumberInputRef | null) => {
      editor.current = value
      const input = tag(value)
      setInputTag(input)
      setRefs((old) => [...old, { generation, input }])
    },
    [generation],
  )
  const bindRoot = useCallback((value: View | null) => setRootTag(tag(value)), [generation])
  const painted = useCallback((value: TNativeNumberInputRenderState) => setRendered(value), [])
  useEffect(() => {
    let active = true
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", (flag) => {
      if (active) setMotionEvents((old) => [...old, flag])
    })
    void AccessibilityInfo.isReduceMotionEnabled().then((flag) => {
      if (active) setMotionEvents((old) => (old.length ? old : [flag]))
    })
    return () => {
      active = false
      listener.remove()
      if (pendingFrame.current != null) cancelAnimationFrame(pendingFrame.current)
    }
  }, [])
  const name =
    mode === "actions"
      ? NUMBER_ACTION_CASES[index]
      : mode === "styles"
        ? NUMBER_STYLE_CASES[index]
        : border
          ? "second"
          : "first"
  useLayoutEffect(() => {
    const focus = focusAcknowledged.current
    if (
      name === "selection" ||
      selection == null ||
      selection.generation !== generation ||
      selection.inputTag !== inputTag ||
      focus?.generation !== generation ||
      focus.inputTag !== inputTag ||
      tag(editor.current) !== inputTag
    )
      return
    editor.current?.setSelection(selection.start, selection.end)
  }, [generation, inputTag, name, selection])
  const disabled = mode === "actions" && (name === "disabled" || (name === "guard" && guardTakeover)),
    readOnly = mode === "actions" && name === "readonly",
    uncontrolled = mode === "actions" && name === "default"
  const narrow = mode === "styles" && name === "long-narrow",
    invalid = mode === "styles" && name === "error",
    warning = mode === "styles" && ["error", "warning"].includes(name),
    success = mode === "styles" && ["error", "warning", "success"].includes(name)
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
  const expectedBackground = name === "custom" ? "#ddeeff" : theme.colors.controlBackground
  const width = narrow ? 190 : 260,
    expectedHeight = name === "final" ? 78 : undefined
  const fontSize = narrow ? 24 : theme.typography.fontSizes.b10
  const rootLayout = [...layouts]
    .reverse()
    .find((event) => event.generation === generation && event.target === rootTag && event.currentTarget === rootTag)
  const lastLayout = rootLayout?.layout
  const referenceStyle: ViewStyle = {
    width,
    height: lastLayout?.height ?? 46,
    borderWidth: 1,
    borderColor: expectedBorder,
    borderRadius: theme.radius.rounded,
    backgroundColor: expectedBackground,
  }
  const record = (phase: string, event: { target: unknown; currentTarget: unknown; nativeEvent: object }) => {
    const frozen = snapshotNumberEvent(phase, generation, event)
    setEvents((old) => [...old, frozen])
    return frozen
  }
  const resetMode = (nextMode: TMode) => {
    editor.current?.blur()
    setMode(nextMode)
    setIndex(0)
    setGeneration((old) => old + 1)
    setVisible(true)
    setReferenceAtOrigin(false)
    setSelection(null)
    focusAcknowledged.current = null
    setBorder(false)
    setDefaultValue(0)
    setGuardTakeover(false)
    setTick(0)
    setOwnerValue(nextMode === "actions" ? null : 5)
  }
  const next = () => {
    const nextIndex = index + 1,
      nextName = mode === "actions" ? NUMBER_ACTION_CASES[nextIndex] : NUMBER_STYLE_CASES[nextIndex]
    if (nextName !== "disabled" && nextName !== "readonly") editor.current?.blur()
    setIndex(nextIndex)
    setReferenceAtOrigin(false)
    setSelection(null)
    focusAcknowledged.current = null
    setGuardTakeover(false)
    if (mode === "actions") {
      if (name === "default" || nextName === "default") setGeneration((old) => old + 1)
      if (["invalid", "veto", "guard", "disabled", "readonly", "restored"].includes(nextName)) setOwnerValue(5)
      if (nextName === "bound") setOwnerValue(0.75)
      if (nextName === "french") setOwnerValue(12.5)
      if (nextName === "selection") setOwnerValue(null)
      if (nextName === "retired") setVisible(false)
      if (nextName === "fresh") {
        setGeneration((old) => old + 1)
        setVisible(true)
        setOwnerValue(2)
      }
    } else setOwnerValue(nextName === "long-narrow" ? 1234567.875 : 5)
  }
  const action = (label: string, onPress: () => void, compact = false) => (
    <Button
      key={label}
      raised={false}
      accessibilityLabel={label}
      customStyles={compact ? { width: 140 } : undefined}
      onPress={onPress}
    >
      {label}
    </Button>
  )
  const intl = {
    preparation: NUMBER_INTL_PREPARATION,
    supported: Intl.NumberFormat.supportedLocalesOf(["en-US", "fr-CA"]),
    english: new Intl.NumberFormat("en-US").format(7.5),
    french: new Intl.NumberFormat("fr-CA").format(7.5),
  }
  const state = {
    mode,
    case: name,
    generation,
    visible,
    ownerValue,
    defaultValue,
    tick,
    inputTag,
    rootTag,
    rendered,
    requests,
    rawChanges,
    events,
    refs,
    layouts,
    rootLayout: rootLayout ?? null,
    intl,
    disabled,
    readOnly,
    uncontrolled,
    narrow,
    width,
    expectedHeight: expectedHeight ?? null,
    fontSize,
    expectedBorder,
    expectedBorderNativeColor: processColor(expectedBorder),
    expectedBackgroundNativeColor: processColor(expectedBackground),
    themeMode: theme.mode,
    motionEvents,
    referenceAtOrigin,
    selection,
  }
  return (
    <View style={{ gap: 8 }}>
      <Text testID="number-native-state" accessible accessibilityLabel={JSON.stringify(state)}>
        Number: {mode} / {name}
      </Text>
      <View testID="number-native-pair" style={{ height: 214 }}>
        <View style={{ position: "absolute", top: 0, left: 0, width: 292, flexDirection: "row", gap: 6 }}>
          {action("Focus Number", () => editor.current?.focus(), true)}
          {action("Rerender Number", () => setTick((old) => old + 1), true)}
        </View>
        <View
          testID="number-native-parent"
          collapsable={false}
          style={{
            position: "absolute",
            top: 66,
            left: 0,
            width: 292,
            height: 144,
            padding: 12,
            backgroundColor: "#ffffff",
          }}
        >
          {visible && (
            <NumberInput
              key={generation}
              ref={bindInput}
              testID="number-native-control"
              accessibilityLabel="Public Number editor"
              incrementLabel="Increase Number"
              decrementLabel="Decrease Number"
              placeholder="Empty number"
              width={width}
              height={expectedHeight}
              value={uncontrolled ? undefined : ownerValue}
              defaultValue={uncontrolled ? defaultValue : undefined}
              minValue={name === "bound" ? 0 : undefined}
              maxValue={name === "bound" ? 1.1 : undefined}
              step={name === "bound" ? 0.25 : undefined}
              locale={name === "french" ? "fr-CA" : "en-US"}
              isDisabled={disabled}
              isReadOnly={readOnly}
              errorState={invalid}
              warningState={warning}
              successState={success}
              customStyles={
                name === "custom" || name === "final"
                  ? { borderColor: "#7a3bba", backgroundColor: "#ddeeff" }
                  : undefined
              }
              customInputStyles={narrow ? { fontSize, height: 64 } : undefined}
              style={
                mode === "lifetime"
                  ? { borderColor: expectedBorder }
                  : name === "final"
                    ? { borderColor: "#117733", backgroundColor: theme.colors.controlBackground, height: 78 }
                    : undefined
              }
              onChange={(value) => {
                const stale = generation !== live.current.generation || !live.current.visible
                setRequests((old) => [...old, { value, generation, stale }])
                if (!stale && name !== "veto" && !uncontrolled) setOwnerValue(value)
              }}
              onChangeText={(value) => {
                const stale = generation !== live.current.generation || !live.current.visible
                setRawChanges((old) => [...old, { value, generation, stale }])
                if (!stale && name === "empty" && value === "001.25") setTick((old) => (old === 0 ? 1 : old))
                if (!stale && name === "guard" && value === "8") setGuardTakeover(true)
                const focus = focusAcknowledged.current
                if (
                  !stale &&
                  name === "selection" &&
                  value === "001.25" &&
                  focus?.generation === generation &&
                  focus.inputTag === inputTag &&
                  inputTag != null
                )
                  setSelection({ start: 0, end: 3, generation, inputTag })
                else setSelection(null)
              }}
              onLayout={(event) => {
                const frozen = {
                  generation,
                  target: tag(event.target),
                  currentTarget: tag(event.currentTarget),
                  layout: { ...event.nativeEvent.layout },
                }
                setLayouts((old) => [...old, frozen])
              }}
              inputProps={{
                keyboardType: "numbers-and-punctuation",
                returnKeyType: "done",
                selection:
                  name === "selection" && selection?.generation === generation && selection.inputTag === inputTag
                    ? { start: selection.start, end: selection.end }
                    : undefined,
                onChange: (event) => record("change", event),
                onFocus: (event) => {
                  const frozen = record("focus", event),
                    text = (frozen.nativeEvent.text as string | undefined) ?? ""
                  if (
                    inputTag != null &&
                    frozen.target === inputTag &&
                    frozen.currentTarget === inputTag &&
                    frozen.nativeEvent.target === inputTag
                  ) {
                    focusAcknowledged.current = { generation, inputTag }
                    setSelection({ start: 0, end: text.length, generation, inputTag })
                  }
                },
                onBlur: (event) => {
                  record("blur", event)
                  setSelection(null)
                  focusAcknowledged.current = null
                },
                onSelectionChange: (event) => record("selection", event),
                onSubmitEditing: (event) => record("submit", event),
                onEndEditing: (event) => record("end", event),
              }}
              render={(nativeProps, current) => (
                <RootProbe
                  nativeProps={nativeProps}
                  current={current}
                  generation={generation}
                  bind={bindRoot}
                  painted={painted}
                />
              )}
            />
          )}
        </View>
        {mode !== "actions" && (
          <View
            pointerEvents="none"
            testID="number-native-reference-parent"
            collapsable={false}
            style={{
              position: "absolute",
              top: 66,
              left: referenceAtOrigin ? 0 : 1000,
              width: 292,
              height: 144,
              padding: 12,
              backgroundColor: "#ffffff",
            }}
          >
            {visible && <View testID="number-native-reference" style={referenceStyle} />}
          </View>
        )}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {action("Number actions checks", () => resetMode("actions"))}
        {action("Number styles checks", () => resetMode("styles"))}
        {action("Number lifetime checks", () => resetMode("lifetime"))}
        {action("Blur Number", () => editor.current?.blur())}
        {mode !== "lifetime" &&
          index < (mode === "actions" ? NUMBER_ACTION_CASES.length : NUMBER_STYLE_CASES.length) - 1 &&
          action("Next Number check", next)}
        {mode === "actions" && name === "default" && action("Update Number default", () => setDefaultValue(8))}
        {mode !== "actions" && action("Show Number component", () => setReferenceAtOrigin(false))}
        {mode !== "actions" && action("Show Number reference", () => setReferenceAtOrigin(true))}
        {mode === "lifetime" && (
          <>
            {action("First Number border", () => setBorder(false))}
            {action("Second Number border", () => setBorder(true))}
            {action("Interrupt Number border", () => {
              setBorder(false)
              pendingFrame.current = requestAnimationFrame(() => {
                pendingFrame.current = null
                setBorder(true)
              })
            })}
            {action("Retire Number", () => setVisible(false))}
            {action("Fresh Number", () => {
              setGeneration((old) => old + 1)
              setVisible(true)
            })}
          </>
        )}
      </View>
    </View>
  )
}
