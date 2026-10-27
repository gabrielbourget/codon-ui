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
