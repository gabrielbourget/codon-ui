import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Animated, processColor, StyleSheet, TextInput, type View } from "react-native"

import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { Text } from "../../Text/Text"
import { Panel } from "../Panel"
import type { TNativePanelProps } from "../types"

import { PanelFixture } from "./fixtures/PanelFixture"

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
const hidden = { includeHiddenElements: true }
const row = (id: string) => screen.getByTestId(id, hidden)
const style = () => StyleSheet.flatten(row("panel").props.style)
const advance = async (milliseconds: number) => act(() => jest.advanceTimersByTime(milliseconds))
const setup = async () => {
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    change = jest.fn()
  const node = (props: Partial<TNativePanelProps> = {}) => (
    <NativeOverlayProvider>
      <Panel
        ref={root}
        accessibilityLabel="Appearance panel"
        isOpen
        width={200}
        height={300}
        horizontalGap={0}
        backgroundColor="red"
        customStyles={{ color: "red", borderRadius: 0 }}
        {...props}
      >
        <Text testID="inherited">Inherited foreground</Text>
        <TextInput ref={editor} testID="held" value="held" onChangeText={change} />
      </Panel>
    </NativeOverlayProvider>
  )
  const view = await render(node())
  return { ...view, root, editor, change, node }
}
it("runs Panel-owned paint and numeric layout changes for350ms on the original root/editor", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const f = await setup(),
    root = f.root.current,
    editor = f.editor.current
  expect(root).not.toBeNull()
  expect(editor).not.toBeNull()
  await f.rerender(
    f.node({
      width: 400,
      height: 500,
      horizontalGap: 40,
      backgroundColor: "blue",
      customStyles: { color: "blue", borderRadius: 20 },
    }),
  )
  await advance(175)
  expect(style().width).toBeGreaterThan(200)
  expect(style().width).toBeLessThan(400)
  expect(style().height).toBeGreaterThan(300)
  expect(style().height).toBeLessThan(500)
  expect(style().left).toBeGreaterThan(0)
  expect(style().left).toBeLessThan(40)
  expect(style().borderRadius).toBeGreaterThan(0)
  expect(style().borderRadius).toBeLessThan(20)
  expect(processColor(style().backgroundColor)).not.toBe(processColor("red"))
  expect(processColor(style().backgroundColor)).not.toBe(processColor("blue"))
  await advance(200)
  expect(style()).toMatchObject({ width: 400, height: 500, left: 40, borderRadius: 20 })
  expect(processColor(style().backgroundColor)).toBe(processColor("blue"))
  expect(processColor(StyleSheet.flatten(row("inherited").props.style).color)).toBe(processColor("blue"))
  expect(timing.mock.calls.some(([, options]) => options.duration === 350 && options.useNativeDriver === false)).toBe(
    true,
  )
  expect(f.root.current).toBe(root)
  expect(f.editor.current).toBe(editor)
  expect(row("held").props.value).toBe("held")
  expect(f.change).not.toHaveBeenCalled()
})
it("does not restart an unchanged layout deadline when paint is retargeted", async () => {
  const f = await setup()
  await f.rerender(f.node({ width: 400, backgroundColor: "blue" }))
  await advance(175)
  const width = style().width
  const color = processColor(style().backgroundColor)
  await f.rerender(f.node({ width: 400, backgroundColor: "green" }))
  expect(style().width).toBe(width)
  expect(processColor(style().backgroundColor)).toBe(color)
  await advance(200)
  expect(style().width).toBe(400)
  expect(processColor(style().backgroundColor)).not.toBe(processColor("green"))
  await advance(175)
  expect(processColor(style().backgroundColor)).toBe(processColor("green"))
})
it("finishes current appearance when Reduce Motion becomes enabled", async () => {
  let changed: ((enabled: boolean) => void) | undefined
  const preferences: {
    addEventListener: (name: "reduceMotionChanged", listener: (enabled: boolean) => void) => { remove: () => void }
  } = AccessibilityInfo
  jest.spyOn(preferences, "addEventListener").mockImplementation((_name, listener) => {
    changed = listener
    return { remove: jest.fn() }
  })
  const f = await setup()
  await f.rerender(f.node({ width: 400, backgroundColor: "blue" }))
  await advance(175)
  await act(() => changed?.(true))
  expect(style().width).toBe(400)
  expect(processColor(style().backgroundColor)).toBe(processColor("blue"))
})
it("preserves percentage/auto values and does not reuse an old numeric width when returning", async () => {
  const f = await setup(),
    root = f.root.current
  await f.rerender(f.node({ width: 400 }))
  await advance(175)
  await f.rerender(f.node({ width: "50%" }))
  expect(style().width).toBe("50%")
  await f.rerender(f.node({ width: "auto" }))
  expect(style().width).toBe("auto")
  await f.rerender(f.node({ width: 100 }))
  expect(style().width).toBe(100)
  expect(f.root.current).toBe(root)
})
it("does not animate changed appearance or construct children while closed", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const Child = jest.fn(() => <Text>Closed child</Text>)
  const node = (width: number, backgroundColor: string) => (
    <NativeOverlayProvider>
      <Panel accessibilityLabel="Closed panel" isOpen={false} width={width} backgroundColor={backgroundColor}>
        <Child />
      </Panel>
    </NativeOverlayProvider>
  )
  const view = await render(node(200, "red"))
  await view.rerender(node(400, "blue"))
  expect(timing).not.toHaveBeenCalled()
  expect(Child).not.toHaveBeenCalled()
})
it("keeps the maintained scene's held editor through a complete appearance toggle", async () => {
  const input = createRef<TextInput>()
  await render(<PanelFixture inputRef={input} />)
  await fireEvent.press(screen.getByRole("button", { name: "Open panel" }))
  await fireEvent(row("panel-window"), "show")
  const original = input.current
  expect(original).not.toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Toggle panel appearance", ...hidden }))
  await advance(375)
  expect(style()).toMatchObject({ width: 360, left: 12, borderRadius: 20 })
  expect(processColor(style().backgroundColor)).toBe(processColor("lavender"))
  expect(input.current).toBe(original)
  expect(screen.getByLabelText("Held query", hidden).props.value).toBe("")
})
