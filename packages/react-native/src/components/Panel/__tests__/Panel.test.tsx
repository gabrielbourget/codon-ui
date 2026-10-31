import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, useState } from "react"
import { AccessibilityInfo, Animated, Platform, StyleSheet, TextInput, View } from "react-native"

import { Button, NativeOverlayProvider, NativeThemeProvider, Text, type TNativeBackdropEffectProps } from "../../.."
import { NativeBackdropHost } from "../../../overlays/backdrop/NativeBackdropHost"
import { NativeFloatingScopeContext } from "../../../overlays/floating/scope"
import { Panel } from "../Panel"
import type { TNativePanelProps } from "../types"

import { PanelFixture } from "./fixtures/PanelFixture"

jest.unmock("react-native/Libraries/Components/View/View")
jest.unmock("react-native/Libraries/Components/View/ViewNativeComponent")
jest.mock("react-native-safe-area-context", () => ({ SafeAreaProvider: jest.requireActual("react-native").View }))
const row = (id = "panel") => screen.getByTestId(id, { includeHiddenElements: true })
const wrap = (props: Partial<TNativePanelProps> = {}) => (
  <NativeOverlayProvider>
    <Panel aria-label="Panel" isOpen {...props}>
      <Text>Panel body</Text>
    </Panel>
  </NativeOverlayProvider>
)
const show = async (id = "panel") => fireEvent(row(`${id}-window`), "show")
const layout = async (width: number) =>
  fireEvent(row(), "layout", { nativeEvent: { layout: { x: 0, y: 0, width, height: 500 } } })

it("inherits Panel text styles through owned descendants within the original window and retains explicit resets", async () => {
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    change = jest.fn()
  const tree = (spacing: number, italic: boolean) => (
    <NativeOverlayProvider>
      <Panel
        ref={root}
        aria-label="Inherited styles"
        isOpen
        customStyles={{ letterSpacing: spacing, textAlign: "right", fontStyle: italic ? "italic" : "normal" }}
      >
        <Text testID="inherited-style">Inherited</Text>
        <Button>Button inherits</Button>
        <Button customStyles={{ fontStyle: "italic", letterSpacing: 3 }}>
          <Text testID="button-authored">Button-owned styles</Text>
        </Button>
        <Text testID="explicit-style" style={{ letterSpacing: 0, fontStyle: "normal", textAlign: "left" }}>
          Explicit
        </Text>
        <Text testID="cleared-style" customStyles={{ letterSpacing: 9 }} style={{ letterSpacing: undefined }}>
          Cleared
        </Text>
        <NativeFloatingScopeContext.Provider value={{ id: "other-window", canAct: () => true }}>
          <Text testID="other-window-text">Other window</Text>
        </NativeFloatingScopeContext.Provider>
        <TextInput ref={editor} testID="inherited-held" value="held" onChangeText={change} />
      </Panel>
    </NativeOverlayProvider>
  )
  const view = await render(tree(2, true))
  const originalRoot = root.current,
    originalEditor = editor.current
  expect(JSON.parse(row().props.nativeTypographyStyle)).toMatchObject({
    letterSpacing: 2,
    textAlign: "right",
    fontStyle: "italic",
  })
  expect(row().props.nativeTypographyWindow).toBe("")
  expect(row("panel-floating-host").props.nativeTypographyWindow).toMatch(/^codon-floating-/)
  expect(row("inherited-style")).toHaveStyle({
    letterSpacing: 2,
    textAlign: "right",
    fontStyle: "italic",
    fontSize: 14,
    fontWeight: "400",
  })
  expect(screen.getByText("Button inherits")).toHaveStyle({
    letterSpacing: 0,
    textAlign: "center",
    fontStyle: "normal",
  })
  expect(row("button-authored")).toHaveStyle({ fontStyle: "italic", letterSpacing: 3 })
  expect(row("explicit-style")).toHaveStyle({ letterSpacing: 0, fontStyle: "normal", textAlign: "left" })
  expect(row("cleared-style")).toHaveStyle({ letterSpacing: 2 })
  expect(StyleSheet.flatten(row("other-window-text").props.style).letterSpacing).toBeUndefined()
  await view.rerender(tree(0, false))
  expect(row("inherited-style")).toHaveStyle({ letterSpacing: 0, fontStyle: "normal" })
  expect(JSON.parse(row().props.nativeTypographyStyle)).toMatchObject({ letterSpacing: 0, fontStyle: "normal" })
  expect(root.current).toBe(originalRoot)
  expect(editor.current).toBe(originalEditor)
  expect(row("inherited-held").props.value).toBe("held")
  expect(change).not.toHaveBeenCalled()
})
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => jest.restoreAllMocks())

