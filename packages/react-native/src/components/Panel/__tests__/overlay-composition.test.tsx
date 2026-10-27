import { act, cleanup, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Animated, StyleSheet, TextInput, View, type ViewStyle } from "react-native"

import { NativeBackdropHost } from "../../../overlays/backdrop/NativeBackdropHost"
import type { TNativeBackdropEffectProps } from "../../../overlays/backdrop/types"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { Panel } from "../Panel"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.unmock("react-native/Libraries/Components/View/View")
jest.unmock("react-native/Libraries/Components/View/ViewNativeComponent")
jest.mock("react-native-safe-area-context", () => ({ SafeAreaProvider: jest.requireActual("react-native").View }))
beforeEach(() => jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true))
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
})
const row = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })

it("retains the original custom-adapter source and Effect under the stable underlay plane through paint updates", async () => {
  const target = createRef<View>(),
    editor = createRef<TextInput>(),
    changed = jest.fn(),
    effects: TNativeBackdropEffectProps[] = []
  const Effect = (props: TNativeBackdropEffectProps) => {
    effects.push(props)
    return <View testID="original-effect" />
  }
  const adapter = { Target: View, Effect }
  const tree = (opacity?: number) => (
    <NativeOverlayProvider backdropAdapter={adapter}>
      <NativeBackdropHost ref={target} testID="original-source">
        <Panel accessibilityLabel="Custom backdrop" isOpen overlayBlur customOverlayStyles={{ opacity }}>
          <TextInput ref={editor} testID="adapter-editor" value="held" onChangeText={changed} />
        </Panel>
      </NativeBackdropHost>
    </NativeOverlayProvider>
  )
  const view = await render(tree(0.4))
  const source = target.current,
    input = editor.current,
    original = row("original-effect"),
    underlay = row("panel-overlay-underlay"),
    backdrop = row("panel-backdrop")
  expect(source).not.toBeNull()
  expect(input).not.toBeNull()
  const ancestors = []
  for (let parent = original.parent; parent; parent = parent.parent) ancestors.push(parent)
  expect(ancestors).toContain(underlay)
  expect(underlay.props.pointerEvents).toBe("none")
  for (const opacity of [0, 0.8, undefined]) {
    await view.rerender(tree(opacity))
    expect(row("original-effect")).toBe(original)
    expect(row("panel-overlay-underlay")).toBe(underlay)
    expect(row("panel-backdrop")).toBe(backdrop)
    expect(target.current).toBe(source)
    expect(editor.current).toBe(input)
    expect(effects.at(-1)?.targetRef.current).toBe(source)
    expect(effects.at(-1)?.radius).toBe(10)
    expect(row("adapter-editor").props.value).toBe("held")
  }
  expect(changed).not.toHaveBeenCalled()
})

it.each([false, true])(
  "retains authored animated opacity including derived nodes (%s) on native paint instead of View alpha",
  async (derived) => {
    const opacity = new Animated.Value(0.4)
    await render(
      <NativeOverlayProvider>
        <Panel
          accessibilityLabel="Animated paint"
          isOpen
          customOverlayStyles={{ opacity: derived ? Animated.add(opacity, 0) : opacity }}
        />
      </NativeOverlayProvider>,
    )
    const group = row("panel-overlay-composite")
    expect(group.props.paintOpacity).toBe(0.4)
    await act(() => opacity.setValue(0))
    expect(group.props.paintOpacity).toBe(0)
    expect(StyleSheet.flatten(group.props.style).opacity).toBeUndefined()
    await act(() => opacity.setValue(0.8))
    expect(group.props.paintOpacity).toBe(0.8)
  },
)

it("routes overlay zero opacity through native paint while retaining the original control and separate body plane", async () => {
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    changed = jest.fn()
  const tree = (opacity?: number, zIndex = -1) => (
    <NativeOverlayProvider>
      <Panel
        ref={root}
        accessibilityLabel="Paint ownership"
        isOpen
        customStyles={{ zIndex }}
        customOverlayStyles={{ opacity }}
      >
        <TextInput ref={editor} testID="paint-editor" value="held" onChangeText={changed} />
      </Panel>
    </NativeOverlayProvider>
  )
  const view = await render(tree(0.4))
  const group = row("panel-overlay-composite"),
    original = root.current,
    input = editor.current,
    backdrop = row("panel-backdrop"),
    bodyPlane = row("panel-overlay-body")
  expect(original).not.toBeNull()
  expect(input).not.toBeNull()
  expect(group.props.paintOpacity).toBe(0.4)
  expect(StyleSheet.flatten(group.props.style).opacity).toBeUndefined()
  expect(bodyPlane.props.collapsable).toBe(false)
  expect(bodyPlane.props.pointerEvents).toBe("box-none")
  expect(row("panel").parent).toBe(bodyPlane)
  for (const opacity of [0, 0.8, undefined]) {
    await view.rerender(tree(opacity, -2147483648))
    expect(group.props.paintOpacity).toBe(opacity ?? 1)
    expect(StyleSheet.flatten(group.props.style).opacity).toBeUndefined()
    expect(row("panel-overlay-body")).toBe(bodyPlane)
    expect(row("panel-backdrop")).toBe(backdrop)
    expect(root.current).toBe(original)
    expect(editor.current).toBe(input)
    expect(row("paint-editor").props.value).toBe("held")
  }
  expect(changed).not.toHaveBeenCalled()
})

