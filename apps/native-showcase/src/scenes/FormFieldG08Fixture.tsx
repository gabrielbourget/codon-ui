import { useCallback, useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  findNodeHandle,
  Text as RawText,
  TextInput,
  View,
  type LayoutChangeEvent,
  type TextStyle,
  type ViewStyle,
} from "react-native"

import { Button, FormField, Text, useNativeTheme } from "@codon-ui/react-native"

import { inspectNativeAccessibility } from "../../../../packages/react-native/src/input/accessibilityInspection"

export const FIELD_ACTIONS = [
  "baseline",
  "messages",
  "target-cleared",
  "target-restored",
  "relationships",
  "changed-targets",
  "removed-targets",
  "empty-messages",
  "retired",
  "fresh",
] as const
export const FIELD_STYLES = [
  "style-baseline",
  "root",
  "top",
  "label",
  "top-right",
  "bottom",
  "bottom-right",
  "validation",
  "description",
  "final-style",
  "raised",
  "fractional",
  "zero",
  "long-narrow",
  "dark",
  "light-restored",
] as const
type TMode = "behavior" | "styles" | "motion"
type TLayout = {
  target: number | null
  currentTarget: number | null
  layout: { x: number; y: number; width: number; height: number }
}

export const FormFieldG08Fixture = () => {
  const theme = useNativeTheme()
  const [mode, setMode] = useState<TMode>("behavior"),
    [index, setIndex] = useState(0)
  const [referenceAtOrigin, setReferenceAtOrigin] = useState(false)
  const [value, setValue] = useState("owner"),
    [changes, setChanges] = useState(0),
    [focuses, setFocuses] = useState(0)
  const [rootTag, setRootTag] = useState<number | null>(null),
    [childTag, setChildTag] = useState<number | null>(null)
  const [layouts, setLayouts] = useState<TLayout[]>([]),
    [events, setEvents] = useState<{ phase: string; target: number | null; currentTarget: number | null }[]>([])
  const root = useRef<View | null>(null),
    editor = useRef<TextInput | null>(null),
    live = useRef(true),
    inspectionRequest = useRef(0)
  const [inspection, setInspection] = useState<Record<string, unknown> | null>(null),
    [inspectionSequence, setInspectionSequence] = useState(0)
  const [motionSelected, setMotionSelected] = useState(false),
    [motionVisible, setMotionVisible] = useState(true),
    [motionLifetime, setMotionLifetime] = useState(0)
  const [motionTrace, setMotionTrace] = useState<{ name: string; epochMs: number }[]>([]),
    [motionEvents, setMotionEvents] = useState<boolean[]>([])
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    live.current = true
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", (next) => {
      if (live.current) setMotionEvents((old) => [...old, next])
    })
    void AccessibilityInfo.isReduceMotionEnabled().then((next) => {
      if (live.current) setMotionEvents((old) => (old.length ? old : [next]))
    })
    return () => {
      live.current = false
      listener.remove()
      timers.current.forEach(clearTimeout)
    }
  }, [])
  const cases = mode === "styles" ? FIELD_STYLES : FIELD_ACTIONS,
    name = mode === "motion" ? "motion" : cases[index]
  const visible = mode === "motion" ? motionVisible : name !== "retired",
    narrow = name === "long-narrow",
    zero = name === "zero"
  const measurementHeight = narrow ? 261 : 224
  const relationships = ["relationships", "changed-targets", "removed-targets"].includes(name),
    targetsVisible = name !== "removed-targets"
  const label = mode === "motion" ? "██████" : narrow ? "Renseignements de livraison et coordonnées" : "Email"
  const required = mode !== "motion",
    hasMessages = mode === "styles" || name === "messages",
    emptyMessages = name === "empty-messages"
  const description =
    mode === "motion" ? "" : narrow ? "Une description longue qui reste entièrement accessible." : "Description"
  const foreground =
    mode === "motion"
      ? motionSelected
        ? "#117733"
        : "#bb3322"
      : name === "final-style"
        ? "#117733"
        : name === "root"
          ? "#bb3322"
          : theme.colors.foreground
  const rootStyles: TextStyle = {
    ...(mode === "motion" ? { color: foreground } : {}),
    ...(name === "root" || name === "final-style"
      ? { padding: 5, backgroundColor: "#ddeeff", borderColor: "#2f7d18", borderWidth: 2, color: "#bb3322" }
      : {}),
    ...(name === "fractional" ? { width: 213.25 } : {}),
    ...(zero ? { width: 0, height: 0, overflow: "hidden" } : {}),
  }
  const topStyles: ViewStyle = name === "top" ? { padding: 3, gap: 7, backgroundColor: "#ddeeff" } : {}
  const labelStyles: TextStyle =
    mode === "motion"
      ? { fontSize: 30, lineHeight: 38 }
      : name === "label"
        ? { fontSize: 17, fontWeight: "700", color: "#7a3bba", padding: 2 }
        : {}
  const topRightStyles: ViewStyle = name === "top-right" ? { padding: 3, backgroundColor: "#ddeeff" } : {}
  const bottomStyles: ViewStyle = name === "bottom" ? { padding: 3, gap: 7, backgroundColor: "#ddeeff" } : {}
  const bottomRightStyles: ViewStyle =
    name === "bottom-right" ? { padding: 2, maxWidth: 45, backgroundColor: "#ddeeff" } : {}
  const validationStyles: TextStyle =
    name === "validation" ? { gap: 3, fontSize: 13, color: "#117733", padding: 1 } : {}
  const descriptionStyles: TextStyle =
    name === "description" ? { fontStyle: "normal", fontSize: 15, color: "#7a3bba", padding: 2 } : {}
  const shadow =
    name === "raised"
      ? [
          {
            offsetX: 0,
            offsetY: 2,
            blurRadius: 3,
            color: theme.mode === "dark" ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.12)",
          },
          {
            offsetX: 0,
            offsetY: 2,
            blurRadius: 2,
            color: theme.mode === "dark" ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.24)",
          },
        ]
      : undefined
  const textStyles: TextStyle = {
    color: foreground,
    fontSize: theme.typography.fontSizes.b11,
    fontWeight: theme.typography.fontWeights.regular,
    fontStyle: "normal",
    fontFamily: theme.typography.fontFamilies.body,
    lineHeight: theme.typography.lineHeight,
  }
  const tag = (next: unknown) => (typeof next === "number" ? next : next == null ? null : findNodeHandle(next as View))
  const bindRoot = useCallback((next: View | null) => {
    root.current = next
    setRootTag(tag(next))
  }, [])
  const bindChild = useCallback((next: TextInput | null) => {
    editor.current = next
    setChildTag(tag(next))
  }, [])
  const record = (phase: string, event: { target: unknown; currentTarget: unknown }) => {
    const row = { phase, target: tag(event.target), currentTarget: tag(event.currentTarget) }
    setEvents((old) => [...old, row])
  }
  const layout = (event: LayoutChangeEvent) => {
    const row = {
      target: tag(event.target),
      currentTarget: tag(event.currentTarget),
      layout: { ...event.nativeEvent.layout },
    }
    setLayouts((old) => (JSON.stringify(old.at(-1)) === JSON.stringify(row) ? old : [...old, row]))
  }
  const changeMode = (next: TMode) => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    inspectionRequest.current++
    setMode(next)
    setIndex(0)
    setReferenceAtOrigin(false)
    setInspection(null)
    setMotionSelected(false)
    setMotionVisible(true)
    setMotionTrace([])
    setMotionLifetime((old) => old + 1)
  }
  const inspect = () => {
    const sequence = ++inspectionRequest.current,
      target = root.current,
      caseName = name
    if (
      !inspectNativeAccessibility(target, (event) => {
        if (!live.current || sequence !== inspectionRequest.current || target !== root.current) return
        setInspection({ case: caseName, ...event.nativeEvent })
        setInspectionSequence(sequence)
      })
    )
      setInspection({ case: caseName, error: "unregistered-target" })
  }
  const arm = () => {
    timers.current.forEach(clearTimeout)
    setMotionSelected(false)
    setMotionVisible(true)
    setMotionTrace([])
    const schedule = (delay: number, key: string, action: () => void) =>
      setTimeout(() => {
        const epochMs = Date.now()
        setMotionTrace((old) => [...old, { name: key, epochMs }])
        action()
      }, delay)
    timers.current = [
      ...Array.from({ length: 40 }, (_, i) =>
        schedule(3000 + i * 100, `retarget-${i}`, () => setMotionSelected(i % 2 === 0)),
      ),
      schedule(7500, "settle", () => setMotionSelected(true)),
      schedule(8750, "retire", () => setMotionVisible(false)),
      schedule(10750, "fresh", () => {
        setMotionLifetime((old) => old + 1)
        setMotionVisible(true)
      }),
    ]
  }
  const child = (reference: boolean) =>
    mode === "behavior" ? (
      <TextInput
        ref={reference ? undefined : bindChild}
        testID={reference ? "field-reference-editor" : "field-native-editor"}
        accessibilityLabel="Caller editor"
        value={value}
        onChangeText={
          reference
            ? undefined
            : (next) => {
                setChanges((old) => old + 1)
                setValue(next)
              }
        }
        onFocus={reference ? undefined : () => setFocuses((old) => old + 1)}
        returnKeyType="done"
        onSubmitEditing={reference ? undefined : () => editor.current?.blur()}
        style={{ width: "100%", height: 28, padding: 0, color: "#333333", fontSize: 14, lineHeight: 20 }}
      />
    ) : mode === "motion" ? null : (
      <RawText selectable={false} style={{ color: "#333333", fontSize: 14, lineHeight: 20 }}>
        Caller child
      </RawText>
    )
  const state = {
    case: name,
    mode,
    value,
    changes,
    focuses,
    rootTag,
    childTag,
    layouts,
    events,
    visible,
    referenceAtOrigin,
    inspection,
    inspectionSequence,
    relationships,
    targetsVisible,
    themeMode: theme.mode,
    narrow,
    zero,
    label,
    required,
    hasMessages,
    emptyMessages,
    motionSelected,
    motionTrace,
    motionEvents,
  }
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {(["behavior", "styles", "motion"] as const).map((next) => (
          <Button key={next} raised={false} onPress={() => changeMode(next)}>
            Field {next} checks
          </Button>
        ))}
      </View>
      <Text testID="field-native-state" accessibilityLabel={JSON.stringify(state)} numberOfLines={1}>
        Field check: {name}
      </Text>
      {mode === "motion" ? (
        <>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Button raised={false} onPress={() => setMotionSelected(false)}>
              First
            </Button>
            <Button raised={false} onPress={() => setMotionSelected(true)}>
              Second
            </Button>
          </View>
          <Button raised={false} onPress={arm}>
            Arm Field motion and retirement
          </Button>
        </>
      ) : (
        <Button
          raised={false}
          onPress={() => {
            inspectionRequest.current++
            setIndex((old) => (old + 1) % cases.length)
            setReferenceAtOrigin(false)
            setInspection(null)
          }}
        >
          Next Field check
        </Button>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Button raised={false} onPress={inspect}>
          Inspect Field metadata
        </Button>
        <Button raised={false} onPress={() => editor.current?.blur()}>
          Blur child
        </Button>
        <Button raised={false} onPress={() => setReferenceAtOrigin(false)}>
          Show Field component
        </Button>
        <Button raised={false} onPress={() => setReferenceAtOrigin(true)}>
          Show Field reference
        </Button>
      </View>
      <View testID="field-native-relationship-targets" style={{ height: 20, flexDirection: "row", gap: 4 }}>
        {targetsVisible ? (
          <>
            <RawText nativeID="field-g08-name" style={{ fontSize: 10, lineHeight: 12 }}>
              {name === "changed-targets" ? "Changed field" : "Field name"}
            </RawText>
            <RawText nativeID="field-g08-guide" style={{ fontSize: 10, lineHeight: 12 }}>
              Guide
            </RawText>
            <RawText nativeID="field-g08-details" style={{ fontSize: 10, lineHeight: 12 }}>
              Details
            </RawText>
          </>
        ) : null}
      </View>
      <View style={{ height: 20, paddingLeft: 12 }}>
        {name === "style-baseline" ? (
          <View
            testID="field-canonical-marker-row"
            collapsable={false}
            style={{ flexDirection: "row", gap: 2, alignSelf: "flex-start" }}
          >
            <RawText selectable={false} testID="field-canonical-marker-label" style={textStyles}>
              {label}
            </RawText>
            <RawText
              selectable={false}
              testID="field-canonical-marker-indicator"
              style={{ ...textStyles, color: theme.colors.statusDanger }}
            >
              {required ? "*" : undefined}
            </RawText>
          </View>
        ) : null}
      </View>
      <View
        testID="field-native-pair"
        collapsable={false}
        style={{ width: "100%", maxWidth: 280, height: measurementHeight * 2 + 8 }}
      >
        <View
          testID="field-native-parent"
          collapsable={false}
          style={{
            width: "100%",
            height: measurementHeight,
            padding: 12,
            backgroundColor: "#ffffff",
            alignItems: "flex-start",
          }}
        >
          {visible ? (
            <FormField
              key={mode === "motion" ? `motion-${motionLifetime}` : name === "fresh" ? "fresh" : "original"}
              ref={bindRoot}
              testID="field-native-target"
              label={label}
              labelID="field-native-label"
              labelFor={name === "target-cleared" ? undefined : editor}
              required={required}
              raised={name === "raised"}
              description={description}
              errorMessages={
                hasMessages
                  ? [
                      narrow ? "Une erreur suffisamment longue pour vérifier le retour à la ligne." : "Error one",
                      "Error two",
                    ]
                  : emptyMessages
                    ? []
                    : undefined
              }
              warningMessages={hasMessages ? ["Warning"] : undefined}
              successMessages={hasMessages ? ["Success"] : undefined}
              topRightContent={
                mode === "motion" ? undefined : (
                  <RawText style={{ color: "#333333", fontSize: 12, lineHeight: 16 }}>Top</RawText>
                )
              }
              bottomRightContent={
                hasMessages ? (
                  <RawText style={{ color: "#333333", fontSize: 12, lineHeight: 16 }}>End</RawText>
                ) : emptyMessages ? (
                  0
                ) : undefined
              }
              customStyles={rootStyles}
              style={name === "final-style" ? { color: "#117733", padding: 3 } : narrow ? { width: 160 } : undefined}
              customTopRowStyles={topStyles}
              customLabelStyles={labelStyles}
              customTopRightStyles={topRightStyles}
              customBottomRowStyles={bottomStyles}
              customBottomRightStyles={bottomRightStyles}
              customValidationMessageStyles={validationStyles}
              customDescriptionStyles={descriptionStyles}
              onLayout={layout}
              onFocus={(event) => record("focus", event)}
              onBlur={(event) => record("blur", event)}
              ariaLabelledBy={relationships ? "field-g08-name" : undefined}
              ariaDescribedBy={relationships ? "field-g08-guide" : undefined}
              ariaDetails={relationships ? "field-g08-details" : undefined}
              labels={{ descriptionLabel: "Guidance", detailsLabel: "Details" }}
            >
              {child(false)}
            </FormField>
          ) : null}
        </View>
        <View
          testID="field-native-reference-parent"
          collapsable={false}
          style={{
            ...(referenceAtOrigin ? { position: "absolute" as const, top: 0, left: 0 } : { marginTop: 8 }),
            width: "100%",
            height: measurementHeight,
            padding: 12,
            backgroundColor: "#ffffff",
            alignItems: "flex-start",
          }}
        >
          {visible ? (
            <View
              testID="field-native-reference"
              collapsable={false}
              style={{
                width: "100%",
                flexDirection: "column",
                gap: theme.spacing.unit,
                boxShadow: shadow,
                ...rootStyles,
                ...(name === "final-style" ? { padding: 3 } : {}),
                ...(narrow ? { width: 160 } : {}),
              }}
            >
              <View
                testID="field-reference-top"
                style={{ flexDirection: "row", justifyContent: "space-between", ...topStyles }}
              >
                <RawText
                  selectable={false}
                  testID="field-reference-label"
                  style={{ ...textStyles, flexShrink: 1, ...labelStyles }}
                >
                  {label}
                  <View style={{ width: 2, height: 1 }} />
                  <RawText style={{ color: theme.colors.statusDanger }}>{required ? "*" : undefined}</RawText>
                </RawText>
                <View testID="field-reference-top-right" style={{ flexShrink: 1, ...topRightStyles }}>
                  {mode === "motion" ? null : (
                    <RawText style={{ color: "#333333", fontSize: 12, lineHeight: 16 }}>Top</RawText>
                  )}
                </View>
              </View>
              {child(true)}
              {hasMessages || emptyMessages ? (
                <View
                  testID="field-reference-bottom"
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    ...bottomStyles,
                  }}
                >
                  <View
                    testID="field-reference-validation"
                    style={{
                      width: "100%",
                      flexDirection: "column",
                      gap: theme.spacing.unit,
                      flexShrink: 1,
                      ...validationStyles,
                    }}
                  >
                    {hasMessages
                      ? [
                          narrow ? "Une erreur suffisamment longue pour vérifier le retour à la ligne." : "Error one",
                          "Error two",
                          "Warning",
                          "Success",
                        ].map((message, i) => (
                          <RawText
                            key={message}
                            selectable={false}
                            style={{
                              ...textStyles,
                              color:
                                i < 2
                                  ? theme.colors.statusDanger
                                  : i === 2
                                    ? theme.colors.statusWarning
                                    : theme.colors.statusSuccess,
                              ...validationStyles,
                            }}
                          >
                            {message}
                          </RawText>
                        ))
                      : null}
                  </View>
                  <View testID="field-reference-bottom-right" style={{ flexShrink: 1, ...bottomRightStyles }}>
                    {hasMessages ? (
                      <RawText style={{ color: "#333333", fontSize: 12, lineHeight: 16 }}>End</RawText>
                    ) : (
                      <RawText style={{ ...textStyles, fontSize: theme.typography.fontSizes.b10 }}>0</RawText>
                    )}
                  </View>
                </View>
              ) : null}
              {description ? (
                <RawText
                  selectable={false}
                  testID="field-reference-description"
                  style={{ ...textStyles, fontStyle: "italic", ...descriptionStyles }}
                >
                  {description}
                </RawText>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}
