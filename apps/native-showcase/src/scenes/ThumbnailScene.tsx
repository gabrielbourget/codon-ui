import { useCallback, useRef, useState } from "react"
import {
  findNodeHandle,
  Image,
  StyleSheet,
  Text as RawText,
  View,
  useWindowDimensions,
  type Image as ImageHost,
} from "react-native"

import {
  Button,
  Text,
  ThumbnailImage,
  useNativeTheme,
  type ThumbnailImageRenderImageArgs,
} from "@codon-ui/react-native"

const RECTANGLE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAYCAIAAAAzn+mLAAAAPklEQVR4nGPgqO/Bin58uIMV0Vo9w6iDRh006qAR56CBshiX+lEHjTpo1EEjz0EDZTEu9aMOGnXQqINGnIMAV6ykOfJ/enQAAAAASUVORK5CYII="
const SQUARE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAQklEQVR4nGP48eEOVsRR34MVkaqeYdSCUQuGgAXUMgiX+lELRi0YChZQyyBc6kctGLVgKFhALYNwqR+1YNSCIWABANaQrmq0T3KIAAAAAElFTkSuQmCC"
const INVALID = "data:image/png;base64,AA=="
const OTHER_INVALID = "data:image/png;base64,AQ=="
const DENSITY_1X =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKUlEQVR4nO3NMQ0AAAgDsImad+yhgoOkSf9m2lMRCAQCgUAgEAgEX4IFcB18PUxddScAAAAASUVORK5CYII="
const DENSITY_2X =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAeklEQVR4nO3PUQkAIBTAwBfDFia0uyH8OITBAtxmn/V1wwUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWPHYB8kZAtdhb15YAAAAASUVORK5CYII="
const DENSITY_3X =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAAApElEQVR4nO3QQQ0AIBDAsDODMuRjAgd82aPJBCydtY8ezfeDeIAAAQIEKBwgQIAAAQoHCBAgQIDCAQIECBCgcIAAAQIEKBwgQIAAAQoHCBAgQIDCAQIECBCgcIAAAQIEKBwgQIAAAQoHCBAgQIDCAQIECBCgcIAAAQIEKBwgQIAAAQoHCBAgQIDCAQIECBCgcIAAAQIEKBwgQIAAAQoHCBAgQD+7gmYvDR9wdcoAAAAASUVORK5CYII="
const DENSITY_MODES = ["off", "1x / 2x / 3x", "src / 2x / 3x"] as const
const describeLoadedSource = (uri: string | undefined) => {
  if (uri === DENSITY_1X) return "density 1x, 32 pixels"
  if (uri === DENSITY_2X) return "density 2x, 64 pixels"
  if (uri === DENSITY_3X) return "density 3x, 96 pixels"
  if (uri === SQUARE) return "square src"
  if (uri === RECTANGLE) return "landscape src"
  return uri ?? "URI not reported"
}
const SOURCE_LABELS = ["failure then landscape", "all fail", "empty list", "square", "landscape"] as const

