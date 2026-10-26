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
        Raw styled phrase
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
it("transitions mixed percentage dimensions in the actual modal viewport and keeps auto discrete", async () => {
  const f = await setup(),
    root = f.root.current
  await fireEvent(row("panel-floating-host"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 800, height: 600 } },
  })
  await f.rerender(f.node({ width: "50%" }))
  expect(style().width).toBe(200)
  await advance(175)
  expect(style().width).toBeGreaterThan(200)
  expect(style().width).toBeLessThan(400)
  await advance(200)
  expect(style().width).toBe("50%")
  await f.rerender(f.node({ width: "auto" }))
  expect(style().width).toBe("auto")
  await f.rerender(f.node({ width: 100 }))
  expect(style().width).toBe(100)
  expect(f.root.current).toBe(root)
})

it("transitions authored spacing, borders, opacity and scalar typography on the existing hosts", async () => {
  const f = await setup(),
    root = f.root.current,
    editor = f.editor.current
  const before = {
    padding: 4,
    paddingLeft: 8,
    marginTop: 0,
    gap: 2,
    opacity: 1,
    borderWidth: 1,
    borderColor: "red",
    fontSize: 12,
    fontWeight: "400",
    letterSpacing: 0,
    lineHeight: 18,
    textDecorationColor: "red",
    textShadowColor: "red",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
  } as const
  await f.rerender(f.node({ customStyles: before }))
  await advance(375)
  await f.rerender(
    f.node({
      customStyles: {
        padding: 24,
        paddingLeft: 48,
        marginTop: 20,
        gap: 12,
        opacity: 0.2,
        borderWidth: 5,
        borderColor: "blue",
        fontSize: 32,
        fontWeight: "800",
        letterSpacing: 4,
        lineHeight: 38,
        textDecorationColor: "blue",
        textShadowColor: "blue",
        textShadowOffset: { width: 8, height: 12 },
        textShadowRadius: 6,
      },
    }),
  )
  await advance(175)
  const current = style()
  const text = StyleSheet.flatten(screen.getByText("Raw styled phrase", hidden).props.style)
  expect(current.padding).toBeGreaterThan(4)
  expect(current.padding).toBeLessThan(24)
  expect(current.paddingLeft).toBeGreaterThan(8)
  expect(current.paddingLeft).toBeLessThan(48)
  expect(current.marginTop).toBeGreaterThan(0)
  expect(current.marginTop).toBeLessThan(20)
  expect(current.gap).toBeGreaterThan(2)
  expect(current.gap).toBeLessThan(12)
  expect(current.opacity).toBeGreaterThan(0.2)
  expect(current.opacity).toBeLessThan(1)
  expect(current.borderWidth).toBeGreaterThan(1)
  expect(current.borderWidth).toBeLessThan(5)
  expect(processColor(current.borderColor)).not.toBe(processColor("red"))
  expect(processColor(current.borderColor)).not.toBe(processColor("blue"))
  expect(text.fontSize).toBeGreaterThan(12)
  expect(text.fontSize).toBeLessThan(32)
  expect(text.fontWeight).toBe("800")
  expect(text.letterSpacing).toBeGreaterThan(0)
  expect(text.letterSpacing).toBeLessThan(4)
  expect(text.lineHeight).toBeGreaterThan(18)
  expect(text.lineHeight).toBeLessThan(38)
  expect(text.textShadowOffset.width).toBeGreaterThan(0)
  expect(text.textShadowOffset.width).toBeLessThan(8)
  expect(text.textShadowOffset.height).toBeGreaterThan(0)
  expect(text.textShadowOffset.height).toBeLessThan(12)
  expect(text.textShadowRadius).toBeGreaterThan(0)
  expect(text.textShadowRadius).toBeLessThan(6)
  expect(processColor(text.textShadowColor)).not.toBe(processColor("red"))
  expect(processColor(text.textShadowColor)).not.toBe(processColor("blue"))
  expect(processColor(text.textDecorationColor)).not.toBe(processColor("red"))
  expect(processColor(text.textDecorationColor)).not.toBe(processColor("blue"))
  await advance(200)
  expect(style()).toMatchObject({
    padding: 24,
    paddingLeft: 48,
    marginTop: 20,
    gap: 12,
    opacity: 0.2,
    borderWidth: 5,
    borderColor: "blue",
  })
  expect(StyleSheet.flatten(screen.getByText("Raw styled phrase", hidden).props.style)).toMatchObject({
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 4,
    lineHeight: 38,
    textShadowOffset: { width: 8, height: 12 },
    textShadowRadius: 6,
  })
  expect(f.root.current).toBe(root)
  expect(f.editor.current).toBe(editor)
  expect(f.change).not.toHaveBeenCalled()
})

