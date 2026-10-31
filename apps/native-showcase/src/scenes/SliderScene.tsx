import { useRef, useState } from "react"
import { View } from "react-native"

import { Button, Slider, Text, useNativeTheme, type TNativeSliderState } from "@codon-ui/react-native"

const ORDERS = [undefined, "primary", "secondary", "tertiary", "quaternary", "quintenary"] as const
const GEOMETRIES = ["round", "rounded", "orthogonal"] as const
export const SliderScene = () => {
  const theme = useNativeTheme()
  const [value, setValue] = useState(0)
  const [range, setRange] = useState<number[]>([0.25, 0.75])
  const [request, setRequest] = useState("none")
  const [end, setEnd] = useState("none")
  const [requests, setRequests] = useState(0)
  const [ends, setEnds] = useState(0)
  const [veto, setVeto] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [vertical, setVertical] = useState(false)
  const [rtl, setRtl] = useState(false)
  const [custom, setCustom] = useState(false)
  const [zero, setZero] = useState(false)
  const [french, setFrench] = useState(false)
  const [percent, setPercent] = useState(false)
  const [shadow, setShadow] = useState(true)
  const [focus, setFocus] = useState(true)
  const [orderIndex, setOrderIndex] = useState(0)
  const [geometryIndex, setGeometryIndex] = useState(0)
  const [memberDisabled, setMemberDisabled] = useState(false)
  const [frame, setFrame] = useState("unmeasured")
  const rangeState = useRef<TNativeSliderState | null>(null)
  const action = (label: string, onPress: () => void) => (
    <Button order="primary" raised={false} accessibilityLabel={label} onPress={onPress}>
      {label}
    </Button>
  )
  const common = {
    minValue: 0,
    maxValue: 1,
    step: 0.05,
    width: zero ? 0 : ("100%" as const),
    maxWidth: 300,
    orientation: vertical ? ("vertical" as const) : ("horizontal" as const),
    height: vertical ? 240 : undefined,
    direction: rtl ? ("rtl" as const) : ("ltr" as const),
    isDisabled: disabled,
    locale: french ? "fr-CA" : "en-US",
    formatOptions: percent ? { style: "percent" as const } : undefined,
    geometry: GEOMETRIES[geometryIndex],
    order: ORDERS[orderIndex],
    raised: shadow,
    enableFocusStyle: focus,
    customStyles: custom ? { padding: 6, borderWidth: 1, borderColor: theme.colors.focusRing } : undefined,
    customLabelStyles: custom ? { color: theme.actions.tertiary.border } : undefined,
    customOutputStyles: custom ? { fontSize: 16, color: theme.actions.primary.border } : undefined,
    customTrackStyles: custom ? { backgroundColor: theme.colors.controlTrackBackground } : undefined,
    customThumbStyles: custom
      ? { width: 24, height: 24, minHeight: 0, borderRadius: 5, backgroundColor: theme.actions.primary.background }
      : undefined,
  }
  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2" variant="h3">
        Native Slider
      </Text>
      <Slider
        {...common}
        testID="slider-scalar"
        accessibilityLabel="Scalar adjustment"
        label="Scalar adjustment"
        thumbAriaLabels={["Scalar handle"]}
        value={value}
        onChange={(next) => {
          setRequest(`scalar ${next}`)
          setRequests((count) => count + 1)
          if (!veto) setValue(next)
        }}
        onChangeEnd={(next) => {
          setEnd(`scalar ${next}`)
          setEnds((count) => count + 1)
        }}
        onLayout={({ nativeEvent: { layout } }) => {
          const next = `${Number(layout.width.toFixed(3))} x ${Number(layout.height.toFixed(3))}`
          setFrame((old) => (old === next ? old : next))
        }}
      />
      <Slider
        {...common}
        testID="slider-range"
        accessibilityLabel="Range adjustment"
        label="Range adjustment"
        thumbAriaLabels={["Lower handle", "Upper handle"]}
        value={range}
        onChange={(next) => {
          setRequest(`range ${JSON.stringify(next)}`)
          setRequests((count) => count + 1)
          if (!veto) setRange(next)
        }}
        onChangeEnd={(next) => {
          setEnd(`range ${JSON.stringify(next)}`)
          setEnds((count) => count + 1)
        }}
        style={({ state, defaultStyle }) => {
          rangeState.current = state
          return { ...defaultStyle, maxWidth: custom ? 280 : defaultStyle.maxWidth }
        }}
      />
      <Text testID="slider-state">
        Scalar: {value}. Range: {JSON.stringify(range)}. Request: {request}. Requests: {requests}. End: {end}. Ends:{" "}
        {ends}. Parent: {veto ? "veto" : "echo"}. Disabled: {String(disabled)}. Orientation:{" "}
        {vertical ? "vertical" : "horizontal"}. Direction: {rtl ? "rtl" : "ltr"}. Order: {ORDERS[orderIndex] ?? "none"}.
        Geometry: {GEOMETRIES[geometryIndex]}. Locale: {french ? "fr-CA" : "en-US"}. Format:{" "}
        {percent ? "percent" : "decimal"}. Member disabled: {String(memberDisabled)}.
      </Text>
      <Text testID="slider-frame">Last native scalar root: {frame}.</Text>
      <Text>
        Track presses select the nearest handle. Dragging retains the grab offset; separate request/end receipts keep
        owner veto visible. Two independent handles retain adjacent bounds. Native frame receipts never feed numeric
        values.
      </Text>
      {action("Toggle slider owner veto", () => setVeto((old) => !old))}
      {action("Set slider scalar zero", () => setValue(0))}
      {action("Set slider scalar maximum", () => setValue(1))}
      {action("Toggle empty slider range", () => {
        setRange((old) => (old.length ? [] : [0.25, 0.75]))
        setMemberDisabled(false)
      })}
      {action("Set stacked slider range", () => {
        if ((rangeState.current?.values.length ?? 0) >= 2) rangeState.current?.setThumbEditable(1, true)
        setRange([0.5, 0.5])
        setMemberDisabled(false)
      })}
      {action("Toggle slider upper editable", () => {
        if ((rangeState.current?.values.length ?? 0) < 2) return
        const next = !memberDisabled
        rangeState.current?.setThumbEditable(1, !next)
        setMemberDisabled(next)
      })}
      {action("Toggle slider disabled", () => setDisabled((old) => !old))}
      {action("Toggle slider orientation", () => setVertical((old) => !old))}
      {action("Toggle slider direction", () => setRtl((old) => !old))}
      {action("Next slider order", () => setOrderIndex((index) => (index + 1) % ORDERS.length))}
      {action("Next slider geometry", () => setGeometryIndex((index) => (index + 1) % GEOMETRIES.length))}
      {action("Toggle slider styles", () => setCustom((old) => !old))}
      {action("Toggle slider zero width", () => setZero((old) => !old))}
      {action("Toggle slider locale", () => setFrench((old) => !old))}
      {action("Toggle slider format", () => setPercent((old) => !old))}
      {action("Toggle slider shadow", () => setShadow((old) => !old))}
      {action("Toggle slider focus style", () => setFocus((old) => !old))}
      <Text testID="slider-content-end">
        Fin des réglages de plage — gardez les valeurs, les poignées et cette dernière explication accessibles lorsque
        la fenêtre ou le texte système change.
      </Text>
    </View>
  )
}
