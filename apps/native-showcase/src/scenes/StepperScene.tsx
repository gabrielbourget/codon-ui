import { useRef, useState } from "react"
import { View } from "react-native"

import { Button, Stepper, Text, useNativeTheme, type TNativeStepperRef } from "@codon-ui/react-native"

const GEOMETRIES = ["round", "rounded", "orthogonal"] as const
const ORDERS = [undefined, "primary", "secondary", "tertiary", "quaternary", "quintenary"] as const
const SIZES = ["medium", "small", "large"] as const
const STATUSES = ["none", "error", "warning", "success"] as const

export const StepperScene = () => {
  const theme = useNativeTheme()
  const ref = useRef<TNativeStepperRef>(null)
  const [value, setValue] = useState<number | null>(0)
  const [requested, setRequested] = useState<number | null>()
  const [raw, setRaw] = useState("")
  const [requests, setRequests] = useState(0)
  const [veto, setVeto] = useState(false)
  const [cohesive, setCohesive] = useState(false)
  const [vertical, setVertical] = useState(false)
  const [outline, setOutline] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [custom, setCustom] = useState(false)
  const [zero, setZero] = useState(false)
  const [icons, setIcons] = useState(false)
  const [french, setFrench] = useState(false)
  const [geometryIndex, setGeometryIndex] = useState(0)
  const [orderIndex, setOrderIndex] = useState(0)
  const [sizeIndex, setSizeIndex] = useState(0)
  const [statusIndex, setStatusIndex] = useState(0)
  const [frame, setFrame] = useState("unmeasured")
  const action = (label: string, onPress: () => void) => (
    <Button order="primary" raised={false} accessibilityLabel={label} onPress={onPress}>
      {label}
    </Button>
  )
  const status = STATUSES[statusIndex]
  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2" variant="h3">
        Native Stepper
      </Text>
      <Text testID="stepper-state">
        Value: {value ?? "empty"}. Request: {requested === undefined ? "none" : (requested ?? "empty")}. Requests:{" "}
        {requests}. Raw: {raw === "" ? "empty" : raw}. Parent: {veto ? "veto" : "echo"}. Type:{" "}
        {cohesive ? "cohesive" : "segmented"}. Orientation: {vertical ? "vertical" : "horizontal"}. Mode:{" "}
        {outline ? "outline" : "fill"}. Order: {ORDERS[orderIndex] ?? "none"}. Geometry: {GEOMETRIES[geometryIndex]}.
        Size: {SIZES[sizeIndex]}. Guard: {disabled ? "disabled" : readOnly ? "read-only" : "enabled"}. Locale:{" "}
        {french ? "fr-CA" : "en-US"}. Status: {status}.
      </Text>
      <Text testID="stepper-frame">Last native root: {frame}.</Text>
      <Stepper
        ref={ref}
        testID="stepper-example"
        accessibilityLabel="Controlled quantity"
        incrementLabel="Increase controlled quantity"
        decrementLabel="Decrease controlled quantity"
        value={value}
        minValue={-1}
        maxValue={1}
        step={0.1}
        locale={french ? "fr-CA" : "en-US"}
        onChangeText={setRaw}
        onChange={(next) => {
          setRequested(next)
          setRequests((count) => count + 1)
          if (!veto) setValue(next)
        }}
        type={cohesive ? "cohesive" : "segmented"}
        orientation={vertical ? "vertical" : "horizontal"}
        colorMode={outline ? "outline" : "fill"}
        order={ORDERS[orderIndex]}
        geometry={GEOMETRIES[geometryIndex]}
        textSize={SIZES[sizeIndex]}
        isDisabled={disabled}
        isReadOnly={readOnly}
        errorState={status === "error"}
        warningState={status === "warning"}
        successState={status === "success"}
        width={zero ? 0 : "100%"}
        labels={{ inputButtonGroupAriaLabel: french ? "Commandes de quantité" : "Quantity controls" }}
        PlusIcon={icons ? <Text>+</Text> : undefined}
        MinusIcon={icons ? <Text>−</Text> : undefined}
        customStyles={custom ? { borderWidth: 2, borderColor: theme.colors.focusRing, padding: 8 } : undefined}
        customGroupStyles={custom ? { gap: 12, backgroundColor: theme.colors.controlBackground } : undefined}
        customInputStyles={custom ? { fontSize: 18, maxWidth: 80, color: theme.actions.secondary.border } : undefined}
        customButtonStyles={
          custom ? { width: 44, height: 44, padding: 0, paddingHorizontal: 0, borderRadius: 5 } : undefined
        }
        style={({ defaultStyle, isReadOnly }) => ({
          ...defaultStyle,
          opacity: isReadOnly ? 0.8 : defaultStyle.opacity,
        })}
        onLayout={({ nativeEvent: { layout } }) => {
          const next = `${Number(layout.width.toFixed(3))} x ${Number(layout.height.toFixed(3))}`
          setFrame((current) => (current === next ? current : next))
        }}
      />
      <Text>
        Caller-owned decimal quantity, bounded from−1 to1. A short release requests one step. Hold to repeat; the
        separate request count also exposes repeated owner veto. Frame receipts are observations only.
      </Text>
      {action("Toggle stepper owner veto", () => setVeto((current) => !current))}
      {action("Set stepper zero", () => setValue(0))}
      {action("Set stepper empty", () => setValue(null))}
      {action("Set stepper maximum", () => setValue(1))}
      {action("Toggle stepper type", () => setCohesive((current) => !current))}
      {action("Toggle stepper orientation", () => setVertical((current) => !current))}
      {action("Toggle stepper color mode", () => setOutline((current) => !current))}
      {action("Next stepper order", () => setOrderIndex((index) => (index + 1) % ORDERS.length))}
      {action("Next stepper geometry", () => setGeometryIndex((index) => (index + 1) % GEOMETRIES.length))}
      {action("Next stepper text size", () => setSizeIndex((index) => (index + 1) % SIZES.length))}
      {action("Next stepper status", () => setStatusIndex((index) => (index + 1) % STATUSES.length))}
      {action("Toggle stepper disabled", () => setDisabled((current) => !current))}
      {action("Toggle stepper read-only", () => setReadOnly((current) => !current))}
      {action("Toggle stepper styles", () => setCustom((current) => !current))}
      {action("Toggle stepper zero width", () => setZero((current) => !current))}
      {action("Toggle stepper icons", () => setIcons((current) => !current))}
      {action("Toggle stepper locale", () => setFrench((current) => !current))}
      {action("Focus stepper editor", () => ref.current?.focus())}
      <Text testID="stepper-content-end">
        Fin des contrôles de quantité — gardez cette dernière action et les messages accessibles lorsque le texte
        système ou la fenêtre change.
      </Text>
    </View>
  )
}
