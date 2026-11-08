import { useCallback, useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  Text as RawText,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native"

import { Button, ListBoxItem, Text, useNativeTheme, type TNativeSelectKey } from "@codon-ui/react-native"

const BEHAVIOR = [
  "baseline",
  "echo",
  "string-zero",
  "empty-key",
  "programmatic-off",
  "disabled",
  "readonly",
  "held-disabled",
  "restored",
  "child-callback",
  "renderer",
  "replaced",
  "retired",
  "fresh",
] as const
const STYLES = [
  "style-baseline",
  "selected",
  "small-text",
  "large-text",
  "root-custom",
  "final-style",
  "foreground",
  "explicit-child",
  "square",
  "long-narrow",
  "fractional",
  "percentage",
  "auto",
  "small-target",
  "zero",
  "dark",
  "light-restored",
] as const
const LONG_LABEL = "Choisissez les paramètres puis continuez pour enregistrer vos modifications."
type TMode = "behavior" | "styles" | "motion"
type TLayout = {
  target: number | null
  currentTarget: number | null
  layout: { x: number; y: number; width: number; height: number }
}

export const ListBoxItemG08Fixture = () => {
  const theme = useNativeTheme()
  const { scale } = useWindowDimensions()
  const [mode, setMode] = useState<TMode>("behavior")
  const [index, setIndex] = useState(0)
  const [ownedSelected, setOwnedSelected] = useState(false)
  const [actions, setActions] = useState(0)
  const [canceled, setCanceled] = useState(false)
  const [rootTag, setRootTag] = useState<number | null>(null)
  const [layouts, setLayouts] = useState<TLayout[]>([])
  const [events, setEvents] = useState<
    { phase: string; target: number | null; currentTarget: number | null; epochMs: number }[]
  >([])
  const [motionEvents, setMotionEvents] = useState<boolean[]>([])
  const [motionVisible, setMotionVisible] = useState(true)
  const [motionTrace, setMotionTrace] = useState<{ name: string; epochMs: number }[]>([])
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [motionEpoch, setMotionEpoch] = useState(0)
  const [motionLifetime, setMotionLifetime] = useState(0)
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
  const bind = useCallback((node: View | null) => setRootTag(node ? findNodeHandle(node) : null), [])
  const tag = (node: unknown) => (typeof node === "number" ? node : node == null ? null : findNodeHandle(node as View))
  const visible = mode === "motion" ? motionVisible : name !== "retired"
  const selected =
    mode === "styles"
      ? ["selected", "dark", "light-restored"].includes(name)
      : name === "programmatic-off"
        ? false
        : ownedSelected
  const disabled = name === "disabled" || (name === "held-disabled" && canceled)
  const readonly = name === "readonly"
  const id: TNativeSelectKey = name === "empty-key" ? "" : name === "string-zero" ? "0" : 0
  const narrow = name === "long-narrow"
  const textValue = narrow ? LONG_LABEL : `Choice ${typeof id}:${id}`
  const display =
    name === "child-callback"
      ? selected
        ? "Selected content"
        : "Available content"
      : name === "explicit-child"
        ? "Authored foreground"
        : textValue
  const zero = name === "zero"
  const small = name === "small-target"
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
  const rootCustom = name === "root-custom" || name === "final-style"
  const background =
    mode === "motion"
      ? selected
        ? "#117733"
        : "#bb3322"
      : name === "final-style"
        ? "#117733"
        : rootCustom
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
  const fontSize =
    theme.typography.fontSizes[name === "small-text" ? "b11" : name === "large-text" || narrow ? "b9" : "b10"]
  const border = rootCustom ? 2 : 0
  const padding = zero || small ? 0 : theme.spacing.unit * 2
  const radius = name === "square" ? 0 : theme.radius.rounded
  const state = {
    case: name,
    mode,
    scale,
    rootTag,
    layouts,
    events,
    actions,
    selected,
    disabled,
    readonly,
    canceled,
    visible,
    id,
    keyType: typeof id,
    textValue,
    display,
    width,
    zero,
    small,
    narrow,
    rootCustom,
    background,
    foreground,
    fontSize,
    border,
    padding,
    radius,
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
  const record = (phase: string, event: GestureResponderEvent) =>
    setEvents((old) => [
      ...old,
      { phase, target: tag(event.target), currentTarget: tag(event.currentTarget), epochMs: Date.now() },
    ])
  const changeMode = (next: TMode) => {
    for (const timer of timers.current) clearTimeout(timer)
    timers.current = []
    setMode(next)
    setIndex(0)
    setOwnedSelected(false)
    setCanceled(false)
    setActions(0)
    setEvents([])
    setMotionVisible(true)
    setMotionTrace([])
    setMotionLifetime((old) => old + 1)
  }
  const armMotion = () => {
    for (const timer of timers.current) clearTimeout(timer)
    setOwnedSelected(false)
    setMotionVisible(true)
    setMotionTrace([])
    setMotionEpoch(Date.now())
    const schedule = (delay: number, label: string, action: () => void) =>
      setTimeout(() => {
        setMotionTrace((old) => [...old, { name: label, epochMs: Date.now() }])
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
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button raised={false} onPress={() => changeMode("behavior")}>
          ListBoxItem behavior checks
        </Button>
        <Button raised={false} onPress={() => changeMode("styles")}>
          ListBoxItem style checks
        </Button>
        <Button raised={false} onPress={() => changeMode("motion")}>
          ListBoxItem motion checks
        </Button>
      </View>
      <Text testID="list-item-native-state" accessibilityLabel={JSON.stringify(state)} numberOfLines={1}>
        ListBoxItem check: {name}; actions {actions}
      </Text>
      {mode === "motion" ? (
        <Button raised={false} onPress={armMotion}>
          Arm ListBoxItem motion and retirement
        </Button>
      ) : (
        <Button raised={false} onPress={() => setIndex((old) => (old + 1) % cases.length)}>
          Next ListBoxItem check
        </Button>
      )}
      <View
        testID="list-item-native-pair"
        collapsable={false}
        style={{ width: narrow ? 120 : "100%", maxWidth: 280, gap: 8 }}
      >
        <View
          testID="list-item-native-parent"
          collapsable={false}
          style={{ width: "100%", height: 224, padding: 12, backgroundColor: "#ffffff", alignItems: "flex-start" }}
        >
          {visible ? (
            <ListBoxItem
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
              testID="list-item-native-target"
              id={id}
              textValue={textValue}
              isSelected={selected}
              isDisabled={disabled}
              isReadOnly={readonly}
              textSize={name === "small-text" ? "small" : name === "large-text" || narrow ? "large" : "medium"}
              onLayout={layout}
              onPressIn={(event) => {
                record("in", event)
                if (name === "held-disabled") setCanceled(true)
              }}
              onPressOut={(event) => record("out", event)}
              onPress={(event) => {
                record("press", event)
                setActions((old) => old + 1)
                if (name === "echo" || name === "restored") setOwnedSelected((old) => !old)
              }}
              customStyles={{
                width,
                padding,
                borderRadius: radius,
                ...(zero || small ? { height: zero ? 0 : 24, overflow: "hidden" } : {}),
                ...(mode === "motion" ? { backgroundColor: background } : {}),
                ...(rootCustom ? { backgroundColor: "#bb3322", borderWidth: 2, borderColor: "#2f7d18" } : {}),
                ...(name === "foreground" ? { color: "#b73434" } : {}),
              }}
              style={
                name === "final-style"
                  ? (state) => ({
                      backgroundColor: state.defaultStyle.backgroundColor === "#bb3322" ? "#117733" : "#ff00ff",
                    })
                  : undefined
              }
              render={
                name === "renderer"
                  ? (props, state) => (
                      <Pressable
                        {...props}
                        nativeID={state.isSelected ? "list-item-selected" : "list-item-available"}
                      />
                    )
                  : undefined
              }
            >
              {name === "child-callback" ? (
                (state) => (state.isSelected ? "Selected content" : "Available content")
              ) : name === "explicit-child" ? (
                <Text color="#7a3bba">Authored foreground</Text>
              ) : undefined}
            </ListBoxItem>
          ) : null}
        </View>
        <View
          testID="list-item-native-reference-parent"
          collapsable={false}
          style={{ width: "100%", height: 224, padding: 12, backgroundColor: "#ffffff", alignItems: "flex-start" }}
        >
          {visible ? (
            <View
              testID="list-item-native-reference"
              collapsable={false}
              style={{
                width,
                minHeight: zero || small ? undefined : 44,
                height: zero ? 0 : small ? 24 : undefined,
                overflow: zero || small ? "hidden" : undefined,
                padding,
                borderRadius: radius,
                borderWidth: border,
                borderColor: "#2f7d18",
                justifyContent: "center",
                backgroundColor: background,
                opacity: disabled ? theme.opacity.disabled : 1,
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