it("CAP.panel.001 preserves default/controlled false without constructing children", async () => {
  const Child = jest.fn(() => <Text>Hidden</Text>)
  const { rerender } = await render(
    <NativeOverlayProvider>
      <Panel aria-label="Closed">
        <Child />
      </Panel>
    </NativeOverlayProvider>,
  )
  expect(Child).not.toHaveBeenCalled()
  await rerender(
    <NativeOverlayProvider>
      <Panel aria-label="Closed" isOpen={false}>
        <Child />
      </Panel>
    </NativeOverlayProvider>,
  )
  expect(screen.queryByTestId("panel")).toBeNull()
  expect(Child).not.toHaveBeenCalled()
})

it("CAP.panel.002 admits the body/backdrop with no Modal starter controls, padding or scroller", async () => {
  await render(wrap())
  await show()
  expect(row()).toHaveStyle({ height: "100%", flexDirection: "column" })
  expect(row("panel-backdrop")).toHaveStyle({ backgroundColor: "rgba(0, 0, 0, 0.3)" })
  expect(screen.getByText("Panel body")).toBeOnTheScreen()
  expect(screen.queryByText("Modal Title")).toBeNull()
  expect(screen.queryByTestId("panel-scroll")).toBeNull()
  expect(StyleSheet.flatten(row().props.style).padding).toBeUndefined()
})

it("CAP.panel.003 routes enabled blur through the reviewed adapter and keeps shadow/geometry", async () => {
  const effect = jest.fn((_props: TNativeBackdropEffectProps) => <View testID="real-renderer-required" />)
  await render(
    <NativeOverlayProvider backdropAdapter={{ Target: View, Effect: effect }}>
      <NativeBackdropHost>
        <Panel aria-label="Blur" isOpen overlayBlur raised panelGeometry="rounded" />
      </NativeBackdropHost>
    </NativeOverlayProvider>,
  )
  expect(row()).toHaveStyle({
    borderRadius: 5,
    boxShadow: [
      { offsetX: 0, offsetY: 2, blurRadius: 3, color: "rgba(0,0,0,0.12)" },
      { offsetX: 0, offsetY: 2, blurRadius: 2, color: "rgba(0,0,0,0.24)" },
    ],
  })
  expect(effect).toHaveBeenCalled()
  expect(effect.mock.calls.at(-1)?.[0]).toMatchObject({ radius: 10 })
})

it("CAP.panel.004 defaults to orthogonal, unraised, unblurred presentation", async () => {
  await render(wrap({ raised: false, overlayBlur: false, panelGeometry: "orthogonal" }))
  expect(row()).toHaveStyle({ borderRadius: 0 })
  expect(StyleSheet.flatten(row().props.style).boxShadow).toBeUndefined()
  expect(screen.queryByTestId("panel-backdrop-target")).toBeNull()
})

it("CAP.panel.005 keeps computed/custom/final and independent overlay/text owners", async () => {
  await render(
    <NativeOverlayProvider>
      <Panel
        aria-label="Styled"
        isOpen
        backgroundColor="red"
        width={350}
        customStyles={{ width: 360, backgroundColor: "blue", color: "turquoise", fontSize: 19 }}
        style={{ width: 370, backgroundColor: "gold" }}
        customOverlayStyles={{ backgroundColor: "plum" }}
      >
        Owned{" "}
        <Text testID="authored" style={{ color: "navy" }}>
          Authored
        </Text>
      </Panel>
    </NativeOverlayProvider>,
  )
  expect(row()).toHaveStyle({ width: 370, backgroundColor: "gold" })
  expect(row("panel-backdrop")).toHaveStyle({ backgroundColor: "plum" })
  expect(screen.getByText("Owned ")).toHaveStyle({ color: "turquoise", fontSize: 19 })
  expect(row("authored")).toHaveStyle({ color: "navy" })
  expect(StyleSheet.flatten(row().props.style).color).toBeUndefined()
})

it("CAP.panel.006 preserves explicit dimensions/background and physical right-side placement", async () => {
  await render(wrap({ width: 350, height: 500, backgroundColor: "gold", position: "right", horizontalGap: -8 }))
  expect(row()).toHaveStyle({ width: 350, height: 500, backgroundColor: "gold", right: -8 })
})

it("CAP.panel.007 retains round geometry", async () => {
  await render(wrap({ panelGeometry: "round" }))
  expect(row()).toHaveStyle({ borderRadius: 10000 })
})

it("CAP.panel.008/.010 repeatedly requests false while an owner holds true", async () => {
  const callback = jest.fn()
  await render(wrap({ onOpenChange: callback }))
  await show()
  await fireEvent.press(row("panel-backdrop"))
  await fireEvent.press(row("panel-backdrop"))
  expect(callback.mock.calls).toEqual([[false], [false]])
  expect(row("panel-window").props.visible).toBe(true)
})

