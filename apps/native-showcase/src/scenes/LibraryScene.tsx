import { Fragment, useState } from "react"
import { Platform, Pressable, StyleSheet, Text as CoreText, View } from "react-native"

import {
  AVAILABLE_CORNER_GEOMETRY_CODES,
  AVAILABLE_FONT_VARIANTS,
  AVAILABLE_FONT_WEIGHTS,
  AVAILABLE_THEMING_ORDER_CODES,
  Button,
  CarouselCloseButton,
  NativeFocusView,
  PlaceholderText,
  Text,
  useNativeTheme,
} from "@codon-ui/react-native"

const SceneControl = ({
  label,
  selected = false,
  onPress,
}: {
  label: string
  selected?: boolean
  onPress: () => void
}) => {
  const theme = useNativeTheme()
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.control, { backgroundColor: theme.actions.primary.background }]}
    >
      <CoreText style={{ color: theme.actions.primary.foreground }}>{label}</CoreText>
    </Pressable>
  )
}

export const LibraryScene = ({ count, increment }: { count: number; increment: () => void }) => {
  const [variantIndex, setVariantIndex] = useState(AVAILABLE_FONT_VARIANTS.indexOf("b10"))
  const [weightIndex, setWeightIndex] = useState(1)
  const [orderIndex, setOrderIndex] = useState(0)
  const [geometryIndex, setGeometryIndex] = useState(1)
  const [outlined, setOutlined] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [pending, setPending] = useState(false)
  const [keyboardFocusable, setKeyboardFocusable] = useState(true)
  const [lastRelease, setLastRelease] = useState("none")
  const [custom, setCustom] = useState(false)
  const [renderChildren, setRenderChildren] = useState(false)
  const [constrained, setConstrained] = useState(false)
  const [selectable, setSelectable] = useState(true)
  const [clearTextTypography, setClearTextTypography] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(true)
  const [closeActions, setCloseActions] = useState(0)
  const [placeholderCentered, setPlaceholderCentered] = useState(false)
  const [placeholderEmpty, setPlaceholderEmpty] = useState(false)
  const variant = AVAILABLE_FONT_VARIANTS[variantIndex]
  const weight = AVAILABLE_FONT_WEIGHTS[weightIndex]
  const order = AVAILABLE_THEMING_ORDER_CODES[orderIndex]
  const geometry = AVAILABLE_CORNER_GEOMETRY_CODES[geometryIndex]

  return (
    <View style={styles.scene}>
      <Text elementType="h2" variant="h3">
        Native Text and Button
      </Text>
      <Text testID="library-state">
        Library action count: {count}. Order: {order}. Mode: {outlined ? "outline" : "fill"}. State:{" "}
        {disabled ? "disabled" : pending ? "pending" : "enabled"}. Keyboard focus:{" "}
        {keyboardFocusable ? "enabled" : "excluded"}.
      </Text>
      <View style={styles.controls}>
        <SceneControl
          label="Next text variant"
          onPress={() => setVariantIndex((index) => (index + 1) % AVAILABLE_FONT_VARIANTS.length)}
        />
        <SceneControl
          label="Next font weight"
          onPress={() => setWeightIndex((index) => (index + 1) % AVAILABLE_FONT_WEIGHTS.length)}
        />
        <SceneControl
          label="Toggle text selection"
          selected={selectable}
          onPress={() => setSelectable((value) => !value)}
        />
        <SceneControl
          label="Next button order"
          onPress={() => setOrderIndex((index) => (index + 1) % AVAILABLE_THEMING_ORDER_CODES.length)}
        />
        <SceneControl
          label="Toggle button outline"
          selected={outlined}
          onPress={() => setOutlined((value) => !value)}
        />
        <SceneControl
          label="Next button geometry"
          onPress={() => setGeometryIndex((index) => (index + 1) % AVAILABLE_CORNER_GEOMETRY_CODES.length)}
        />
        <SceneControl
          label="Toggle library disabled"
          selected={disabled}
          onPress={() => setDisabled((value) => !value)}
        />
        <SceneControl label="Toggle library pending" selected={pending} onPress={() => setPending((value) => !value)} />
        <SceneControl
          label="Toggle library keyboard focus"
          selected={keyboardFocusable}
          onPress={() => setKeyboardFocusable((value) => !value)}
        />
        <SceneControl label="Toggle library styles" selected={custom} onPress={() => setCustom((value) => !value)} />
        <SceneControl
          label="Clear text typography"
          selected={clearTextTypography}
          onPress={() => setClearTextTypography((value) => !value)}
        />
        <SceneControl
          label="Toggle render children"
          selected={renderChildren}
          onPress={() => setRenderChildren((value) => !value)}
        />
        <SceneControl
          label="Toggle constrained target"
          selected={constrained}
          onPress={() => setConstrained((value) => !value)}
        />
        <SceneControl
          label="Toggle placeholder alignment"
          selected={placeholderCentered}
          onPress={() => setPlaceholderCentered((value) => !value)}
        />
        <SceneControl
          label="Toggle empty placeholder"
          selected={placeholderEmpty}
          onPress={() => setPlaceholderEmpty((value) => !value)}
        />
      </View>
      <Text>
        Text variant {variant}; weight {weight}; button geometry {geometry}.
      </Text>
      <Text
        testID="library-text-preview"
        variant={variant}
        fontWeight={weight}
        selectable={selectable}
        customStyles={custom ? { fontSize: 18, fontWeight: "700", fontStyle: "italic", lineHeight: 26 } : undefined}
        style={
          clearTextTypography
            ? { fontSize: undefined, fontWeight: undefined, fontStyle: undefined, lineHeight: undefined }
            : undefined
        }
      >
        Native text remains readable: sélectionnez les paramètres et continuez lorsque vous êtes prêt.
      </Text>
      <Text>
        Parent text with <Text fontWeight="bold">nested bold content</Text> and inherited foreground.
      </Text>
      <PlaceholderText testID="library-placeholder" align={placeholderCentered ? "center" : "left"} onPress={increment}>
        {placeholderEmpty ? "" : "Choose an item"}
      </PlaceholderText>
      <Text testID="library-release">Last release: {lastRelease}</Text>
      <Button
        accessibilityLabel="Library action"
        testID="library-button"
        render={(props, state) => (
          <NativeFocusView {...props} nativeID={`library-button-${state.isPending ? "pending" : "ready"}`} />
        )}
        order={order}
        colorMode={outlined ? "outline" : "fill"}
        geometry={geometry}
        isDisabled={disabled}
        isPending={pending}
        focusable={keyboardFocusable}
        onPress={increment}
        onPressUp={(event) => setLastRelease("kind" in event.nativeEvent ? event.nativeEvent.kind : "touch")}
        raised={!custom}
        style={
          custom
            ? (state) => ({
                backgroundColor: state.isPressed ? "#173f5f" : "#123456",
                color: "#ffffff",
                fontSize: 20,
                fontWeight: "700",
                letterSpacing: 1,
                textTransform: "uppercase",
                boxShadow: renderChildren
                  ? [{ offsetX: 0, offsetY: 2, blurRadius: 3, color: "rgba(0, 0, 0, 0.24)" }]
                  : "0px 2px 3px rgba(0, 0, 0, 0.24)",
                filter:
                  renderChildren && Platform.OS === "android"
                    ? [{ dropShadow: { offsetX: 0, offsetY: 2, standardDeviation: 1, color: "rgba(0, 0, 0, 0.24)" } }]
                    : undefined,
              })
            : undefined
        }
      >
        {renderChildren
          ? (state) => (
              <>
                Rendered library action {count}
                <View accessible={false} style={{ width: 10, height: 10, backgroundColor: state.foregroundColor }} />
              </>
            )
          : ["Library ", <Fragment key="label">action {count}</Fragment>]}
      </Button>
      <Button
        accessibilityLabel="Long library action"
        order={order}
        colorMode={outlined ? "outline" : "fill"}
        isDisabled={disabled}
        isPending={pending}
        onPress={increment}
      >
        A long action label: continuez lorsque tous les paramètres sont prêts.
      </Button>
      <Text testID="carousel-close-receipt">
        Close preview: {previewOpen ? "open" : "closed"}. Close actions: {closeActions}.
      </Text>
      {previewOpen && (
        <View testID="carousel-close-preview" style={styles.closePreview}>
          <Text>Standalone Carousel close control</Text>
          <CarouselCloseButton
            isDisabled={disabled}
            isPending={pending}
            onPress={() => {
              setPreviewOpen(false)
              setCloseActions((value) => value + 1)
            }}
            customStyles={custom ? { padding: 10, borderWidth: 2, borderColor: "#087f8c" } : undefined}
          />
        </View>
      )}
      <SceneControl label="Restore close preview" onPress={() => setPreviewOpen(true)} />
      {constrained && (
        <View style={styles.constraint}>
          <Text>
            Explicit 24 × 24 target in a parent that clips overflow. This fixture is an intentional target limitation.
          </Text>
          <View collapsable={false} style={{ width: 24, height: 24, overflow: "hidden" }}>
            <Button
              accessibilityLabel="Constrained library action"
              customStyles={{ width: 24, height: 24 }}
              style={(state) => state.defaultStyle}
              onPress={increment}
            >
              !
            </Button>
          </View>
        </View>
      )}
      <Text>
        Library scenes use native events, refs, roles and styles. Physical screen-reader and touch acceptance remain
        separate.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scene: { gap: 10 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  control: { minHeight: Platform.OS === "ios" ? 44 : 48, padding: 10, justifyContent: "center", borderRadius: 5 },
  constraint: { gap: 10 },
  closePreview: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
})
