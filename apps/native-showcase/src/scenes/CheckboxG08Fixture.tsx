import { useCallback, useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  Text as RawText,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native"

import { Button, Checkbox, CheckboxGroup, Text, useNativeTheme } from "@codon-ui/react-native"

const BEHAVIOR = [
  "baseline",
  "echo",
  "disabled",
  "readonly",
  "held-disabled",
  "restored",
  "renderer",
  "mixed",
  "group-veto",
  "group-echo",
  "group-disabled",
  "group-readonly",
  "replaced",
  "retired",
  "fresh",
  "local",
  "local-default-changed",
] as const
const STYLES = [
  "style-baseline",
  "selected",
  "mixed-style",
  "no-icon",
  "mixed-no-icon",
  "primary",
  "raised",
  "root-custom",
  "final-style",
  "explicit-child",
  "orthogonal",
  "round",
  "long-narrow",
  "fractional",
  "percentage",
  "root-small",
  "zero",
  "dark",
  "light-restored",
] as const
const LONG_LABEL = "Conserver tous les paramètres puis continuer pour enregistrer les modifications."
type TMode = "behavior" | "styles" | "motion"
type TLayout = {
  target: number | null
  currentTarget: number | null
  layout: { x: number; y: number; width: number; height: number }
}

export const CheckboxG08Fixture = () => {
  const theme = useNativeTheme(),
    { scale } = useWindowDimensions()
  const [mode, setMode] = useState<TMode>("behavior"),
    [index, setIndex] = useState(0)
  const [owned, setOwned] = useState(false),
    [localValue, setLocalValue] = useState(false),
    [groupValue, setGroupValue] = useState<string[]>([])
  const [actions, setActions] = useState(0),
    [requests, setRequests] = useState<boolean[]>([]),
    [groupRequests, setGroupRequests] = useState<string[][]>([]),
    [phases, setPhases] = useState<string[]>([])
  const [canceled, setCanceled] = useState(false),
    [rootTag, setRootTag] = useState<number | null>(null),
    [layouts, setLayouts] = useState<TLayout[]>([])
  const [events, setEvents] = useState<
    { phase: string; target: number | null; currentTarget: number | null; epochMs: number }[]
  >([])
  const [referenceAtOrigin, setReferenceAtOrigin] = useState(false)
  const [motionEvents, setMotionEvents] = useState<boolean[]>([]),
    [motionVisible, setMotionVisible] = useState(true),
    [motionTrace, setMotionTrace] = useState<{ name: string; epochMs: number }[]>([]),
    [motionLifetime, setMotionLifetime] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    let active = true
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      if (active) setMotionEvents((old) => [...old, value])
    })
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setMotionEvents((old) => (old.length ? old : [value]))
    })
    return () => {
      active = false
      listener.remove()
      for (const timer of timers.current) clearTimeout(timer)
    }
  }, [])
  const cases = mode === "styles" ? STYLES : BEHAVIOR,
    name = mode === "motion" ? "motion" : cases[index]
  const local = name === "local" || name === "local-default-changed",
    grouped = name.startsWith("group-")
  const mixed = ["mixed", "mixed-style", "mixed-no-icon"].includes(name)
  const selected =
    mode === "styles"
      ? ["selected", "no-icon", "primary", "raised", "dark", "light-restored"].includes(name)
      : grouped
        ? groupValue.includes("one")
        : local
          ? localValue
          : owned
  const visible = mode === "motion" ? motionVisible : name !== "retired"
  const disabled = name === "disabled" || name === "group-disabled" || (name === "held-disabled" && canceled),
    readonly = name === "readonly" || name === "group-readonly"
  const zero = name === "zero",
    small = name === "root-small",
    narrow = name === "long-narrow",
    custom = name === "root-custom" || name === "final-style",
    primary = name === "primary",
    raised = name === "raised"
  const markWidth = name === "fractional" ? 27.25 : 20,
    markHeight = name === "fractional" ? 19.75 : 20
  const rootWidth = zero ? 0 : small ? 24 : narrow ? 140 : name === "percentage" ? "50%" : 200,
    rootHeight = zero ? 0 : small ? 24 : undefined
  const display =
    mode === "motion" ? "" : narrow ? LONG_LABEL : name === "explicit-child" ? "Authored foreground" : "Keep settings"
  const filled = selected || mixed,
    showIcon = !["no-icon", "mixed-no-icon"].includes(name)
  const background =
    mode === "motion"
      ? selected
        ? "#117733"
        : theme.colors.controlBackground
      : filled
        ? primary
          ? theme.actions.primary.background
          : theme.colors.controlSelectedBackground
        : theme.colors.controlBackground
  const foreground = name === "explicit-child" ? "#7a3bba" : custom ? "#265b99" : theme.colors.foreground
  const glyphColor = primary ? theme.actions.primary.foreground : theme.colors.controlSelectedForeground
  const borderColor =
    mode === "motion"
      ? "#117733"
      : primary
        ? theme.actions.primary.border
        : filled
          ? theme.colors.controlSelectedBackground
          : theme.colors.controlBorder
  const radius = name === "orthogonal" ? 0 : name === "round" ? theme.radius.round : theme.radius.rounded
  const root: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.unit,
    minHeight: rootHeight === undefined ? 44 : undefined,
    width: rootWidth,
    height: rootHeight,
    opacity: disabled ? theme.opacity.disabled : 1,
    ...(zero || small ? { overflow: "hidden" } : {}),
    ...(custom ? { backgroundColor: name === "final-style" ? "#117733" : "#bb3322", padding: 4 } : {}),
  }
  const shape: ViewStyle = {
    width: markWidth,
    height: markHeight,
    cursor: "pointer",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: background,
    borderWidth: 2,
    borderColor,
    borderRadius: radius,
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    ...(raised
      ? {
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.24,
          shadowRadius: 3,
          elevation: 2,
        }
      : {}),
  }
  const bind = useCallback((node: View | null) => setRootTag(node ? findNodeHandle(node) : null), [])
  const tag = (node: unknown) => (typeof node === "number" ? node : node == null ? null : findNodeHandle(node as View))
  const layout = (event: LayoutChangeEvent) => {
    const row = {
      target: tag(event.target),
      currentTarget: tag(event.currentTarget),
      layout: { ...event.nativeEvent.layout },
    }
    setLayouts((old) =>
      old.at(-1)?.currentTarget === row.currentTarget &&
      JSON.stringify(old.at(-1)?.layout) === JSON.stringify(row.layout)
        ? old
        : [...old, row],
    )
  }
  const record = (phase: string, event: { target: unknown; currentTarget: unknown }) => {
    const row = { phase, target: tag(event.target), currentTarget: tag(event.currentTarget), epochMs: Date.now() }
    setEvents((old) => [...old, row])
  }
  const changeMode = (next: TMode) => {
    for (const timer of timers.current) clearTimeout(timer)
    timers.current = []
    setMode(next)
    setIndex(0)
    setOwned(false)
    setLocalValue(false)
    setGroupValue([])
    setActions(0)
    setRequests([])
    setGroupRequests([])
    setPhases([])
    setCanceled(false)
    setEvents([])
    setReferenceAtOrigin(false)
    setMotionVisible(true)
    setMotionTrace([])
    setMotionLifetime((old) => old + 1)
  }
  const arm = () => {
    for (const timer of timers.current) clearTimeout(timer)
    setOwned(false)
    setMotionVisible(true)
    setMotionTrace([])
    const schedule = (delay: number, name: string, action: () => void) =>
      setTimeout(() => {
        const observed = { name, epochMs: Date.now() }
        setMotionTrace((old) => [...old, observed])
        action()
      }, delay)
    timers.current = [
      ...Array.from({ length: 32 }, (_, index) =>
        schedule(
          3000 + index * 125,
          index === 0 ? "select" : index === 1 ? "interrupt" : index === 2 ? "retarget" : `retarget-${index}`,
          () => setOwned(index % 2 === 0),
        ),
      ),
      schedule(7000, "settle", () => setOwned(true)),
      schedule(10000, "retire", () => setMotionVisible(false)),
      schedule(13000, "fresh", () => {
        setMotionLifetime((old) => old + 1)
        setMotionVisible(true)
      }),
    ]
  }
  const snapshot = {
    case: name,
    mode,
    scale,
    rootTag,
    layouts,
    events,
    actions,
    requests,
    groupRequests,
    groupValue,
    phases,
    selected,
    mixed,
    disabled,
    readonly,
    canceled,
    visible,
    local,
    grouped,
    zero,
    small,
    narrow,
    label: "Keep settings",
    display,
    rootWidth,
    rootHeight,
    markWidth,
    markHeight,
    background,
    glyphColor,
    borderColor,
    radius,
    raised,
    referenceAtOrigin,
    themeMode: theme.mode,
    motionEvents,
    motionTrace,
  }
  const component = visible ? (
    <Checkbox
      key={
        local
          ? "local"
          : grouped
            ? "group"
            : name === "replaced"
              ? "replaced"
              : name === "fresh"
                ? "fresh"
                : mode === "motion"
                  ? `motion-${motionLifetime}`
                  : "original"
      }
      ref={bind}
      testID="checkbox-native-target"
      accessibilityLabel="Keep settings"
      value={grouped ? "one" : undefined}
      isSelected={grouped ? true : local ? undefined : selected}
      defaultSelected={local ? name === "local-default-changed" : undefined}
      isIndeterminate={mixed}
      showIcon={showIcon}
      isDisabled={grouped ? false : disabled}
      isReadOnly={grouped ? false : readonly}
      onLayout={layout}
      onFocus={(event) => record("focus", event)}
      onBlur={(event) => record("blur", event)}
      onPressIn={(event) => {
        record("in", event)
        if (name === "held-disabled") setCanceled(true)
      }}
      onPressOut={(event) => record("out", event)}
      onPress={(event) => {
        record("press", event)
        setActions((old) => old + 1)
        setPhases((old) => [...old, "press"])
      }}
      onChange={(next) => {
        setRequests((old) => [...old, next])
        setPhases((old) => [...old, "change"])
        if (local) setLocalValue(next)
        else if (!grouped && name !== "baseline") setOwned(next)
      }}
      width={markWidth}
      height={markHeight}
      order={primary ? "primary" : undefined}
      color={mode === "motion" ? "#117733" : undefined}
      geometry={name === "orthogonal" ? "orthogonal" : name === "round" ? "round" : "rounded"}
      raised={raised}
      customStyles={{
        width: rootWidth,
        ...(rootHeight !== undefined ? { height: rootHeight } : {}),
        ...(zero || small ? { overflow: "hidden" } : {}),
        ...(custom ? { backgroundColor: "#bb3322", color: "#265b99", padding: 4 } : {}),
      }}
      style={
        name === "final-style"
          ? (state) => ({ backgroundColor: state.defaultStyle.backgroundColor === "#bb3322" ? "#117733" : "#ff00ff" })
          : undefined
      }
      render={
        name === "renderer"
          ? (props, state) => (
              <Pressable
                {...props}
                nativeID={state.isIndeterminate ? "checkbox-mixed" : state.isSelected ? "checkbox-on" : "checkbox-off"}
              />
            )
          : undefined
      }
    >
      {display ? name === "explicit-child" ? <Text style={{ color: "#7a3bba" }}>{display}</Text> : display : null}
    </Checkbox>
  ) : null
  const checkWidth = markWidth * 0.3,
    checkHeight = markHeight * 0.55,
    checkBounds = (checkWidth + checkHeight) * Math.SQRT1_2,
    checkInset = (markWidth - checkBounds) / 2
  const reference = visible ? (
    <View testID="checkbox-native-reference" collapsable={false} style={root}>
      <View testID="checkbox-native-reference-shape" style={shape}>
        {mixed ? (
          <View style={{ width: "70%", height: 3, backgroundColor: glyphColor }} />
        ) : selected && showIcon ? (
          <View pointerEvents="none" style={{ width: markWidth, height: markHeight }}>
            <View
              style={{
                position: "absolute",
                left: checkInset,
                width: checkBounds,
                height: markHeight,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  left: -checkInset,
                  width: markWidth,
                  height: markHeight,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  testID="checkbox-native-reference-check"
                  style={{
                    width: checkWidth,
                    height: checkHeight,
                    borderRightWidth: 2,
                    borderBottomWidth: 2,
                    borderColor: glyphColor,
                    transform: [{ rotate: "45deg" }],
                    marginTop: -markHeight * 0.15,
                  }}
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>
      {display ? (
        <RawText
          testID="checkbox-native-reference-text"
          accessible={false}
          selectable={false}
          style={{
            flexShrink: name === "explicit-child" ? undefined : 1,
            color: foreground,
            fontSize: theme.typography.fontSizes.b10,
            fontFamily: theme.typography.fontFamilies.body,
            fontWeight: theme.typography.fontWeights.regular,
            fontStyle: "normal",
            lineHeight: theme.typography.lineHeight,
          }}
        >
          {display}
        </RawText>
      ) : null}
    </View>
  ) : null
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["behavior", "styles", "motion"] as const).map((value) => (
          <Button key={value} raised={false} onPress={() => changeMode(value)}>
            Checkbox {value} checks
          </Button>
        ))}
      </View>
      <Text testID="checkbox-native-state" accessibilityLabel={JSON.stringify(snapshot)} numberOfLines={1}>
        Checkbox check: {name}; actions {actions}
      </Text>
      {mode === "motion" ? (
        <Button raised={false} onPress={arm}>
          Arm Checkbox motion and retirement
        </Button>
      ) : (
        <Button
          raised={false}
          onPress={() => {
            setIndex((old) => (old + 1) % cases.length)
            setReferenceAtOrigin(false)
          }}
        >
          Next Checkbox check
        </Button>
      )}
      {mode !== "motion" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Button raised={false} onPress={() => setReferenceAtOrigin(true)}>
            Show Checkbox reference
          </Button>
          <Button raised={false} onPress={() => setReferenceAtOrigin(false)}>
            Show Checkbox component
          </Button>
        </View>
      ) : null}
      <View
        testID="checkbox-native-pair"
        collapsable={false}
        style={{ width: "100%", maxWidth: 280, height: 456, position: "relative" }}
      >
        <View
          testID="checkbox-native-parent"
          collapsable={false}
          style={{ width: "100%", height: 224, padding: 12, backgroundColor: "#ffffff", alignItems: "flex-start" }}
        >
          <View style={{ width: "100%", opacity: referenceAtOrigin ? 0 : 1 }}>
            {grouped ? (
              <CheckboxGroup
                value={groupValue}
                isDisabled={disabled}
                isReadOnly={readonly}
                onChange={(next) => {
                  setGroupRequests((old) => [...old, next])
                  setPhases((old) => [...old, "group"])
                  if (name !== "group-veto") setGroupValue(next)
                }}
                style={{ padding: 0, gap: 0, width: "100%", alignItems: "flex-start" }}
              >
                {component}
              </CheckboxGroup>
            ) : (
              component
            )}
          </View>
        </View>
        <View
          testID="checkbox-native-reference-parent"
          collapsable={false}
          pointerEvents="none"
          style={{
            position: "absolute",
            top: referenceAtOrigin ? 0 : 232,
            left: 0,
            width: "100%",
            height: 224,
            padding: 12,
            backgroundColor: "#ffffff",
            alignItems: "flex-start",
          }}
        >
          {reference}
        </View>
      </View>
    </View>
  )
}