it("adds and removes the complete raised shadow list without jumping to the destination", async () => {
  const f = await setup()
  await f.rerender(f.node({ raised: true }))
  expect(style().boxShadow).toHaveLength(2)
  expect(style().boxShadow[0].blurRadius).toBe(0)
  await advance(175)
  const shadow = style().boxShadow
  expect(shadow[0].offsetY).toBeGreaterThan(0)
  expect(shadow[0].offsetY).toBeLessThan(2)
  expect(shadow[0].blurRadius).toBeGreaterThan(0)
  expect(shadow[0].blurRadius).toBeLessThan(3)
  expect(shadow[1].blurRadius).toBeGreaterThan(0)
  expect(shadow[1].blurRadius).toBeLessThan(2)
  await advance(200)
  await f.rerender(f.node({ raised: false }))
  await advance(175)
  expect(style().boxShadow).toHaveLength(2)
  expect(style().boxShadow[0].blurRadius).toBeGreaterThan(0)
  expect(style().boxShadow[0].blurRadius).toBeLessThan(3)
  await advance(200)
  expect(style().boxShadow).toBeUndefined()
})

it("retargets an interrupted property without restarting unrelated nested-shadow and spacing deadlines", async () => {
  const f = await setup()
  await f.rerender(f.node({ customStyles: { padding: 40, boxShadow: "0px 8px 12px 4px rgba(0, 0, 255, 0.6)" } }))
  await advance(175)
  const padding = style().padding
  const shadow = style().boxShadow
  await f.rerender(f.node({ customStyles: { padding: 80, boxShadow: "0px 8px 12px 4px rgba(0, 0, 255, 0.6)" } }))
  expect(style().padding).toBeCloseTo(padding, 0)
  expect(style().boxShadow[0].blurRadius).toBeCloseTo(shadow[0].blurRadius, 0)
  await advance(200)
  expect(style().padding).toBeGreaterThan(padding)
  expect(style().padding).toBeLessThan(80)
  expect(style().boxShadow).toBe("0px 8px 12px 4px rgba(0, 0, 255, 0.6)")
  await advance(175)
  expect(style().padding).toBe(80)
})

it("transitions removed overrides to their current shorthand defaults then restores the original style shape", async () => {
  const f = await setup()
  await f.rerender(f.node({ customStyles: { padding: 10, paddingLeft: 50, opacity: 0.2 } }))
  await advance(375)
  await f.rerender(f.node({ customStyles: { padding: 10 } }))
  await advance(175)
  expect(style().paddingLeft).toBeGreaterThan(10)
  expect(style().paddingLeft).toBeLessThan(50)
  expect(style().opacity).toBeGreaterThan(0.2)
  expect(style().opacity).toBeLessThan(1)
  await advance(200)
  expect(style()).toMatchObject({ padding: 10 })
  expect(style().paddingLeft).toBeUndefined()
  expect(style().opacity).toBeUndefined()
})

it("shortens a rapid reversal while preserving an independent transition's original deadline", async () => {
  const f = await setup()
  await f.rerender(f.node({ customStyles: { padding: 0, opacity: 1 } }))
  await advance(375)
  await f.rerender(f.node({ customStyles: { padding: 40, opacity: 0.2 } }))
  await advance(175)
  const padding = style().padding
  await f.rerender(f.node({ customStyles: { padding: 0, opacity: 0.2 } }))
  expect(style().padding).toBeCloseTo(padding, 0)
  await advance(100)
  expect(style().padding).toBeGreaterThan(0)
  expect(style().padding).toBeLessThan(padding)
  expect(style().opacity).toBeGreaterThan(0.2)
  await advance(100)
  expect(style()).toMatchObject({ padding: 0, opacity: 0.2 })
})

