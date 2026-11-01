import { useState } from "react"
import { StyleSheet, View } from "react-native"

import {
  AVAILABLE_CORNER_GEOMETRY_CODES,
  Button,
  NativeThemeProvider,
  Tag,
  Text,
  useNativeTheme,
  type NativeThemeTransition,
  type TNativeTagTransition,
} from "@codon-ui/react-native"

const THEME_CHANNELS = ["backgroundColor", "color", "borderColor", "boxShadow"] as const
const THEME_TIMINGS: readonly (NativeThemeTransition | undefined)[] = [
  undefined,
  0,
  { duration: "1s", delay: 100, easing: "linear" },
]
const AUTHORED_SHADOW = [{ offsetX: 6, offsetY: 4, blurRadius: 8, spreadDistance: 2, color: "#3151a6" }] as const
const TAG_IDS = [0, "0", "", undefined] as const
const TAG_ALIASES = [undefined, false, true, "mixed"] as const
const TAG_BORDERS = ["solid", "dashed", "dotted"] as const
const TAG_TIMINGS: readonly (TNativeTagTransition | undefined)[] = [
  undefined,
  0,
  { duration: "1s", delay: 20, easing: "linear" },
]
const describeID = (id: string | number | undefined) =>
  id === undefined ? "undefined" : typeof id === "number" ? `number ${id}` : `string ${JSON.stringify(id)}`

