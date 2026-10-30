import { cloneElement, useState, type PropsWithChildren, type ReactElement } from "react"
import { StyleSheet, View } from "react-native"

import {
  AVAILABLE_NATIVE_STROKE_LINECAPS,
  AVAILABLE_THEMING_ORDER_CODES,
  Button,
  CircularProgress,
  Counter,
  NativeCircularProgressContext,
  NativeCircularProgressLabel,
  NativeFocusView,
  Text,
} from "@codon-ui/react-native"

const valueLabels = [
  { name: "automatic", value: undefined },
  { name: "null", value: null },
  { name: "false", value: false },
  { name: "empty", value: "" },
  { name: "numeric zero", value: 0 },
  { name: "bigint zero", value: 0n },
  { name: "numeric label", value: 4 },
  { name: "bigint label", value: 4n },
  { name: "string zero", value: "0" },
  { name: "true", value: true },
  { name: "text", value: "One quarter" },
  { name: "array", value: ["1", " of ", 4] },
  { name: "fragment", value: <>One quarter</> },
  { name: "element", value: <Text>Value label nodes remain unmounted</Text> },
  { name: "promise", value: Promise.resolve("One quarter") },
] as const

const CounterLayoutChild = () => {
  const [content, setContent] = useState(0)
  const [explicitDisplay, setExplicitDisplay] = useState(false)
  return (
    <>
      <View
        testID="counter-layout-child"
        style={{ height: 20, width: 20, backgroundColor: "purple", display: explicitDisplay ? "flex" : undefined }}
      >
        {content === 1 ? <Text> </Text> : content === 2 ? <View testID="counter-layout-nested" /> : null}
      </View>
      <Button onPress={() => setContent((current) => (current + 1) % 3)}>Next counter child content</Button>
      <Button onPress={() => setExplicitDisplay((current) => !current)}>Toggle counter child display</Button>
      <Text testID="counter-layout-state">
        Child: {content}. Explicit display: {String(explicitDisplay)}.
      </Text>
    </>
  )
}