it("retargets a removed longhand when its shorthand changes during the running transition", async () => {
  const f = await setup()
  await f.rerender(f.node({ customStyles: { padding: 10, paddingLeft: 50 } }))
  await advance(375)
  await f.rerender(f.node({ customStyles: { padding: 10 } }))
  await advance(175)
  const left = style().paddingLeft
  await f.rerender(f.node({ customStyles: { padding: 80 } }))
  expect(style().paddingLeft).toBeCloseTo(left, 0)
  await advance(200)
  expect(style().paddingLeft).toBeGreaterThan(left)
  expect(style().paddingLeft).toBeLessThan(80)
  await advance(175)
  expect(style()).toMatchObject({ padding: 80 })
  expect(style().paddingLeft).toBeUndefined()
})

it("uses live viewport measurements during a mixed-unit transition without extending its deadline", async () => {
  const f = await setup()
  const viewport = (width: number) =>
    fireEvent(row("panel-floating-host"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width, height: 600 } },
    })
  await viewport(800)
  await f.rerender(f.node({ width: "50%" }))
  await advance(175)
  const previous = style().width
  await viewport(1200)
  expect(style().width).toBeGreaterThan(previous)
  expect(style().width).toBeLessThan(600)
  await advance(200)
  expect(style().width).toBe("50%")
})

it("resolves omitted border, outline and shadow colors from the same Panel foreground", async () => {
  const f = await setup()
  await f.rerender(
    f.node({
      customStyles: {
        color: "red",
        borderWidth: 2,
        outlineWidth: 1,
        boxShadow: "0px 4px 8px",
        textShadowOffset: { width: 2, height: 3 },
        textShadowRadius: 4,
      },
    }),
  )
  await advance(375)
  expect(style()).toMatchObject({ borderColor: "red", outlineColor: "red" })
  expect(style().boxShadow[0]).toMatchObject({ offsetX: 0, offsetY: 4, blurRadius: 8, color: "red" })
  expect(StyleSheet.flatten(screen.getByText("Raw styled phrase", hidden).props.style).textShadowColor).toBe("red")
  await f.rerender(
    f.node({
      customStyles: {
        color: "blue",
        borderWidth: 2,
        outlineWidth: 1,
        boxShadow: "0px 4px 8px",
        textShadowOffset: { width: 2, height: 3 },
        textShadowRadius: 4,
      },
    }),
  )
  await advance(175)
  const color = processColor(style().borderColor)
  expect(color).not.toBe(processColor("red"))
  expect(color).not.toBe(processColor("blue"))
  expect(processColor(style().outlineColor)).toBe(color)
  expect(processColor(style().boxShadow[0].color)).toBe(color)
  await advance(200)
  expect(style().boxShadow[0].color).toBe("blue")
})

it("keeps the pinned renderer's supported font weights while metric transitions run", async () => {
  const f = await setup()
  await f.rerender(f.node({ customStyles: { fontWeight: "400", fontSize: 12 } }))
  await advance(375)
  await f.rerender(f.node({ customStyles: { fontWeight: "800", fontSize: 32 } }))
  await advance(175)
  const text = StyleSheet.flatten(screen.getByText("Raw styled phrase", hidden).props.style)
  expect(text.fontWeight).toBe("800")
  expect(text.fontSize).toBeGreaterThan(12)
  expect(text.fontSize).toBeLessThan(32)
})

it("retires the appearance clock and its listeners when the original Panel unmounts", async () => {
  const stop = jest.spyOn(Animated.Value.prototype, "stopAnimation")
  const remove = jest.spyOn(Animated.Value.prototype, "removeListener")
  const f = await setup()
  await f.rerender(f.node({ customStyles: { padding: 40 }, width: 400 }))
  await advance(100)
  await f.unmount()
  expect(stop).toHaveBeenCalled()
  expect(remove).toHaveBeenCalled()
  await advance(500)
  expect(f.root.current).toBeNull()
  expect(f.editor.current).toBeNull()
  expect(f.change).not.toHaveBeenCalled()
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
