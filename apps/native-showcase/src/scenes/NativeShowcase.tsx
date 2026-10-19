import { StatusBar } from "expo-status-bar"
import { useRef, useState, type PropsWithChildren } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import {
  NativeOverlayProvider,
  NativeFloatingLayerHost,
  NativeThemeProvider,
  useNativeTheme,
  type NativeThemeMode,
} from "@codon-ui/react-native"

import { AVAILABLE_LAYOUT_FIXTURES, LAYOUT_FIXTURE_LABELS, type TLayoutFixture } from "../fixtures/layout"

import { AvatarScene } from "./AvatarScene"
import { BasicControlsScene } from "./BasicControlsScene"
import { BreadcrumbsScene } from "./BreadcrumbsScene"
import { CircularCounterScene } from "./CircularCounterScene"
import { ClickPopoverScene } from "./ClickPopoverScene"
import { DisplayScene } from "./DisplayScene"
import { FormFieldScene } from "./FormFieldScene"
import { GalleryScene } from "./GalleryScene"
import { LibraryScene } from "./LibraryScene"
import { LinkScene } from "./LinkScene"
import { LoadingScene } from "./LoadingScene"
import { MultilineRadioScene } from "./MultilineRadioScene"
import { NumberInputScene } from "./NumberInputScene"
import { OverlayScene } from "./OverlayScene"
import { PaginationScene } from "./PaginationScene"
import { RangeScene } from "./RangeScene"
import { SceneShell } from "./SceneShell"
import { SelectScene } from "./SelectScene"
import { SliderScene } from "./SliderScene"
import { StepperScene } from "./StepperScene"
import { TagScene } from "./TagScene"
import { ThumbnailScene } from "./ThumbnailScene"
import { ToasterScene } from "./ToasterScene"
import { ToggleScene } from "./ToggleScene"
import { TooltipScene } from "./TooltipScene"
import { TypeaheadSearchScene } from "./TypeaheadSearchScene"

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
  const scrollView = useRef<ScrollView>(null)
  const scrollOffset = useRef(0)
  const layoutGeneration = useRef(0)
  const revealFocusedInput = () => {
    const generation = ++layoutGeneration.current
    const input = TextInput.State.currentlyFocusedInput()
    if (!input) return
    // Native focus scrolling can leave the field outside the resized, clipped viewport.
    scrollView.current?.getNativeScrollRef()?.measureInWindow((_x, viewportTop, _width, viewportHeight) => {
      input.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
        if (generation !== layoutGeneration.current || TextInput.State.currentlyFocusedInput() !== input) return
        const overflow = inputTop + inputHeight + styles.page.padding - (viewportTop + viewportHeight)
        if (overflow > 0)
          scrollView.current?.scrollTo({ y: Math.max(0, scrollOffset.current + overflow), animated: false })
      })
    })
  }
  // iOS padding keeps flex measurements tied to the current window after rotation.
  return (
    <KeyboardAvoidingView style={styles.surface} behavior={Platform.OS === "ios" ? "padding" : "height"}>
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
        <ScrollView
          ref={scrollView}
          testID="showcase-scroll"
          style={styles.surface}
          contentContainerStyle={styles.page}
          onLayout={revealFocusedInput}
          onContentSizeChange={revealFocusedInput}
          onScroll={({ nativeEvent }) => {
            scrollOffset.current = nativeEvent.contentOffset.y
          }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

export const NativeShowcase = () => {
  const dimensions = useWindowDimensions()
  const [mode, setMode] = useState<NativeThemeMode>("light")
  const [customized, setCustomized] = useState(false)
  const [fixture, setFixture] = useState<TLayoutFixture>("live")
  const [count, setCount] = useState(0)
  const [scene, setScene] = useState<
    | "foundation"
    | "library"
    | "controls"
    | "select"
    | "multiline"
    | "number"
    | "overlay"
    | "range"
    | "display"
    | "loading"
    | "toggle"
    | "avatar"
    | "tag"
    | "link"
    | "thumbnail"
    | "gallery"
    | "stepper"
    | "slider"
    | "field"
    | "search"
    | "circular"
    | "tooltip"
    | "popover"
    | "breadcrumbs"
    | "pagination"
    | "toaster"
  >("foundation")
  const reset = () => {
    setMode("light")
    setCustomized(false)
    setFixture("live")
    setCount(0)
    setScene("foundation")
  }

  return (
    <NativeThemeProvider
      mode={mode}
      overrides={customized ? { colors: { foreground: "#087f8c" }, typography: { fontSizes: { b10: 18 } } } : undefined}
    >
      <NativeOverlayProvider>
        <NativeFloatingLayerHost testID="showcase-floating-host">
          <ShowcaseSurface>
            <ThemeHeading />
            <WindowMetadata width={dimensions.width} height={dimensions.height} fontScale={dimensions.fontScale} />
            <View style={styles.controls}>
              <FixtureAction
                label="Foundation scene"
                selected={scene === "foundation"}
                onPress={() => setScene("foundation")}
              />
              <FixtureAction
                label="Text/Button scene"
                selected={scene === "library"}
                onPress={() => setScene("library")}
              />
              <FixtureAction
                label="Basic controls scene"
                selected={scene === "controls"}
                onPress={() => setScene("controls")}
              />
              <FixtureAction
                label="Multiline/Radio scene"
                selected={scene === "multiline"}
                onPress={() => setScene("multiline")}
              />
              <FixtureAction label="Select scene" selected={scene === "select"} onPress={() => setScene("select")} />
              <FixtureAction
                label="Breadcrumbs scene"
                selected={scene === "breadcrumbs"}
                onPress={() => setScene("breadcrumbs")}
              />
              <FixtureAction label="Toaster scene" selected={scene === "toaster"} onPress={() => setScene("toaster")} />
              <FixtureAction
                label="Pagination scene"
                selected={scene === "pagination"}
                onPress={() => setScene("pagination")}
              />
              <FixtureAction label="Overlay scene" selected={scene === "overlay"} onPress={() => setScene("overlay")} />
              <FixtureAction
                label="ClickPopover scene"
                selected={scene === "popover"}
                onPress={() => setScene("popover")}
              />
              <FixtureAction
                label="Tooltip/Hover scene"
                selected={scene === "tooltip"}
                onPress={() => setScene("tooltip")}
              />
              <FixtureAction
                label="NumberInput scene"
                selected={scene === "number"}
                onPress={() => setScene("number")}
              />
              <FixtureAction
                label="Progress/Meter scene"
                selected={scene === "range"}
                onPress={() => setScene("range")}
              />
              <FixtureAction
                label="Indicator/Segment scene"
                selected={scene === "display"}
                onPress={() => setScene("display")}
              />
              <FixtureAction label="Loading scene" selected={scene === "loading"} onPress={() => setScene("loading")} />
              <FixtureAction label="Toggle scene" selected={scene === "toggle"} onPress={() => setScene("toggle")} />
              <FixtureAction label="Avatar scene" selected={scene === "avatar"} onPress={() => setScene("avatar")} />
              <FixtureAction label="Tag scene" selected={scene === "tag"} onPress={() => setScene("tag")} />
              <FixtureAction label="Link scene" selected={scene === "link"} onPress={() => setScene("link")} />
              <FixtureAction
                label="Thumbnail scene"
                selected={scene === "thumbnail"}
                onPress={() => setScene("thumbnail")}
              />
              <FixtureAction label="Stepper scene" selected={scene === "stepper"} onPress={() => setScene("stepper")} />
              <FixtureAction label="Slider scene" selected={scene === "slider"} onPress={() => setScene("slider")} />
              <FixtureAction label="Form field scene" selected={scene === "field"} onPress={() => setScene("field")} />
              <FixtureAction
                label="Inline search scene"
                selected={scene === "search"}
                onPress={() => setScene("search")}
              />
              <FixtureAction
                label="Circular/Counter scene"
                selected={scene === "circular"}
                onPress={() => setScene("circular")}
              />
              <FixtureAction label="Gallery scene" selected={scene === "gallery"} onPress={() => setScene("gallery")} />
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
              {scene === "toaster" ? (
                <ToasterScene />
              ) : scene === "pagination" ? (
                <PaginationScene />
              ) : scene === "breadcrumbs" ? (
                <BreadcrumbsScene />
              ) : scene === "popover" ? (
                <ClickPopoverScene />
              ) : scene === "tooltip" ? (
                <TooltipScene />
              ) : scene === "circular" ? (
                <CircularCounterScene />
              ) : scene === "search" ? (
                <TypeaheadSearchScene />
              ) : scene === "field" ? (
                <FormFieldScene />
              ) : scene === "slider" ? (
                <SliderScene />
              ) : scene === "stepper" ? (
                <StepperScene />
              ) : scene === "gallery" ? (
                <GalleryScene />
              ) : scene === "thumbnail" ? (
                <ThumbnailScene />
              ) : scene === "link" ? (
                <LinkScene />
              ) : scene === "tag" ? (
                <TagScene />
              ) : scene === "avatar" ? (
                <AvatarScene />
              ) : scene === "toggle" ? (
                <ToggleScene />
              ) : scene === "loading" ? (
                <LoadingScene />
              ) : scene === "display" ? (
                <DisplayScene />
              ) : scene === "range" ? (
                <RangeScene />
              ) : scene === "overlay" ? (
                <OverlayScene toggleTheme={() => setMode((current) => (current === "light" ? "dark" : "light"))} />
              ) : scene === "number" ? (
                <NumberInputScene />
              ) : scene === "multiline" ? (
                <MultilineRadioScene />
              ) : scene === "select" ? (
                <SelectScene />
              ) : scene === "controls" ? (
                <BasicControlsScene />
              ) : scene === "library" ? (
                <LibraryScene count={count} increment={() => setCount((value) => value + 1)} />
              ) : (
                <ThemePreview count={count} increment={() => setCount((value) => value + 1)} />
              )}
            </SceneShell>
          </ShowcaseSurface>
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
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
