import { cleanup, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, StyleSheet, TextInput, type View, type ViewStyle } from "react-native"

import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { Panel } from "../Panel"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("react-native-safe-area-context", () => ({ SafeAreaProvider: jest.requireActual("react-native").View }))
beforeEach(() => jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true))
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
})
const row = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })

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
  const ancestor = (element: ReturnType<typeof row>) => {
    for (let node = element.parent; node; node = node.parent)
      if (node.props.testID === "panel-overlay-composite") return node
    return null
  }
  expect(ancestor(row("panel"))).toBe(group)
  expect(ancestor(backdrop)).toBe(group)
  expect(originalRoot).not.toBeNull()
  expect(originalEditor).not.toBeNull()
  expect(row("panel")).toHaveStyle({ filter: [{ contrast: 1.5 }] })
  expect(backdrop).toHaveStyle({ backgroundColor: "plum" })
  for (const field of ["filter", "mixBlendMode", "isolation", "zIndex"] as const) {
    expect(StyleSheet.flatten(backdrop.props.style)[field]).toBeUndefined()
    expect(StyleSheet.flatten(row("panel-floating-host").props.style)[field]).toBeUndefined()
  }
  await view.rerender(tree({ filter: "none", mixBlendMode: "normal", isolation: "auto", zIndex: 0 }))
  expect(group).toHaveStyle({ filter: [], mixBlendMode: "normal", isolation: "auto", zIndex: 0 })
  await view.rerender(tree())
  for (const field of ["filter", "mixBlendMode", "isolation", "zIndex"] as const)
    expect(StyleSheet.flatten(group.props.style)[field]).toBeUndefined()
  expect(root.current).toBe(originalRoot)
  expect(editor.current).toBe(originalEditor)
  expect(row("panel-backdrop")).toBe(backdrop)
  expect(row("composite-editor").props.value).toBe("held")
  expect(changed).not.toHaveBeenCalled()
})