export const TagScene = () => {
  const theme = useNativeTheme()
  const [themeTimings, setThemeTimings] = useState({ backgroundColor: 0, color: 0, borderColor: 0, boxShadow: 0 })
  const [authoredShadow, setAuthoredShadow] = useState(false)
  const [selected, setSelected] = useState(false)
  const [echo, setEcho] = useState(true)
  const [requests, setRequests] = useState(0)
  const [lastRequest, setLastRequest] = useState("none")
  const [idIndex, setIDIndex] = useState(0)
  const [aliasIndex, setAliasIndex] = useState(0)
  const [geometryIndex, setGeometryIndex] = useState(1)
  const [borderIndex, setBorderIndex] = useState(0)
  const [timingIndex, setTimingIndex] = useState(0)
  const [disabled, setDisabled] = useState(false)
  const [raised, setRaised] = useState(false)
  const [raisedOnHover, setRaisedOnHover] = useState(false)
  const [custom, setCustom] = useState(false)
  const [colors, setColors] = useState(false)
  const [borders, setBorders] = useState(false)
  const [zero, setZero] = useState(false)
  const [constrained, setConstrained] = useState(false)
  const [longLabel, setLongLabel] = useState(false)
  const [measuredFrame, setMeasuredFrame] = useState<{ width: number; height: number }>()
  const [disableDuringPress, setDisableDuringPress] = useState(false)
  const id = TAG_IDS[idIndex]
  const alias = TAG_ALIASES[aliasIndex]
  const geometry = AVAILABLE_CORNER_GEOMETRY_CODES[geometryIndex]
  const borderStyle = TAG_BORDERS[borderIndex]
  const timingOverrides = Object.fromEntries(
    THEME_CHANNELS.flatMap((channel) =>
      themeTimings[channel] === 0 ? [] : [[channel, THEME_TIMINGS[themeTimings[channel]]]],
    ),
  ) as Partial<Record<(typeof THEME_CHANNELS)[number], NativeThemeTransition>>

  return (
    <View style={styles.scene}>
      <Text elementType="h2" variant="h3">
        Static and controlled tags
      </Text>
      <Text testID="tag-state">
        Owner: {String(selected)}. Echo: {String(echo)}. Requests: {requests}. Last: {lastRequest}. ID: {describeID(id)}
        . Exposed: {alias === undefined ? "default" : String(alias)}. Size:{" "}
        {zero ? "zero" : constrained ? "140" : "automatic"}. Geometry: {geometry}. Frame:{" "}
        {measuredFrame ? `${measuredFrame.width} x ${measuredFrame.height}` : "unmeasured"}. Armed guard:{" "}
        {String(disableDuringPress)}.
      </Text>
      <View style={styles.controls}>
        <Button onPress={() => setEcho((current) => !current)}>Toggle tag owner echo</Button>
        <Button onPress={() => setSelected((current) => !current)}>Toggle tag owner value</Button>
        <Button onPress={() => setDisabled((current) => !current)}>Toggle tag disabled</Button>
        <Button onPress={() => setDisableDuringPress(true)}>Arm tag disable during press</Button>
        <Button onPress={() => setIDIndex((index) => (index + 1) % TAG_IDS.length)}>Next tag ID</Button>
        <Button onPress={() => setAliasIndex((index) => (index + 1) % TAG_ALIASES.length)}>
          Next tag accessibility override
        </Button>
        <Button onPress={() => setGeometryIndex((index) => (index + 1) % AVAILABLE_CORNER_GEOMETRY_CODES.length)}>
          Next tag geometry
        </Button>
        <Button onPress={() => setBorders((current) => !current)}>Toggle tag borders</Button>
        <Button onPress={() => setBorderIndex((index) => (index + 1) % TAG_BORDERS.length)}>
          Next tag border style
        </Button>
        <Button onPress={() => setRaised((current) => !current)}>Toggle tag raised</Button>
        <Button onPress={() => setRaisedOnHover((current) => !current)}>Toggle tag hover shadow</Button>
        <Button onPress={() => setColors((current) => !current)}>Toggle tag colors</Button>
        <Button onPress={() => setCustom((current) => !current)}>Toggle tag styles</Button>
        <Button onPress={() => setZero((current) => !current)}>Toggle tag zero dimensions</Button>
        <Button onPress={() => setConstrained((current) => !current)}>Toggle tag width constraint</Button>
        <Button onPress={() => setLongLabel((current) => !current)}>Toggle long tag label</Button>
        <Button onPress={() => setTimingIndex((index) => (index + 1) % TAG_TIMINGS.length)}>Next tag transition</Button>
        {THEME_CHANNELS.map((channel) => (
          <Button
            key={channel}
            onPress={() =>
              setThemeTimings((current) => ({ ...current, [channel]: (current[channel] + 1) % THEME_TIMINGS.length }))
            }
          >
            Next tag theme {channel} timing
          </Button>
        ))}
        <Button onPress={() => setAuthoredShadow((current) => !current)}>Toggle authored tag shadow</Button>
      </View>
      <Text testID="tag-theme-timings">
        Theme timings:{" "}
        {THEME_CHANNELS.map(
          (channel) => `${channel}=${["inherit", "0 ms", "1 s linear, delay 100 ms"][themeTimings[channel]]}`,
        ).join("; ")}
        . Authored shadow: {String(authoredShadow)}.
      </Text>
      <NativeThemeProvider
        mode={theme.mode}
        overrides={{
          ...theme,
          transitions: THEME_CHANNELS.some((channel) => themeTimings[channel] !== 0)
            ? { ...theme.transitions, ...timingOverrides }
            : theme.transitions,
        }}
      >
        <View style={styles.preview}>
          <Tag
            testID="tag-status"
            accessibilityLabel={`Tag status ${selected ? "active" : "inactive"}`}
            geometry={geometry}
            raised={raised}
            raisedOnHover={raisedOnHover}
            color={colors ? "#2f7d18" : undefined}
            border={borders ? { borderWidth: 1, borderColor: "#b73434", borderStyle } : undefined}
            backgroundColorTransition={TAG_TIMINGS[timingIndex]}
            customStyles={custom ? { color: "#b73434", fontWeight: "700" } : undefined}
            style={authoredShadow ? { boxShadow: [...AUTHORED_SHADOW] } : undefined}
          >
            {selected ? "Active / actif" : "Inactive / inactif"}
          </Tag>
          <Tag
            testID="tag-example"
            accessibilityLabel="Controlled tag"
            pressable
            isPressed={selected}
            isDisabled={disabled}
            id={id}
            aria-pressed={alias}
            onPressIn={() => {
              if (!disableDuringPress) return
              setDisableDuringPress(false)
              setDisabled(true)
            }}
            onLayout={({ nativeEvent: { layout } }) => {
              const width = Math.round(layout.width * 1000) / 1000
              const height = Math.round(layout.height * 1000) / 1000
              setMeasuredFrame((current) =>
                current?.width === width && current.height === height ? current : { width, height },
              )
            }}
            onPress={(requestedID) => {
              setRequests((count) => count + 1)
              setLastRequest(describeID(requestedID))
              if (echo) setSelected((current) => !current)
            }}
            width={zero ? 0 : constrained ? 140 : undefined}
            height={zero ? 0 : undefined}
            geometry={geometry}
            raised={raised}
            raisedOnHover={raisedOnHover}
            activeColor={colors ? "#2f7d18" : undefined}
            inactiveColor={colors ? "#a66b00" : undefined}
            activeBorder={borders ? { borderWidth: 1, borderColor: "#b73434", borderStyle } : undefined}
            inactiveBorder={borders ? { borderWidth: 2, borderColor: "#b73434", borderStyle } : undefined}
            backgroundColorTransition={TAG_TIMINGS[timingIndex]}
            customStyles={custom ? { color: "#b73434", fontSize: 18, borderColor: "#2f7d18" } : undefined}
            style={
              custom || authoredShadow
                ? (state) => ({
                    ...(custom ? { opacity: state.isDisabled ? 0.3 : 0.8, fontSize: 20 } : {}),
                    ...(authoredShadow ? { boxShadow: [...AUTHORED_SHADOW] } : {}),
                  })
                : undefined
            }
          >
            {longLabel
              ? "Étiquette longue : les valeurs restent liées aux choix de la personne et les actions restent accessibles."
              : "Request this tag"}
          </Tag>
          <Text>
            Transition:{" "}
            {timingIndex === 0
              ? "local background inherits theme; default colors 250 ms / shadow 450 ms"
              : timingIndex === 1
                ? "background immediate"
                : "background 1 s linear, delay 20 ms"}
            . Hover uses a native pointer; the controlled value changes only when the owner echoes.
          </Text>
        </View>
      </NativeThemeProvider>
    </View>
  )
}

const styles = StyleSheet.create({
  scene: { gap: 10 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  preview: { gap: 10, alignItems: "flex-start" },
})
