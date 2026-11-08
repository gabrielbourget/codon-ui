import {
  cloneElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactElement,
} from "react"
import { AccessibilityInfo, findNodeHandle, PixelRatio, View, type LayoutChangeEvent } from "react-native"
import Svg, { Circle, Path, Text as SVGText } from "react-native-svg"

import {
  Button,
  CircularProgress,
  NativeCircularProgressContext,
  NativeCircularProgressLabel,
  NativeFocusView,
  Text,
  useNativeTheme,
  type TNativeCircularProgressProps,
  type TNativeCircularProgressRef,
} from "@codon-ui/react-native"

// Private installed observer fixture. Expected drawing uses explicit SVG primitives, never library geometry helpers.
export const CIRCULAR_NATIVE_CASES: readonly { name: string; props: Partial<TNativeCircularProgressProps> }[] = [
  { name: "quarter", props: {} },
  { name: "zero", props: { value: 0, text: "0%" } },
  { name: "full", props: { value: 100, text: "100%" } },
  { name: "lower-clamp", props: { value: -25, text: "raw -25" } },
  { name: "upper-clamp", props: { value: 125, text: "raw 125" } },
  { name: "empty-range", props: { minValue: 100, maxValue: 100, text: "empty" } },
  { name: "half", props: { circleRatio: 0.5 } },
  { name: "reverse", props: { circleRatio: 0.5, counterClockwise: true } },
  { name: "round", props: { strokeLineCap: "round" } },
  { name: "square", props: { strokeLineCap: "square" } },
  { name: "wide", props: { width: 120, height: 80, strokeWidth: 12, backgroundColor: "red", backgroundPadding: 6 } },
  { name: "zero-width", props: { width: 0 } },
  { name: "zero-height", props: { height: 0 } },
  {
    name: "six-slots",
    props: {
      width: 110,
      customStyles: [{ width: 90 }, false, { opacity: 0.8 }],
      style: ({ percentage, defaultStyle }) => ({ width: percentage === 25 && defaultStyle.width === 90 ? 100 : 88 }),
      backgroundColor: "red",
      backgroundPadding: 4,
      customSVGStyles: { width: 80, height: 80 },
      customTrackStyles: { stroke: "#a66b00", strokeWidth: 4 },
      customPathStyles: { stroke: "#2f7d18", strokeWidth: 8, strokeDashoffset: 0 },
      customTextStyles: { fill: "#b73434", fontSize: 18, fontWeight: "bold", fontStyle: "italic" },
      customBackgroundStyles: { fill: "#efefef" },
    },
  },
  {
    name: "named-paint",
    props: { pathColor: "red", trackColor: "green", backgroundColor: "red", order: "quintenary" },
  },
  { name: "current-color", props: { pathColor: "red", customPathStyles: { stroke: "currentColor" } } },
  { name: "context-label", props: {} },
  { name: "empty-label", props: { valueLabel: "" } },
  { name: "node-label", props: { valueLabel: <Text>Semantic node stays unmounted</Text> } },
  { name: "unknown", props: { isIndeterminate: true } },
]

const nodeTag = (node: unknown) =>
  typeof node === "number" ? node : node == null ? null : findNodeHandle(node as TNativeCircularProgressRef)

