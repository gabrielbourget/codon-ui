import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { AVAILABLE_INDICATOR_SHAPES, Button, Indicator, LineSegment, Text } from "@codon-ui/react-native"

const DISPLAY_SIZES = [10, 14, 20] as const

export const DisplayScene = () => {
  const [isActive, setIsActive] = useState(true)
  const [shapeIndex, setShapeIndex] = useState(0)
  const [sizeIndex, setSizeIndex] = useState(0)
  const [vertical, setVertical] = useState(false)
  const [bordered, setBordered] = useState(false)
  const [custom, setCustom] = useState(false)
  const [explicitColors, setExplicitColors] = useState(false)
  const [zero, setZero] = useState(false)
  const shape = AVAILABLE_INDICATOR_SHAPES[shapeIndex]
  const size = zero ? 0 : DISPLAY_SIZES[sizeIndex]
  const direction = vertical ? "vertical" : "horizontal"

  return (
    <View style={styles.scene}>
      <Text elementType="h2" variant="h3">
        Indicators and segments
      </Text>
      <Text testID="display-state">
        Indicator: {isActive ? "active" : "inactive"}. Shape: {shape}. Size: {size}. Segment token: {direction}.
      </Text>
      <View style={styles.controls}>
        <Button onPress={() => setIsActive((current) => !current)}>Toggle indicator activity</Button>
        <Button onPress={() => setShapeIndex((index) => (index + 1) % AVAILABLE_INDICATOR_SHAPES.length)}>
          Next indicator shape
        </Button>
        <Button onPress={() => setSizeIndex((index) => (index + 1) % DISPLAY_SIZES.length)}>Next display size</Button>
        <Button onPress={() => setVertical((current) => !current)}>Toggle segment direction</Button>
        <Button onPress={() => setBordered((current) => !current)}>Toggle indicator border</Button>
        <Button onPress={() => setExplicitColors((current) => !current)}>Toggle explicit display colors</Button>
        <Button onPress={() => setCustom((current) => !current)}>Toggle display styles</Button>
        <Button onPress={() => setZero((current) => !current)}>Toggle zero dimensions</Button>
      </View>
      <View style={styles.preview}>
        <Text>Availability</Text>
        <Indicator
          testID="display-indicator"
          isActive={isActive}
          shape={shape}
          size={size}
          borderWidth={zero ? 0 : bordered ? 2 : 0}
          color={explicitColors ? "#2f7d18" : undefined}
          inactiveColor={explicitColors ? "#a66b00" : undefined}
          accessible
          role="img"
          accessibilityLabel={isActive ? "Availability active" : "Availability inactive"}
          customStyles={custom ? { backgroundColor: "#a66b00", opacity: 0.8 } : undefined}
          style={custom ? (state) => ({ backgroundColor: state.isActive ? "#2f7d18" : "#b73434" }) : undefined}
        />
        <Text>The indicator below inherits the action's foreground.</Text>
        <Button order="primary" onPress={() => setIsActive((current) => !current)}>
          Toggle activity from example action
          <Indicator testID="display-owned-indicator" isActive={isActive} />
        </Button>
      </View>
      <Text>
        Segment token {direction}: {vertical ? "width × thickness" : "height × thickness"}.
      </Text>
      <LineSegment
        testID="display-segment"
        direction={direction}
        height={zero ? 0 : 60}
        width={zero ? 0 : 90}
        size={zero ? 0 : 3}
        color={explicitColors ? "#2f7d18" : undefined}
        accessible
        role="separator"
        accessibilityLabel="Example boundary"
        customStyles={custom ? { backgroundColor: "#a66b00", opacity: 0.75 } : undefined}
        style={
          custom ? (state) => ({ backgroundColor: state.direction === "vertical" ? "#2f7d18" : "#b73434" }) : undefined
        }
      />
      <Text>Long descriptive copy: les couleurs et les dimensions restent liées aux paramètres choisis.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scene: { gap: 10 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  preview: { gap: 10 },
})
