import { useCallback, useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  Text as RawText,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native"

import { Button, Radio, RadioGroup, Text, useNativeTheme } from "@codon-ui/react-native"

const BEHAVIOR = [
  "baseline",
  "echo",
  "reselected",
  "disabled",
  "readonly",
  "held-disabled",
  "restored",
  "renderer",
  "replaced",
  "retired",
  "fresh",
  "local",
  "local-default-changed",
  "empty-value",
] as const
const STYLES = [
  "style-baseline",
  "selected",
  "root-custom",
  "final-style",
  "shape-custom",
  "explicit-child",
  "square",
  "round",
  "long-narrow",
  "fractional",
  "percentage",
  "auto",
  "small-target",
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

export const RadioG08Fixture = () => {
  const theme = useNativeTheme()
  const { scale } = useWindowDimensions()
  const [mode, setMode] = useState<TMode>("behavior")
  const [index, setIndex] = useState(0)
  const [owned, setOwned] = useState<string | null>(null)
  const [localValue, setLocalValue] = useState<string | null>("a")
  const [actions, setActions] = useState(0)
  const [requests, setRequests] = useState<string[]>([])
  const [phases, setPhases] = useState<string[]>([])
  const [canceled, setCanceled] = useState(false)
  const [rootTag, setRootTag] = useState<number | null>(null)
  const [layouts, setLayouts] = useState<TLayout[]>([])
  const [events, setEvents] = useState<
    { phase: string; target: number | null; currentTarget: number | null; epochMs: number }[]
  >([])
  const [motionEvents, setMotionEvents] = useState<boolean[]>([])
  const [motionVisible, setMotionVisible] = useState(true)
  const [motionTrace, setMotionTrace] = useState<{ name: string; epochMs: number }[]>([])
  const [motionLifetime, setMotionLifetime] = useState(0)
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
  const cases = mode === "styles" ? STYLES : BEHAVIOR
  const name = mode === "motion" ? "motion" : cases[index]
  const local = name === "local" || name === "local-default-changed"
  const value = name === "empty-value" ? "" : "a"
  const selectedValue =
    mode === "styles"
      ? ["selected", "dark", "light-restored"].includes(name)
        ? "a"
        : null
      : local
        ? localValue
        : owned
  const selected = selectedValue === value
  const visible = mode === "motion" ? motionVisible : name !== "retired"
  const disabled = name === "disabled" || (name === "held-disabled" && canceled)
  const readonly = name === "readonly"
  const narrow = name === "long-narrow",
    zero = name === "zero",
    small = name === "small-target"
  const label = narrow ? LONG_LABEL : "Keep settings"
  const display = name === "explicit-child" ? "Authored foreground" : label
  const width = zero
    ? 0
    : small
      ? 24
      : name === "fractional"
        ? 183.25
        : name === "percentage"
          ? "50%"
          : name === "auto"
            ? "auto"
            : narrow
              ? 110
              : 200
  const custom = name === "root-custom" || name === "final-style"
  const rootBackground = name === "final-style" ? "#117733" : custom ? "#bb3322" : undefined
  const foreground = name === "explicit-child" ? "#7a3bba" : theme.colors.foreground
  const background =
    mode === "motion"
      ? selected
        ? "#117733"
        : "#bb3322"
      : name === "shape-custom"
        ? "#265b99"
        : selected
          ? theme.colors.controlSelectedBackground
          : theme.colors.controlBackground
  const shapeSize = name === "shape-custom" ? 26 : 20
  const borderColor = name === "shape-custom" ? "#2f7d18" : theme.colors.controlBorder
  const radius =
    name === "square" ? 0 : name === "round" ? theme.radius.round : name === "shape-custom" ? 3 : theme.radius.rounded
  const fontSize = theme.typography.fontSizes[narrow ? "b9" : "b10"]
  const bind = useCallback((node: View | null) => setRootTag(node ? findNodeHandle(node) : null), [])
  const tag = (node: unknown) => (typeof node === "number" ? node : node == null ? null : findNodeHandle(node as View))
  const layout = (event: LayoutChangeEvent) => {
    const row = {
      target: tag(event.target),
      currentTarget: tag(event.currentTarget),
      layout: { ...event.nativeEvent.layout },
    }
    setLayouts((old) => {
      const previous = old.at(-1)
      return previous?.currentTarget === row.currentTarget &&
        JSON.stringify(previous.layout) === JSON.stringify(row.layout)
        ? old
        : [...old, row]
    })
  }
  const record = (phase: string, event: { target: unknown; currentTarget: unknown }) => {
    const observed = { phase, target: tag(event.target), currentTarget: tag(event.currentTarget), epochMs: Date.now() }
    setEvents((old) => [...old, observed])
  }
  const changeMode = (next: TMode) => {
    for (const timer of timers.current) clearTimeout(timer)
    timers.current = []
    setMode(next)
    setIndex(0)
    setOwned(null)
    setLocalValue("a")
    setActions(0)
    setRequests([])
    setPhases([])
    setCanceled(false)
    setEvents([])
    setMotionVisible(true)
    setMotionTrace([])
    setMotionLifetime((old) => old + 1)
  }
  const arm = () => {
    for (const timer of timers.current) clearTimeout(timer)
    setOwned(null)
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
          () => setOwned(index % 2 === 0 ? "a" : null),
        ),
      ),
      schedule(7000, "settle", () => setOwned("a")),
      schedule(8250, "retire", () => setMotionVisible(false)),
      schedule(10250, "fresh", () => {
        setMotionLifetime((old) => old + 1)
        setMotionVisible(true)
      }),
    ]
  }
  const target = visible ? (
    <Radio
      key={
        name === "replaced"
          ? "replaced"
          : name === "fresh"
            ? "fresh"
            : mode === "motion"
              ? `motion-${motionLifetime}`
              : "original"
      }
      ref={bind}
      testID="radio-native-target"
      accessibilityLabel={label}
      value={value}
      isDisabled={disabled}
      onLayout={layout}
      geometry={name === "square" ? "orthogonal" : name === "round" ? "round" : "rounded"}
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
      width={width}
      height={zero ? 0 : small ? 24 : undefined}
      customStyles={{
        ...(zero || small ? { overflow: "hidden" } : {}),
        ...(custom ? { backgroundColor: "#bb3322", padding: 4 } : {}),
      }}
      style={
        name === "final-style"
          ? (state) => ({ backgroundColor: state.defaultStyle.backgroundColor === "#bb3322" ? "#117733" : "#ff00ff" })
          : undefined
      }
      customShapeStyles={
        mode === "motion"
          ? { backgroundColor: background }
          : name === "shape-custom"
            ? { width: 26, height: 26, borderRadius: 3, backgroundColor: "#265b99", borderColor: "#2f7d18" }
            : undefined
      }
      render={
        name === "renderer"
          ? (props, state) => (
              <Pressable {...props} nativeID={state.isSelected ? "radio-selected" : "radio-available"} />
            )
          : undefined
      }
    >
      {name === "explicit-child" || narrow ? (
        <Text
          variant={narrow ? "b9" : "b10"}
          color={name === "explicit-child" ? "#7a3bba" : undefined}
          style={{ flexShrink: 1 }}
        >
          {display}
        </Text>
      ) : (
        display
      )}
    </Radio>
  ) : null
  const snapshot = {
    case: name,
    mode,
    scale,
    rootTag,
    layouts,
    events,
    actions,
    requests,
    phases,
    selected,
    selectedValue,
    value,
    disabled,
    readonly,
    canceled,
    visible,
    local,
    label,
    display,
    width,
    zero,
    small,
    narrow,
    background,
    rootBackground,
    foreground,
    borderColor,
    shapeSize,
    fontSize,
    radius,
    themeMode: theme.mode,
    motionEvents,
    motionTrace,
  }
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["behavior", "styles", "motion"] as const).map((value) => (
          <Button key={value} raised={false} onPress={() => changeMode(value)}>
            Radio {value} checks
          </Button>
        ))}
      </View>
      <Text testID="radio-native-state" accessibilityLabel={JSON.stringify(snapshot)} numberOfLines={1}>
        Radio check: {name}; actions {actions}
      </Text>
      {mode === "motion" ? (
        <Button raised={false} onPress={arm}>
          Arm Radio motion and retirement
        </Button>
      ) : (
        <Button raised={false} onPress={() => setIndex((old) => (old + 1) % cases.length)}>
          Next Radio check
        </Button>
      )}
      <View
        testID="radio-native-pair"
        collapsable={false}
        style={{ width: narrow ? 134 : "100%", maxWidth: 280, gap: 8 }}
      >
        <View
          testID="radio-native-parent"
          collapsable={false}
          style={{ width: "100%", height: 224, padding: 12, backgroundColor: "#ffffff", alignItems: "flex-start" }}
        >
          <RadioGroup
            key={local ? "local" : "controlled"}
            value={local ? undefined : selectedValue}
            defaultValue={local ? (name === "local" ? "a" : null) : undefined}
            accessibilityLabel="Settings choices"
            isReadOnly={readonly}
            customStyles={{ alignItems: "flex-start", width: "100%" }}
            onChange={(next) => {
              setRequests((old) => [...old, next])
              setPhases((old) => [...old, "change"])
              if (local) setLocalValue(next)
              else if (name !== "baseline") setOwned(next)
            }}
          >
            {target}
          </RadioGroup>
        </View>
        <View
          testID="radio-native-reference-parent"
          collapsable={false}
          style={{ width: "100%", height: 224, padding: 12, backgroundColor: "#ffffff", alignItems: "flex-start" }}
        >
          {visible ? (
            <View
              testID="radio-native-reference"
              collapsable={false}
              style={{
                width,
                height: zero ? 0 : small ? 24 : undefined,
                minHeight: zero || small ? undefined : 44,
                flexDirection: "row",
                alignItems: "center",
                gap: theme.spacing.unit,
                opacity: disabled ? theme.opacity.disabled : 1,
                ...(zero || small ? { overflow: "hidden" } : {}),
                ...(custom ? { backgroundColor: rootBackground, padding: 4 } : {}),
              }}
            >
              <View
                testID="radio-native-reference-shape"
                style={{
                  width: shapeSize,
                  height: shapeSize,
                  flexShrink: 0,
                  backgroundColor: background,
                  borderWidth: 2,
                  borderColor,
                  borderRadius: radius,
                }}
              />
              <RawText
                accessible={false}
                selectable={false}
                style={{
                  color: foreground,
                  fontSize,
                  fontWeight: theme.typography.fontWeights.regular,
                  fontStyle: "normal",
                  fontFamily: theme.typography.fontFamilies.body,
                  lineHeight: theme.typography.lineHeight,
                  flexShrink: 1,
                }}
              >
                {display}
              </RawText>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}
