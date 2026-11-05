import { useCallback, useEffect, useRef, useState } from "react"
import { findNodeHandle, View, type GestureResponderEvent, type ViewStyle } from "react-native"

import { Button, Slider, Text, useNativeTheme, type TNativeSliderState } from "@codon-ui/react-native"

import { readSliderLayoutOriginalGeometry, SLIDER_LAYOUT_ROOT_ID } from "./sliderLayoutObserver"

const ORDERS = [undefined, "primary", "secondary", "tertiary", "quaternary", "quintenary"] as const
const GEOMETRIES = ["round", "rounded", "orthogonal"] as const
const LAYOUT_PRESETS = ["baseline", "translated", "repositioned", "rotated-scaled"] as const
type TLayoutPreset = (typeof LAYOUT_PRESETS)[number]
const layoutThumbStyle = (preset: TLayoutPreset): ViewStyle => ({
  width: 24,
  height: 24,
  minHeight: 0,
  borderRadius: 5,
  ...(preset === "repositioned" ? { left: "35%", top: "50%" } : {}),
  transform: [
    { translateX: "-50%" },
    { translateY: "-50%" },
    ...(preset === "translated" || preset === "rotated-scaled" ? [{ translateX: 48 }] : []),
    ...(preset === "rotated-scaled" ? [{ rotate: "20deg" as const }, { scale: 1.25 }] : []),
  ],
})
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
  const scalarRoot = useRef<View | null>(null)
  const measureRevision = useRef(0)
  const touchSequence = useRef(0)
  const geometryCancellations = useRef(new Set<() => void>())
  const [layoutPreset, setLayoutPreset] = useState<TLayoutPreset | null>(null)
  const [thumbGeometry, setThumbGeometry] = useState("unmeasured")
  const [thumbGeometryPending, setThumbGeometryPending] = useState(false)
  const [rootWindowFrame, setRootWindowFrame] = useState("unmeasured")
  const [nativeTouches, setNativeTouches] = useState<readonly string[]>([])
  const [droppedLayoutReceipts, setDroppedLayoutReceipts] = useState(0)
  const [scalarLayoutTop, setScalarLayoutTop] = useState(0)
  const invalidateMeasurement = useCallback(() => {
    measureRevision.current += 1
    for (const cancel of [...geometryCancellations.current]) cancel()
    geometryCancellations.current.clear()
  }, [])
  useEffect(() => () => invalidateMeasurement(), [invalidateMeasurement])
  const selectLayoutPreset = (preset: TLayoutPreset | null) => {
    invalidateMeasurement()
    setThumbGeometry("unmeasured")
    setThumbGeometryPending(false)
    setRootWindowFrame("unmeasured")
    setLayoutPreset(preset)
  }
  const recordLayoutReceipt = (receipt: Readonly<Record<string, unknown>>) => {
    if (!layoutPreset) return
    const encoded = JSON.stringify({
      sequence: ++touchSequence.current,
      preset: layoutPreset,
      rootTag: findNodeHandle(scalarRoot.current),
      ...receipt,
    })
    if (touchSequence.current > 512) setDroppedLayoutReceipts(touchSequence.current - 512)
    setNativeTouches((old) => [...old.slice(-511), encoded])
  }
  const recordTouch = (phase: "start" | "move" | "end" | "cancel", event: GestureResponderEvent) => {
    const { target, identifier, pageX, pageY, locationX, locationY, timestamp } = event.nativeEvent
    recordLayoutReceipt({ kind: "touch", phase, target, identifier, pageX, pageY, locationX, locationY, timestamp })
  }
  const measureOriginalThumbs = async () => {
    const root = scalarRoot.current
    if (!root || !layoutPreset) return
    invalidateMeasurement()
    const revision = measureRevision.current
    setThumbGeometryPending(true)
    const token = {
      isCurrent: () => scalarRoot.current === root && measureRevision.current === revision,
      onCancel: (listener: () => void) => {
        geometryCancellations.current.add(listener)
        return () => {
          geometryCancellations.current.delete(listener)
        }
      },
    }
    try {
      const receipt = await readSliderLayoutOriginalGeometry(root, token)
      if (token.isCurrent()) {
        setThumbGeometry(JSON.stringify(receipt))
        setThumbGeometryPending(false)
      }
    } catch (error) {
      if (token.isCurrent()) {
        setThumbGeometry(`unavailable: ${error instanceof Error ? error.message : String(error)}`)
        setThumbGeometryPending(false)
      }
    }
  }
  const measureScalarRoot = () => {
    const original = scalarRoot.current
    if (!original) return
    invalidateMeasurement()
    const revision = measureRevision.current
    original.measureInWindow((x, y, width, height) => {
      if (scalarRoot.current !== original || revision !== measureRevision.current) return
      setRootWindowFrame(JSON.stringify({ rootTag: findNodeHandle(original), x, y, width, height }))
    })
  }
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
  const layoutReceipts = nativeTouches.map((receipt) => JSON.parse(receipt) as Record<string, unknown>)
  const heldDown = layoutReceipts.find((receipt) => receipt.kind === "touch" && receipt.phase === "start")
  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2" variant="h3">
        Native Slider
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {action("Prepare scalar layout witness", () => {
          setValue(0.5)
          setVeto(false)
          setDisabled(false)
          setVertical(false)
          setRtl(false)
          setZero(false)
          setCustom(false)
          setFrench(false)
          setPercent(false)
          setShadow(true)
          setFocus(true)
          setOrderIndex(0)
          setGeometryIndex(0)
          setRequest("none")
          setEnd("none")
          setRequests(0)
          setEnds(0)
          setNativeTouches([])
          setDroppedLayoutReceipts(0)
          touchSequence.current = 0
          selectLayoutPreset("baseline")
        })}
        {LAYOUT_PRESETS.map((preset) => (
          <Button
            key={preset}
            order="primary"
            raised={false}
            accessibilityLabel={`Use scalar layout ${preset}`}
            onPress={() => selectLayoutPreset(preset)}
          >
            Use scalar layout {preset}
          </Button>
        ))}
        {action("Measure scalar original root", measureScalarRoot)}
        {action("Measure scalar original thumb geometry", () => {
          void measureOriginalThumbs()
        })}
        {action("Disable scalar layout witness", () => selectLayoutPreset(null))}
      </View>
      <Slider
        {...common}
        ref={scalarRoot}
        nativeID={layoutPreset ? SLIDER_LAYOUT_ROOT_ID : undefined}
        testID="slider-scalar"
        customThumbStyles={layoutPreset ? layoutThumbStyle(layoutPreset) : common.customThumbStyles}
        onTouchStart={(event) => recordTouch("start", event)}
        onTouchMove={(event) => recordTouch("move", event)}
        onTouchEnd={(event) => recordTouch("end", event)}
        onTouchCancel={(event) => recordTouch("cancel", event)}
        accessibilityLabel="Scalar adjustment"
        label="Scalar adjustment"
        thumbAriaLabels={["Scalar handle"]}
        value={value}
        onChange={(next) => {
          recordLayoutReceipt({ kind: "request", value: next })
          setRequest(`scalar ${next}`)
          setRequests((count) => count + 1)
          if (!veto) setValue(next)
        }}
        onChangeEnd={(next) => {
          recordLayoutReceipt({ kind: "change-end", value: next })
          setEnd(`scalar ${next}`)
          setEnds((count) => count + 1)
        }}
        onLayout={({ nativeEvent: { layout } }) => {
          setScalarLayoutTop(layout.y)
          const next = `${Number(layout.width.toFixed(3))} x ${Number(layout.height.toFixed(3))}`
          setFrame((old) => (old === next ? old : next))
        }}
      />
      {layoutPreset && (
        <Text
          testID="slider-layout-held-json"
          pointerEvents="none"
          accessibilityLabel={JSON.stringify({
            preset: layoutPreset,
            rootTag: findNodeHandle(scalarRoot.current),
            scalar: value,
            requests,
            ends,
            dropped: droppedLayoutReceipts,
            receipts: layoutReceipts,
          })}
          style={{
            position: "absolute",
            top: scalarLayoutTop - 32,
            left: 0,
            right: 0,
            zIndex: 10,
            height: 30,
            fontSize: 9,
            lineHeight: 10,
            backgroundColor: theme.colors.background,
          }}
        >
          {layoutPreset} value{value} req{requests} end{ends} drop{droppedLayoutReceipts}
          {"\n"}
          {heldDown
            ? `DOWN #${heldDown.sequence} root${heldDown.rootTag} target${heldDown.target} id${heldDown.identifier}\npage${Number(heldDown.pageX).toFixed(3)},${Number(heldDown.pageY).toFixed(3)} ts${heldDown.timestamp}`
            : "No native touch yet."}
        </Text>
      )}
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
      <Text testID="slider-layout-witness">
        Scalar layout preset: {layoutPreset ?? "off"}. Original root window frame: {rootWindowFrame}. Original
        event/callback receipts: {nativeTouches.length ? nativeTouches.join(" | ") : "none"}.
      </Text>
      <Text
        testID="slider-layout-native-geometry"
        accessibilityLabel={`Original native thumb geometry: ${thumbGeometryPending ? "pending" : thumbGeometry}.`}
      >
        Original native thumb geometry: {thumbGeometry}.
      </Text>
      <Text>
        The observer reads original stock native track, target and paint bounds, guarded by current root and preset.
        Missing or changing original hosts are reported as unavailable; authored styles are never measured geometry.
      </Text>
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
