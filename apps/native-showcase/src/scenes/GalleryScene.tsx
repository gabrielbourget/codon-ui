import { useCallback, useState } from "react"
import { findNodeHandle, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from "react-native"

import {
  AVAILABLE_THUMBNAIL_SHOWCASE_RENDERING_MODES,
  Button,
  Text,
  ThumbnailImage,
  ThumbnailShowcase,
  useNativeTheme,
} from "@codon-ui/react-native"

const IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAYCAIAAAAzn+mLAAAAPklEQVR4nGPgqO/Bin58uIMV0Vo9w6iDRh006qAR56CBshiX+lEHjTpo1EEjz0EDZTEu9aMOGnXQqINGnIMAV6ykOfJ/enQAAAAASUVORK5CYII="
const SLOT_COUNTS = [4, 2, 0, 2.9, NaN, Infinity] as const
const WIDTHS = [280, 83.25, "50%", "auto"] as const
const COLUMNS = [undefined, 2, 3, 6] as const
const PRIMARY_KINDS = ["image", "undefined", "null", "zero", "false", "empty"] as const
const ITEMS = [
  { id: 0, name: "A" },
  { id: "", name: "B" },
  { id: "c", name: "C" },
  { id: "d", name: "D" },
  { id: "e", name: "E" },
] as const

const GALLERY_CUSTOMIZATIONS = [
  ["root", "Toggle gallery root styles"],
  ["primary", "Toggle gallery primary slot styles"],
  ["row", "Toggle gallery row styles"],
  ["secondary", "Toggle gallery secondary slot styles"],
] as const
type TGalleryCustomization = (typeof GALLERY_CUSTOMIZATIONS)[number][0]
const POSITIONS = ["flow", "relative", "absolute"] as const
type TFrame = { x: number; y: number; width: number; height: number }
const GalleryCell = ({
  name,
  disabled,
  onAction,
  onLayout,
}: {
  name: string
  disabled: boolean
  onAction: () => void
  onLayout: (event: LayoutChangeEvent) => void
}) => {
  const [count, setCount] = useState(0)
  return (
    <Button
      testID={`gallery-item-${name}`}
      accessibilityLabel={`Gallery ${name}, count ${count}`}
      geometry="orthogonal"
      width="100%"
      height="100%"
      raised={false}
      style={{ padding: 0 }}
      isDisabled={disabled}
      onLayout={onLayout}
      onPress={() => {
        setCount((value) => value + 1)
        onAction()
      }}
    >
      {name}:{count}
    </Button>
  )
}

export const GalleryScene = () => {
  const { scale } = useWindowDimensions()
  const [widthIndex, setWidthIndex] = useState(0)
  const [primaryTag, setPrimaryTag] = useState<number | null>(null)
  const bindPrimary = useCallback((node: View | null) => setPrimaryTag(node ? findNodeHandle(node) : null), [])
  const [primaryLoads, setPrimaryLoads] = useState<
    { target: number | null; currentTarget: number | null; uri: string; width: number; height: number }[]
  >([])
  const [originalLayouts, setOriginalLayouts] = useState<
    Record<string, { target: number | null; currentTarget: number | null; layout: TFrame }>
  >({})
  const nodeTag = (node: unknown) =>
    typeof node === "number" ? node : node == null ? null : findNodeHandle(node as View)
  const [modeIndex, setModeIndex] = useState(0)
  const [primaryIndex, setPrimaryIndex] = useState(0)
  const [slotIndex, setSlotIndex] = useState(0)
  const [columnIndex, setColumnIndex] = useState(0)
  const [overflow, setOverflow] = useState(true)
  const [many, setMany] = useState(true)
  const [empty, setEmpty] = useState(false)
  const [reordered, setReordered] = useState(false)
  const [zero, setZero] = useState(false)
  const [custom, setCustom] = useState(false)
  const [customizations, setCustomizations] = useState<readonly TGalleryCustomization[]>([])
  const [positionIndex, setPositionIndex] = useState(0)
  const [disabled, setDisabled] = useState(false)
  const [lifetime, setLifetime] = useState(0)
  const [actions, setActions] = useState(0)
  const [overflowActions, setOverflowActions] = useState(0)
  const [frames, setFrames] = useState<Record<string, TFrame>>({})
  const theme = useNativeTheme()
  const recordFrame = (key: string) => (event: LayoutChangeEvent) => {
    const layout = { ...event.nativeEvent.layout }
    const target = nodeTag(event.target)
    const currentTarget = nodeTag(event.currentTarget)
    setOriginalLayouts((current) => {
      const prior = current[key]
      return prior?.target === target &&
        prior.currentTarget === currentTarget &&
        Object.keys(layout).every((field) => prior.layout[field as keyof TFrame] === layout[field as keyof TFrame])
        ? current
        : { ...current, [key]: { target, currentTarget, layout } }
    })
    const x = Math.round(layout.x * 1000) / 1000
    const y = Math.round(layout.y * 1000) / 1000
    const width = Math.round(layout.width * 1000) / 1000
    const height = Math.round(layout.height * 1000) / 1000
    setFrames((current) =>
      current[key]?.x === x && current[key]?.y === y && current[key]?.width === width && current[key]?.height === height
        ? current
        : { ...current, [key]: { x, y, width, height } },
    )
  }
  const position = POSITIONS[positionIndex]
  const mode = AVAILABLE_THUMBNAIL_SHOWCASE_RENDERING_MODES[modeIndex]
  const kind = PRIMARY_KINDS[primaryIndex]
  const source = reordered ? [ITEMS[1], ITEMS[0], ...ITEMS.slice(2)] : [...ITEMS]
  const selected = empty ? [] : many ? source : source.slice(0, 1)
  const primaryContent =
    kind === "image" ? (
      <View ref={bindPrimary} style={styles.fill} onLayout={recordFrame("primary")} testID="gallery-primary-content">
        <ThumbnailImage
          testID="gallery-primary-image"
          onLayout={recordFrame("image")}
          src={IMAGE}
          onLoad={(event) => {
            const source = event.nativeEvent.source
            const copy = {
              target: nodeTag(event.target),
              currentTarget: nodeTag(event.currentTarget),
              uri: source.uri,
              width: source.width,
              height: source.height,
            }
            setPrimaryLoads((current) => [...current, copy])
          }}
          alt="Gallery primary photo"
          accessible={false}
          resizeMode="cover"
          style={styles.fill}
          fallback={<Text>No photo</Text>}
        />
      </View>
    ) : kind === "undefined" ? undefined : kind === "null" ? null : kind === "zero" ? (
      0
    ) : kind === "false" ? (
      false
    ) : (
      ""
    )
  const snapshot = {
    mode,
    kind,
    count: String(SLOT_COUNTS[slotIndex]),
    columns: COLUMNS[columnIndex] ?? null,
    items: selected.map((item) => item.name),
    overflow,
    zero,
    width: zero ? 0 : WIDTHS[widthIndex],
    custom,
    customizations,
    position,
    disabled,
    lifetime,
    actions,
    overflowActions,
    frames,
    originalLayouts,
    primaryTag,
    primaryLoads,
    expectedURI: IMAGE,
    scale,
    theme: theme.mode,
    colors: {
      border: theme.colors.controlBorder,
      selected: theme.colors.controlSelectedBackground,
      track: theme.colors.controlTrackBackground,
    },
  }
  return (
    <View style={styles.scene}>
      <Text elementType="h2" variant="h3">
        Thumbnail showcase slots and keyed content
      </Text>
      <Text testID="gallery-state">
        Mode: {mode}. Primary: {kind}. Slots: {String(SLOT_COUNTS[slotIndex])}. Columns:{" "}
        {COLUMNS[columnIndex] ?? "default"}. Items: {selected.length}. Overflow: {String(overflow)}. Width:{" "}
        {zero ? 0 : WIDTHS[widthIndex]}. Custom: {String(custom)}. Disabled: {String(disabled)}. Actions: {actions}.
        Overflow actions: {overflowActions}. Lifetime: {lifetime}.
      </Text>
      <Text testID="gallery-customization-state">
        Gallery customizations: {customizations.join(", ") || "none"}. Positioning: {position}.
      </Text>
      <Text testID="gallery-frames">
        Last native frames:{" "}
        {Object.entries(frames)
          .map(([name, frame]) => `${name} ${frame.width} x ${frame.height} at ${frame.x}, ${frame.y}`)
          .join("; ") || "unmeasured"}
        .
      </Text>
      <Text testID="gallery-native-state" accessibilityLabel={JSON.stringify(snapshot)} numberOfLines={1}>
        Native gallery observation
      </Text>
      <View style={styles.controls}>
        <Button
          onPress={() => setModeIndex((value) => (value + 1) % AVAILABLE_THUMBNAIL_SHOWCASE_RENDERING_MODES.length)}
        >
          Next gallery mode
        </Button>
        <Button onPress={() => setPrimaryIndex((value) => (value + 1) % PRIMARY_KINDS.length)}>
          Next gallery primary
        </Button>
        <Button onPress={() => setSlotIndex((value) => (value + 1) % SLOT_COUNTS.length)}>
          Next gallery slot count
        </Button>
        <Button onPress={() => setColumnIndex((value) => (value + 1) % COLUMNS.length)}>
          Next gallery column count
        </Button>
        <Button onPress={() => setOverflow((value) => !value)}>Toggle gallery overflow</Button>
        <Button onPress={() => setMany((value) => !value)}>Toggle gallery five items</Button>
        <Button onPress={() => setEmpty((value) => !value)}>Toggle empty gallery items</Button>
        <Button onPress={() => setReordered((value) => !value)}>Reorder gallery items</Button>
        <Button onPress={() => setWidthIndex((value) => (value + 1) % WIDTHS.length)}>Next gallery width</Button>
        <Button onPress={() => setZero((value) => !value)}>Toggle gallery zero width</Button>
        <Button onPress={() => setCustom((value) => !value)}>Toggle gallery styles</Button>
        {GALLERY_CUSTOMIZATIONS.map(([key, label]) => (
          <Button
            key={key}
            onPress={() =>
              setCustomizations((values) =>
                values.includes(key) ? values.filter((value) => value !== key) : [...values, key],
              )
            }
          >
            {label}
          </Button>
        ))}
        <Button onPress={() => setPositionIndex((value) => (value + 1) % POSITIONS.length)}>
          Next gallery positioning
        </Button>
        <Button onPress={() => setDisabled((value) => !value)}>Toggle gallery actions disabled</Button>
        <Button onPress={() => setLifetime((value) => value + 1)}>Restart gallery content</Button>
      </View>
      <View
        testID="gallery-position-host"
        style={[styles.positionHost, position === "absolute" ? styles.absoluteHost : undefined]}
        onLayout={recordFrame("host")}
      >
        <ThumbnailShowcase
          key={lifetime}
          testID="gallery-example"
          width={zero ? 0 : WIDTHS[widthIndex]}
          renderingMode={mode}
          primaryContent={primaryContent}
          primaryPlaceholder={
            <View
              testID="gallery-primary-placeholder"
              style={[styles.fill, { backgroundColor: theme.colors.controlTrackBackground }]}
              onLayout={recordFrame("primary-placeholder")}
            >
              <Text>No primary media / aucun média principal</Text>
            </View>
          }
          secondaryItems={selected.map((item) => ({
            id: item.id,
            content: (
              <GalleryCell
                name={item.name}
                disabled={disabled}
                onAction={() => setActions((value) => value + 1)}
                onLayout={recordFrame(item.name)}
              />
            ),
          }))}
          secondarySlotCount={SLOT_COUNTS[slotIndex]}
          secondaryColumnCount={COLUMNS[columnIndex]}
          renderSecondaryPlaceholder={({ index }) => (
            <View
              testID="gallery-secondary-placeholder"
              style={[styles.fill, { backgroundColor: theme.colors.controlTrackBackground }]}
              onLayout={recordFrame(`empty-${index}`)}
            >
              <Text>·{index}</Text>
            </View>
          )}
          renderOverflow={
            overflow
              ? ({ hiddenItemCount }) => (
                  <Button
                    testID="gallery-overflow"
                    accessibilityLabel={`Gallery overflow ${hiddenItemCount}`}
                    width="100%"
                    height="100%"
                    geometry="orthogonal"
                    raised={false}
                    style={{ padding: 0 }}
                    isDisabled={disabled}
                    onLayout={recordFrame("overflow")}
                    onPress={() => setOverflowActions((value) => value + 1)}
                  >
                    +{hiddenItemCount}
                  </Button>
                )
              : undefined
          }
          style={[
            custom ? { width: 260, gap: 12, padding: 5, borderWidth: 1, borderColor: theme.colors.controlBorder } : {},
            customizations.includes("root") ? styles.customRoot : undefined,
            position === "relative"
              ? styles.relativePosition
              : position === "absolute"
                ? styles.absolutePosition
                : undefined,
            zero ? { width: 0 } : {},
          ]}
          primarySlotStyle={[
            custom
              ? { aspectRatio: 2, borderRadius: 5, borderWidth: 2, borderColor: theme.colors.controlSelectedBackground }
              : undefined,
            customizations.includes("primary") ? styles.customPrimary : undefined,
          ]}
          secondaryRowStyle={[
            custom
              ? { padding: 4, columnGap: 4, rowGap: 6, backgroundColor: theme.colors.controlTrackBackground }
              : undefined,
            customizations.includes("row") ? styles.customRow : undefined,
          ]}
          secondarySlotStyle={[
            custom
              ? { width: 40, borderRadius: 5, borderWidth: 1, borderColor: theme.colors.controlBorder }
              : undefined,
            customizations.includes("secondary") ? styles.customSecondary : undefined,
          ]}
          onLayout={recordFrame("root")}
        />
      </View>
      <Text>
        Positioned previews use their containing host; absolute positioning reserves 640 logical units for inspection.
      </Text>
      <Text>
        Slot and column counts are separate. Reordering and layout changes preserve keyed child state; restart or Reset
        scene begins a new lifetime. Width0 keeps its authored value while padding, borders and gaps retain their own
        box contributions.
      </Text>
      <Text>Les espaces, les contenus et les actions restent sous le contrôle de la personne.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scene: { gap: 10 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fill: { width: "100%", height: "100%" },
  positionHost: {
    position: "relative",
    width: "100%",
    maxWidth: 304,
    minHeight: 600,
    padding: 12,
    backgroundColor: "#ffffff",
  },
  absoluteHost: { minHeight: 640 },
  relativePosition: { position: "relative", top: 8, left: 8 },
  absolutePosition: { position: "absolute", top: 12, left: 12 },
  customRoot: { padding: 7, borderWidth: 2, borderColor: "#087f8c", gap: 14 },
  customPrimary: { aspectRatio: 2, borderWidth: 3, borderColor: "#be123c", borderRadius: 8 },
  customRow: { padding: 6, columnGap: 8, rowGap: 12, borderWidth: 2, borderColor: "#7c3aed" },
  customSecondary: { width: 48, borderWidth: 2, borderColor: "#166534", borderRadius: 7 },
})
