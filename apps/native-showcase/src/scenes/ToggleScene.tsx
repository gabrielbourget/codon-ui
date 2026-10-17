import { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"

import {
  AVAILABLE_CORNER_GEOMETRY_CODES,
  AVAILABLE_THEMING_ORDER_CODES,
  Button,
  Text,
  ToggleButton,
  ToggleSwitcher,
  type ToggleSwitcherItem,
} from "@codon-ui/react-native"

const MATCH_OPTIONS: readonly ToggleSwitcherItem[] = [
  {
    id: "and",
    label: "Match all conditions — conserver tous les paramètres sélectionnés.",
    accessibilityLabel: "Match all conditions",
  },
  { id: "or", label: "Match any condition", accessibilityLabel: "Match any condition" },
  { id: "", label: "No condition" },
]

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
  const [matchMode, setMatchMode] = useState("and")
  const [matchRequest, setMatchRequest] = useState<string>()
  const [matchRequests, setMatchRequests] = useState(0)
  const [readOnly, setReadOnly] = useState(false)
  const [reversed, setReversed] = useState(false)
  const [missing, setMissing] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [memberDisabled, setMemberDisabled] = useState(false)
  const matchOptions = useMemo(() => {
    if (empty) return []
    const current = MATCH_OPTIONS.filter((item) => !missing || item.id !== matchMode).map((item) =>
      item.id === "or" ? { ...item, disabled: memberDisabled } : item,
    )
    return reversed ? current.reverse() : current
  }, [matchMode, missing, reversed, empty, memberDisabled])
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
      <Text elementType="h3" variant="h4">
        Match modes
      </Text>
      <Text testID="switcher-state">
        Match key: {matchMode === "" ? "empty" : matchMode}. Request:{" "}
        {matchRequest === undefined ? "none" : matchRequest === "" ? "empty" : matchRequest}. Requests: {matchRequests}.
        Read only: {String(readOnly)}. Missing: {String(missing)}. Collection empty: {String(empty)}.
      </Text>
      <View style={styles.controls}>
        <Button onPress={() => setReadOnly((current) => !current)}>Toggle switcher read only</Button>
        <Button onPress={() => setReversed((current) => !current)}>Reverse switcher items</Button>
        <Button onPress={() => setMissing((current) => !current)}>Toggle selected option removal</Button>
        <Button onPress={() => setEmpty((current) => !current)}>Toggle empty switcher collection</Button>
        <Button onPress={() => setMemberDisabled((current) => !current)}>Toggle second option disabled</Button>
        <Button onPress={() => setMatchMode("")}>Select empty switcher key</Button>
      </View>
      <ToggleSwitcher
        testID="toggle-switcher-example"
        accessibilityLabel="Match mode"
        items={matchOptions}
        selectedKey={matchMode}
        onSelectionChange={(key) => {
          setMatchRequest(key)
          setMatchRequests((count) => count + 1)
          if (!veto) setMatchMode(key)
        }}
        isDisabled={disabled}
        isReadOnly={readOnly}
        order={order}
        geometry={geometry}
        width={zero ? 0 : undefined}
        color={explicitColor ? "#2f7d18" : undefined}
        fontSize={custom ? 14 : 12}
        uppercase={custom}
        optionFontWeight={custom ? "medium" : undefined}
        selectedOptionFontWeight={custom ? "bold" : undefined}
        customStyles={custom ? { marginTop: 5, backgroundColor: "#efefef" } : undefined}
        style={custom ? () => ({ marginBottom: 10 }) : undefined}
        customOptionStyles={custom ? { borderRadius: 3, color: "#a66b00" } : undefined}
        customSelectedOptionStyles={custom ? { color: "#087f8c", backgroundColor: "#f7f7f7" } : undefined}
      />
      <Text>Reset explicitly remounts the examples and clears request counts.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scene: { gap: 10 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
})