it("hides the complete original Panel subtree when the overlay display is none and restores it without resetting the editor", async () => {
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    changed = jest.fn()
  const tree = (display?: ViewStyle["display"]) => (
    <NativeOverlayProvider>
      <Panel ref={root} accessibilityLabel="Display ownership" isOpen customOverlayStyles={{ display }}>
        <TextInput ref={editor} testID="display-editor" value="" onChangeText={changed} />
      </Panel>
    </NativeOverlayProvider>
  )
  const view = await render(tree("flex"))
  const original = root.current,
    input = editor.current,
    group = row("panel-overlay-composite"),
    backdrop = row("panel-backdrop")
  expect(original).not.toBeNull()
  expect(input).not.toBeNull()
  await view.rerender(tree("none"))
  expect(group).toHaveStyle({ display: "none" })
  expect(screen.queryByTestId("display-editor")).toBeNull()
  expect(root.current).toBe(original)
  expect(editor.current).toBe(input)
  await view.rerender(tree())
  expect(StyleSheet.flatten(group.props.style).display).toBeUndefined()
  expect(screen.getByTestId("display-editor").props.value).toBe("")
  expect(row("panel-backdrop")).toBe(backdrop)
  expect(root.current).toBe(original)
  expect(editor.current).toBe(input)
  expect(changed).not.toHaveBeenCalled()
})

it("owns overlay filter, blend, isolation and stacking around the original Panel instead of only its backdrop", async () => {
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    changed = jest.fn()
  const tree = (overlay?: ViewStyle) => (
    <NativeOverlayProvider>
      <Panel
        ref={root}
        accessibilityLabel="Composited"
        isOpen
        customStyles={{ filter: "contrast(150%)" }}
        customOverlayStyles={overlay}
      >
        <TextInput ref={editor} testID="composite-editor" value="held" onChangeText={changed} />
      </Panel>
    </NativeOverlayProvider>
  )
  const view = await render(
    tree({
      filter: "brightness(50%) opacity(25%)",
      mixBlendMode: "multiply",
      isolation: "isolate",
      zIndex: 50,
      backgroundColor: "plum",
    }),
  )
  const group = row("panel-overlay-composite"),
    originalRoot = root.current,
    originalEditor = editor.current,
    backdrop = row("panel-backdrop")
  expect(group).toHaveStyle({
    filter: [{ brightness: 0.5 }, { opacity: 0.25 }],
    mixBlendMode: "multiply",
    isolation: "isolate",
    zIndex: 50,
  })
  expect(row("panel-overlay-viewport")).toHaveStyle({ zIndex: 50 })
  const ancestor = (element: ReturnType<typeof row>) => {
    for (let node = element.parent; node; node = node.parent)
      if (node.props.testID === "panel-overlay-composite") return node
    return null
  }
  expect(ancestor(row("panel"))).toBe(group)
  expect(ancestor(backdrop)).toBe(group)
  expect(originalRoot).not.toBeNull()
  expect(originalEditor).not.toBeNull()
  expect(row("panel").props.nativeForegroundComposition).toBe(true)
  expect(row("panel")).toHaveStyle({ filter: [{ contrast: 1.5 }] })
  expect(backdrop).toHaveStyle({ backgroundColor: "plum" })
  for (const field of ["filter", "mixBlendMode", "isolation", "zIndex"] as const) {
    expect(StyleSheet.flatten(backdrop.props.style)[field]).toBeUndefined()
    expect(StyleSheet.flatten(row("panel-floating-host").props.style)[field]).toBeUndefined()
  }
  await view.rerender(tree({ filter: "none", mixBlendMode: "normal", isolation: "auto", zIndex: 0 }))
  expect(group).toHaveStyle({ filter: [], mixBlendMode: "normal", isolation: "auto", zIndex: 0 })
  await view.rerender(tree())
  expect(StyleSheet.flatten(row("panel-overlay-viewport").props.style).zIndex).toBeUndefined()
  for (const field of ["filter", "mixBlendMode", "isolation", "zIndex"] as const)
    expect(StyleSheet.flatten(group.props.style)[field]).toBeUndefined()
  expect(root.current).toBe(originalRoot)
  expect(editor.current).toBe(originalEditor)
  expect(row("panel-backdrop")).toBe(backdrop)
  expect(row("composite-editor").props.value).toBe("held")
  expect(changed).not.toHaveBeenCalled()
})
