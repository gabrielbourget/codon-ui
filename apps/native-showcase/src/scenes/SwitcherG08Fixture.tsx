import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react"
import {
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  Text as RawText,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type TextStyle,
  type StyleProp,
} from "react-native"

import {
  Button,
  NativeThemeProvider,
  Text,
  ToggleSwitcher,
  useNativeTheme,
  type TNativeToggleSwitcherItem,
} from "@codon-ui/react-native"

const BEHAVIOR = [
  "baseline",
  "echo",
  "reselected",
  "disabled",
  "held-readonly",
  "restored",
  "member-disabled",
  "empty-key",
  "reversed",
  "removed",
  "reinserted",
  "empty-items",
  "items-restored",
  "local",
  "default-changed",
  "authored",
  "authored-grown",
  "replaced",
  "retired",
  "fresh",
] as const
const STYLES = [
  "style-baseline",
  "natural",
  "vertical",
  "reverse",
  "selected-b",
  "readonly",
  "primary",
  "root-custom",
  "options-custom",
  "selected-slot",
  "final-root",
  "orthogonal",
  "round",
  "raised",
  "uppercase",
  "font-weights",
  "fractional",
  "percentage",
  "auto",
  "zero",
  "long-narrow",
  "provider",
  "dark",
  "light-restored",
] as const
const LONG = "Conserver tous les paramètres de notification."
type TMode = "behavior" | "styles" | "motion"
type TLayout = {
  target: number | null
  currentTarget: number | null
  layout: { x: number; y: number; width: number; height: number }
}
const tag = (value: unknown) =>
  typeof value === "number" ? value : value == null ? null : findNodeHandle(value as View)
type TAuthoredLabelActions = { grow: () => void }
const AuthoredLabel = forwardRef<
  TAuthoredLabelActions,
  { original: Ref<View>; report: (text: string) => void; style: StyleProp<TextStyle> }