export const CircularCounterScene = () => {
  const [value, setValue] = useState(25)
  const [raw, setRaw] = useState(false)
  const [maxIndex, setMaxIndex] = useState(0)
  const [half, setHalf] = useState(false)
  const [reverse, setReverse] = useState(false)
  const [capIndex, setCapIndex] = useState(0)
  const [orderIndex, setOrderIndex] = useState(-1)
  const [custom, setCustom] = useState(false)
  const [unknown, setUnknown] = useState(false)
  const [showMax, setShowMax] = useState(true)
  const [showRing, setShowRing] = useState(true)
  const [valueLabelIndex, setValueLabelIndex] = useState(0)
  const [composition, setComposition] = useState(false)
  const max = [100, 0, "0"] as const
  const cap = AVAILABLE_NATIVE_STROKE_LINECAPS[capIndex]
  const order = orderIndex < 0 ? undefined : AVAILABLE_THEMING_ORDER_CODES[orderIndex]
  const rawValue = raw ? "not numeric" : value
  return (
    <View style={styles.scene}>
      <Text elementType="h2" variant="h3">
        Circular progress and counters
      </Text>
      <Text testID="circular-value-label-state">Value label: {valueLabels[valueLabelIndex].name}.</Text>
      <Text testID="circular-counter-state">
        Value: {value}. Counter: {rawValue}. Max: {String(max[maxIndex])} ({typeof max[maxIndex]}). Ratio:{" "}
        {half ? "half" : "full"}. Direction: {reverse ? "counter-clockwise" : "forward"}. Cap: {cap}. Order:{" "}
        {order ?? "semantic"}.
      </Text>
      <View style={styles.controls}>
        <Button onPress={() => setValue((current) => Math.min(100, current + 25))}>Advance circular value</Button>
        <Button onPress={() => setValue(0)}>Zero circular value</Button>
        <Button onPress={() => setValue(79.5)}>Set rounded warning threshold</Button>
        <Button onPress={() => setValue(89.5)}>Set rounded danger threshold</Button>
        <Button onPress={() => setRaw((current) => !current)}>Toggle raw counter text</Button>
        <Button onPress={() => setMaxIndex((current) => (current + 1) % max.length)}>Next counter max</Button>
        <Button onPress={() => setHalf((current) => !current)}>Toggle circular ratio</Button>
        <Button onPress={() => setReverse((current) => !current)}>Reverse circular direction</Button>
        <Button onPress={() => setCapIndex((current) => (current + 1) % AVAILABLE_NATIVE_STROKE_LINECAPS.length)}>
          Next circular cap
        </Button>
        <Button
          onPress={() =>
            setOrderIndex((current) => (current < AVAILABLE_THEMING_ORDER_CODES.length - 1 ? current + 1 : -1))
          }
        >
          Next circular order
        </Button>
        <Button onPress={() => setCustom((current) => !current)}>Toggle circular and counter styles</Button>
        <Button onPress={() => setUnknown((current) => !current)}>Toggle circular unknown semantics</Button>
        <Button onPress={() => setValueLabelIndex((current) => (current + 1) % valueLabels.length)}>
          Next circular value label
        </Button>
        <Button onPress={() => setShowMax((current) => !current)}>Toggle counter max suffix</Button>
        <Button onPress={() => setShowRing((current) => !current)}>Toggle counter ring</Button>
        <Button onPress={() => setComposition((current) => !current)}>Toggle circular composition</Button>
      </View>
      <CircularProgress
        testID="circular-demo"
        aria-label="Circular task progress"
        value={value}
        valueLabel={valueLabels[valueLabelIndex].value}
        text={`${value}%`}
        width={120}
        height={120}
        circleRatio={half ? 0.5 : 1}
        counterClockwise={reverse}
        strokeLineCap={cap}
        order={order}
        backgroundColor={custom ? "red" : undefined}
        backgroundPadding={custom ? 4 : 0}
        isIndeterminate={unknown}
        customStyles={custom ? { opacity: 0.85 } : undefined}
        customSVGStyles={custom ? { transform: [{ rotate: "12deg" }] } : undefined}
        customTrackStyles={custom ? { stroke: "#a66b00", strokeWidth: 4 } : undefined}
        customPathStyles={custom ? { stroke: "#2f7d18", strokeWidth: 8 } : undefined}
        customTextStyles={custom ? { fill: "#b73434", fontSize: 18 } : undefined}
        customBackgroundStyles={custom ? { fill: "#efefef" } : undefined}
      />
      <Counter
        testID="counter-demo"
        aria-label="Task count"
        value={rawValue}
        maxValue={max[maxIndex]}
        showMaxValue={showMax}
        showProgressIndicator={showRing}
        warningPercentageThreshold={80}
        errorOrDangerPercentageThreshold={90}
        customStyles={custom ? { padding: 8, borderWidth: 1, borderColor: "#a66b00" } : undefined}
        customTextStyles={custom ? { fontSize: 18, fontWeight: "bold" } : undefined}
        customProgressIndicatorStyles={custom ? { width: 20, height: 20 } : undefined}
      >
        <Text>Caller-owned count</Text>
      </Counter>
      {composition ? (
        <>
          <NativeCircularProgressContext.Provider value={{ slots: { task: { maxValue: 200 } } }}>
            <CircularProgress
              testID="circular-context-demo"
              slot="task"
              value={value}
              render={(props) => {
                const provider = props.children as ReactElement<PropsWithChildren>
                return (
                  <NativeFocusView {...props}>
                    {cloneElement(
                      provider,
                      undefined,
                      <>
                        <NativeCircularProgressLabel testID="circular-context-label">
                          Scoped task progress
                        </NativeCircularProgressLabel>
                        {provider.props.children}
                      </>,
                    )}
                  </NativeFocusView>
                )
              }}
            />
          </NativeCircularProgressContext.Provider>
          <Counter value={value} testID="counter-layout-demo" customStyles={{ fontStyle: "italic", letterSpacing: 2 }}>
            <CounterLayoutChild />
          </Counter>
          <Text>Native layout check: the empty purple box is hidden until it has content or explicit display.</Text>
        </>
      ) : null}
      <Text>
        Named vector colors retain the canonical color/stroke distinction. Explicit slot stroke/fill styles own paint.
        Numeric max zero hides optional parts; string zero retains them.
      </Text>
    </View>
  )
}
const styles = StyleSheet.create({ scene: { gap: 16 }, controls: { flexDirection: "row", flexWrap: "wrap", gap: 8 } })
