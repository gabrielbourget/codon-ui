import { useCallback, useEffect, useRef, useState } from "react"
import { AccessibilityInfo, findNodeHandle, Text as RawText, View, type LayoutChangeEvent } from "react-native"
import Svg, { Path } from "react-native-svg"

import {
  Button,
  Counter,
  Text,
  useNativeTheme,
  type TNativeCounterProps,
  type TNativeCounterRef,
} from "@codon-ui/react-native"

export const COUNTER_NATIVE_CASES: readonly { name: string; props: Partial<TNativeCounterProps> }[] = [
  { name: "baseline", props: {} },
  { name: "zero", props: { value: 0 } },
  { name: "raw-string", props: { value: "0049", maxValue: "0100" } },
  { name: "warning", props: { value: 79.5 } },
  { name: "danger", props: { value: 89.5 } },
  { name: "numeric-max-zero", props: { maxValue: 0 } },
  { name: "string-max-zero", props: { value: 0, maxValue: "0" } },
  { name: "raw-text", props: { value: "not numeric" } },
  { name: "hidden-parts", props: { showMaxValue: false, showProgressIndicator: false } },
  {
    name: "three-slots",
    props: {
      customStyles: { padding: 4, borderWidth: 1, borderColor: "#a66b00", fontStyle: "italic", letterSpacing: 2 },
      customTextStyles: { color: "#087f8c", fontSize: 18, fontWeight: "700", fontStyle: "normal", letterSpacing: 0 },
      customProgressIndicatorStyles: { width: 20, height: 20 },
    },
  },
  { name: "explicit-color", props: { color: "#087f8c" } },
  { name: "fractional", props: { width: 183.25 } },
  { name: "zero-width", props: { width: 0 } },
  { name: "auto-width", props: { width: undefined } },
  { name: "percentage", props: { width: "100%" } },
]

const tag = (node: unknown) =>
  typeof node === "number" ? node : node == null ? null : findNodeHandle(node as TNativeCounterRef)