export const ThumbnailScene = () => {
  const { scale } = useWindowDimensions()
  const theme = useNativeTheme()
  const [visible, setVisible] = useState(true)
  const [dimensionIndex, setDimensionIndex] = useState(0)
  const [referenceLoads, setReferenceLoads] = useState(0)
  const [referenceSource, setReferenceSource] = useState("")
  const [events, setEvents] = useState<
    {
      kind: string
      epochMs: number
      target: number | null
      currentTarget: number | null
      source?: unknown
      error?: string
      layout?: unknown
    }[]
  >([])
  const [binding, setBinding] = useState({ tag: null as number | null, attaches: 0, detaches: 0 })
  const adapterRef = useRef<ImageHost | null>(null)
  const nodeTag = (node: unknown) =>
    typeof node === "number" ? node : node == null ? null : findNodeHandle(node as ImageHost)
  const bindAdapter = useCallback((node: ImageHost | null) => {
    if (node === adapterRef.current) return
    adapterRef.current = node
    setBinding((old) => ({
      tag: node == null ? null : findNodeHandle(node),
      attaches: old.attaches + (node ? 1 : 0),
      detaches: old.detaches + (node ? 0 : 1),
    }))
  }, [])
  const [mode, setMode] = useState(0)
  const [densityIndex, setDensityIndex] = useState(0)
  const [callerSelected, setCallerSelected] = useState(false)
  const [loadedSource, setLoadedSource] = useState("none")
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
  const densitySet =
    callerSelected || densityIndex === 0
      ? undefined
      : densityIndex === 1
        ? `${DENSITY_1X} 1x, ${DENSITY_2X} 2x, ${DENSITY_3X} 3x`
        : `${DENSITY_2X} 2x, ${DENSITY_3X} 3x`
  const renderImage = ({ imageProps }: ThumbnailImageRenderImageArgs) => (
    <Image
      {...imageProps}
      ref={bindAdapter}
      alt={undefined}
      accessible={imageProps.alt !== ""}
      accessibilityLabel={imageProps.alt}
      style={[{ width: 96, height: 48, aspectRatio: 2 }, imageProps.style]}
    />
  )
  const authoredStyle = {
    ...(densitySet ? { width: 32, height: 32 } : {}),
    ...(custom
      ? {
          width: 120,
          height: 80,
          borderRadius: 5,
          borderWidth: 2,
          borderColor: "#2f7d18",
          resizeMode: "contain" as const,
        }
      : {}),
    ...(dimensionIndex ? { width: dimensionIndex === 1 ? 83.25 : ("50%" as const), height: "auto" as const } : {}),
    ...(constrained ? { width: 140, height: "auto" as const } : {}),
    ...(zero ? { width: 0, height: 0 } : {}),
  }
  const fallbackExpected = !callerSelected && [1, 2].includes(mode)
  const expectedURI = densitySet
    ? scale > 2
      ? DENSITY_3X
      : scale > 1
        ? DENSITY_2X
        : densityIndex === 1
          ? DENSITY_1X
          : mode === 3
            ? SQUARE
            : RECTANGLE
    : !callerSelected && mode === 3
      ? SQUARE
      : RECTANGLE
  const nativeSourceWidth = densitySet ? (scale > 2 ? 96 : scale > 1 ? 64 : 32) : expectedURI === SQUARE ? 32 : 48
  const nativeSourceHeight = densitySet ? nativeSourceWidth : expectedURI === SQUARE ? 32 : 24
  const referenceStyle = {
    width: zero
      ? 0
      : constrained
        ? 140
        : dimensionIndex
          ? dimensionIndex === 1
            ? 83.25
            : ("50%" as const)
          : custom
            ? 120
            : densitySet
              ? 32
              : adapter
                ? 96
                : nativeSourceWidth,
    height: zero
      ? 0
      : constrained || dimensionIndex
        ? undefined
        : custom
          ? 80
          : densitySet
            ? 32
            : adapter
              ? 48
              : nativeSourceHeight,
    ...(constrained || dimensionIndex ? { aspectRatio: nativeSourceWidth / nativeSourceHeight } : {}),
    ...(custom ? { borderRadius: 5, borderWidth: 2, borderColor: "#2f7d18" } : {}),
  }
  const record = {
    mode,
    densityIndex,
    callerSelected,
    equivalent,
    adapter,
    emptyAlt,
    zero,
    custom,
    constrained,
    zeroFallback,
    lifetime,
    visible,
    dimensionIndex,
    errors,
    loads,
    lastLoad,
    loadedSource,
    frame,
    scale,
    theme: theme.mode,
    referenceLoads,
    referenceSource,
    expectedURI,
    nativeSourceWidth,
    nativeSourceHeight,
    adapterBinding: binding,
    events,
  }
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
      <Text testID="thumbnail-density-state">
        Density set: {callerSelected ? "omitted for caller src" : DENSITY_MODES[densityIndex]}. Source dimensions:{" "}
        {zero ? "authored zero" : densitySet ? "32 by 32" : "intrinsic"}. Last native source: {loadedSource}. Window
        scale: {scale}.
      </Text>
      <Text testID="thumbnail-native-state" accessibilityLabel={JSON.stringify(record)} numberOfLines={1}>
        {JSON.stringify(record)}
      </Text>
      <View style={styles.controls}>
        <Button onPress={() => setVisible((old) => !old)}>Toggle thumbnail presence</Button>
        <Button onPress={() => setDimensionIndex((old) => (old + 1) % 3)}>Next thumbnail dimension</Button>
        <Button onPress={() => setMode((value) => (value + 1) % SOURCE_LABELS.length)}>Next thumbnail sources</Button>
        <Button onPress={() => setDensityIndex((value) => (value + 1) % DENSITY_MODES.length)}>
          Next thumbnail density set
        </Button>
        <Button onPress={() => setCallerSelected((value) => !value)}>Toggle caller-selected thumbnail src</Button>
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
        <View testID="thumbnail-native-pair" style={{ gap: 8 }}>
          <View testID="thumbnail-native-parent" collapsable={false} style={styles.measurement}>
            {visible ? (
              <ThumbnailImage
                key={lifetime}
                src={callerSelected ? RECTANGLE : SQUARE}
                srcCandidates={callerSelected ? undefined : candidates}
                srcSet={densitySet}
                alt={emptyAlt ? "" : "Thumbnail preview / aperçu"}
                fallback={
                  zeroFallback ? 0 : <Text testID="thumbnail-fallback">No thumbnail / miniature indisponible</Text>
                }
                testID="thumbnail-example"
                renderImage={adapter ? renderImage : undefined}
                width={zero ? 0 : densitySet ? 32 : undefined}
                height={zero ? 0 : densitySet ? 32 : undefined}
                style={authoredStyle}
                onError={(event) => {
                  const row = {
                    kind: "error",
                    epochMs: Date.now(),
                    target: nodeTag(event.target),
                    currentTarget: nodeTag(event.currentTarget),
                    error: event.nativeEvent.error,
                  }
                  setErrors((value) => value + 1)
                  setEvents((old) => [...old, row])
                }}
                onLoad={(event) => {
                  const { source } = event.nativeEvent
                  const row = {
                    kind: "load",
                    epochMs: Date.now(),
                    target: nodeTag(event.target),
                    currentTarget: nodeTag(event.currentTarget),
                    source: { ...source },
                  }
                  setEvents((old) => [...old, row])
                  setLoads((value) => value + 1)
                  setLastLoad(`${source.width} x ${source.height}`)
                  setLoadedSource(describeLoadedSource(source.uri))
                }}
                onLayout={(event) => {
                  const { layout } = event.nativeEvent
                  const row = {
                    kind: "layout",
                    epochMs: Date.now(),
                    target: nodeTag(event.target),
                    currentTarget: nodeTag(event.currentTarget),
                    layout: { ...layout },
                  }
                  setEvents((old) => {
                    const previous = [...old].reverse().find((entry) => entry.kind === "layout")
                    return previous &&
                      JSON.stringify(previous.layout) === JSON.stringify(row.layout) &&
                      previous.currentTarget === row.currentTarget
                      ? old
                      : [...old, row]
                  })
                  const width = Math.round(layout.width * 1000) / 1000
                  const height = Math.round(layout.height * 1000) / 1000
                  setFrame((current) =>
                    current?.width === width && current.height === height ? current : { width, height },
                  )
                }}
              />
            ) : null}
          </View>
          <View testID="thumbnail-native-reference-parent" collapsable={false} style={styles.measurement}>
            {visible ? (
              fallbackExpected ? (
                <RawText
                  style={{
                    fontSize: theme.typography.fontSizes.b10,
                    fontWeight: theme.typography.fontWeights.regular,
                    fontFamily: theme.typography.fontFamilies.body,
                    fontStyle: "normal",
                    color: theme.colors.foreground,
                  }}
                >
                  {zeroFallback ? 0 : "No thumbnail / miniature indisponible"}
                </RawText>
              ) : (
                <Image
                  source={{ uri: expectedURI }}
                  accessible={false}
                  testID="thumbnail-native-reference"
                  style={referenceStyle}
                  resizeMode={custom ? "contain" : "stretch"}
                  resizeMethod="scale"
                  fadeDuration={0}
                  onLoad={(event) => {
                    setReferenceSource(event.nativeEvent.source.uri ?? "")
                    setReferenceLoads((old) => old + 1)
                  }}
                />
              )
            ) : null}
          </View>
        </View>
      </View>
      <Text>
        A density set with 1x takes native precedence over src; without 1x, src supplies that candidate. Caller-selected
        mode omits the set and candidate list. The genuine load URI records native delivery; metadata probes are not
        decode events.
      </Text>
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
  preview: { width: "100%" },
  measurement: { width: "100%", maxWidth: 280, height: 180, padding: 12, backgroundColor: "#ffffff" },
})