it("CAP.panel.009 consumes every wrapper prop and honors test identity aliases", async () => {
  await render(
    wrap({
      testID: "native",
      "data-testid": "alias",
      width: 0,
      height: 0,
      horizontalGap: 0,
      position: "left",
      raised: false,
      overlayBlur: false,
    }),
  )
  const root = row("native")
  expect(root).toHaveStyle({ width: 0, height: 0, left: 0 })
  for (const key of [
    "width",
    "height",
    "horizontalGap",
    "position",
    "raised",
    "overlayBlur",
    "isOpen",
    "onOpenChange",
    "customStyles",
    "customOverlayStyles",
  ])
    expect(root.props[key]).toBeUndefined()
  expect(screen.queryByTestId("alias")).toBeNull()
})

it("CAP.panel.011/.012/.013 keeps pointer and keyboard guards independent, with current callbacks", async () => {
  const old = jest.fn(),
    next = jest.fn()
  const { rerender } = await render(wrap({ isDismissable: false, onOpenChange: old }))
  await show()
  const staleSystem = row("panel-window").props.onRequestClose
  await fireEvent.press(row("panel-backdrop"))
  await fireEvent(row("panel-window"), "requestClose")
  expect(old.mock.calls).toEqual([[false]])
  await rerender(wrap({ isKeyboardDismissDisabled: true, onOpenChange: next }))
  await fireEvent(row("panel-window"), "requestClose")
  expect(next).not.toHaveBeenCalled()
  await fireEvent.press(row("panel-backdrop"))
  expect(next.mock.calls).toEqual([[false]])
  await rerender(wrap({ isDismissable: false, onOpenChange: next }))
  await act(() => staleSystem())
  expect(next.mock.calls).toEqual([[false], [false]])
})

it.each([499, 500, 800, 0])("uses the actual native viewport breakpoint at %s", async (width) => {
  await render(wrap())
  await fireEvent(row("panel-floating-host"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width, height: 600 } } })
  expect(row()).toHaveStyle({ width: width < 500 ? width * 0.8 : 300 })
})

it("keeps explicit undefined style resets at the canonical CSS/default layer", async () => {
  await render(
    wrap({
      width: 350,
      height: 200,
      backgroundColor: "gold",
      horizontalGap: 20,
      style: { width: undefined, height: undefined, backgroundColor: undefined, left: undefined },
    }),
  )
  await fireEvent(row("panel-floating-host"), "layout", { nativeEvent: { layout: { width: 800, height: 600 } } })
  expect(row()).toHaveStyle({ width: 300, height: "100%", backgroundColor: "#ffffff", left: 0 })
})

it("retains controlled children through closure requests and retires old handlers on actual closure/unmount", async () => {
  const callback = jest.fn()
  const Child = () => {
    const [value] = useState(0)
    return <Text>Value {value}</Text>
  }
  const tree = (isOpen: boolean) => (
    <NativeOverlayProvider>
      <Panel aria-label="State" isOpen={isOpen} onOpenChange={callback}>
        <Child />
      </Panel>
    </NativeOverlayProvider>
  )
  const { rerender, unmount } = await render(tree(true))
  await show()
  const stale = row("panel-window").props.onRequestClose
  const dismissed = row("panel-window").props.onDismiss
  await act(() => stale())
  expect(screen.getByText("Value 0")).toBeOnTheScreen()
  await rerender(tree(false))
  await act(() => stale())
  expect(callback.mock.calls).toEqual([[false]])
  if (Platform.OS === "ios") await act(() => dismissed())
  await unmount()
  await act(() => stale())
  expect(callback).toHaveBeenCalledTimes(1)
})

it.each([
  { width: -1 },
  { horizontalGap: Infinity },
  { position: "top" },
  { backgroundColor: "var(--bad)" },
  { overlayBlur: "true" },
])("rejects unsupported native values %p", async (props) => {
  await expect(render(wrap(props as Partial<TNativePanelProps>))).rejects.toThrow()
})

it("requires real blur capability rather than silently accepting an unblurred fallback", async () => {
  await expect(render(wrap({ overlayBlur: true }))).rejects.toThrow("backdropAdapter")
})

