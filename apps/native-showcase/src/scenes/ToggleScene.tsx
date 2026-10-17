import { useState } from "react"
import { StyleSheet, View } from "react-native"

import {
  AVAILABLE_CORNER_GEOMETRY_CODES,
  AVAILABLE_THEMING_ORDER_CODES,
  Button,
  Text,
  ToggleButton,
} from "@codon-ui/react-native"

export const ToggleScene = () => {
  const [selected, setSelected] = useState(false)
  const [veto, setVeto] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [request, setRequest] = useState<boolean>()
  const [requests, setRequests] = useState(0)
  const [activations, setActivations] = useState(0)
  const [orderIndex, setOrderIndex] = useState(0)
  const [geometryIndex, setGeometryIndex] = useState(0)
  const [explicitColor, setExplicitColor] = useState(false)
  const [custom, setCustom] = useState(false)
  const [zero, setZero] = useState(false)
  const order = AVAILABLE_THEMING_ORDER_CODES[orderIndex]
  const geometry = AVAILABLE_CORNER_GEOMETRY_CODES[geometryIndex]

  return (
    <View style={styles.scene}>
      <Text elementType="h2" variant="h3">
        Toggle buttons
      </Text>
      <Text testID="toggle-state">
        Owner: {String(selected)}. Request: {request === undefined ? "none" : String(request)}. Requests: {requests}.
        Activations: {activations}. Veto: {String(veto)}. Order: {order}. Geometry: {geometry}.
      </Text>
      <View style={styles.controls}>
        <Button onPress={() => setVeto((current) => !current)}>Toggle caller veto</Button>
        <Button onPress={() => setDisabled((current) => !current)}>Toggle toggle disabled</Button>
        <Button onPress={() => setOrderIndex((index) => (index + 1) % AVAILABLE_THEMING_ORDER_CODES.length)}>
          Next toggle order
        </Button>
        <Button onPress={() => setGeometryIndex((index) => (index + 1) % AVAILABLE_CORNER_GEOMETRY_CODES.length)}>
          Next toggle geometry
        </Button>
        <Button onPress={() => setExplicitColor((current) => !current)}>Toggle explicit toggle color</Button>
        <Button onPress={() => setCustom((current) => !current)}>Toggle toggle styles</Button>
        <Button onPress={() => setZero((current) => !current)}>Toggle zero toggle dimensions</Button>
      </View>
      <ToggleButton
        testID="toggle-controlled"
        accessibilityLabel="Controlled flag"
        isSelected={selected}
        isDisabled={disabled}
        order={order}
        geometry={geometry}
        color={explicitColor ? "#2f7d18" : undefined}
        width={zero ? 0 : undefined}
        height={zero ? 0 : undefined}
        onChange={(next) => {
          setRequest(next)
          setRequests((count) => count + 1)
          if (!veto) setSelected(next)
        }}
        onPress={() => setActivations((count) => count + 1)}
        customStyles={custom ? { marginTop: 5, color: "#a66b00" } : undefined}
        style={custom ? (state) => ({ color: state.isSelected ? "#2f7d18" : "#b73434", marginBottom: 10 }) : undefined}
      >
        {({ isSelected, foregroundColor }) => (
          <Text color={foregroundColor}>{isSelected ? "Flag on" : "Flag off"}</Text>
        )}
      </ToggleButton>
      <Text>The second button owns its initial selection; changing host fixtures preserves it.</Text>
      <ToggleButton testID="toggle-uncontrolled" accessibilityLabel="Local flag" defaultSelected isDisabled={disabled}>
        Local flag with a long label: conserver les paramètres sélectionnés lors du changement de thème.
      </ToggleButton>
      <Text>Reset explicitly remounts both examples and clears request counts.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scene: { gap: 10 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
})
