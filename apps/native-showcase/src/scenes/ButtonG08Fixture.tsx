import { useCallback, useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  findNodeHandle,
  Text as RawText,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native"

import { Button, Text, NativeFocusView, useNativeTheme, type TNativeButtonProps } from "@codon-ui/react-native"

const BEHAVIOR = [
  "baseline",
  "repeated",
  "disabled",
  "held-disabled",
  "restored",
  "pending",
  "held-pending",
  "pending-restored",
  "renderer",
  "replaced",
  "retired",
  "fresh",
  "focus-excluded",
  "long-press",
] as const
const STYLES = [
  "style-baseline",
  "flat",
  "outline",
  "primary",
  "secondary",
  "transparent",
  "root-custom",
  "final-style",
  "foreground",
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
export const ButtonG08Fixture = () => {
  const theme = useNativeTheme()
  const { scale } = useWindowDimensions()
  const [mode, setMode] = useState<TMode>("behavior")
  const [index, setIndex] = useState(0)
  const [ownedSelected, setOwnedSelected] = useState(false)
  const [actions, setActions] = useState(0)
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
  const selected = ownedSelected
  const visible = mode === "motion" ? motionVisible : name !== "retired"
  const disabled = name === "disabled" || (name === "held-disabled" && canceled)
  const pending = name === "pending" || (name === "held-pending" && canceled)
  const narrow = name === "long-narrow"
  const label = narrow ? LONG_LABEL : "Save settings"
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
  const order = (["primary", "secondary"].includes(name) ? name : undefined) as TNativeButtonProps["order"]
  const outlined = name === "outline"
  const transparent = name === "transparent"
  const action = order ? theme.actions[order] : undefined
  const background =
    mode === "motion"
      ? selected
        ? "#117733"
        : "#bb3322"
      : name === "final-style"
        ? "#117733"
        : custom
          ? "#bb3322"
          : transparent || outlined
            ? "transparent"
            : (action?.background ?? theme.colors.background)
  const foreground =
    name === "explicit-child"
      ? "#7a3bba"
      : name === "foreground"
        ? "#b73434"
        : outlined
          ? "#265b99"
          : (action?.foreground ?? theme.colors.foreground)
  const borderColor = custom ? "#2f7d18" : outlined ? "#265b99" : (action?.border ?? theme.colors.controlBorder)
  const fontSize = theme.typography.fontSizes[narrow ? "b9" : "b10"]
  const padding = zero || small ? 0 : theme.spacing.unit
  const radius = name === "square" ? 0 : name === "round" ? theme.radius.round : theme.radius.rounded
  const raised = name === "style-baseline"
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
    phases,
    selected,
    disabled,
    canceled,
    visible,
    pending,
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
    hasShadow: raised || mode === "motion",
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
    setActions(0)
    setPhases([])
    setCanceled(false)
    setEvents([])
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
      ...Array.from({ length: 20 }, (_, index) =>
        schedule(3000 + index * 180, `retarget-${index}`, () => setOwnedSelected(index % 2 === 0)),
      ),
      schedule(7000, "settle", () => setOwnedSelected(true)),
      schedule(8250, "retire", () => setMotionVisible(false)),
      schedule(10250, "fresh", () => {
        setMotionLifetime((old) => old + 1)
        setMotionVisible(true)
      }),
    ]
  }

  const target = visible ? (
    <Button
      key={
        name === "focus-excluded"
          ? "focus-excluded"
          : name === "replaced"
            ? "replaced"
            : name === "fresh"
              ? "fresh"
              : mode === "motion"
                ? `motion-${motionLifetime}`
                : "original"
      }
      ref={bind}
      testID="button-native-target"
      accessibilityLabel={label}
      isDisabled={disabled}
      isPending={pending}
      focusable={name !== "focus-excluded"}
      tabIndex={name === "focus-excluded" ? -1 : undefined}
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
      order={order}
      colorMode={outlined ? "outline" : "fill"}
      color={outlined ? "#265b99" : undefined}
      transparent={transparent}
      geometry={name === "square" ? "orthogonal" : name === "round" ? "round" : "rounded"}
      onPressStart={(event) => {
        record("start", event)
        setPhases((old) => [...old, "start"])
      }}
      onPressUp={(event) => {
        record("up", event)
        setPhases((old) => [...old, "up"])
      }}
      onPressEnd={(event) => {
        record("end", event)
        setPhases((old) => [...old, "end"])
      }}
      onPressChange={(value) => setPhases((old) => [...old, value ? "change:true" : "change:false"])}
      onLongPress={
        name === "long-press"
          ? (event) => {
              record("long", event)
              setPhases((old) => [...old, "long"])
            }
          : undefined
      }
      onPressIn={(event) => {
        record("in", event)
        if (name === "held-disabled" || name === "held-pending") setCanceled(true)
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
        ...(mode === "motion"
          ? {
              backgroundColor: background,
              shadowColor: "#000000",
              shadowOpacity: selected ? 0.4 : 0,
              shadowOffset: { width: 0, height: 6 },
              shadowRadius: 0,
              elevation: 0,
            }
          : {}),
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
              <NativeFocusView {...props} nativeID={state.isPending ? "button-pending" : "button-available"} />
            )
          : undefined
      }
    >
      {(_state) => {
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
    </Button>
  ) : null
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["behavior", "styles", "motion"] as const).map((value) => (
          <Button key={value} raised={false} onPress={() => changeMode(value)}>
            Button {value} checks
          </Button>
        ))}
      </View>
      <Text testID="button-native-state" accessibilityLabel={JSON.stringify(snapshot)} numberOfLines={1}>
        Button check: {name}; actions {actions}
      </Text>
      {mode === "motion" ? (
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Button raised={false} onPress={() => setOwnedSelected(false)}>
            First
          </Button>
          <Button raised={false} onPress={() => setOwnedSelected(true)}>
            Second
          </Button>
          <Button raised={false} onPress={() => setReferenceAtOrigin(true)}>
            Reference
          </Button>
          <Button raised={false} onPress={() => setReferenceAtOrigin(false)}>
            Component
          </Button>
        </View>
      ) : null}
      {mode === "motion" ? (
        <Button raised={false} onPress={arm}>
          Arm Button motion and retirement
        </Button>
      ) : (
        <Button
          raised={false}
          onPress={() => {
            setIndex((old) => (old + 1) % cases.length)
            setCanceled(false)
            setReferenceAtOrigin(false)
          }}
        >
          Next Button check
        </Button>
      )}
      {raised ? (
        <Button raised={false} onPress={() => setReferenceAtOrigin(true)}>
          Match raised reference position
        </Button>
      ) : null}
      <View
        testID="button-native-pair"
        collapsable={false}
        style={{ width: narrow ? 120 : "100%", maxWidth: 280, gap: 8 }}
      >
        <View
          testID="button-native-parent"
          collapsable={false}
          style={{ width: "100%", height: 224, padding: 12, backgroundColor: "#ffffff", alignItems: "flex-start" }}
        >
          {target}
        </View>
        <View
          testID="button-native-reference-parent"
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
              testID="button-native-reference"
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
                borderWidth: zero ? 0 : outlined ? 2 : 0,
                borderColor,
                backgroundColor: background,
                opacity: disabled ? theme.opacity.disabled : 1,
                ...(focused && focusVisible && !disabled
                  ? { outlineColor: theme.colors.focusRing, outlineWidth: 1.5, outlineOffset: 1.5 }
                  : {}),
                ...(mode === "motion"
                  ? {
                      shadowColor: "#000000",
                      shadowOpacity: selected ? 0.4 : 0,
                      shadowOffset: { width: 0, height: 6 },
                      shadowRadius: 0,
                      elevation: 0,
                    }
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