export const CircularProgressFixture = () => {
  const [expanded, setExpanded] = useState(false)
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState(25)
  const [visible, setVisible] = useState(true)
  const [binding, setBinding] = useState({ rootTag: null as number | null, attaches: 0, detaches: 0 })
  const [layouts, setLayouts] = useState<Record<string, unknown>>({})
  const [motionEvents, setMotionEvents] = useState<boolean[]>([])
  const [scheduled, setScheduled] = useState<{ kind: string; epochMs: number }[]>([])
  const [contacts, setContacts] = useState<{ kind: string; target: number | null; currentTarget: number | null }[]>([])
  const root = useRef<TNativeCircularProgressRef | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const theme = useNativeTheme()
  useEffect(() => {
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) =>
      setMotionEvents((previous) => [...previous, enabled]),
    )
    return () => {
      listener.remove()
      timers.current.forEach(clearTimeout)
    }
  }, [])
  const bind = useCallback((node: TNativeCircularProgressRef | null) => {
    if (node === root.current) return
    root.current = node
    setBinding((previous) => ({
      rootTag: nodeTag(node),
      attaches: previous.attaches + (node ? 1 : 0),
      detaches: previous.detaches + (node ? 0 : 1),
    }))
  }, [])
  const layout = useCallback((owner: string, event: LayoutChangeEvent) => {
    const next = {
      layout: { ...event.nativeEvent.layout },
      target: nodeTag((event.nativeEvent as unknown as { target: unknown }).target),
      currentTarget: nodeTag(event.currentTarget),
    }
    setLayouts((previous) =>
      JSON.stringify(previous[owner]) === JSON.stringify(next) ? previous : { ...previous, [owner]: next },
    )
  }, [])
  const reset = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setIndex(0)
    setValue(25)
    setVisible(true)
    setScheduled([])
    setContacts([])
    setExpanded(true)
  }
  const current = CIRCULAR_NATIVE_CASES[index]
  const props: TNativeCircularProgressProps = { value, text: `${value}%`, width: 120, height: 120, ...current.props }
  const width = current.name === "six-slots" ? 100 : (props.width as number)
  const height = props.height as number
  const radius = 50 - (props.strokeWidth ?? 8) / 2 - (props.backgroundColor ? (props.backgroundPadding ?? 0) : 0)
  const circumference = 2 * Math.PI * radius
  const span = (props.maxValue ?? 100) - (props.minValue ?? 0)
  const fraction = span <= 0 ? 0 : Math.max(0, Math.min(1, (props.value - (props.minValue ?? 0)) / span))
  const ratio = props.circleRatio ?? 1
  const direction = props.counterClockwise ? -1 : 1
  const d = `M 50,50 m 0,-${radius} a ${radius},${radius} ${props.counterClockwise ? 1 : 0} 1 1 0,${2 * radius} a ${radius},${radius} ${props.counterClockwise ? 1 : 0} 1 1 0,-${2 * radius}`
  const slots = current.name === "six-slots"
  const label = current.name === "context-label"
  const pathColor = slots
    ? "#2f7d18"
    : current.name === "current-color"
      ? "red"
      : theme.colors.controlSelectedBackground
  const trackColor = slots ? "#a66b00" : theme.mode === "dark" ? "#202020" : "#f7f7f7"
  const background = slots ? "#efefef" : theme.colors.background
  const record = {
    index,
    case: current.name,
    value: props.value,
    width,
    height,
    mode: theme.mode,
    ...binding,
    layouts,
    motionEvents,
    scheduled,
    visible,
    contacts,
  }
  const arm = () => {
    timers.current.forEach(clearTimeout)
    setScheduled([])
    setIndex(0)
    setValue(0)
    setVisible(true)
    const later = (delay: number, kind: string, action: () => void) =>
      timers.current.push(
        setTimeout(() => {
          setScheduled((previous) => [...previous, { kind, epochMs: Date.now() }])
          action()
        }, delay),
      )
    later(3000, "to-full", () => setValue(100))
    later(3100, "supersede-ten", () => setValue(10))
    later(4200, "to-sixty", () => setValue(60))
    later(5200, "to-twenty", () => setValue(20))
    later(6200, "to-ninety", () => setValue(90))
    later(6300, "retire", () => setVisible(false))
    later(7600, "reinsert-zero", () => {
      setValue(0)
      setVisible(true)
    })
  }
  return (
    <View style={{ gap: 8 }}>
      <Button onPress={reset}>Prepare CircularProgress checks</Button>
      {expanded ? (
        <>
          <Text testID="circular-native-state" accessibilityLabel={JSON.stringify(record)} numberOfLines={1}>
            {JSON.stringify(record)}
          </Text>
          <Button onPress={arm}>Arm CircularProgress interruption and retirement</Button>
          <View testID="circular-native-pair" style={{ flexDirection: "row", gap: 8 }}>
            <View
              testID="circular-native-parent"
              collapsable={false}
              style={{ width: 144, height: 144, padding: 12, backgroundColor: "white" }}
            >
              <NativeCircularProgressContext.Provider value={label ? { slots: { task: { maxValue: 200 } } } : {}}>
                {visible ? (
                  <CircularProgress
                    {...props}
                    ref={bind}
                    testID="circular-native-target"
                    slot={label ? "task" : undefined}
                    aria-label={label ? undefined : "Circular verification"}
                    onLayout={(event) => layout("target", event)}
                    onTouchStart={(event) =>
                      setContacts((previous) => [
                        ...previous,
                        {
                          kind: "start",
                          target: nodeTag(event.nativeEvent.target),
                          currentTarget: nodeTag(event.currentTarget),
                        },
                      ])
                    }
                    onTouchEnd={(event) =>
                      setContacts((previous) => [
                        ...previous,
                        {
                          kind: "end",
                          target: nodeTag(event.nativeEvent.target),
                          currentTarget: nodeTag(event.currentTarget),
                        },
                      ])
                    }
                    render={
                      label
                        ? (host) => {
                            const provider = host.children as ReactElement<PropsWithChildren>
                            return (
                              <NativeFocusView {...host}>
                                {cloneElement(
                                  provider,
                                  undefined,
                                  <>
                                    <NativeCircularProgressLabel testID="circular-native-label">
                                      Scoped circular task
                                    </NativeCircularProgressLabel>
                                    {provider.props.children}
                                  </>,
                                )}
                              </NativeFocusView>
                            )
                          }
                        : undefined
                    }
                  />
                ) : null}
              </NativeCircularProgressContext.Provider>
            </View>
            <View
              testID="circular-native-reference-parent"
              collapsable={false}
              style={{ width: 144, height: 144, padding: 12, backgroundColor: "white" }}
            >
              <View
                testID="circular-native-reference"
                collapsable={false}
                style={{ width, height, opacity: slots ? 0.8 : 1 }}
              >
                <Svg
                  width={slots ? 80 : "100%"}
                  height={slots ? 80 : "100%"}
                  viewBox="0 0 100 100"
                  color={theme.colors.foreground}
                >
                  {props.backgroundColor ? <Circle cx={50} cy={50} r={50} fill={background} /> : null}
                  <Path
                    testID="circular-native-reference-track"
                    d={d}
                    fillOpacity={0}
                    stroke={trackColor}
                    strokeWidth={slots ? 4 : (props.strokeWidth ?? 6)}
                    strokeLinecap={props.strokeLineCap ?? "butt"}
                    strokeDasharray={[circumference, circumference]}
                    strokeDashoffset={direction * (1 - ratio) * circumference}
                  />
                  <Path
                    testID="circular-native-reference-path"
                    d={d}
                    fillOpacity={0}
                    stroke={pathColor}
                    strokeWidth={slots ? 8 : (props.strokeWidth ?? 6)}
                    strokeLinecap={props.strokeLineCap ?? "butt"}
                    strokeDasharray={[circumference, circumference]}
                    strokeDashoffset={direction * (1 - fraction * ratio) * circumference}
                  />
                  {props.text ? (
                    <SVGText
                      x={50}
                      y={50}
                      fill={slots ? "#b73434" : theme.colors.foreground}
                      fontSize={slots ? 18 : 24}
                      fontWeight={slots ? "bold" : undefined}
                      fontStyle={slots ? "italic" : undefined}
                      fontFamily={theme.typography.fontFamilies.body}
                      alignmentBaseline="middle"
                      textAnchor="middle"
                    >
                      {props.text}
                    </SVGText>
                  ) : null}
                </Svg>
              </View>
            </View>
          </View>
          <Button onPress={() => setIndex((previous) => (previous + 1) % CIRCULAR_NATIVE_CASES.length)}>
            Next CircularProgress check
          </Button>
          <Button onPress={() => setValue((previous) => (previous === 25 ? 75 : 25))}>
            Change CircularProgress value
          </Button>
          <Text>
            Native scale {PixelRatio.get()}. Reference uses independent SVG primitives. Counter is outside these checks.
          </Text>
        </>
      ) : null}
    </View>
  )
}
