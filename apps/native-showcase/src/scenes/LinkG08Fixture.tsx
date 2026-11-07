import { useCallback, useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  Text as RawText,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native"

import { Button, Link, NativeThemeProvider, Text, useNativeTheme } from "@codon-ui/react-native"

import { inspectNativeAccessibility } from "../../../../packages/react-native/src/input/accessibilityInspection"

const BEHAVIOR = [
  "baseline",
  "echo",
  "disabled",
  "held-disabled",
  "restored",
  "empty",
  "fragment",
  "relative",
  "small-hit-target",
  "replaced",
  "retired",
  "fresh",
  "alias-relationships",
  "attribute-relationships",
  "changed-targets",
  "removed-targets",
  "empty-relationships",
  "error",
  "handoff",
] as const
const STYLES = [
  "style-baseline",
  "primary",
  "visited",
  "visited-override",
  "provider-visited",
  "root-custom",
  "final-style",
  "explicit-child",
  "underline",
  "line-through",
  "fractional",
  "percentage",
  "auto",
  "small-target",
  "zero",
  "long-narrow",
  "dark",
  "light-restored",
] as const
const UNHANDLED = "codon-lab-unhandled://destination?value=0&empty="
const HANDOFF = "https://example.com/codon-native?value=0&empty="
const LONG = "Ouvrir les renseignements détaillés puis revenir aux paramètres de notification."
type TMode = "behavior" | "styles" | "motion"
type TLayout = {
  target: number | null
  currentTarget: number | null
  layout: { x: number; y: number; width: number; height: number }
}
export const LinkG08Fixture = () => {
  const theme = useNativeTheme(),
    { scale } = useWindowDimensions()
  const [mode, setMode] = useState<TMode>("behavior"),
    [index, setIndex] = useState(0)
  const [visited, setVisited] = useState(false),
    [canceled, setCanceled] = useState(false),
    [hrefChanged, setHrefChanged] = useState(false)
  const [requests, setRequests] = useState<
    {
      case: string
      href: string
      target: number | null
      currentTarget: number | null
      before: boolean
      after: boolean
    }[]
  >([])
  const [errors, setErrors] = useState<{ href: string; error: string }[]>([])
  const [events, setEvents] = useState<
    { phase: string; target: number | null; currentTarget: number | null; epochMs: number }[]
  >([])
  const [rootTag, setRootTag] = useState<number | null>(null),
    [layouts, setLayouts] = useState<TLayout[]>([])
  const [referenceAtOrigin, setReferenceAtOrigin] = useState(false)
  const [inspection, setInspection] = useState<Record<string, unknown> | null>(null),
    [inspectionSequence, setInspectionSequence] = useState(0)
  const [focused, setFocused] = useState(false),
    [focusVisible, setFocusVisible] = useState(false)
  const root = useRef<View | null>(null),
    inspectionRequest = useRef(0),
    live = useRef(true)
  const [motionSelected, setMotionSelected] = useState(false),
    [motionVisible, setMotionVisible] = useState(true),
    [motionLifetime, setMotionLifetime] = useState(0)
  const [motionTrace, setMotionTrace] = useState<{ name: string; epochMs: number }[]>([]),
    [motionEvents, setMotionEvents] = useState<boolean[]>([])
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    live.current = true
    let active = true
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      if (active) setMotionEvents((old) => [...old, value])
    })
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setMotionEvents((old) => (old.length ? old : [value]))
    })
    return () => {
      active = false
      live.current = false
      listener.remove()
      for (const timer of timers.current) clearTimeout(timer)
    }
  }, [])
  const cases = mode === "styles" ? STYLES : BEHAVIOR,
    name = mode === "motion" ? "motion" : cases[index]
  const visible = mode === "motion" ? motionVisible : name !== "retired",
    disabled = name === "disabled" || (name === "held-disabled" && canceled)
  const narrow = name === "long-narrow",
    zero = name === "zero",
    small = name === "small-target" || name === "small-hit-target",
    natural = name === "baseline" || name === "style-baseline"
  const styledVisited = ["visited", "visited-override", "provider-visited"].includes(name),
    selected = mode === "styles" ? styledVisited : visited
  const ordered =
    mode === "styles" &&
    ["primary", "visited", "visited-override", "provider-visited", "dark", "light-restored"].includes(name)
  const providerVisited = name === "provider-visited" ? "#7e22ce" : undefined
  const visitedColor = name === "visited-override" ? "#2f7d18" : undefined
  const custom = name === "root-custom" || name === "final-style"
  const explicit = name === "explicit-child"
  const foreground =
    mode === "motion"
      ? motionSelected
        ? "#117733"
        : "#bb3322"
      : name === "final-style"
        ? "#117733"
        : custom
          ? "#bb3322"
          : explicit
            ? "#7a3bba"
            : ordered
              ? styledVisited
                ? (visitedColor ??
                  providerVisited ??
                  theme.actions.primary.visitedForeground ??
                  (() => {
                    const a = theme.actions.primary.background as string,
                      b = theme.colors.background as string
                    const mix = (i: number) =>
                      Math.round(parseInt(a.slice(i, i + 2), 16) * 0.85 + parseInt(b.slice(i, i + 2), 16) * 0.15)
                    return `rgb(${mix(1)}, ${mix(3)}, ${mix(5)})`
                  })())
                : theme.actions.primary.background
              : theme.colors.foreground
  const width = natural
    ? undefined
    : zero
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
                ? 130
                : 200
  const height = natural || narrow ? undefined : zero ? 0 : small ? 24 : 44,
    padding = natural || zero || small ? 0 : 5
  const fontSize = mode === "motion" ? 30 : theme.typography.fontSizes.b10,
    lineHeight = mode === "motion" ? 38 : theme.typography.lineHeight
  const decoration = name === "underline" ? "underline" : name === "line-through" ? "line-through" : "none"
  const display = mode === "motion" ? "██████" : narrow ? LONG : explicit ? "Authored foreground" : "Read settings"
  const href =
    name === "empty"
      ? ""
      : name === "fragment"
        ? "#section"
        : name === "relative"
          ? "/relative"
          : name === "handoff"
            ? HANDOFF
            : name === "error" && hrefChanged
              ? "#changed-after-request"
              : UNHANDLED
  const related = [
    "alias-relationships",
    "attribute-relationships",
    "changed-targets",
    "removed-targets",
    "empty-relationships",
  ].includes(name)
  const targetText = name === "changed-targets" ? ["Changed A", "Changed B"] : ["First", "Second"],
    targetsVisible = name !== "removed-targets"
  const tag = (value: unknown) =>
    typeof value === "number" ? value : value == null ? null : findNodeHandle(value as View)
  const bind = useCallback((node: View | null) => {
    root.current = node
    setRootTag(node ? findNodeHandle(node) : null)
  }, [])
  const record = (phase: string, event: { target: unknown; currentTarget: unknown }) => {
    const row = { phase, target: tag(event.target), currentTarget: tag(event.currentTarget), epochMs: Date.now() }
    setEvents((old) => [...old, row])
  }
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
    inspectionRequest.current++
    setMode(next)
    setIndex(0)
    setVisited(false)
    setCanceled(false)
    setHrefChanged(false)
    setRequests([])
    setErrors([])
    setEvents([])
    setReferenceAtOrigin(false)
    setInspection(null)
    setMotionSelected(false)
    setMotionVisible(true)
    setMotionTrace([])
    setMotionLifetime((old) => old + 1)
  }
  const inspect = () => {
    const generation = ++inspectionRequest.current,
      current = root.current,
      caseName = name
    const accepted = inspectNativeAccessibility(current, (event) => {
      if (!live.current || generation !== inspectionRequest.current || current !== root.current) return
      setInspection({ case: caseName, ...event.nativeEvent })
      setInspectionSequence(generation)
    })
    if (!accepted) setInspection({ case: caseName, error: "unregistered-target" })
  }
  const arm = () => {
    for (const timer of timers.current) clearTimeout(timer)
    setMotionSelected(false)
    setMotionVisible(true)
    setMotionTrace([])
    const schedule = (delay: number, key: string, action: () => void) =>
      setTimeout(() => {
        setMotionTrace((old) => [...old, { name: key, epochMs: Date.now() }])
        action()
      }, delay)
    timers.current = [
      ...Array.from({ length: 40 }, (_, i) =>
        schedule(3000 + i * 75, `retarget-${i}`, () => setMotionSelected(i % 2 === 0)),
      ),
      schedule(7000, "settle", () => setMotionSelected(true)),
      schedule(8250, "retire", () => setMotionVisible(false)),
      schedule(10250, "fresh", () => {
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
    requests,
    errors,
    visited: selected,
    disabled,
    canceled,
    visible,
    href,
    hrefChanged,
    related,
    targetText,
    targetsVisible,
    inspection,
    inspectionSequence,
    referenceAtOrigin,
    width: width ?? null,
    height: height ?? null,
    padding,
    fontSize,
    lineHeight,
    foreground,
    decoration,
    display,
    zero,
    small,
    narrow,
    natural,
    themeMode: theme.mode,
    focused,
    focusVisible,
    motionSelected,
    motionTrace,
    motionEvents,
  }
  const link = visible ? (
    <Link
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
      testID="link-native-target"
      accessibilityLabel="Read settings"
      accessibilityHint="Open the destination"
      accessibilityValue={{ text: "Link value" }}
      href={href}
      isVisited={selected}
      isDisabled={disabled}
      order={ordered ? "primary" : undefined}
      color={mode === "motion" ? foreground : undefined}
      visitedColor={visitedColor}
      textDecoration={decoration}
      onLayout={layout}
      ariaLabelledBy={related ? "link-g08-name-a link-g08-name-b" : undefined}
      ariaDescribedBy={related ? "link-g08-guide" : undefined}
      ariaDetails={related ? "link-g08-details" : undefined}
      aria-labelledby={
        name === "attribute-relationships"
          ? "link-g08-name-b link-g08-name-a"
          : name === "empty-relationships"
            ? ""
            : undefined
      }
      aria-describedby={name === "empty-relationships" ? "" : undefined}
      aria-details={name === "empty-relationships" ? "" : undefined}
      labels={{ descriptionLabel: "Guidance", detailsLabel: "Details" }}
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
      onPressIn={(event) => {
        record("in", event)
        if (name === "held-disabled") setCanceled(true)
      }}
      onPressOut={(event) => record("out", event)}
      onPress={(event) => {
        const before = !!(event.defaultPrevented || event.isDefaultPrevented?.())
        if (name !== "error" && name !== "handoff") event.preventDefault()
        const row = {
          case: name,
          href,
          target: tag(event.target),
          currentTarget: tag(event.currentTarget),
          before,
          after: !!(event.defaultPrevented || event.isDefaultPrevented?.()),
        }
        setRequests((old) => [...old, row])
        record("press", event)
        if (name === "echo") setVisited(true)
        if (name === "error") setHrefChanged(true)
      }}
      onNavigationError={(error, destination) =>
        setErrors((old) => [...old, { href: destination, error: String(error) }])
      }
      customStyles={{
        width,
        height,
        padding,
        paddingHorizontal: padding,
        fontSize,
        lineHeight,
        ...(zero || small ? { overflow: "hidden" } : {}),
        ...(custom ? { color: "#bb3322", backgroundColor: "#ddeeff", borderColor: "#2f7d18", borderWidth: 2 } : {}),
        ...(mode === "motion" ? { color: foreground } : {}),
      }}
      style={
        name === "final-style"
          ? (state) => ({ color: state.defaultStyle.color === "#bb3322" ? "#117733" : "#ff00ff" })
          : undefined
      }
    >
      {explicit || narrow ? (
        <Text color={explicit ? "#7a3bba" : undefined} style={{ flexShrink: 1 }}>
          {display}
        </Text>
      ) : (
        display
      )}
    </Link>
  ) : null
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["behavior", "styles", "motion"] as const).map((next) => (
          <Button key={next} raised={false} onPress={() => changeMode(next)}>
            Link {next} checks
          </Button>
        ))}
      </View>
      <Text testID="link-native-state" accessibilityLabel={JSON.stringify(snapshot)} numberOfLines={1}>
        Link check: {name}
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
            Arm Link motion and retirement
          </Button>
        </>
      ) : (
        <Button
          raised={false}
          onPress={() => {
            inspectionRequest.current++
            setIndex((old) => (old + 1) % cases.length)
            setCanceled(false)
            setReferenceAtOrigin(false)
            setInspection(null)
          }}
        >
          Next Link check
        </Button>
      )}
      <Button raised={false} onPress={inspect}>
        Inspect Link metadata
      </Button>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button raised={false} onPress={() => setReferenceAtOrigin(false)}>
          Show Link component
        </Button>
        <Button raised={false} onPress={() => setReferenceAtOrigin(true)}>
          Show Link reference
        </Button>
      </View>
      <View style={{ height: 20, flexDirection: "row", gap: 5 }}>
        {targetsVisible ? (
          <>
            <Text nativeID="link-g08-name-a">{targetText[0]}</Text>
            <Text nativeID="link-g08-name-b">{targetText[1]}</Text>
            <Text nativeID="link-g08-guide">Guide</Text>
            <Text nativeID="link-g08-details">Detail</Text>
          </>
        ) : null}
      </View>
      <View testID="link-native-pair" collapsable={false} style={{ width: "100%", maxWidth: 280, height: 456 }}>
        <View
          testID="link-native-parent"
          collapsable={false}
          style={{ width: "100%", height: 224, padding: 12, backgroundColor: "#ffffff", alignItems: "flex-start" }}
        >
          <NativeThemeProvider
            mode={theme.mode}
            overrides={providerVisited ? { actions: { primary: { visitedForeground: providerVisited } } } : undefined}
          >
            {link}
          </NativeThemeProvider>
        </View>
        <View
          testID="link-native-reference-parent"
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
              testID="link-native-reference"
              collapsable={false}
              style={{
                width,
                height,
                minWidth: width === undefined ? (Platform.OS === "ios" ? 44 : 48) : undefined,
                minHeight: height === undefined ? (Platform.OS === "ios" ? 44 : 48) : undefined,
                padding,
                flexDirection: "row",
                alignItems: "center",
                gap: theme.spacing.unit,
                borderRadius: theme.radius.rounded,
                opacity: disabled ? theme.opacity.disabled : 1,
                ...(zero || small ? { overflow: "hidden" as const } : {}),
                ...(custom ? { backgroundColor: "#ddeeff", borderColor: "#2f7d18", borderWidth: 2 } : {}),
                ...(focused && focusVisible && !disabled
                  ? { outlineColor: theme.colors.focusRing, outlineWidth: 1.5, outlineOffset: 2 }
                  : {}),
              }}
            >
              <RawText
                accessible={false}
                selectable={false}
                style={{
                  color: foreground,
                  fontSize,
                  lineHeight,
                  fontWeight: theme.typography.fontWeights.regular,
                  fontFamily: theme.typography.fontFamilies.body,
                  fontStyle: "normal",
                  textDecorationLine: explicit || narrow ? undefined : decoration,
                  ...(explicit || narrow ? { flexShrink: 1 } : {}),
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
