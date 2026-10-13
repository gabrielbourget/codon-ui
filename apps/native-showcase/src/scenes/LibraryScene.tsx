import { useState } from "react"
import { Platform, Pressable, StyleSheet, Text as CoreText, View } from "react-native"

import {
  AVAILABLE_CORNER_GEOMETRY_CODES,
  AVAILABLE_FONT_VARIANTS,
  AVAILABLE_FONT_WEIGHTS,
  AVAILABLE_THEMING_ORDER_CODES,
  Button,
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
  const [custom, setCustom] = useState(false)
  const [renderChildren, setRenderChildren] = useState(false)
  const [constrained, setConstrained] = useState(false)
  const [selectable, setSelectable] = useState(true)
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
        {disabled ? "disabled" : pending ? "pending" : "enabled"}.
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
        <SceneControl label="Toggle library styles" selected={custom} onPress={() => setCustom((value) => !value)} />
        <SceneControl
          label="Toggle render children"
          selected={renderChildren}
          onPress={() => setRenderChildren((value) => !value)}
        />
        <SceneControl
          label="Toggle constrained button"
          selected={constrained}
          onPress={() => setConstrained((value) => !value)}
        />
      </View>
      <Text>
        Text variant {variant}; weight {weight}; button geometry {geometry}.
      </Text>
      <Text testID="library-text-preview" variant={variant} fontWeight={weight} selectable={selectable}>
        Native text remains readable: sélectionnez les paramètres et continuez lorsque vous êtes prêt.
      </Text>
      <Text>
        Parent text with <Text fontWeight="bold">nested bold content</Text> and inherited foreground.
      </Text>
      <Button
        accessibilityLabel="Library action"
        testID="library-button"
        order={order}
        colorMode={outlined ? "outline" : "fill"}
        geometry={geometry}
        isDisabled={disabled}
        isPending={pending}
        onPress={increment}
        style={
          custom
            ? (state) => ({ backgroundColor: state.isPressed ? "#173f5f" : "#123456", color: "#ffffff" })
            : undefined
        }
      >
        {renderChildren
          ? (state) => (
              <>
                <Text>Rendered library action</Text>
                <View accessible={false} style={{ width: 10, height: 10, backgroundColor: state.foregroundColor }} />
              </>
            )
          : "Library action"}
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
      {constrained && (
        <View style={styles.constraint}>
          <Text>
            Explicit 24 × 24 target in a 24 × 24 parent. Hit slop is clipped by the parent; this fixture is an
            intentional target limitation.
          </Text>
          <View collapsable={false} style={{ width: 24, height: 24 }}>
            <Button accessibilityLabel="Constrained library action" width={24} height={24} onPress={increment}>
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
})
