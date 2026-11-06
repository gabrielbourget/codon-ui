import { useCallback, useEffect, useState } from "react"
import {
  findNodeHandle,
  Image,
  StyleSheet,
  Text as RawText,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from "react-native"

import { AVAILABLE_CORNER_GEOMETRY_CODES, Avatar, Button, Text, useNativeTheme } from "@codon-ui/react-native"

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

const AVATAR_BEHAVIOR_CHECKS = [
  "baseline",
  "sample",
  "invalid",
  "removed",
  "first-name",
  "last-name",
  "anonymous",
  "disabled",
  "passive",
  "missing-handler",
  "held-cancel",
  "restored",
  "retired",
  "fresh",
  "delayed",
] as const
const AVATAR_STYLE_CHECKS = [
  "style-baseline",
  "orthogonal",
  "rounded",
  "raised",
  "root-style",
  "fallback-style",
  "text-style",
  "image-style",
  "final-precedence",
  "fractional",
  "percentage",
  "auto",
  "zero",
  "dark",
  "light-restored",
  "narrow",
  "name-enlarged",
] as const
const NativeAvatarChecks = ({ mode }: { mode: "behavior" | "styles" }) => {
  const theme = useNativeTheme()
  const { scale } = useWindowDimensions()
  const [index, setIndex] = useState(0)
  const checks = mode === "behavior" ? AVATAR_BEHAVIOR_CHECKS : AVATAR_STYLE_CHECKS
  const name = checks[index]
  const [rootTag, setRootTag] = useState<number | null>(null)
  const [mountedEpochMs, setMountedEpochMs] = useState(0)
  const [layouts, setLayouts] = useState<
    {
      target: number | null
      currentTarget: number | null
      layout: { x: number; y: number; width: number; height: number }
    }[]
  >([])
  const [contacts, setContacts] = useState<{ target: number | null; currentTarget: number | null }[]>([])
  const [actions, setActions] = useState(0)
  const [canceled, setCanceled] = useState(false)
  const [delayElapsed, setDelayElapsed] = useState(false)
  useEffect(() => {
    if (name !== "delayed") return
    const timer = setTimeout(() => setDelayElapsed(true), 8000)
    return () => clearTimeout(timer)
  }, [name])
  const [referenceLoaded, setReferenceLoaded] = useState("")
  const tag = (value: unknown) =>
    typeof value === "number" ? value : value == null ? null : findNodeHandle(value as View)
  const bind = useCallback((node: View | null) => {
    setRootTag(node ? findNodeHandle(node) : null)
    if (node) setMountedEpochMs(Date.now())
  }, [])
  const visible = name !== "retired"
  const delayed = name === "delayed"
  const imageMode = name === "sample" || name === "image-style" ? "sample" : name === "invalid" ? "invalid" : "none"
  const size =
    name === "zero"
      ? 0
      : name === "fractional"
        ? 83.25
        : name === "percentage"
          ? "50%"
          : name === "auto"
            ? "auto"
            : name === "name-enlarged"
              ? 96
              : name === "baseline"
                ? 30
                : 48
  const clickable = name !== "passive"
  const disabled = name === "disabled" || (name === "held-cancel" && canceled)
  const first = name === "last-name" || name === "anonymous" ? undefined : "Alice"
  const last = name === "first-name" || name === "anonymous" ? undefined : "Smith"
  const initials = name === "anonymous" ? "AP" : name === "first-name" ? "A" : name === "last-name" ? "S" : "AS"
  const label = name === "anonymous" ? "Anonymous Person" : [first, last].filter(Boolean).join(" ")
  const geometry = name === "orthogonal" ? "orthogonal" : name === "rounded" ? "rounded" : "round"
  const raised = name === "raised"
  const rootStyle = name === "root-style" || name === "final-precedence"
  const fallbackStyle = name === "fallback-style"
  const textStyle = name === "text-style" || name === "name-enlarged"
  const imageStyle = name === "image-style"
  const background = name === "final-precedence" ? "#117733" : rootStyle ? "#bb3322" : theme.colors.foreground
  const foreground = fallbackStyle ? "#2266aa" : textStyle ? "#b73434" : theme.colors.background
  const radius = geometry === "orthogonal" ? 0 : geometry === "rounded" ? theme.radius.rounded : theme.radius.round
  const shadow = raised
    ? {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.24,
        shadowRadius: 3,
        elevation: 2,
      }
    : {}
  const referenceRoot = {
    width: size,
    height: size,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
    borderRadius: radius,
    backgroundColor: background,
    borderWidth: rootStyle ? 2 : 0,
    borderColor: "#2f7d18",
    ...shadow,
  } as const
  const observeLayout = (event: LayoutChangeEvent) => {
    const row = {
      target: tag(event.target),
      currentTarget: tag(event.currentTarget),
      layout: { ...event.nativeEvent.layout },
    }
    setLayouts((old) => {
      const previous = old.at(-1)
      return previous?.currentTarget === row.currentTarget &&
        JSON.stringify(previous.layout) === JSON.stringify(row.layout)
        ? old
        : [...old, row]
    })
  }
  const observePress = (event: GestureResponderEvent) => {
    setContacts((old) => [...old, { target: tag(event.target), currentTarget: tag(event.currentTarget) }])
    setActions((old) => old + 1)
  }
  const state = {
    case: name,
    mode,
    scale,
    rootTag,
    mountedEpochMs,
    layouts,
    contacts,
    actions,
    canceled,
    visible,
    delayed,
    delay: delayed ? 8000 : 0,
    imageMode,
    size,
    clickable,
    interactive: clickable && name !== "missing-handler",
    disabled,
    initials,
    label,
    geometry,
    raised,
    rootStyle,
    fallbackStyle,
    textStyle,
    imageStyle,
    referenceLoaded,
    background,
    foreground,
    themeMode: theme.mode,
  }
  return (
    <View style={{ gap: 10 }}>
      <Text testID="avatar-native-state" accessibilityLabel={JSON.stringify(state)} numberOfLines={1}>
        Avatar check: {name}; actions {actions}
      </Text>
      <Button raised={false} onPress={() => setIndex((old) => (old + 1) % checks.length)}>
        Next Avatar check
      </Button>
      <View
        testID="avatar-native-pair"
        collapsable={false}
        style={{ gap: 8, width: name === "narrow" ? 120 : "100%", maxWidth: 280 }}
      >
        <View testID="avatar-native-parent" collapsable={false} style={styles.measurement}>
          {visible ? (
            <Avatar
              key={name === "fresh" ? "fresh" : delayed ? "delayed" : "original"}
              ref={bind}
              testID="avatar-native-target"
              name1={first}
              name2={last}
              labels={{ placeholderFirstName: "Anonymous", placeholderLastName: "Person" }}
              size={size}
              geometry={geometry}
              raised={raised}
              clickable={clickable}
              disabled={disabled}
              onPress={name === "missing-handler" ? undefined : observePress}
              onPressIn={() => {
                if (name === "held-cancel") setCanceled(true)
              }}
              onLayout={observeLayout}
              fallbackDelay={delayed ? 8000 : undefined}
              imageURL={
                imageMode === "sample"
                  ? SAMPLE_IMAGE
                  : imageMode === "invalid"
                    ? "data:image/png;base64,AA=="
                    : undefined
              }
              customStyles={
                rootStyle ? { backgroundColor: "#bb3322", borderWidth: 2, borderColor: "#2f7d18" } : undefined
              }
              style={
                name === "final-precedence"
                  ? (state) => ({
                      backgroundColor: state.defaultStyle.backgroundColor === "#bb3322" ? "#117733" : "#ff00ff",
                    })
                  : undefined
              }
              customFallbackStyles={fallbackStyle ? { backgroundColor: "#a66b00", color: "#2266aa" } : undefined}
              customImageStyles={imageStyle ? { opacity: 0.8, resizeMode: "cover" } : undefined}
              customTextProps={{
                testID: "avatar-native-initials",
                customStyles: textStyle ? { fontSize: 24, color: "#b73434" } : undefined,
                style: textStyle ? { fontSize: name === "name-enlarged" ? 32 : 26 } : undefined,
              }}
              customTextStyles={textStyle ? { fontSize: 25 } : undefined}
            />
          ) : null}
        </View>
        <View testID="avatar-native-reference-parent" collapsable={false} style={styles.measurement}>
          {visible ? (
            <View testID="avatar-native-reference" collapsable={false} style={referenceRoot}>
              {imageMode === "sample" ? (
                <Image
                  source={{ uri: SAMPLE_IMAGE }}
                  accessible={false}
                  resizeMode={imageStyle ? "cover" : "contain"}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    borderRadius: radius,
                    opacity: imageStyle ? 0.8 : 1,
                  }}
                  onLoad={(event) => setReferenceLoaded(event.nativeEvent.source.uri ?? "")}
                />
              ) : (
                <View
                  pointerEvents="none"
                  style={{
                    width: "100%",
                    height: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: fallbackStyle ? "#a66b00" : undefined,
                  }}
                >
                  {!delayed || delayElapsed ? (
                    <RawText
                      accessible={false}
                      selectable={false}
                      style={{
                        color: foreground,
                        fontSize: textStyle ? (name === "name-enlarged" ? 32 : 26) : theme.typography.fontSizes.b10,
                        fontWeight: theme.typography.fontWeights.regular,
                        fontFamily: theme.typography.fontFamilies.body,
                        fontStyle: "normal",
                        lineHeight: theme.typography.lineHeight,
                      }}
                    >
                      {initials}
                    </RawText>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}

export const AvatarScene = () => {
  const [nativeMode, setNativeMode] = useState<"behavior" | "styles" | null>(null)
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
        <Button raised={false} onPress={() => setNativeMode("behavior")}>
          Prepare Avatar behavior checks
        </Button>
        <Button raised={false} onPress={() => setNativeMode("styles")}>
          Prepare Avatar style checks
        </Button>
      </View>
      {nativeMode ? (
        <NativeAvatarChecks key={nativeMode} mode={nativeMode} />
      ) : (
        <>
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
                imageMode === "sample"
                  ? SAMPLE_IMAGE
                  : imageMode === "invalid"
                    ? "data:image/png;base64,AA=="
                    : undefined
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
              Fallback delay: {delayed ? "1000 ms" : "immediate"}. Eligibility belongs to the mounted avatar; restart
              its lifetime to observe a new delay. Image fixtures are local PNG data, including one intentionally
              invalid image.
            </Text>
            <Text>Les initiales, les couleurs et la taille restent liées aux paramètres choisis.</Text>
          </View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  scene: { gap: 10 },
  measurement: { width: "100%", height: 128, padding: 12, backgroundColor: "#ffffff", alignItems: "flex-start" },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  preview: { gap: 10, alignItems: "flex-start" },
})
