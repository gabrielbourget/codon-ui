import { useCallback, useEffect, useRef, useState } from "react"
import { AccessibilityInfo, findNodeHandle, StyleSheet, View, type LayoutChangeEvent } from "react-native"

import {
  Button,
  CircleLoader,
  LaggingLinesLoader,
  Text,
  useNativeTheme,
  type TNativeCircleLoaderRef,
  type TNativeLaggingLinesLoaderRef,
} from "@codon-ui/react-native"

const nativeTag = (node: unknown) =>
  typeof node === "number" ? node : node == null ? null : findNodeHandle(node as TNativeCircleLoaderRef)

const LOADER_DURATIONS = [undefined, "0.45s", 1200] as const
const CIRCLE_SIZES = [25, 40, 0] as const
const LINE_WIDTHS = [150, "100%", 0] as const

export const LoadingScene = () => {
  const [durationIndex, setDurationIndex] = useState(0)
  const [sizeIndex, setSizeIndex] = useState(0)
  const [widthIndex, setWidthIndex] = useState(0)
  const [stopped, setStopped] = useState(false)
  const [transparent, setTransparent] = useState(false)
  const [explicitColors, setExplicitColors] = useState(false)
  const [custom, setCustom] = useState(false)
  const [fractional, setFractional] = useState(false)
  const [visible, setVisible] = useState(true)
  const [linesVisible, setLinesVisible] = useState(true)
  const [linesFractional, setLinesFractional] = useState(false)
  const [linesBinding, setLinesBinding] = useState({ rootTag: null as number | null, attaches: 0, detaches: 0 })
  const [linesLayout, setLinesLayout] = useState<unknown>(null)
  const [linesHostWidth, setLinesHostWidth] = useState(0)
  const linesRoot = useRef<TNativeLaggingLinesLoaderRef | null>(null)
  const [binding, setBinding] = useState({ rootTag: null as number | null, attaches: 0, detaches: 0 })
  const [layout, setLayout] = useState<unknown>(null)
  const [motionEvents, setMotionEvents] = useState<boolean[]>([])
  const root = useRef<TNativeCircleLoaderRef | null>(null)
  const theme = useNativeTheme()
  const bind = useCallback((node: TNativeCircleLoaderRef | null) => {
    if (node === root.current) return
    root.current = node
    setBinding((current) => ({
      rootTag: nativeTag(node),
      attaches: current.attaches + (node ? 1 : 0),
      detaches: current.detaches + (node ? 0 : 1),
    }))
  }, [])
  const receiveLayout = useCallback((event: LayoutChangeEvent) => {
    const next = {
      layout: { ...event.nativeEvent.layout },
      eventTarget: nativeTag(event.target),
      currentTarget: nativeTag(event.currentTarget),
      nativeTarget: nativeTag((event.nativeEvent as unknown as { target?: unknown }).target),
    }
    setLayout((previous: unknown) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next))
  }, [])
  const bindLines = useCallback((node: TNativeLaggingLinesLoaderRef | null) => {
    if (node === linesRoot.current) return
    linesRoot.current = node
    setLinesBinding((current) => ({
      rootTag: nativeTag(node),
      attaches: current.attaches + (node ? 1 : 0),
      detaches: current.detaches + (node ? 0 : 1),
    }))
  }, [])
  const receiveLinesLayout = useCallback((event: LayoutChangeEvent) => {
    const next = {
      layout: { ...event.nativeEvent.layout },
      eventTarget: nativeTag(event.target),
      currentTarget: nativeTag(event.currentTarget),
      nativeTarget: nativeTag((event.nativeEvent as unknown as { target?: unknown }).target),
    }
    setLinesLayout((previous: unknown) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next))
  }, [])
  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) =>
      setMotionEvents((events) => [...events, enabled]),
    )
    return () => subscription.remove()
  }, [])
  const duration = stopped ? 0 : LOADER_DURATIONS[durationIndex]
  const size = fractional ? 33.25 : CIRCLE_SIZES[sizeIndex]
  const width = linesFractional ? 183.25 : LINE_WIDTHS[widthIndex]
  const rootWidth = custom ? 72 : size
  const rootHeight = custom ? 60 : size
  const foreground = explicitColors ? "#2f7d18" : custom ? "#087f8c" : theme.colors.foreground
  const track = transparent ? "transparent" : explicitColors ? "#a66b00" : "rgba(127, 127, 127, 0.22)"
  const snapshot = {
    ...binding,
    layout,
    motionEvents,
    visible,
    fractional,
    size,
    stopped,
    duration: duration ?? 850,
    custom,
    transparent,
    explicitColors,
    mode: theme.mode,
    rootWidth,
    rootHeight,
  }

  const linesWidth = typeof width === "number" ? width : linesHostWidth
  const linesBackground = theme.mode === "dark" ? "#101010" : "#ffffff"
  const linesPaint = custom ? "#a66b00" : explicitColors ? "#2f7d18" : theme.colors.foreground
  const linesSnapshot = {
    ...linesBinding,
    layout: linesLayout,
    motionEvents,
    visible: linesVisible,
    fractional: linesFractional,
    width,
    rootWidth: linesWidth,
    hostWidth: linesHostWidth,
    measurementBackground: linesBackground,
    rootHeight: 50,
    stopped,
    duration: custom ? (stopped ? 0 : 500) : (duration ?? 3000),
    custom,
    explicitColors,
    mode: theme.mode,
  }

  return (
    <View style={styles.scene}>
      <Text elementType="h2" variant="h3">
        Loading indicators
      </Text>
      <Text testID="loading-state">
        Duration: {duration ?? "defaults"}. Circle size: {size}. Line width: {width}. Track:{" "}
        {transparent ? "clear" : "visible"}. Slide override: {custom ? (stopped ? "0" : "0.5s") : "none"}.
      </Text>
      <View style={styles.controls}>
        <Button onPress={() => setDurationIndex((index) => (index + 1) % LOADER_DURATIONS.length)}>
          Next loader duration
        </Button>
        <Button onPress={() => setStopped((current) => !current)}>Toggle stopped motion</Button>
        <Button onPress={() => setSizeIndex((index) => (index + 1) % CIRCLE_SIZES.length)}>Next circle size</Button>
        <Button onPress={() => setWidthIndex((index) => (index + 1) % LINE_WIDTHS.length)}>Next line width</Button>
        <Button onPress={() => setTransparent((current) => !current)}>Toggle transparent track</Button>
        <Button onPress={() => setExplicitColors((current) => !current)}>Toggle loader colors</Button>
        <Button onPress={() => setCustom((current) => !current)}>Toggle loader styles</Button>
        <Button onPress={() => setFractional((current) => !current)}>Toggle fractional circle</Button>
        <Button onPress={() => setVisible((current) => !current)}>Toggle circle presence</Button>
        <Button onPress={() => setLinesFractional((current) => !current)}>Toggle fractional lines</Button>
        <Button onPress={() => setLinesVisible((current) => !current)}>Toggle lines presence</Button>
      </View>
      <Text>The circle's container and ring have independent dimensions.</Text>
      <Text testID="loading-native-state" accessibilityLabel={JSON.stringify(snapshot)} numberOfLines={1}>
        {JSON.stringify(snapshot)}
      </Text>
      <View testID="loading-circle-pair" collapsable={false} style={{ flexDirection: "row", gap: 8 }}>
        <View
          testID="loading-circle-parent"
          collapsable={false}
          style={{ width: 104, height: 88, padding: 8, backgroundColor: "white" }}
        >
          {visible ? (
            <CircleLoader
              testID="loading-circle"
              ref={bind}
              onLayout={receiveLayout}
              accessibilityLabel="Saving circle"
              size={size}
              spinnerTrackWidth={size === 0 ? 0 : 3}
              duration={duration}
              spinnerColor={explicitColors ? "#2f7d18" : undefined}
              spinnerTrackColor={explicitColors ? "#a66b00" : undefined}
              spinnerTrackIsTransparent={transparent}
              customStyles={custom ? { marginTop: 5, color: "#b73434" } : undefined}
              style={custom ? () => ({ opacity: 0.8, color: "#087f8c", width: 72, height: 60 }) : undefined}
            />
          ) : null}
        </View>
        <View
          testID="loading-circle-reference-parent"
          collapsable={false}
          style={{ width: 104, height: 88, padding: 8, backgroundColor: "white" }}
        >
          <View
            style={{
              alignSelf: "flex-start",
              alignItems: "center",
              justifyContent: "center",
              width: rootWidth,
              height: rootHeight,
              marginTop: custom ? 5 : 0,
              opacity: custom ? 0.8 : 1,
            }}
          >
            <View
              testID="loading-circle-reference"
              style={{
                width: size,
                height: size,
                borderRadius: theme.radius.round,
                borderWidth: size === 0 ? 0 : 3,
                borderColor: track,
                borderTopColor: foreground,
                borderRightColor: foreground,
              }}
            />
          </View>
        </View>
      </View>
      <Text>Line styles affect each slide; the final style controls the outer container.</Text>
      <Text testID="loading-lines-native-state" accessibilityLabel={JSON.stringify(linesSnapshot)} numberOfLines={1}>
        {JSON.stringify(linesSnapshot)}
      </Text>
      <View testID="loading-lines-pair" collapsable={false} style={{ gap: 8 }}>
        <View
          testID="loading-lines-parent"
          collapsable={false}
          style={{ width: "100%", maxWidth: 330, height: 100, padding: 8, backgroundColor: linesBackground }}
        >
          <View
            testID="loading-lines-host"
            collapsable={false}
            style={{ width: "75%" }}
            onLayout={({ nativeEvent }) => setLinesHostWidth(nativeEvent.layout.width)}
          >
            {linesVisible ? (
              <LaggingLinesLoader
                testID="loading-lines"
                ref={bindLines}
                onLayout={receiveLinesLayout}
                accessibilityLabel="Fetching lines"
                width={width}
                duration={duration}
                color={explicitColors ? "#2f7d18" : undefined}
                customStyles={
                  custom
                    ? {
                        backgroundColor: "#a66b00",
                        borderRadius: 5,
                        height: 7,
                        animationDuration: stopped ? 0 : "0.5s",
                      }
                    : undefined
                }
                style={custom ? () => ({ marginBottom: 10 }) : undefined}
              />
            ) : null}
          </View>
        </View>
        <View
          testID="loading-lines-reference-parent"
          collapsable={false}
          style={{ width: "100%", maxWidth: 330, height: 100, padding: 8, backgroundColor: linesBackground }}
        >
          <View style={{ width: "75%" }}>
            <View
              style={{
                width,
                height: 50,
                alignSelf: "center",
                justifyContent: "center",
                marginBottom: custom ? 10 : 0,
              }}
            >
              <View style={{ width: "100%", height: 0 }}>
                {[
                  { opacity: 0.4, scaleX: 1.2 },
                  { opacity: 0.6, scaleX: 1.1 },
                  { opacity: 0.9, scaleX: 1 },
                ].map((recipe, index) => (
                  <View
                    key={index}
                    testID={"loading-lines-reference-motion-" + index}
                    style={{ position: "absolute", width: "20%" }}
                  >
                    <View
                      style={{
                        width: "100%",
                        height: custom ? 7 : 5,
                        opacity: recipe.opacity,
                        transform: [{ scaleX: recipe.scaleX }],
                        backgroundColor: linesPaint,
                        borderRadius: custom ? 5 : 0,
                      }}
                    />
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>
      <Button testID="loading-owned-button" order="primary">
        Saving example action
        <CircleLoader testID="loading-owned-circle" duration={duration} />
        <LaggingLinesLoader testID="loading-owned-lines" duration={duration} width={60} style={{ height: 20 }} />
      </Button>
      <Text>
        Reduce Motion keeps a static first frame. Le chargement reste annoncé même lorsque le mouvement est arrêté.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scene: { gap: 10 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
})
