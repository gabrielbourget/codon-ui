import { useState } from "react"
import { Image, StyleSheet, View } from "react-native"

import { Button, Text, ThumbnailImage, type ThumbnailImageRenderImageArgs } from "@codon-ui/react-native"

const RECTANGLE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAYCAIAAAAzn+mLAAAAPklEQVR4nGPgqO/Bin58uIMV0Vo9w6iDRh006qAR56CBshiX+lEHjTpo1EEjz0EDZTEu9aMOGnXQqINGnIMAV6ykOfJ/enQAAAAASUVORK5CYII="
const SQUARE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAQklEQVR4nGP48eEOVsRR34MVkaqeYdSCUQuGgAXUMgiX+lELRi0YChZQyyBc6kctGLVgKFhALYNwqR+1YNSCIWABANaQrmq0T3KIAAAAAElFTkSuQmCC"
const INVALID = "data:image/png;base64,AA=="
const OTHER_INVALID = "data:image/png;base64,AQ=="
const SOURCE_LABELS = ["failure then landscape", "all fail", "empty list", "square", "landscape"] as const

export const ThumbnailScene = () => {
  const [mode, setMode] = useState(0)
  const [equivalent, setEquivalent] = useState(false)
  const [adapter, setAdapter] = useState(false)
  const [emptyAlt, setEmptyAlt] = useState(false)
  const [zero, setZero] = useState(false)
  const [custom, setCustom] = useState(false)
  const [constrained, setConstrained] = useState(false)
  const [zeroFallback, setZeroFallback] = useState(false)
  const [lifetime, setLifetime] = useState(0)
  const [errors, setErrors] = useState(0)
  const [loads, setLoads] = useState(0)
  const [lastLoad, setLastLoad] = useState("none")
  const [frame, setFrame] = useState<{ width: number; height: number }>()
  const candidates =
    mode === 0
      ? equivalent
        ? [null, INVALID, INVALID, "", RECTANGLE, SQUARE, undefined]
        : [INVALID, RECTANGLE, SQUARE]
      : mode === 1
        ? [INVALID, OTHER_INVALID]
        : mode === 2
          ? [null, "", undefined]
          : mode === 3
            ? []
            : [RECTANGLE]
  const renderImage = ({ imageProps }: ThumbnailImageRenderImageArgs) => (
    <Image
      {...imageProps}
      alt={undefined}
      accessible={imageProps.alt !== ""}
      accessibilityLabel={imageProps.alt}
      style={[{ width: 96, height: 48, aspectRatio: 2 }, imageProps.style]}
    />
  )
  return (
    <View style={styles.scene}>
      <Text elementType="h2" variant="h3">
        Thumbnail candidates and native image layout
      </Text>
      <Text testID="thumbnail-state">
        Sources: {SOURCE_LABELS[mode]}. Equivalent: {String(equivalent)}. Adapter: {String(adapter)}. Empty alt:{" "}
        {String(emptyAlt)}. Zero size: {String(zero)}. Errors: {errors}. Loads: {loads}. Last load: {lastLoad}.
        Lifetime: {lifetime}. Frame: {frame ? `${frame.width} x ${frame.height}` : "unmeasured"}.
      </Text>
      <View style={styles.controls}>
        <Button onPress={() => setMode((value) => (value + 1) % SOURCE_LABELS.length)}>Next thumbnail sources</Button>
        <Button onPress={() => setEquivalent((value) => !value)}>Toggle equivalent thumbnail candidates</Button>
        <Button onPress={() => setAdapter((value) => !value)}>Toggle thumbnail renderer</Button>
        <Button onPress={() => setEmptyAlt((value) => !value)}>Toggle empty thumbnail alt</Button>
        <Button onPress={() => setZero((value) => !value)}>Toggle thumbnail zero size</Button>
        <Button onPress={() => setCustom((value) => !value)}>Toggle thumbnail styles</Button>
        <Button onPress={() => setConstrained((value) => !value)}>Toggle thumbnail width constraint</Button>
        <Button onPress={() => setZeroFallback((value) => !value)}>Toggle zero thumbnail fallback</Button>
        <Button onPress={() => setLifetime((value) => value + 1)}>Restart thumbnail lifetime</Button>
      </View>
      <View style={styles.preview}>
        <ThumbnailImage
          key={lifetime}
          src={SQUARE}
          srcCandidates={candidates}
          alt={emptyAlt ? "" : "Thumbnail preview / aperçu"}
          fallback={zeroFallback ? 0 : <Text testID="thumbnail-fallback">No thumbnail / miniature indisponible</Text>}
          testID="thumbnail-example"
          renderImage={adapter ? renderImage : undefined}
          width={zero ? 0 : undefined}
          height={zero ? 0 : undefined}
          style={{
            ...(custom
              ? {
                  width: 120,
                  height: 80,
                  borderRadius: 5,
                  borderWidth: 2,
                  borderColor: "#2f7d18",
                  resizeMode: "contain",
                }
              : {}),
            ...(constrained ? { width: 140, height: "auto" } : {}),
            ...(zero ? { width: 0, height: 0 } : {}),
          }}
          onError={() => setErrors((value) => value + 1)}
          onLoad={({ nativeEvent: { source } }) => {
            setLoads((value) => value + 1)
            setLastLoad(`${source.width} x ${source.height}`)
          }}
          onLayout={({ nativeEvent: { layout } }) => {
            const width = Math.round(layout.width * 1000) / 1000
            const height = Math.round(layout.height * 1000) / 1000
            setFrame((current) => (current?.width === width && current.height === height ? current : { width, height }))
          }}
        />
      </View>
      <Text>
        The built-in renderer derives natural geometry from native decoding. The injected renderer owns its defaults;
        authored zero dimensions still take precedence.
      </Text>
      <Text>
        La miniature et les valeurs choisies restent stables lorsque le thème et les dimensions de la fenêtre changent.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scene: { gap: 10 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  preview: { alignSelf: "flex-start" },
})
