import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Animated, TextInput, type View } from "react-native"

import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { getPanelLayoutLength, getPanelLayoutLengths, mixPanelLayoutLength } from "../layoutLengths"
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
const lengths = () =>
  row("panel-overlay-composite").props.panelLayoutLengths as {
    field: string
    points: number
    percent: number
  }[]
const length = (field: string) => lengths().find((value) => value.field === field)!

it("matches the canonical midpoint geometry while retaining a live percentage coefficient", () => {
  const defaults = getPanelLayoutLengths(
    { height: "100%", width: 300 },
    { width: 1280, height: 720 },
    {
      viewportHeight: true,
      viewportWidth: true,
    },
  )
  const authored = getPanelLayoutLengths({ height: "100%", width: "50%" }, { width: 1280, height: 720 })
  const height = mixPanelLayoutLength(defaults.height!, authored.height!)(0.5)
  expect(height.points + height.percent * 172).toBe(446)
  expect(height.points + height.percent * 252).toBe(486)
  const width = mixPanelLayoutLength(defaults.width!, authored.width!)(0.5)
  expect(width.points + width.percent * 232).toBe(208)
  const next = mixPanelLayoutLength(authored.width!, getPanelLayoutLength("width", 80)!)(0.5)
  expect(next.points + next.percent * 232).toBe(98)
  expect(getPanelLayoutLength("height", "auto")).toBeUndefined()
  expect(getPanelLayoutLength("width", Infinity)).toBeUndefined()
})

const setup = async () => {
  const panel = createRef<View>(),
    editor = createRef<TextInput>(),
    changed = jest.fn()
  const node = (props: Partial<TNativePanelProps> = {}) => (
    <NativeOverlayProvider>
      <Panel ref={panel} accessibilityLabel="Canonical lengths" isOpen {...props}>
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

it("transitions default100vh to authored100% on the original clock and original empty editor", async () => {
  const f = await setup(),
    originalPanel = f.panel.current,
    originalEditor = f.editor.current
  const timing = jest.spyOn(Animated, "timing")
  const overlay = { width: 240, height: 180, borderWidth: 4, transform: [{ translateX: 0 }] }
  await f.rerender(f.node({ height: "100%", customOverlayStyles: overlay }))
  expect(length("height")).toEqual({ field: "height", points: 720, percent: 0 })
  await advance(175)
  const middle = length("height")
  expect(middle.percent).toBeGreaterThan(0.3)
  expect(middle.percent).toBeLessThan(0.7)
  expect(middle.points).toBeCloseTo(720 * (1 - middle.percent), 8)
  await f.rerender(f.node({ height: "100%", customOverlayStyles: { ...overlay, height: 260 } }))
  expect(length("height")).toEqual(middle)
  expect(timing.mock.calls.filter(([, options]) => options.duration === 350)).toHaveLength(1)
  await advance(200)
  expect(lengths()).toEqual([])
  expect(row("panel-overlay-composite").props.panelViewportHeight).toBe(false)
  await f.rerender(f.node({ customOverlayStyles: overlay }))
  expect(length("height")).toEqual({ field: "height", points: 0, percent: 1 })
  await advance(375)
  expect(lengths()).toEqual([])
  expect(row("panel-overlay-composite").props.panelViewportHeight).toBe(true)
  expect(f.panel.current).toBe(originalPanel)
  expect(f.editor.current).toBe(originalEditor)
  expect(row("held").props.value).toBe("")
  expect(f.changed).not.toHaveBeenCalled()
})

it("retargets mixed width coefficients and shortens reversal without resetting independent paint", async () => {
  const f = await setup()
  await f.rerender(f.node({ width: "50%", customStyles: { opacity: 0.2 } }))
  expect(length("width")).toEqual({ field: "width", points: 300, percent: 0 })
  await advance(175)
  const middle = length("width")
  expect(middle.points).toBeCloseTo(300 * (1 - middle.percent / 0.5), 8)
  await f.rerender(f.node({ customStyles: { opacity: 0.2 } }))
  expect(length("width")).toEqual(middle)
  await advance(200)
  expect(lengths()).toEqual([])
  expect(row("panel-overlay-composite").props.panelViewportWidth).toBe(true)
  expect(f.changed).not.toHaveBeenCalled()
})

it("retains distinct inset axes and preserves an authored more-specific block axis", async () => {
  const f = await setup()
  await f.rerender(f.node({ customStyles: { inset: 0, insetBlock: 20 } }))
  await advance(375)
  await f.rerender(f.node({ customStyles: { inset: "50%", insetBlock: 20 } }))
  await advance(175)
  expect(length("insetInline").percent).toBeGreaterThan(0.15)
  expect(length("insetInline").percent).toBeLessThan(0.35)
  expect(lengths().some(({ field }) => field === "inset" || field === "insetBlock")).toBe(false)
  await advance(200)
  expect(lengths()).toEqual([])
})