it("uses measured signed translation and retires an interrupted exit callback", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const runs: {
    config: Animated.TimingAnimationConfig
    finish?: (result: { finished: boolean }) => void
    stop: jest.Mock
  }[] = []
  jest.spyOn(Animated, "timing").mockImplementation((_value, config) => {
    const run = { config, finish: undefined as ((result: { finished: boolean }) => void) | undefined, stop: jest.fn() }
    runs.push(run)
    return {
      start: (finish) => {
        run.finish = finish
      },
      stop: run.stop,
      reset: jest.fn(),
    }
  })
  const { rerender } = await render(wrap())
  await show()
  expect(runs).toHaveLength(0)
  await layout(275)
  expect(row()).toHaveStyle({ transform: [{ translateX: -275 }] })
  expect(runs.at(-1)?.config).toMatchObject({ toValue: 0, duration: 250, useNativeDriver: true })
  await rerender(wrap({ isOpen: false }))
  const exiting = runs.at(-1)!
  expect(exiting.config.toValue).toBe(1)
  expect(row().props.pointerEvents).toBe("none")
  await rerender(wrap({ isOpen: true, position: "right" }))
  expect(exiting.stop).toHaveBeenCalled()
  expect(row()).toHaveStyle({ transform: [{ translateX: 275 }] })
  await act(() => exiting.finish?.({ finished: true }))
  expect(row("panel-window").props.visible).toBe(true)
})

it("retains dark theme surface/shadow values without altering the palette", async () => {
  await render(
    <NativeOverlayProvider>
      <NativeThemeProvider mode="dark">
        <Panel aria-label="Dark" isOpen raised />
      </NativeThemeProvider>
    </NativeOverlayProvider>,
  )
  expect(row()).toHaveStyle({
    backgroundColor: "#171717",
    boxShadow: [
      { offsetX: 0, offsetY: 2, blurRadius: 3, color: "rgba(0,0,0,0.35)" },
      { offsetX: 0, offsetY: 2, blurRadius: 2, color: "rgba(0,0,0,0.28)" },
    ],
  })
})

it("SCENE.panel.001 keeps the maintained owner veto, physical side and held editor", async () => {
  const inputRef = createRef<TextInput>()
  await render(<PanelFixture inputRef={inputRef} />)
  await fireEvent.press(screen.getByRole("button", { name: "Open panel" }))
  await show()
  const editor = inputRef.current
  await fireEvent.press(screen.getByRole("button", { name: "Request close" }))
  expect(row("panel-window").props.visible).toBe(true)
  await fireEvent.press(screen.getByRole("button", { name: "Toggle physical side" }))
  expect(row()).toHaveStyle({ right: 0 })
  expect(inputRef.current).toBe(editor)
  expect(screen.getByLabelText("Held query").props.value).toBe("")
  await fireEvent.press(screen.getByRole("button", { name: "Toggle veto" }))
  await fireEvent.press(screen.getByRole("button", { name: "Request close" }))
  expect(screen.queryByTestId("panel")).toBeNull()
})

it("SCENE.panel.002 routes configured blur to the root source without supplying a fake renderer", async () => {
  const probe = jest.fn((_props: TNativeBackdropEffectProps) => null)
  await render(<PanelFixture adapter={{ Target: View, Effect: probe }} />)
  await fireEvent.press(screen.getByRole("button", { name: "Open panel" }))
  await show()
  expect(probe).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("button", { name: "Toggle configured blur" }))
  expect(probe.mock.calls.at(-1)?.[0].targetRef.current?.props.testID).toBe("panel-scene-root")
})

it("preserves canonical box sizing defaults, explicit overrides and the original Panel/editor", async () => {
  const panel = createRef<View>(),
    editor = createRef<TextInput>(),
    changed = jest.fn()
  const node = (boxSizing?: "border-box" | "content-box") => (
    <NativeOverlayProvider>
      <Panel
        ref={panel}
        isOpen
        aria-label="Sizing"
        customStyles={{ width: 80, height: 60, padding: 10, borderWidth: 4, boxSizing }}
        customOverlayStyles={{ width: 240, height: 180, padding: 10, borderWidth: 4, boxSizing }}
      >
        <TextInput ref={editor} testID="box-held" value="" onChangeText={changed} />
      </Panel>
    </NativeOverlayProvider>
  )
  const result = await render(node())
  const original = panel.current,
    held = editor.current
  expect(row()).toHaveStyle({ boxSizing: "content-box", width: 80, height: 60, padding: 10, borderWidth: 4 })
  expect(row("panel-overlay-composite")).toHaveStyle({ boxSizing: "content-box", width: 240, height: 180 })
  await result.rerender(node("border-box"))
  expect(row()).toHaveStyle({ boxSizing: "border-box" })
  expect(row("panel-overlay-composite")).toHaveStyle({ boxSizing: "border-box" })
  await result.rerender(node())
  expect(row()).toHaveStyle({ boxSizing: "content-box" })
  expect(row("panel-overlay-composite")).toHaveStyle({ boxSizing: "content-box" })
  expect(panel.current).toBe(original)
  expect(editor.current).toBe(held)
  expect(row("box-held").props.value).toBe("")
  expect(changed).not.toHaveBeenCalled()
})
