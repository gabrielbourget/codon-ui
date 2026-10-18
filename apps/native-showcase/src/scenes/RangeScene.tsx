import { useState } from "react"
import { StyleSheet, View } from "react-native"

import {
  AVAILABLE_CORNER_GEOMETRY_CODES,
  AVAILABLE_THEMING_ORDER_CODES,
  Button,
  LinearProgress,
  Meter,
  Text,
  type LinearProgressProps,
} from "@codon-ui/react-native"

export const RangeScene = () => {
  const [value, setValue] = useState(25)
  const [unknown, setUnknown] = useState(false)
  const [vertical, setVertical] = useState(false)
  const [reverse, setReverse] = useState(false)
  const [custom, setCustom] = useState(false)
  const [authoredLabel, setAuthoredLabel] = useState(false)
  const [geometryIndex, setGeometryIndex] = useState(2)
  const [orderIndex, setOrderIndex] = useState(-1)
  const geometry = AVAILABLE_CORNER_GEOMETRY_CODES[geometryIndex]
  const order = orderIndex < 0 ? undefined : AVAILABLE_THEMING_ORDER_CODES[orderIndex]
  const presentation: Pick<
    LinearProgressProps,
    | "orientation"
    | "direction"
    | "height"
    | "width"
    | "barGeometry"
    | "trackGeometry"
    | "order"
    | "raised"
    | "customStyles"
    | "customTrackStyles"
    | "customBarStyles"
  > = {
    orientation: vertical ? "vertical" : "horizontal",
    direction: vertical ? (reverse ? "down" : "up") : reverse ? "left" : "right",
    width: vertical ? 18 : "100%",
    height: vertical ? 140 : 14,
    barGeometry: geometry,
    trackGeometry: geometry,
    order,
    raised: custom,
    customStyles: custom ? { opacity: 0.85 } : undefined,
    customTrackStyles: custom ? { borderColor: "#a66b00", borderWidth: 2 } : undefined,
    customBarStyles: custom ? { backgroundColor: "#2f7d18", borderRadius: 2 } : undefined,
  }

  return (
    <View style={styles.scene}>
      <Text elementType="h2" variant="h3">
        Progress and measurement
      </Text>
      <Text testID="range-state">
        Progress: {value}%. Measurement: {value - 50}. {unknown ? "Unknown" : "Known"} progress.{" "}
        {vertical ? "Vertical" : "Horizontal"}, {reverse ? "reversed" : "forward"}. Geometry: {geometry}. Order:{" "}
        {order ?? "semantic"}.
      </Text>
      <View style={styles.controls}>
        <Button onPress={() => setValue((current) => Math.min(100, current + 25))}>Advance range by 25</Button>
        <Button onPress={() => setValue(0)}>Reset range to zero</Button>
        <Button onPress={() => setUnknown((current) => !current)}>Toggle unknown progress</Button>
        <Button onPress={() => setVertical((current) => !current)}>Toggle range orientation</Button>
        <Button onPress={() => setReverse((current) => !current)}>Reverse range direction</Button>
        <Button onPress={() => setGeometryIndex((index) => (index + 1) % AVAILABLE_CORNER_GEOMETRY_CODES.length)}>
          Next range geometry
        </Button>
        <Button
          onPress={() => setOrderIndex((index) => (index < AVAILABLE_THEMING_ORDER_CODES.length - 1 ? index + 1 : -1))}
        >
          Next range order
        </Button>
        <Button onPress={() => setCustom((current) => !current)}>Toggle range styles</Button>
        <Button onPress={() => setAuthoredLabel((current) => !current)}>Toggle authored value labels</Button>
      </View>
      <Text>Task progress</Text>
      <LinearProgress
        {...presentation}
        testID="range-progress"
        accessibilityLabel="Task progress"
        value={value}
        isIndeterminate={unknown}
        valueLabel={authoredLabel ? String(value) + " of 100 tasks" : undefined}
      />
      <Text>Measurement from −50 to 50</Text>
      <Meter
        {...presentation}
        testID="range-meter"
        accessibilityLabel="Measured capacity"
        value={value - 50}
        minValue={-50}
        maxValue={50}
        locale="en-US"
        formatOptions={{ style: "decimal" }}
        valueLabel={authoredLabel ? String(value - 50) + " units" : undefined}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  scene: { gap: 10 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
})
