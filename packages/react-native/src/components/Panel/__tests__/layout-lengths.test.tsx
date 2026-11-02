import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, StyleSheet, TextInput, type View } from "react-native"

import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { createPanelAppearanceMixer } from "../appearanceValues"
import { Panel } from "../Panel"
import type { TNativePanelProps } from "../types"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("react-native-safe-area-context", () => ({ SafeAreaProvider: jest.requireActual("react-native").View }))
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const row = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const advance = async (milliseconds: number) => act(() => jest.advanceTimersByTime(milliseconds))
const style = () => StyleSheet.flatten(row("panel").props.style)

it.each(["width", "height", "minWidth", "maxHeight", "padding", "marginStart", "inset", "flexBasis"])(
  "leaves mixed-unit %s sizing to native layout instead of resolving against a viewport",
  (field) => {
    const bounds = { width: 1280, height: 720 }
    expect(createPanelAppearanceMixer(field, 300, "50%", bounds, "navy")).toBeUndefined()
    expect(createPanelAppearanceMixer(field, "50%", 80, bounds, "navy")).toBeUndefined()
    expect(createPanelAppearanceMixer(field, "auto", 80, bounds, "navy")).toBeUndefined()
    expect(createPanelAppearanceMixer(field, "0%", "50%", bounds, "navy")!(0.5)).toBe("25%")
    expect(createPanelAppearanceMixer(field, 0, 80, bounds, "navy")!(0.5)).toBe(40)
  },
)

const setup = async () => {
  const panel = createRef<View>(),
    editor = createRef<TextInput>(),
    changed = jest.fn()
  const node = (props: Partial<TNativePanelProps> = {}) => (
    <NativeOverlayProvider>
      <Panel ref={panel} accessibilityLabel="Native lengths" isOpen {...props}>
        <TextInput ref={editor} testID="held" value="" onChangeText={changed} />
      </Panel>
    </NativeOverlayProvider>
  )
  const view = await render(node())
  await fireEvent(row("panel-floating-host"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 1280, height: 720 } },
  })
  await advance(375)
  return { ...view, node, panel, editor, changed }
}

it("retains original body and editor through native percentages, auto, zero and flow changes", async () => {
  const f = await setup(),
    originalPanel = f.panel.current,
    originalEditor = f.editor.current,
    plane = row("panel-overlay-body")
  for (const props of [
    { width: "50%", height: "100%", customStyles: { position: "relative" } },
    { width: "auto", height: "auto", customStyles: { position: "static" } },
    { width: 0, height: 0, customStyles: { position: "absolute" } },
  ] satisfies Partial<TNativePanelProps>[]) {
    await f.rerender(
      f.node({ ...props, customOverlayStyles: { width: 240, height: 180, padding: 10, borderWidth: 4 } }),
    )
    expect(style()).toMatchObject({ width: props.width, height: props.height, position: props.customStyles.position })
    expect(row("panel-overlay-body")).toBe(plane)
    expect(plane).toHaveStyle({ flexGrow: 1, flexShrink: 1 })
    expect(f.panel.current).toBe(originalPanel)
    expect(f.editor.current).toBe(originalEditor)
    expect(row("held").props.value).toBe("")
  }
  expect(f.changed).not.toHaveBeenCalled()
})

it("retains percentage values across parent resize and keeps an independent paint deadline", async () => {
  const f = await setup()
  await f.rerender(f.node({ width: "50%", height: "100%", customStyles: { opacity: 0.2 } }))
  expect(style().width).toBe("50%")
  await advance(175)
  const opacity = style().opacity
  expect(opacity).toBeGreaterThan(0.2)
  expect(opacity).toBeLessThan(1)
  await f.rerender(
    f.node({
      width: "50%",
      height: "100%",
      customStyles: { opacity: 0.2 },
      customOverlayStyles: { width: 240, height: 260 },
    }),
  )
  await fireEvent(row("panel-floating-host"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 800, height: 600 } },
  })
  expect(style()).toMatchObject({ width: "50%", height: "100%", opacity })
  await advance(200)
  expect(style().opacity).toBe(0.2)
  expect(f.changed).not.toHaveBeenCalled()
})

it("interpolates percentages in native units and retargets without replacing the original host", async () => {
  const f = await setup()
  await f.rerender(f.node({ width: "20%" }))
  const original = f.panel.current
  await f.rerender(f.node({ width: "60%" }))
  await advance(175)
  expect(typeof style().width).toBe("string")
  const middle = parseFloat(style().width as string)
  expect(middle).toBeGreaterThan(30)
  expect(middle).toBeLessThan(50)
  await f.rerender(f.node({ width: "20%" }))
  await advance(200)
  expect(style().width).toBe("20%")
  expect(f.panel.current).toBe(original)
})
