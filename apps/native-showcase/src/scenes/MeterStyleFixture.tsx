import { useCallback, useEffect, useRef, useState } from "react"
import {
  findNodeHandle,
  AccessibilityInfo,
  Platform,
  PlatformColor,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native"

import { Button, Meter, Text, useNativeTheme, type MeterProps, type TNativeMeterRef } from "@codon-ui/react-native"

const registered = StyleSheet.create({ root: { width: 91, opacity: 0.75 }, bar: { backgroundColor: "purple" } })
const nativeColor =
  Platform.OS === "ios" ? PlatformColor("systemBlueColor") : PlatformColor("?android:attr/colorAccent")
type TCase = Readonly<{
  name: string
  props: Partial<MeterProps>
  width: number
  height: number
  root?: ViewStyle
  track?: ViewStyle
  bar?: ViewStyle
}>

export const METER_STYLE_CASES: readonly TCase[] = [
  { name: "semantic", props: {}, width: 150, height: 10 },
  { name: "fractional", props: { width: 73.25, height: 13.75 }, width: 73.25, height: 13.75 },
  { name: "zero-width", props: { width: 0 }, width: 0, height: 10 },
  { name: "zero-height", props: { height: 0 }, width: 150, height: 0 },
  { name: "percentage", props: { width: "50%", height: 20 }, width: 108, height: 20 },
  { name: "auto-height", props: { height: "auto" }, width: 150, height: 0 },
  { name: "physical-left", props: { direction: "left", width: 160, height: 20 }, width: 160, height: 20 },
  { name: "vertical-up", props: { orientation: "vertical", width: 20, height: 140 }, width: 20, height: 140 },
  {
    name: "vertical-down",
    props: { orientation: "vertical", direction: "down", width: 20, height: 140 },
    width: 20,
    height: 140,
  },
  { name: "orthogonal", props: { barGeometry: "orthogonal", trackGeometry: "orthogonal" }, width: 150, height: 10 },
  {
    name: "independent-radii",
    props: { barGeometry: "rounded", trackGeometry: "orthogonal", height: 24 },
    width: 150,
    height: 24,
  },
  { name: "primary", props: { order: "primary", height: 20 }, width: 150, height: 20 },
  {
    name: "explicit-colors",
    props: { order: "primary", barColor: "#087f8c", trackColor: "#ffcc66", height: 20 },
    width: 150,
    height: 20,
    track: { backgroundColor: "#ffcc66" },
    bar: { backgroundColor: "#087f8c" },
  },
  {
    name: "registered-array",
    props: { customStyles: [false, registered.root], customBarStyles: [undefined, registered.bar], height: 20 },
    width: 91,
    height: 20,
    root: { opacity: 0.75 },
    bar: { backgroundColor: "purple" },
  },
  {
    name: "post-custom-final",
    props: {
      width: 180,
      height: 20,
      barColor: "blue",
      customStyles: { width: 100, opacity: 0.5 },
      customTrackStyles: { backgroundColor: "#ffcc66", borderColor: "#174ea6", borderWidth: 2 },
      customBarStyles: { backgroundColor: "#087f8c", borderRadius: 2 },
      style: ({ percentage, valueText, defaultStyle }) => ({
        width: percentage === 25 && valueText === "25%" && defaultStyle.width === 100 ? 84 : 92,
        marginTop: 5,
      }),
    },
    width: 84,
    height: 20,
    root: { opacity: 0.5, marginTop: 5 },
    track: { backgroundColor: "#ffcc66", borderColor: "#174ea6", borderWidth: 2 },
    bar: { backgroundColor: "#087f8c", borderRadius: 2 },
  },
  {
    name: "native-color",
    props: { barColor: nativeColor, height: 20 },
    width: 150,
    height: 20,
    bar: { backgroundColor: nativeColor },
  },
  { name: "zero-opacity", props: { style: [false, { opacity: 0 }] }, width: 150, height: 10, root: { opacity: 0 } },
  { name: "raised", props: { raised: true, height: 20 }, width: 150, height: 20 },
]

type TOwner = "target" | "parent" | "reference" | "referenceParent"
const tag = (node: unknown) =>
  typeof node === "number" ? node : node == null ? null : findNodeHandle(node as TNativeMeterRef)

export const MeterStyleFixture = () => {
  const [expanded, setExpanded] = useState(false)
  const [rawReferences, setRawReferences] = useState(false)
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState(25)
  const [motionEvents, setMotionEvents] = useState<boolean[]>([])
  const [layouts, setLayouts] = useState<Partial<Record<TOwner, unknown>>>({})
  const [binding, setBinding] = useState({ rootTag: null as number | null, attaches: 0, detaches: 0 })
  const root = useRef<TNativeMeterRef | null>(null)
  const theme = useNativeTheme()
  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) =>
      setMotionEvents((previous) => [...previous, enabled]),
    )
    return () => subscription.remove()
  }, [])
  const bind = useCallback((node: TNativeMeterRef | null) => {
    if (node === root.current) return
    root.current = node
    setBinding((previous) => ({
      rootTag: tag(node),
      attaches: previous.attaches + (node === null ? 0 : 1),
      detaches: previous.detaches + (node === null ? 1 : 0),
    }))
  }, [])
  const receiveLayout = useCallback((owner: TOwner, event: LayoutChangeEvent) => {
    const next = {
      layout: { ...event.nativeEvent.layout },
      nativeTarget: tag((event.nativeEvent as unknown as { target?: unknown }).target),
      currentTarget: tag(event.currentTarget),
    }
    setLayouts((previous) =>
      JSON.stringify(previous[owner]) === JSON.stringify(next) ? previous : { ...previous, [owner]: next },
    )
  }, [])
  const current = METER_STYLE_CASES[index]
  const vertical = current.props.orientation === "vertical"
  const reverse = current.props.direction === "left" || current.props.direction === "down"
  const radii = { orthogonal: 0, rounded: theme.radius.rounded, round: theme.radius.round }
  const trackRadius = radii[current.props.trackGeometry ?? "round"]
  const barRadius = radii[current.props.barGeometry ?? "round"]
  const parent: ViewStyle = { width: 240, height: 170, padding: 12, alignItems: "flex-start", backgroundColor: "white" }
  const renderReference = (owner: "target" | "reference") => (
    <View
      testID={`meter-style-${owner}`}
      ref={owner === "target" ? bind : undefined}
      collapsable={false}
      accessible={false}
      onLayout={(event) => receiveLayout(owner, event)}
      style={[
        { width: current.width, height: current.props.height === "auto" ? "auto" : current.height },
        current.root,
      ]}
    >
      <View
        style={[
          {
            width: "100%",
            height: "100%",
            borderWidth: 1,
            borderColor: theme.colors.controlBorder,
            backgroundColor: theme.colors.background,
            borderRadius: trackRadius,
          },
          current.props.raised
            ? {
                shadowColor: "#000000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.24,
                shadowRadius: 3,
                elevation: 2,
              }
            : undefined,
          current.track,
        ]}
      >
        <View
          style={{
            flex: 1,
            overflow: "hidden",
            borderRadius: current.track?.borderRadius ?? trackRadius,
            direction: "ltr",
          }}
        >
          <View
            style={[
              {
                position: "absolute",
                width: vertical ? "100%" : `${value}%`,
                height: vertical ? `${value}%` : "100%",
                backgroundColor: current.props.order
                  ? theme.actions[current.props.order].background
                  : theme.colors.controlSelectedBackground,
                borderRadius: barRadius,
              },
              vertical
                ? { left: 0, ...(reverse ? { top: 0 } : { bottom: 0 }) }
                : { top: 0, ...(reverse ? { right: 0 } : { left: 0 }) },
              current.bar,
            ]}
          />
        </View>
      </View>
    </View>
  )
  return (
    <View style={{ gap: 6 }}>
      <Button
        accessibilityLabel="Prepare Meter styles"
        onPress={() => {
          setExpanded(true)
          setRawReferences(false)
          setIndex(0)
          setValue(25)
        }}
      >
        Prepare Meter styles
      </Button>
      {expanded && (
        <>
          <Button
            accessibilityLabel="Next Meter style"
            onPress={() => setIndex((value) => (value + 1) % METER_STYLE_CASES.length)}
          >
            Next Meter style
          </Button>
          <Button
            accessibilityLabel="Change Meter style value"
            onPress={() => setValue((currentValue) => (currentValue === 25 ? 75 : 25))}
          >
            Change Meter style value
          </Button>
          <Button
            accessibilityLabel="Compare raw Meter style references"
            onPress={() => {
              setIndex(17)
              setValue(25)
              setRawReferences(true)
            }}
          >
            Compare raw Meter style references
          </Button>
          <Text
            testID="meter-style-state"
            accessible
            accessibilityLabel={JSON.stringify({
              index,
              case: current.name,
              value,
              motionEvents,
              mode: theme.mode,
              layouts,
              rawReferences,
              ...binding,
            })}
          >
            Meter style: {current.name}
          </Text>
          <View testID="meter-style-pair" collapsable={false} style={{ gap: 12 }}>
            <View
              testID="meter-style-parent"
              collapsable={false}
              style={parent}
              onLayout={(event) => receiveLayout("parent", event)}
            >
              {rawReferences ? (
                renderReference("target")
              ) : (
                <Meter
                  {...current.props}
                  value={value}
                  valueLabel={`${value}%`}
                  accessibilityLabel="Style meter"
                  testID="meter-style-target"
                  ref={bind}
                  onLayout={(event) => receiveLayout("target", event)}
                />
              )}
            </View>
            <View
              testID="meter-style-reference-parent"
              collapsable={false}
              style={parent}
              onLayout={(event) => receiveLayout("referenceParent", event)}
            >
              {renderReference("reference")}
            </View>
          </View>
        </>
      )}
    </View>
  )
}
