import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { Button, CircleLoader, LaggingLinesLoader, Text } from "@codon-ui/react-native"

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
  const duration = stopped ? 0 : LOADER_DURATIONS[durationIndex]
  const size = CIRCLE_SIZES[sizeIndex]
  const width = LINE_WIDTHS[widthIndex]

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
      </View>
      <Text>The circle's container and ring have independent dimensions.</Text>
      <CircleLoader
        testID="loading-circle"
        accessibilityLabel="Saving circle"
        size={size}
        spinnerTrackWidth={size === 0 ? 0 : 3}
        duration={duration}
        spinnerColor={explicitColors ? "#2f7d18" : undefined}
        spinnerTrackColor={explicitColors ? "#a66b00" : undefined}
        spinnerTrackIsTransparent={transparent}
        customStyles={custom ? { marginTop: 5, color: "#b73434" } : undefined}
        style={custom ? () => ({ opacity: 0.8, color: "#087f8c" }) : undefined}
      />
      <Text>Line styles affect each slide; the final style controls the outer container.</Text>
      <LaggingLinesLoader
        testID="loading-lines"
        accessibilityLabel="Fetching lines"
        width={width}
        duration={duration}
        color={explicitColors ? "#2f7d18" : undefined}
        customStyles={
          custom
            ? { backgroundColor: "#a66b00", borderRadius: 5, height: 7, animationDuration: stopped ? 0 : "0.5s" }
            : undefined
        }
        style={custom ? () => ({ marginBottom: 10 }) : undefined}
      />
      <Button order="primary">
        Saving example action
        <CircleLoader testID="loading-owned-circle" duration={duration} />
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