export const CounterFixture = () => {
  const theme = useNativeTheme()
  const [expanded, setExpanded] = useState(false)
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const [motionColor, setMotionColor] = useState<string | undefined>()
  const [binding, setBinding] = useState({ rootTag: null as number | null, attaches: 0, detaches: 0 })
  const [layouts, setLayouts] = useState<Record<string, unknown>>({})
  const [contacts, setContacts] = useState<{ target: number | null; currentTarget: number | null }[]>([])
  const [motionEvents, setMotionEvents] = useState<boolean[]>([])
  const [scheduled, setScheduled] = useState<{ kind: string; epochMs: number }[]>([])
  const root = useRef<TNativeCounterRef | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) =>
      setMotionEvents((old) => [...old, enabled]),
    )
    return () => {
      listener.remove()
      timers.current.forEach(clearTimeout)
    }
  }, [])
  const bind = useCallback((node: TNativeCounterRef | null) => {
    if (node === root.current) return
    root.current = node
    setBinding((old) => ({
      rootTag: tag(node),
      attaches: old.attaches + (node ? 1 : 0),
      detaches: old.detaches + (node ? 0 : 1),
    }))
  }, [])
  const layout = useCallback((owner: string, event: LayoutChangeEvent) => {
    const next = {
      layout: { ...event.nativeEvent.layout },
      target: tag((event.nativeEvent as unknown as { target: unknown }).target),
      currentTarget: tag(event.currentTarget),
    }
    setLayouts((old) => (JSON.stringify(old[owner]) === JSON.stringify(next) ? old : { ...old, [owner]: next }))
  }, [])
  const current = COUNTER_NATIVE_CASES[index]
  const motion = motionColor !== undefined
  const props: TNativeCounterProps = motion
    ? { value: 25, width: 180, height: 40, color: motionColor }
    : {
        value: 25,
        maxValue: 100,
        warningPercentageThreshold: 80,
        errorOrDangerPercentageThreshold: 90,
        width: 180,
        height: 40,
        showMaxValue: true,
        showProgressIndicator: true,
        ...current.props,
      }
  const slots = !motion && current.name === "three-slots"
  const textColor = slots
    ? "#087f8c"
    : (motionColor ??
      props.color ??
      (current.name === "danger"
        ? theme.colors.statusDanger
        : current.name === "warning"
          ? theme.colors.statusWarning
          : theme.colors.foreground))
  const rawStyle = {
    fontSize: theme.typography.fontSizes.b10,
    fontWeight: theme.typography.fontWeights.regular,
    fontFamily: theme.typography.fontFamilies.body,
    fontStyle: "normal" as const,
    lineHeight: theme.typography.lineHeight,
    textAlign: "center" as const,
    color: textColor,
  }
  const numericStyle = slots
    ? { ...rawStyle, color: "#087f8c", fontSize: 18, fontWeight: "700" as const, letterSpacing: 0 }
    : rawStyle
  const rootStyle = {
    width: props.width,
    height: props.height,
    flexDirection: "row" as const,
    gap: theme.spacing.unit,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...(slots ? { padding: 4, borderWidth: 1, borderColor: "#a66b00" } : {}),
  }
  const percentage = (Number(props.value) / Number(props.maxValue)) * 100
  const fraction = Number.isNaN(percentage) ? undefined : Math.max(0, Math.min(1, percentage / 100))
  const background = theme.mode === "dark" ? "#101010" : "#ffffff"
  const record = {
    case: motion ? "motion" : current.name,
    index,
    value: props.value,
    maxValue: props.maxValue,
    width: props.width ?? "auto",
    height: props.height,
    visible,
    mode: theme.mode,
    motionColor,
    ...binding,
    layouts,
    contacts,
    motionEvents,
    scheduled,
  }
  const reset = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setIndex(0)
    setVisible(true)
    setMotionColor(undefined)
    setScheduled([])
    setContacts([])
    setExpanded(true)
  }
  const arm = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setMotionColor("#087f8c")
    setVisible(true)
    setScheduled([])
    const later = (delay: number, kind: string, action: () => void) =>
      timers.current.push(
        setTimeout(() => {
          setScheduled((old) => [...old, { kind, epochMs: Date.now() }])
          action()
        }, delay),
      )
    later(3000, "red", () => setMotionColor("#b73434"))
    later(3100, "supersede-green", () => setMotionColor("#2f7d18"))
    later(4200, "blue", () => setMotionColor("#087f8c"))
    later(5200, "red-again", () => setMotionColor("#b73434"))
    later(6200, "green-again", () => setMotionColor("#2f7d18"))
    later(6300, "retire", () => setVisible(false))
    later(7600, "fresh-blue", () => {
      setMotionColor("#087f8c")
      setVisible(true)
    })
  }
  return (
    <View style={{ gap: 8 }}>
      <Button onPress={reset}>Prepare Counter checks</Button>
      {expanded ? (
        <>
          <Text testID="counter-native-state" accessibilityLabel={JSON.stringify(record)} numberOfLines={1}>
            {JSON.stringify(record)}
          </Text>
          <Button onPress={arm}>Arm Counter color interruption and retirement</Button>
          <View testID="counter-native-pair" style={{ gap: 8 }}>
            <View
              testID="counter-native-parent"
              collapsable={false}
              style={{ width: "100%", maxWidth: 330, height: 72, padding: 8, backgroundColor: background }}
            >
              {visible ? (
                <Counter
                  {...props}
                  ref={bind}
                  testID="counter-native-target"
                  accessibilityLabel="Native counter"
                  onLayout={(event) => layout("target", event)}
                  onTouchStart={(event) =>
                    setContacts((old) => [
                      ...old,
                      {
                        target: tag((event.nativeEvent as unknown as { target: unknown }).target),
                        currentTarget: tag(event.currentTarget),
                      },
                    ])
                  }
                >
                  {!motion ? (
                    slots ? (
                      <Text testID="counter-native-child">Owned</Text>
                    ) : (
                      <View
                        testID="counter-native-empty-child"
                        collapsable={false}
                        style={{ width: 20, height: 20, backgroundColor: "#7134a6" }}
                      />
                    )
                  ) : null}
                </Counter>
              ) : null}
            </View>
            <View
              testID="counter-native-reference-parent"
              collapsable={false}
              style={{ width: "100%", maxWidth: 330, height: 72, padding: 8, backgroundColor: background }}
            >
              {visible ? (
                <View testID="counter-native-reference" collapsable={false} style={rootStyle}>
                  {props.showProgressIndicator && props.maxValue ? (
                    <View style={{ width: slots ? 20 : 12, height: slots ? 20 : 12 }}>
                      <Svg width="100%" height="100%" viewBox="0 0 100 100" color={theme.colors.foreground}>
                        <Path
                          d="M 50,50 m 0,-46 a 46,46 0 1 1 0,92 a 46,46 0 1 1 0,-92"
                          fillOpacity={0}
                          stroke={theme.mode === "dark" ? "#202020" : "#f7f7f7"}
                          strokeWidth={6}
                          strokeLinecap="butt"
                          strokeDasharray={[2 * Math.PI * 46, 2 * Math.PI * 46]}
                          strokeDashoffset={0}
                        />
                        {fraction !== undefined ? (
                          <Path
                            d="M 50,50 m 0,-46 a 46,46 0 1 1 0,92 a 46,46 0 1 1 0,-92"
                            fillOpacity={0}
                            stroke={theme.colors.controlSelectedBackground}
                            strokeWidth={6}
                            strokeLinecap="butt"
                            strokeDasharray={[2 * Math.PI * 46, 2 * Math.PI * 46]}
                            strokeDashoffset={(1 - fraction) * 2 * Math.PI * 46}
                          />
                        ) : null}
                      </Svg>
                    </View>
                  ) : null}
                  <View
                    style={{ height: "100%", flexDirection: "row", justifyContent: "center", alignItems: "center" }}
                  >
                    <RawText testID="counter-native-reference-value" style={numericStyle}>
                      {props.value}
                    </RawText>
                    {props.showMaxValue && props.maxValue ? (
                      <RawText style={numericStyle}>{`/${props.maxValue}`}</RawText>
                    ) : null}
                  </View>
                  {!motion ? (
                    slots ? (
                      <RawText
                        style={{ ...rawStyle, color: theme.colors.foreground, fontStyle: "italic", letterSpacing: 2 }}
                      >
                        Owned
                      </RawText>
                    ) : (
                      <View collapsable={false} style={{ width: 20, height: 20, backgroundColor: "#7134a6" }} />
                    )
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
          <Button onPress={() => setIndex((old) => (old + 1) % COUNTER_NATIVE_CASES.length)}>Next Counter check</Button>
        </>
      ) : null}
    </View>
  )
}
