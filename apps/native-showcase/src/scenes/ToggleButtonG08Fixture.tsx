import { useCallback, useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  findNodeHandle,
  Text as RawText,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native"

import {
  Button,
  Text,
  ToggleButton,
  NativeFocusView,
  ToggleButtonGroup,
  useNativeTheme,
  type TNativeToggleButtonSelectionState,
} from "@codon-ui/react-native"

const BEHAVIOR = [
  "baseline",
  "echo",
  "disabled",
  "held-disabled",
  "restored",
  "state-method",
  "renderer",
  "replaced",
  "retired",
  "fresh",
  "auto-focus",
  "local",
  "local-default-changed",
  "single-group",
  "multiple-group",
] as const
const STYLES = [
  "style-baseline",
  "selected",
  "root-custom",
  "final-style",
  "foreground",
  "explicit-child",
  "square",
  "round",
  "raised",
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
export const ToggleButtonG08Fixture = () => {
  const theme = useNativeTheme()
  const { scale } = useWindowDimensions()
  const [mode, setMode] = useState<TMode>("behavior")
  const [index, setIndex] = useState(0)
  const [ownedSelected, setOwnedSelected] = useState(false)
  const [localSelected, setLocalSelected] = useState(true)
  const [actions, setActions] = useState(0)
  const [requests, setRequests] = useState<boolean[]>([])
  const [phases, setPhases] = useState<string[]>([])
  const [canceled, setCanceled] = useState(false)
  const [focusVisible, setFocusVisible] = useState(false)
  const [focused, setFocused] = useState(false)
  const [referenceAtOrigin, setReferenceAtOrigin] = useState(false)
  const [rootTag, setRootTag] = useState<number | null>(null)
  const [layouts, setLayouts] = useState<TLayout[]>([])
  const [events, setEvents] = useState<
    { phase: string; target: number | null; currentTarget: number | null; epochMs: number }[]
  >([])
  const [groupKeys, setGroupKeys] = useState<Set<string | number>>(new Set())
  const selection = useRef<TNativeToggleButtonSelectionState | null>(null)
  const [motionEvents, setMotionEvents] = useState<boolean[]>([])
  const [motionVisible, setMotionVisible] = useState(true)
  const [motionTrace, setMotionTrace] = useState<{ name: string; epochMs: number }[]>([])
  const [motionEpoch, setMotionEpoch] = useState(0)
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
  const bind = useCallback((node: View | null) => {
    setRootTag(node ? findNodeHandle(node) : null)
    if (!node) {
      setFocused(false)
      setFocusVisible(false)
    }
  }, [])
  const tag = (node: unknown) => (typeof node === "number" ? node : node == null ? null : findNodeHandle(node as View))
  const local = name === "local" || name === "local-default-changed"
  const grouped = name === "single-group" || name === "multiple-group"
  const selected =
    mode === "styles"
      ? ["selected", "dark", "light-restored"].includes(name)
      : local
        ? localSelected
        : grouped
          ? groupKeys.has(0)
          : ownedSelected
  const visible = mode === "motion" ? motionVisible : name !== "retired"
  const disabled = name === "disabled" || (name === "held-disabled" && canceled)
  const narrow = name === "long-narrow"
  const label = narrow ? LONG_LABEL : "Flag settings"
  const display = name === "explicit-child" ? "Authored foreground" : label
  const zero = name === "zero",
    small = name === "small-target"
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
              ? 96
              : 200
  const custom = name === "root-custom" || name === "final-style"
  const background =
    mode === "motion"
      ? selected
        ? "#117733"
        : "#bb3322"
      : name === "final-style"
        ? "#117733"
        : custom
          ? "#bb3322"
          : selected
            ? theme.colors.controlSelectedBackground
            : theme.colors.controlBackground
  const foreground =
    name === "explicit-child"
      ? "#7a3bba"
      : name === "foreground"
        ? "#b73434"
        : selected
          ? theme.colors.controlSelectedForeground
          : theme.colors.controlForeground
  const borderColor = custom
    ? "#2f7d18"
    : selected
      ? theme.colors.controlSelectedBackground
      : theme.colors.controlBorder
  const fontSize = theme.typography.fontSizes[narrow ? "b9" : "b10"]
  const padding = zero || small ? 0 : theme.spacing.unit
  const radius = name === "square" ? 0 : name === "round" ? theme.radius.round : theme.radius.rounded
  const raised = name === "raised"
  const snapshot = {
    case: name,
    focused,
    focusVisible,
    referenceAtOrigin,
    mode,
    scale,
    rootTag,
    layouts,
    events,
    actions,
    requests,
    phases,
    selected,
    disabled,
    canceled,
    visible,
    grouped,
    radio: name === "single-group",
    groupKeys: [...groupKeys],
    local,
    label,
    display,
    width,
    zero,
    small,
    narrow,
    background,
    foreground,
    borderColor,
    fontSize,
    padding,
    radius,
    raised,
    themeMode: theme.mode,
    motionEvents,
    motionTrace,
    motionEpoch,
  }
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
    setReferenceAtOrigin(false)
    setMode(next)
    setIndex(0)
    setOwnedSelected(false)
    setLocalSelected(true)
    setActions(0)
    setRequests([])
    setPhases([])
    setCanceled(false)
    setEvents([])
    setGroupKeys(new Set())
    setMotionVisible(true)
    setMotionTrace([])
    setMotionLifetime((old) => old + 1)
  }
  const arm = () => {
    for (const timer of timers.current) clearTimeout(timer)
    setOwnedSelected(false)
    setMotionVisible(true)
    setMotionTrace([])
    setMotionEpoch(Date.now())
    const schedule = (delay: number, name: string, action: () => void) =>
      setTimeout(() => {
        setMotionTrace((old) => [...old, { name, epochMs: Date.now() }])
        action()
      }, delay)
    timers.current = [
      schedule(3000, "select", () => setOwnedSelected(true)),
      schedule(3125, "interrupt", () => setOwnedSelected(false)),
      schedule(3250, "retarget", () => setOwnedSelected(true)),
      schedule(4300, "retire", () => setMotionVisible(false)),
      schedule(5000, "fresh", () => {
        setMotionLifetime((old) => old + 1)
        setMotionVisible(true)
      }),
    ]
  }
  const target = visible ? (
    <ToggleButton
      key={
        name === "auto-focus"
          ? "auto-focus"
          : local
            ? "local"
            : grouped
              ? name
              : name === "replaced"
                ? "replaced"
                : name === "fresh"
                  ? "fresh"
                  : mode === "motion"
                    ? `motion-${motionLifetime}`
                    : "original"
      }
      ref={bind}
      testID="toggle-button-native-target"
      accessibilityLabel={label}
      id={0}
      isSelected={local || grouped ? undefined : selected}
      defaultSelected={local ? name === "local" : undefined}
      isDisabled={disabled}
      preventFocusOnPress={name !== "baseline"}
      autoFocus={name === "auto-focus"}
      onFocus={(event) => {
        record("focus", event)
        setFocused(true)
        setFocusVisible(event.nativeEvent.isFocusVisible === true)
      }}
      onBlur={(event) => {
        record("blur", event)
        setFocused(false)
        setFocusVisible(false)
      }}
      onLayout={layout}
      raised={raised}
      geometry={name === "square" ? "orthogonal" : name === "round" ? "round" : "rounded"}
      onChange={(next) => {
        setRequests((old) => [...old, next])
        setPhases((old) => [...old, "change"])
        if (local) setLocalSelected(next)
        else if (name !== "baseline") setOwnedSelected(next)
      }}
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
      customStyles={{
        width,
        padding,
        paddingHorizontal: padding,
        ...(zero || small ? { height: zero ? 0 : 24, overflow: "hidden", ...(zero ? { borderWidth: 0 } : {}) } : {}),
        ...(mode === "motion" ? { backgroundColor: background } : {}),
        ...(custom ? { backgroundColor: "#bb3322", borderColor: "#2f7d18" } : {}),
        ...(name === "foreground" ? { color: "#b73434" } : {}),
        ...(narrow ? { fontSize } : {}),
        ...(name === "round" ? { paddingHorizontal: theme.spacing.unit } : {}),
      }}
      style={
        name === "final-style"
          ? (state) => ({ backgroundColor: state.defaultStyle.backgroundColor === "#bb3322" ? "#117733" : "#ff00ff" })
          : undefined
      }
      render={
        name === "renderer"
          ? (props, state) => (
              <NativeFocusView {...props} nativeID={state.isSelected ? "toggle-selected" : "toggle-available"} />
            )
          : undefined
      }
    >
      {(state) => {
        selection.current = state.state
        return name === "explicit-child" || narrow ? (
          <Text
            variant={narrow ? "b9" : "b10"}
            color={name === "explicit-child" ? "#7a3bba" : undefined}
            style={narrow ? { flexShrink: 1 } : undefined}
          >
            {display}
          </Text>
        ) : (
          display
        )
      }}
    </ToggleButton>
  ) : null
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["behavior", "styles", "motion"] as const).map((value) => (
          <Button key={value} raised={false} onPress={() => changeMode(value)}>
            ToggleButton {value} checks
          </Button>
        ))}
      </View>
      <Text testID="toggle-button-native-state" accessibilityLabel={JSON.stringify(snapshot)} numberOfLines={1}>
        ToggleButton check: {name}; actions {actions}
      </Text>
      {mode === "motion" ? (
        <Button raised={false} onPress={arm}>
          Arm ToggleButton motion and retirement
        </Button>
      ) : (
        <Button
          raised={false}
          onPress={() => {
            setIndex((old) => (old + 1) % cases.length)
            setGroupKeys(new Set())
            setReferenceAtOrigin(false)
          }}
        >
          Next ToggleButton check
        </Button>
      )}
      {name === "state-method" ? (
        <Button raised={false} onPress={() => selection.current?.toggle()}>
          Toggle through exposed state
        </Button>
      ) : null}
      {name === "raised" ? (
        <Button raised={false} onPress={() => setReferenceAtOrigin(true)}>
          Match raised reference position
        </Button>
      ) : null}
      <View
        testID="toggle-button-native-pair"
        collapsable={false}
        style={{ width: narrow ? 120 : "100%", maxWidth: 280, gap: 8 }}
      >
        <View
          testID="toggle-button-native-parent"
          collapsable={false}
          style={{ width: "100%", height: 224, padding: 12, backgroundColor: "#ffffff", alignItems: "flex-start" }}
        >
          {grouped ? (
            <ToggleButtonGroup
              selectionMode={name === "single-group" ? "single" : "multiple"}
              selectedKeys={groupKeys}
              onSelectionChange={(keys) => setGroupKeys(new Set(keys))}
              accessibilityLabel="Flag group"
            >
              {target}
            </ToggleButtonGroup>
          ) : (
            target
          )}
        </View>
        <View
          testID="toggle-button-native-reference-parent"
          collapsable={false}
          style={{
            ...(referenceAtOrigin ? ({ position: "absolute", top: 0, left: 0 } as const) : {}),
            width: "100%",
            height: 224,
            padding: 12,
            backgroundColor: "#ffffff",
            alignItems: "flex-start",
          }}
        >
          {visible ? (
            <View
              testID="toggle-button-native-reference"
              collapsable={false}
              style={{
                width,
                minWidth: undefined,
                minHeight: zero || small ? undefined : 44,
                height: zero ? 0 : small ? 24 : undefined,
                overflow: zero || small ? "hidden" : undefined,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: theme.spacing.unit,
                padding,
                borderRadius: radius,
                borderWidth: zero ? 0 : 1,
                borderColor,
                backgroundColor: background,
                opacity: disabled ? theme.opacity.disabled : 1,
                ...(focused && focusVisible && !disabled
                  ? { outlineColor: theme.colors.focusRing, outlineWidth: 1.5, outlineOffset: 1.5 }
                  : {}),
                ...(raised
                  ? {
                      shadowColor: "#000000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.24,
                      shadowRadius: 3,
                      elevation: 2,
                    }
                  : {}),
              }}
            >
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
                  letterSpacing: 0,
                  textAlign: "center",
                  ...(narrow ? { flexShrink: 1 } : {}),
                }}
              >
                {display}
              </RawText>
            </View>
          ) : null}
        </View>
        {referenceAtOrigin ? <View style={{ height: 224 }} /> : null}
      </View>
    </View>
  )
}
