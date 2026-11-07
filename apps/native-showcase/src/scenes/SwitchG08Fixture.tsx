import { Children, cloneElement, isValidElement, useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  Text as RawText,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ViewStyle,
  type ColorValue,
  type TextStyle,
  type PressableProps,
} from "react-native"

import { Button, Switch, Text, useNativeTheme } from "@codon-ui/react-native"

const BEHAVIOR = [
  "baseline",
  "echo",
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
] as const
const STYLES = [
  "style-baseline",
  "selected",
  "border",
  "inverted",
  "primary",
  "root-custom",
  "final-style",
  "parts-custom",
  "authored-left",
  "orthogonal",
  "round",
  "icons",
  "long-narrow",
  "fractional",
  "percentage",
  "track-small",
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
type TReference = {
  root: ViewStyle
  track: ViewStyle
  indicator: ViewStyle
  selected: boolean
  display: string
  font: number
  foreground: ColorValue
  family: string | undefined
  weight: TextStyle["fontWeight"]
  lineHeight: number | undefined
  gap: number
  icons: boolean
  iconColor: ColorValue
}

const RawSwitch = ({ model }: { model: TReference }) => {
  const [bounds, setBounds] = useState<{ width: number; height: number }>()
  const [indicatorWidth, setIndicatorWidth] = useState<number>()
  const size = bounds?.height ?? Math.max(0, Number(model.track.height) - 2 * Number(model.track.borderWidth))
  const extent = Math.max(
    0,
    (bounds?.width ?? (typeof model.track.width === "number" ? model.track.width : 0)) - (indicatorWidth ?? size),
  )
  return (
    <View testID="switch-native-reference" collapsable={false} style={model.root}>
      <View testID="switch-native-reference-track" style={model.track}>
        <View
          testID="switch-native-reference-content"
          style={{ flex: 1, position: "relative" }}
          onLayout={({ nativeEvent: { layout } }) =>
            setBounds((old) =>
              old?.width === layout.width && old.height === layout.height
                ? old
                : { width: layout.width, height: layout.height },
            )
          }
        >
          {model.icons ? (
            <View style={{ flexDirection: "row", height: "100%" }}>
              {["✓", "×"].map((text, index) => (
                <View
                  key={text}
                  style={{
                    width: "50%",
                    justifyContent: "center",
                    alignItems: index ? "flex-end" : "flex-start",
                    ...(index ? { paddingRight: 3 } : { paddingLeft: 3 }),
                  }}
                >
                  <RawText
                    accessible={false}
                    selectable={false}
                    style={{
                      fontSize: 10,
                      color: model.iconColor,
                      fontFamily: model.family,
                      fontWeight: model.weight,
                      fontStyle: "normal",
                      lineHeight: model.lineHeight,
                    }}
                  >
                    {text}
                  </RawText>
                </View>
              ))}
            </View>
          ) : null}
          <View
            testID="switch-native-reference-indicator"
            style={{
              position: "absolute",
              top: 0,
              left: model.selected ? extent : 0,
              width: size,
              height: size,
              ...model.indicator,
            }}
            onLayout={({ nativeEvent: { layout } }) =>
              setIndicatorWidth((old) => (old === layout.width ? old : layout.width))
            }
          />
        </View>
      </View>
      {model.display ? (
        <RawText
          testID="switch-native-reference-text"
          accessible={false}
          selectable={false}
          style={{
            flexShrink: 1,
            color: model.foreground,
            fontSize: model.font,
            fontFamily: model.family,
            fontWeight: model.weight,
            fontStyle: "normal",
            lineHeight: model.lineHeight,
          }}
        >
          {model.display}
        </RawText>
      ) : null}
    </View>
  )
}

export const SwitchG08Fixture = () => {
  const theme = useNativeTheme(),
    { scale } = useWindowDimensions()
  const [mode, setMode] = useState<TMode>("behavior"),
    [index, setIndex] = useState(0)
  const [owned, setOwned] = useState(false),
    [localValue, setLocalValue] = useState(false)
  const [actions, setActions] = useState(0),
    [requests, setRequests] = useState<boolean[]>([]),
    [phases, setPhases] = useState<string[]>([])
  const [canceled, setCanceled] = useState(false),
    [rootTag, setRootTag] = useState<number | null>(null),
    [layouts, setLayouts] = useState<TLayout[]>([])
  const [events, setEvents] = useState<
    { phase: string; target: number | null; currentTarget: number | null; epochMs: number }[]
  >([])
  const [referenceAtOrigin, setReferenceAtOrigin] = useState(false)
  const [recordMotionLayouts, setRecordMotionLayouts] = useState(false)
  const [motionEvents, setMotionEvents] = useState<boolean[]>([]),
    [motionVisible, setMotionVisible] = useState(true),
    [motionTrace, setMotionTrace] = useState<{ name: string; epochMs: number }[]>([]),
    [motionLifetime, setMotionLifetime] = useState(0)
  const motionLayouts = useRef<
    {
      part: string
      epochMs: number
      target: number | null
      currentTarget: number | null
      rootTag: number | null
      layout: { x: number; y: number; width: number; height: number }
    }[]
  >([])
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
  const local = name === "local" || name === "local-default-changed"
  const selected =
    mode === "styles"
      ? [
          "selected",
          "border",
          "inverted",
          "primary",
          "parts-custom",
          "authored-left",
          "dark",
          "light-restored",
        ].includes(name)
      : local
        ? localValue
        : owned
  const visible = mode === "motion" ? motionVisible : name !== "retired"
  const disabled = name === "disabled" || (name === "held-disabled" && canceled),
    readonly = name === "readonly"
  const zero = name === "zero",
    small = name === "root-small",
    narrow = name === "long-narrow"
  const parts = name === "parts-custom" || name === "authored-left",
    border = name === "border" || name === "inverted",
    inverted = name === "inverted",
    primary = name === "primary"
  const raised = name === "style-baseline",
    icons = name === "icons"
  const trackWidth = parts ? 90 : name === "fractional" ? 73.25 : name === "track-small" ? 16 : 30
  const trackHeight = parts ? 26 : name === "fractional" ? 13.75 : name === "track-small" ? 8 : 15
  const custom = name === "root-custom" || name === "final-style"
  const rootWidth = zero ? 0 : small ? 24 : narrow ? 140 : custom || name === "percentage" ? 200 : undefined
  const rootHeight = zero ? 0 : small ? 24 : undefined
  const background =
    mode === "motion"
      ? selected
        ? "#117733"
        : "#bb3322"
      : parts
        ? "#265b99"
        : selected
          ? inverted
            ? theme.colors.controlTrackInvertedBackground
            : primary
              ? theme.actions.primary.background
              : theme.colors.controlSelectedBackground
          : theme.colors.controlTrackBackground
  const indicator =
    mode === "motion"
      ? "#ffffff"
      : parts
        ? "#abcdef"
        : selected && inverted
          ? theme.colors.controlSelectedBackground
          : theme.colors.controlSelectedForeground
  const borderColor = selected && inverted ? theme.colors.controlSelectedBackground : theme.colors.controlBorder
  const radius = name === "orthogonal" ? 0 : theme.radius.round
  const display = narrow ? LONG_LABEL : "",
    font = theme.typography.fontSizes[narrow ? "b9" : "b10"]
  const rootBackground = name === "final-style" ? "#117733" : custom ? "#bb3322" : undefined
  const root: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.unit,
    minWidth: rootWidth === undefined ? 44 : undefined,
    minHeight: rootHeight === undefined ? 44 : undefined,
    width: rootWidth,
    height: rootHeight,
    opacity: disabled ? theme.opacity.disabled : 1,
    ...(zero || small ? { overflow: "hidden" } : {}),
    ...(custom ? { backgroundColor: rootBackground, padding: 4 } : {}),
  }
  const track: ViewStyle = {
    width: name === "percentage" ? "50%" : trackWidth,
    height: trackHeight,
    backgroundColor: background,
    borderRadius: radius,
    borderWidth: border ? 1.5 : 0,
    borderColor,
  }
  const thumb: ViewStyle = {
    backgroundColor: indicator,
    borderRadius: radius,
    ...(parts ? { width: 17, height: 17, borderRadius: 3 } : {}),
    ...(name === "authored-left" ? { left: 5 } : {}),
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
  const model: TReference = {
    root,
    track,
    indicator: thumb,
    selected,
    display,
    font,
    foreground: theme.colors.foreground,
    family: theme.typography.fontFamilies.body,
    weight: theme.typography.fontWeights.regular,
    lineHeight: theme.typography.lineHeight,
    gap: theme.spacing.unit,
    icons,
    iconColor: theme.colors.controlSelectedForeground,
  }
  const tag = (node: unknown) => (typeof node === "number" ? node : node == null ? null : findNodeHandle(node as View))
  const bind = useCallback((node: View | null) => setRootTag(node ? findNodeHandle(node) : null), [])
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
  const inspectMotionChildren = (children: ReactNode): ReactNode =>
    Children.map(children, (child) => {
      if (
        !isValidElement<{ children?: ReactNode; testID?: string; onLayout?: (event: LayoutChangeEvent) => void }>(child)
      )
        return child
      const { testID, onLayout } = child.props
      const measured = testID === "switch-native-target-track-content" || testID === "switch-native-target-indicator"
      return cloneElement(child, {
        children: inspectMotionChildren(child.props.children),
        ...(measured
          ? {
              onLayout: (event: LayoutChangeEvent) => {
                motionLayouts.current.push({
                  part: testID,
                  epochMs: Date.now(),
                  target: tag(event.target),
                  currentTarget: tag(event.currentTarget),
                  rootTag,
                  layout: { ...event.nativeEvent.layout },
                })
                onLayout?.(event)
              },
            }
          : {}),
      })
    })
  const inspectMotionRootChildren = (children: PressableProps["children"]): PressableProps["children"] =>
    typeof children === "function" ? (state) => inspectMotionChildren(children(state)) : inspectMotionChildren(children)
  const changeMode = (next: TMode) => {
    motionLayouts.current = []
    setRecordMotionLayouts(false)
    for (const timer of timers.current) clearTimeout(timer)
    timers.current = []
    setMode(next)
    setIndex(0)
    setOwned(false)
    setLocalValue(false)
    setActions(0)
    setRequests([])
    setPhases([])
    setCanceled(false)
    setEvents([])
    setReferenceAtOrigin(false)
    setMotionVisible(true)
    setMotionTrace([])
    setMotionLifetime((old) => old + 1)
  }
  const arm = () => {
    motionLayouts.current = []
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
    phases,
    selected,
    disabled,
    readonly,
    canceled,
    visible,
    local,
    zero,
    small,
    narrow,
    label: "Keep settings",
    display,
    rootWidth,
    rootHeight,
    trackWidth,
    trackHeight,
    background,
    indicator,
    borderColor,
    radius,
    raised,
    referenceAtOrigin,
    themeMode: theme.mode,
    motionEvents,
    motionTrace,
    recordMotionLayouts,
    motionLayouts: !motionVisible || motionTrace.at(-1)?.name === "fresh" ? motionLayouts.current : [],
  }
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["behavior", "styles", "motion"] as const).map((value) => (
          <Button key={value} raised={false} onPress={() => changeMode(value)}>
            Switch {value} checks
          </Button>
        ))}
      </View>
      {mode === "motion" ? (
        <Button raised={false} onPress={() => setRecordMotionLayouts(true)}>
          Record native Switch layouts
        </Button>
      ) : null}
      <Text testID="switch-native-state" accessibilityLabel={JSON.stringify(snapshot)} numberOfLines={1}>
        Switch check: {name}; actions {actions}
      </Text>
      {mode === "motion" ? (
        <Button raised={false} onPress={arm}>
          Arm Switch motion and retirement
        </Button>
      ) : (
        <Button
          raised={false}
          onPress={() => {
            setIndex((old) => (old + 1) % cases.length)
            setReferenceAtOrigin(false)
          }}
        >
          Next Switch check
        </Button>
      )}
      {mode !== "motion" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Button raised={false} onPress={() => setReferenceAtOrigin(true)}>
            Show Switch reference
          </Button>
          <Button raised={false} onPress={() => setReferenceAtOrigin(false)}>
            Show Switch component
          </Button>
        </View>
      ) : null}
      <View
        testID="switch-native-pair"
        collapsable={false}
        style={{ width: "100%", maxWidth: 280, height: 456, position: "relative" }}
      >
        <View
          testID="switch-native-parent"
          collapsable={false}
          style={{ width: "100%", height: 224, padding: 12, backgroundColor: "#ffffff", alignItems: "flex-start" }}
        >
          <View style={{ opacity: referenceAtOrigin ? 0 : 1 }}>
            {visible ? (
              <Switch
                key={
                  local
                    ? "local"
                    : name === "replaced"
                      ? "replaced"
                      : name === "fresh"
                        ? "fresh"
                        : mode === "motion"
                          ? `motion-${motionLifetime}`
                          : "original"
                }
                ref={bind}
                testID="switch-native-target"
                accessibilityLabel="Keep settings"
                isSelected={local ? undefined : selected}
                defaultSelected={local ? name === "local-default-changed" : undefined}
                isDisabled={disabled}
                isReadOnly={readonly}
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
                  else if (name !== "baseline") setOwned(next)
                }}
                width={trackWidth}
                height={trackHeight}
                order={primary ? "primary" : undefined}
                geometry={name === "orthogonal" ? "orthogonal" : "round"}
                raised={raised}
                showBorder={border}
                invertColorsOnToggle={inverted}
                showOnOffIcons={icons}
                customStyles={{
                  ...(rootWidth !== undefined ? { width: rootWidth } : {}),
                  ...(rootHeight !== undefined ? { height: rootHeight } : {}),
                  ...(zero || small ? { overflow: "hidden" } : {}),
                  ...(custom ? { backgroundColor: "#bb3322", padding: 4 } : {}),
                }}
                customTrackStyles={
                  mode === "motion" || parts || name === "percentage"
                    ? {
                        ...(mode === "motion" || parts ? { backgroundColor: background } : {}),
                        ...(name === "percentage" ? { width: "50%" } : {}),
                      }
                    : undefined
                }
                customIndicatorStyles={
                  mode === "motion" || parts
                    ? {
                        ...(mode === "motion" ? { backgroundColor: "#ffffff" } : {}),
                        ...(parts ? { width: 17, height: 17, borderRadius: 3, backgroundColor: "#abcdef" } : {}),
                        ...(name === "authored-left" ? { left: 5 } : {}),
                      }
                    : undefined
                }
                style={
                  name === "final-style"
                    ? (state) => ({
                        backgroundColor: state.defaultStyle.backgroundColor === "#bb3322" ? "#117733" : "#ff00ff",
                      })
                    : undefined
                }
                render={
                  mode === "motion" && recordMotionLayouts
                    ? (props) => <Pressable {...props}>{inspectMotionRootChildren(props.children)}</Pressable>
                    : name === "renderer"
                      ? (props, state) => (
                          <Pressable {...props} nativeID={state.isSelected ? "switch-on" : "switch-off"} />
                        )
                      : undefined
                }
                rightContent={
                  display ? (
                    <Text variant="b9" style={{ flexShrink: 1 }}>
                      {display}
                    </Text>
                  ) : undefined
                }
              />
            ) : null}
          </View>
        </View>
        <View
          testID="switch-native-reference-parent"
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
          {visible ? <RawSwitch model={model} /> : null}
        </View>
      </View>
    </View>
  )
}
