import { useState } from "react"
import { StyleSheet, View, type LayoutChangeEvent } from "react-native"

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
const COLUMNS = [undefined, 2, 3, 6] as const
const PRIMARY_KINDS = ["image", "undefined", "null", "zero", "false", "empty"] as const
const ITEMS = [
  { id: 0, name: "A" },
  { id: "", name: "B" },
  { id: "c", name: "C" },
  { id: "d", name: "D" },
  { id: "e", name: "E" },
] as const

type TFrame = { width: number; height: number }
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
  const [disabled, setDisabled] = useState(false)
  const [lifetime, setLifetime] = useState(0)
  const [actions, setActions] = useState(0)
  const [overflowActions, setOverflowActions] = useState(0)
  const [frames, setFrames] = useState<Record<string, TFrame>>({})
  const theme = useNativeTheme()
  const recordFrame =
    (key: string) =>
    ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
      const width = Math.round(layout.width * 1000) / 1000
      const height = Math.round(layout.height * 1000) / 1000
      setFrames((current) =>
        current[key]?.width === width && current[key]?.height === height
          ? current
          : { ...current, [key]: { width, height } },
      )
    }
  const mode = AVAILABLE_THUMBNAIL_SHOWCASE_RENDERING_MODES[modeIndex]
  const kind = PRIMARY_KINDS[primaryIndex]
  const source = reordered ? [ITEMS[1], ITEMS[0], ...ITEMS.slice(2)] : [...ITEMS]
  const selected = empty ? [] : many ? source : source.slice(0, 1)
  const primaryContent =
    kind === "image" ? (
      <View style={styles.fill} onLayout={recordFrame("primary")} testID="gallery-primary-content">
        <ThumbnailImage
          src={IMAGE}
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
  return (
    <View style={styles.scene}>
      <Text elementType="h2" variant="h3">
        Thumbnail showcase slots and keyed content
      </Text>
      <Text testID="gallery-state">
        Mode: {mode}. Primary: {kind}. Slots: {String(SLOT_COUNTS[slotIndex])}. Columns:{" "}
        {COLUMNS[columnIndex] ?? "default"}. Items: {selected.length}. Overflow: {String(overflow)}. Width:{" "}
        {zero ? 0 : 280}. Custom: {String(custom)}. Disabled: {String(disabled)}. Actions: {actions}. Overflow actions:{" "}
        {overflowActions}. Lifetime: {lifetime}.
      </Text>
      <Text testID="gallery-frames">
        Last native frames:{" "}
        {Object.entries(frames)
          .map(([name, frame]) => `${name} ${frame.width} x ${frame.height}`)
          .join("; ") || "unmeasured"}
        .
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
        <Button onPress={() => setZero((value) => !value)}>Toggle gallery zero width</Button>
        <Button onPress={() => setCustom((value) => !value)}>Toggle gallery styles</Button>
        <Button onPress={() => setDisabled((value) => !value)}>Toggle gallery actions disabled</Button>
        <Button onPress={() => setLifetime((value) => value + 1)}>Restart gallery content</Button>
      </View>
      <ThumbnailShowcase
        key={lifetime}
        testID="gallery-example"
        width={zero ? 0 : 280}
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
          zero ? { width: 0 } : {},
        ]}
        primarySlotStyle={
          custom
            ? { aspectRatio: 2, borderRadius: 5, borderWidth: 2, borderColor: theme.colors.controlSelectedBackground }
            : undefined
        }
        secondaryRowStyle={
          custom
            ? { padding: 4, columnGap: 4, rowGap: 6, backgroundColor: theme.colors.controlTrackBackground }
            : undefined
        }
        secondarySlotStyle={
          custom ? { width: 40, borderRadius: 5, borderWidth: 1, borderColor: theme.colors.controlBorder } : undefined
        }
        onLayout={recordFrame("root")}
      />
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
})
