import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { AVAILABLE_CORNER_GEOMETRY_CODES, Avatar, Button, Text } from "@codon-ui/react-native"

const AVATAR_NAMES = [
  ["Alice", "Smith"],
  ["Alice", undefined],
  [undefined, "Smith"],
  ["", ""],
] as const
const AVATAR_SIZES = [30, 48, 72] as const
const AVATAR_IMAGE_MODES = ["none", "sample", "invalid"] as const
const SAMPLE_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAQklEQVR4nGP48eEOVsRR34MVkaqeYdSCUQuGgAXUMgiX+lELRi0YChZQyyBc6kctGLVgKFhALYNwqR+1YNSCIWABANaQrmq0T3KIAAAAAElFTkSuQmCC"

export const AvatarScene = () => {
  const [nameIndex, setNameIndex] = useState(0)
  const [sizeIndex, setSizeIndex] = useState(0)
  const [geometryIndex, setGeometryIndex] = useState(2)
  const [imageIndex, setImageIndex] = useState(0)
  const [activations, setActivations] = useState(0)
  const [clickable, setClickable] = useState(true)
  const [disabled, setDisabled] = useState(false)
  const [zero, setZero] = useState(false)
  const [raised, setRaised] = useState(false)
  const [custom, setCustom] = useState(false)
  const [explicitColors, setExplicitColors] = useState(false)
  const [delayed, setDelayed] = useState(false)
  const [lifetime, setLifetime] = useState(0)
  const [measuredFrame, setMeasuredFrame] = useState<{ width: number; height: number }>()
  const [name1, name2] = AVATAR_NAMES[nameIndex]
  const size = zero ? 0 : AVATAR_SIZES[sizeIndex]
  const geometry = AVAILABLE_CORNER_GEOMETRY_CODES[geometryIndex]
  const imageMode = AVATAR_IMAGE_MODES[imageIndex]

  return (
    <View style={styles.scene}>
      <Text elementType="h2" variant="h3">
        Avatar image and fallback
      </Text>
      <Text testID="avatar-state">
        Activations: {activations}. Names: {nameIndex}. Size: {size}. Geometry: {geometry}. Image: {imageMode}.
        {clickable ? " Clickable." : " Passive."}
        {disabled ? " Disabled." : " Enabled."} Frame:{" "}
        {measuredFrame ? `${measuredFrame.width} x ${measuredFrame.height}` : "unmeasured"}.
      </Text>
      <View style={styles.controls}>
        <Button onPress={() => setNameIndex((index) => (index + 1) % AVATAR_NAMES.length)}>Next avatar name</Button>
        <Button onPress={() => setSizeIndex((index) => (index + 1) % AVATAR_SIZES.length)}>Next avatar size</Button>
        <Button onPress={() => setGeometryIndex((index) => (index + 1) % AVAILABLE_CORNER_GEOMETRY_CODES.length)}>
          Next avatar geometry
        </Button>
        <Button onPress={() => setImageIndex((index) => (index + 1) % AVATAR_IMAGE_MODES.length)}>
          Next avatar image
        </Button>
        <Button onPress={() => setClickable((current) => !current)}>Toggle avatar activation</Button>
        <Button onPress={() => setDisabled((current) => !current)}>Toggle avatar disabled</Button>
        <Button onPress={() => setZero((current) => !current)}>Toggle avatar zero size</Button>
        <Button onPress={() => setRaised((current) => !current)}>Toggle avatar raised</Button>
        <Button onPress={() => setExplicitColors((current) => !current)}>Toggle avatar colors</Button>
        <Button onPress={() => setCustom((current) => !current)}>Toggle avatar styles</Button>
        <Button onPress={() => setDelayed((current) => !current)}>Toggle avatar fallback delay</Button>
        <Button onPress={() => setLifetime((current) => current + 1)}>Restart avatar lifetime</Button>
      </View>
      <View style={styles.preview}>
        <Avatar
          key={lifetime}
          testID="avatar-example"
          name1={name1}
          name2={name2}
          labels={{ placeholderFirstName: "Anonymous", placeholderLastName: "Person" }}
          size={size}
          geometry={geometry}
          raised={raised}
          clickable={clickable}
          disabled={disabled}
          onPress={() => setActivations((count) => count + 1)}
          onLayout={({ nativeEvent: { layout } }) => {
            const width = Math.round(layout.width * 1000) / 1000
            const height = Math.round(layout.height * 1000) / 1000
            setMeasuredFrame((current) =>
              current?.width === width && current.height === height ? current : { width, height },
            )
          }}
          imageURL={
            imageMode === "sample" ? SAMPLE_IMAGE : imageMode === "invalid" ? "data:image/png;base64,AA==" : undefined
          }
          fallbackDelay={delayed ? 1000 : undefined}
          foreground={explicitColors ? "#2f7d18" : undefined}
          background={explicitColors ? "#a66b00" : undefined}
          customStyles={custom ? { backgroundColor: "#b73434", borderWidth: 2, borderColor: "#2f7d18" } : undefined}
          style={custom ? (state) => ({ opacity: state.isDisabled ? 0.5 : 0.9 }) : undefined}
          customImageStyles={custom ? { opacity: 0.8, resizeMode: "cover" } : undefined}
          customFallbackStyles={custom ? { backgroundColor: "#a66b00" } : undefined}
          customTextProps={{
            testID: "avatar-initials",
            fontWeight: custom ? "semibold" : "regular",
            customStyles: custom ? { fontSize: 18 } : undefined,
          }}
          customTextStyles={custom ? { fontSize: 20 } : undefined}
        />
        <Text>
          Fallback delay: {delayed ? "1000 ms" : "immediate"}. Eligibility belongs to the mounted avatar; restart its
          lifetime to observe a new delay. Image fixtures are local PNG data, including one intentionally invalid image.
        </Text>
        <Text>Les initiales, les couleurs et la taille restent liées aux paramètres choisis.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  scene: { gap: 10 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  preview: { gap: 10, alignItems: "flex-start" },
})
