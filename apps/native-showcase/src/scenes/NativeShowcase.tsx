import { StatusBar } from "expo-status-bar"
import { useState, type PropsWithChildren } from "react"
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { NativeThemeProvider, useNativeTheme, type NativeThemeMode } from "@codon-ui/react-native"

import { AVAILABLE_LAYOUT_FIXTURES, LAYOUT_FIXTURE_LABELS, type TLayoutFixture } from "../fixtures/layout"

import { LibraryScene } from "./LibraryScene"
import { SceneShell } from "./SceneShell"

const FixtureAction = ({
  label,
  onPress,
  selected = false,
}: {
  label: string
  onPress: () => void
  selected?: boolean
}) => {
  const theme = useNativeTheme()
  return (
    <Pressable
      role="button"
      aria-label={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: pressed ? theme.actions.primary.pressedBackground : theme.actions.primary.background },
      ]}
    >
      <Text style={{ color: theme.actions.primary.foreground }}>{label}</Text>
    </Pressable>
  )
}

const ThemePreview = ({ count, increment }: { count: number; increment: () => void }) => {
  const theme = useNativeTheme()
  return (
    <View style={styles.preview}>
      <Text role="heading" style={{ color: theme.colors.foreground, fontSize: theme.typography.fontSizes.h3 }}>
        Theme foundation
      </Text>
      <Text testID="theme-preview" style={{ color: theme.colors.foreground, fontSize: theme.typography.fontSizes.b10 }}>
        Active theme: {theme.mode}. Action count: {count}.
      </Text>
      <Text style={{ color: theme.colors.foreground }}>
        A long generic label preserves readable native text: sélectionnez les paramètres et continuez lorsque vous êtes
        prêt.
      </Text>
      <FixtureAction label="Increment scene action" onPress={increment} />
      <Text style={{ color: theme.colors.foreground }}>
        Text and Button library scenes are available from the scene controls.
      </Text>
    </View>
  )
}

const ShowcaseSurface = ({ children }: PropsWithChildren) => {
  const theme = useNativeTheme()
  const insets = useSafeAreaInsets()
  return (
    <View
      style={[
        styles.surface,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <ScrollView style={styles.surface} contentContainerStyle={styles.page}>
        {children}
      </ScrollView>
    </View>
  )
}

export const NativeShowcase = () => {
  const dimensions = useWindowDimensions()
  const [mode, setMode] = useState<NativeThemeMode>("light")
  const [customized, setCustomized] = useState(false)
  const [fixture, setFixture] = useState<TLayoutFixture>("live")
  const [count, setCount] = useState(0)
  const [libraryScene, setLibraryScene] = useState(false)
  const reset = () => {
    setMode("light")
    setCustomized(false)
    setFixture("live")
    setCount(0)
    setLibraryScene(false)
  }

  return (
    <NativeThemeProvider
      mode={mode}
      overrides={customized ? { colors: { foreground: "#087f8c" }, typography: { fontSizes: { b10: 18 } } } : undefined}
    >
      <ShowcaseSurface>
        <ThemeHeading />
        <WindowMetadata width={dimensions.width} height={dimensions.height} fontScale={dimensions.fontScale} />
        <View style={styles.controls}>
          <FixtureAction label="Foundation scene" selected={!libraryScene} onPress={() => setLibraryScene(false)} />
          <FixtureAction label="Text/Button scene" selected={libraryScene} onPress={() => setLibraryScene(true)} />
        </View>
        <View style={styles.controls}>
          <FixtureAction label="Light theme" selected={mode === "light"} onPress={() => setMode("light")} />
          <FixtureAction label="Dark theme" selected={mode === "dark"} onPress={() => setMode("dark")} />
          <FixtureAction
            label="Toggle customization"
            selected={customized}
            onPress={() => setCustomized((value) => !value)}
          />
          <FixtureAction label="Reset scene" onPress={reset} />
        </View>
        <View style={styles.controls}>
          {AVAILABLE_LAYOUT_FIXTURES.map((value) => (
            <FixtureAction
              key={value}
              label={LAYOUT_FIXTURE_LABELS[value]}
              selected={fixture === value}
              onPress={() => setFixture(value)}
            />
          ))}
        </View>
        <SceneShell fixture={fixture}>
          {libraryScene ? (
            <LibraryScene count={count} increment={() => setCount((value) => value + 1)} />
          ) : (
            <ThemePreview count={count} increment={() => setCount((value) => value + 1)} />
          )}
        </SceneShell>
      </ShowcaseSurface>
    </NativeThemeProvider>
  )
}

const ThemeHeading = () => {
  const theme = useNativeTheme()
  return (
    <Text role="heading" style={{ color: theme.colors.foreground, fontSize: 24 }}>
      Codon native showcase
    </Text>
  )
}

const WindowMetadata = ({ width, height, fontScale }: { width: number; height: number; fontScale: number }) => {
  const theme = useNativeTheme()
  return (
    <Text style={{ color: theme.colors.foreground }}>
      Window {Math.round(width)} × {Math.round(height)} · font scale {fontScale} · {Platform.OS} · foundation
    </Text>
  )
}

const styles = StyleSheet.create({
  surface: { flex: 1 },
  page: { gap: 15, padding: 15 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  action: {
    minHeight: Platform.OS === "ios" ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 5,
    padding: 10,
  },
  preview: { gap: 10 },
})