>(({ original, report, style }, actions) => {
  const [text, setText] = useState("Short")
  useImperativeHandle(actions, () => ({ grow: () => setText("Longer original label") }), [])
  useLayoutEffect(() => report(text), [report, text])
  return (
    <RawText ref={original} style={style}>
      {text}
    </RawText>
  )
})
export const SwitcherG08Fixture = () => {
  const theme = useNativeTheme(),
    { scale } = useWindowDimensions(),
    minimum = Platform.OS === "ios" ? 44 : 48
  const [mode, setMode] = useState<TMode>("behavior"),
    [index, setIndex] = useState(0),
    [owner, setOwner] = useState("a"),
    [held, setHeld] = useState(false)
  const [requests, setRequests] = useState<{ case: string; key: string; epochMs: number }[]>([]),
    [events, setEvents] = useState<
      { phase: string; target: number | null; currentTarget: number | null; epochMs: number }[]
    >([])
  const [rootTag, setRootTag] = useState<number | null>(null),
    [labelTag, setLabelTag] = useState<number | null>(null),
    [layouts, setLayouts] = useState<TLayout[]>([])
  const [referenceAtOrigin, setReferenceAtOrigin] = useState(false),
    [referenceWidth, setReferenceWidth] = useState<number>()
  const [motionSelected, setMotionSelected] = useState(false),
    [motionVisible, setMotionVisible] = useState(true),
    [lifetime, setLifetime] = useState(0)
  const [motionEvents, setMotionEvents] = useState<boolean[]>([]),
    [motionTrace, setMotionTrace] = useState<{ name: string; epochMs: number }[]>([])
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const authoredActions = useRef<TAuthoredLabelActions>(null)
  const [authoredText, setAuthoredText] = useState("Short")
  useEffect(() => {
    let live = true
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      if (live) setMotionEvents((old) => [...old, value])
    })
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (live) setMotionEvents((old) => (old.length ? old : [value]))
    })
    return () => {
      live = false
      listener.remove()
      for (const timer of timers.current) clearTimeout(timer)
    }
  }, [])
  const cases = mode === "styles" ? STYLES : BEHAVIOR,
    name = mode === "motion" ? "motion" : cases[index]
  const visible = mode === "motion" ? motionVisible : name !== "retired",
    disabled = name === "disabled",
    readonly = name === "readonly" || (name === "held-readonly" && held)
  const empty = name === "empty-items",
    missing = name === "removed",
    reversed = name === "reversed",
    narrow = name === "long-narrow",
    authored = name === "authored" || name === "authored-grown",
    grown = name === "authored-grown"
  const natural = name === "natural" || authored,
    auto = name === "auto",
    zero = name === "zero",
    vertical = name === "vertical",
    rowReverse = name === "reverse"
  const rootCustom = name === "root-custom" || name === "final-root",
    optionCustom = name === "options-custom",
    selectedCustom = name === "selected-slot",
    fontCustom = name === "font-weights"
  const raised = name === "raised" || (mode === "motion" && motionSelected),
    geometry = name === "orthogonal" ? "orthogonal" : name === "round" ? "round" : "rounded"
  const rootWidth = natural
    ? undefined
    : auto
      ? "auto"
      : zero
        ? 0
        : name === "percentage"
          ? "80%"
          : name === "fractional"
            ? 183.25
            : narrow
              ? 190
              : 240
  const rootHeight = zero ? 0 : undefined,
    fontSize = zero ? 0 : fontCustom ? 16 : 12
  const selected =
    mode === "motion" ? (motionSelected ? "b" : "a") : name === "empty-key" ? "" : name === "selected-b" ? "b" : owner
  const local = name === "local" || name === "default-changed",
    primary = name === "primary",
    provider = name === "provider"
  const foreground =
    mode === "motion"
      ? "#bb3322"
      : primary
        ? theme.actions.primary.background
        : provider
          ? "#7e22ce"
          : theme.colors.controlSelectedBackground
  const rootBackground =
    mode === "motion"
      ? motionSelected
        ? "#aa7744"
        : "#113355"
      : name === "final-root"
        ? "#117733"
        : rootCustom
          ? "#ddeeff"
          : provider
            ? "#e5e0f0"
            : theme.colors.surfaceMuted
  const rootBorder = rootCustom ? "#2f7d18" : provider ? "#7e22ce" : theme.colors.borderMuted,
    border = rootCustom ? 2 : 1,
    padding = rootCustom ? 7 : 2
  const radius = geometry === "round" ? theme.radius.round : geometry === "orthogonal" ? 0 : theme.radius.rounded
  const rootStyle = useMemo(
    () => ({
      backgroundColor: rootCustom ? "#ddeeff" : rootBackground,
      borderColor: rootBorder,
      borderWidth: border,
      padding,
      ...(mode === "motion" ? { color: "#117733" } : {}),
      ...(vertical
        ? { flexDirection: "column" as const }
        : rowReverse
          ? { flexDirection: "row-reverse" as const }
          : {}),
      ...(zero ? { overflow: "hidden" as const } : {}),
    }),
    [rootCustom, rootBackground, rootBorder, border, padding, vertical, rowReverse, zero, mode],
  )
  const commonStyle = useMemo(
    () =>
      optionCustom
        ? {
            backgroundColor: "#f8e8cc",
            color: "#bb3322",
            fontSize: 16,
            paddingHorizontal: 9,
            borderWidth: 1,
            borderColor: "#2f7d18",
          }
        : undefined,
    [optionCustom],
  )
  const selectedStyle = useMemo(
    () => (selectedCustom ? { backgroundColor: "#d5f0df", color: "#117733", fontWeight: "800" as const } : undefined),
    [selectedCustom],
  )
  const bindRoot = useCallback((node: View | null) => setRootTag(node ? findNodeHandle(node) : null), [])
  const bindLabel = useCallback((node: View | null) => setLabelTag(node ? findNodeHandle(node) : null), [])
  const authoredLabel = useMemo(
    () => (
      <AuthoredLabel
        ref={authoredActions}
        original={bindLabel}
        report={setAuthoredText}
        style={{ fontSize, fontWeight: theme.typography.fontWeights.regular, color: theme.colors.foreground }}
      />
    ),
    [bindLabel, fontSize, theme],
  )
  const itemDescriptions = useMemo(() => {
    if (empty) return []
    const entries = [
      {
        id: "a",
        text: authored ? authoredText : narrow ? LONG : "First",
        label: "First choice",
        disabled: false,
      },
      { id: "b", text: "Second", label: "Second choice", disabled: name === "member-disabled" },
      { id: "", text: "None", label: "Empty choice", disabled: false },
    ].filter((item) => !missing || item.id !== "b")
    return reversed ? entries.reverse() : entries
  }, [empty, authored, authoredText, narrow, name, missing, reversed])
  const items = useMemo<readonly TNativeToggleSwitcherItem[]>(
    () =>
      itemDescriptions.map((item) => ({
        id: item.id,
        label: item.id === "a" && authored ? authoredLabel : item.text,
        accessibilityLabel: item.label,
        disabled: item.disabled,
      })),
    [itemDescriptions, authored, authoredLabel],
  )
  const layout = (event: LayoutChangeEvent) => {
    const row = {
      target: tag(event.target),
      currentTarget: tag(event.currentTarget),
      layout: { ...event.nativeEvent.layout },
    }
    setLayouts((old) => {
      const last = old.at(-1)
      return last?.currentTarget === row.currentTarget && JSON.stringify(last.layout) === JSON.stringify(row.layout)
        ? old
        : [...old, row]
    })
  }
  const changeMode = (next: TMode) => {
    for (const timer of timers.current) clearTimeout(timer)
    timers.current = []
    setMode(next)
    setIndex(0)
    setOwner("a")
    setHeld(false)
    setRequests([])
    setEvents([])
    setReferenceAtOrigin(false)
    setMotionSelected(false)
    setMotionVisible(true)
    setMotionTrace([])
    setLifetime((old) => old + 1)
  }
  const arm = () => {
    for (const timer of timers.current) clearTimeout(timer)
    setMotionSelected(false)
    setMotionVisible(true)
    setMotionTrace([])
    const schedule = (delay: number, name: string, action: () => void) =>
      setTimeout(() => {
        const epochMs = Date.now()
        setMotionTrace((old) => [...old, { name, epochMs }])
        action()
      }, delay)
    timers.current = [
      ...Array.from({ length: 40 }, (_, i) =>
        schedule(3000 + i * 150, `retarget-${i}`, () => setMotionSelected(i % 2 === 0)),
      ),
      schedule(10000, "settle", () => setMotionSelected(true)),
      schedule(12000, "retire", () => setMotionVisible(false)),
      schedule(14000, "fresh", () => {
        setLifetime((old) => old + 1)
        setMotionVisible(true)
      }),
    ]
  }
  const snapshot = {
    mode,
    case: name,
    selected,
    owner,
    requests,
    events,
    rootTag,
    labelTag,
    layouts,
    scale,
    visible,
    disabled,
    readonly,
    held,
    items: itemDescriptions,
    rootWidth: rootWidth ?? null,
    rootHeight: rootHeight ?? null,
    rootBackground,
    rootBorder,
    border,
    padding,
    radius,
    fontSize,
    natural,
    zero,
    narrow,
    authored,
    grown,
    local,
    vertical,
    rowReverse,
    referenceWidth: referenceWidth ?? null,
    referenceAtOrigin,
    themeMode: theme.mode,
    motionSelected,
    motionEvents,
    motionTrace,
  }
  const count = itemDescriptions.length,
    bounded = rootWidth !== undefined && rootWidth !== "auto",
    column =
      bounded && referenceWidth !== undefined
        ? Math.max(
            0,
            vertical
              ? referenceWidth - 2 * (padding + border)
              : (referenceWidth - 2 * (padding + border) - 2 * Math.max(0, count - 1)) / Math.max(1, count),
          )
        : undefined
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["behavior", "styles", "motion"] as const).map((next) => (
          <Button key={next} raised={false} onPress={() => changeMode(next)}>
            Switcher {next} checks
          </Button>
        ))}
      </View>
      <Text testID="switcher-native-state" accessibilityLabel={JSON.stringify(snapshot)} numberOfLines={1}>
        Switcher check: {name}
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
            Arm Switcher motion and retirement
          </Button>
        </>
      ) : (
        <Button
          raised={false}
          onPress={() => {
            const next = (index + 1) % cases.length
            if (cases[next] === "local") setOwner("a")
            setIndex(next)
            setHeld(false)
            setReferenceAtOrigin(false)
          }}
        >
          Next Switcher check
        </Button>
      )}
      {authored ? (
        <Button raised={false} onPress={() => authoredActions.current?.grow()}>
          Grow Switcher label
        </Button>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button raised={false} onPress={() => setReferenceAtOrigin(false)}>
          Switcher component
        </Button>
        <Button raised={false} onPress={() => setReferenceAtOrigin(true)}>
          Switcher reference
        </Button>
      </View>
      <View testID="switcher-native-pair" collapsable={false} style={{ width: "100%", maxWidth: 280, height: 456 }}>
        <View
          testID="switcher-native-parent"
          collapsable={false}
          style={{ width: "100%", height: 224, padding: 12, backgroundColor: "#ffffff", alignItems: "flex-start" }}
        >
          <NativeThemeProvider
            mode={theme.mode}
            overrides={
              provider
                ? { colors: { surfaceMuted: "#e5e0f0", borderMuted: "#7e22ce", controlSelectedBackground: "#7e22ce" } }
                : undefined
            }
          >
            {visible ? (
              <ToggleSwitcher
                key={
                  local
                    ? "local"
                    : name === "replaced"
                      ? "replaced"
                      : name === "fresh"
                        ? "fresh"
                        : mode === "motion"
                          ? `motion-${lifetime}`
                          : "original"
                }
                ref={bindRoot}
                testID="switcher-native-target"
                accessibilityLabel="Match mode"
                items={items}
                selectedKey={local ? undefined : selected}
                defaultSelectedKey={local ? (name === "default-changed" ? "" : "a") : undefined}
                onSelectionChange={(key) => {
                  const row = { case: name, key, epochMs: Date.now() }
                  setRequests((old) => [...old, row])
                  if (name !== "baseline") setOwner(key)
                }}
                isDisabled={disabled}
                isReadOnly={readonly}
                width={rootWidth}
                height={rootHeight}
                fontSize={fontSize}
                geometry={geometry}
                raised={raised}
                color={mode === "motion" ? "#bb3322" : undefined}
                order={primary ? "primary" : undefined}
                uppercase={name === "uppercase"}
                optionFontWeight={fontCustom ? "bold" : undefined}
                selectedOptionFontWeight={fontCustom ? "extrabold" : undefined}
                customStyles={rootStyle}
                customOptionStyles={commonStyle}
                customSelectedOptionStyles={selectedStyle}
                style={
                  name === "final-root"
                    ? (state) => ({
                        backgroundColor: state.defaultStyle.backgroundColor === "#ddeeff" ? "#117733" : "#ff00ff",
                      })
                    : undefined
                }
                onLayout={layout}
                onTouchStart={(event) => {
                  const row = {
                    phase: "down",
                    target: tag(event.target),
                    currentTarget: tag(event.currentTarget),
                    epochMs: Date.now(),
                  }
                  setEvents((old) => [...old, row])
                  if (name === "held-readonly") setHeld(true)
                }}
              />
            ) : null}
          </NativeThemeProvider>
        </View>
        <View
          testID="switcher-native-reference-parent"
          collapsable={false}
          style={{
            ...(referenceAtOrigin ? { position: "absolute" as const, top: 0, left: 0 } : { marginTop: 8 }),
            width: "100%",
            height: 224,
            padding: 12,
            backgroundColor: "#ffffff",
            alignItems: "flex-start",
          }}
        >
          {visible ? (
            <View
              testID="switcher-native-reference"
              collapsable={false}
              onLayout={(event) => {
                const width = event.nativeEvent.layout.width
                setReferenceWidth((old) => (old !== undefined && Math.abs(old - width) < 0.001 ? old : width))
              }}
              style={{
                width: rootWidth,
                height: rootHeight,
                alignSelf: "flex-start",
                maxWidth: "100%",
                padding,
                borderWidth: border,
                backgroundColor: rootBackground,
                borderColor: rootBorder,
                borderRadius: radius,
                opacity: disabled || readonly ? theme.opacity.disabled : 1,
                flexDirection: "column",
                ...(zero ? { overflow: "hidden" as const } : {}),
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
              <View
                testID="switcher-native-reference-row"
                style={{
                  flexDirection: vertical ? "column" : rowReverse ? "row-reverse" : "row",
                  gap: 2,
                  alignItems: "stretch",
                  alignSelf: "stretch",
                  flexGrow: rootHeight !== undefined ? 1 : 0,
                }}
              >
                {itemDescriptions.map((item) => {
                  const current = item.id === selected,
                    backgroundColor =
                      selectedCustom && current
                        ? "#d5f0df"
                        : optionCustom
                          ? "#f8e8cc"
                          : current
                            ? theme.colors.controlBackground
                            : "transparent",
                    color =
                      selectedCustom && current
                        ? "#117733"
                        : optionCustom
                          ? "#bb3322"
                          : current
                            ? foreground
                            : mode === "motion"
                              ? "#117733"
                              : theme.colors.controlForeground,
                    weight =
                      selectedCustom && current
                        ? theme.typography.fontWeights.extrabold
                        : fontCustom
                          ? current
                            ? theme.typography.fontWeights.extrabold
                            : theme.typography.fontWeights.bold
                          : current
                            ? theme.typography.fontWeights.semibold
                            : theme.typography.fontWeights.regular
                  return (
                    <View
                      key={item.id}
                      testID={`switcher-native-reference-option-${item.id === "" ? "empty" : item.id}`}
                      collapsable={false}
                      style={{
                        width: column,
                        minWidth: column === undefined ? minimum : undefined,
                        height: rootHeight !== undefined ? "100%" : undefined,
                        minHeight: rootHeight !== undefined ? undefined : minimum,
                        flexShrink: 0,
                        alignSelf: "stretch",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        paddingHorizontal: optionCustom ? 9 : theme.spacing.unit,
                        paddingVertical: 2,
                        overflow: "hidden",
                        borderRadius: radius,
                        backgroundColor,
                        ...(optionCustom ? { borderWidth: 1, borderColor: "#2f7d18" } : {}),
                      }}
                    >
                      {current ? (
                        <View
                          testID="switcher-native-reference-selected-surface"
                          collapsable={false}
                          accessible={false}
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            top: 0,
                            right: 0,
                            bottom: 0,
                            left: 0,
                            backgroundColor,
                            borderRadius: radius,
                            opacity: 1,
                            transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
                          }}
                        />
                      ) : null}
                      <View style={{ flexShrink: 1, zIndex: 1 }}>
                        <RawText
                          accessible={false}
                          selectable={false}
                          style={
                            authored && item.id === "a"
                              ? {
                                  fontSize,
                                  fontWeight: theme.typography.fontWeights.regular,
                                  color: theme.colors.foreground,
                                }
                              : {
                                  fontSize: optionCustom ? 16 : fontSize,
                                  color,
                                  fontWeight: weight,
                                  fontFamily: theme.typography.fontFamilies.body,
                                  lineHeight: theme.typography.lineHeight,
                                  fontStyle: "normal",
                                  textAlign: "center",
                                  letterSpacing: 0,
                                  textTransform: name === "uppercase" ? "uppercase" : "none",
                                }
                          }
                        >
                          {item.text}
                        </RawText>
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}
