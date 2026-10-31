import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, I18nManager, StyleSheet, TextInput, type View, type ViewStyle } from "react-native"

import { geometryPacket, geometrySnapshot } from "../../../input/__tests__/motionGeometry.fixture"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { createPanelAppearanceMixer } from "../appearanceValues"
import { Panel } from "../Panel"
import { resolvePanelRadii, type TPanelBorderBox } from "../radii"

import { PanelFixture } from "./fixtures/PanelFixture"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("react-native-safe-area-context", () => ({ SafeAreaProvider: jest.requireActual("react-native").View }))
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockReturnValue(71)
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const box: TPanelBorderBox = { width: 200, height: 100, direction: "ltr", platform: "ios" }
const decoded = (style: ViewStyle, borderBox = box) => JSON.parse(resolvePanelRadii(style, borderBox).radii)
const row = (id = "panel") => screen.getByTestId(id, { includeHiddenElements: true })
const advance = async (milliseconds: number) => act(() => jest.advanceTimersByTime(milliseconds))

it("interpolates a native length and percentage radius without collapsing either border-box axis", () => {
  const mix = createPanelAppearanceMixer("borderRadius", 10, "50%", { width: 900, height: 800 }, "navy")
  expect(mix).toBeDefined()
  const style = { borderRadius: mix!(0.5) } as ViewStyle
  expect(decoded(style).topLeft).toEqual({ x: 55, y: 30 })
  expect(decoded(style, { ...box, width: 400, height: 160 }).topLeft).toEqual({ x: 105, y: 45 })
  expect(resolvePanelRadii(style).view.borderRadius).toBe(10)
  expect(resolvePanelRadii(style).radii).toBe("")
})

it("uses one CSS overlap factor for every corner, including smaller non-overlapping corners", () => {
  const radii = decoded(
    { borderTopLeftRadius: 80, borderTopRightRadius: 80, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
    { ...box, width: 100 },
  )
  expect(radii).toEqual({
    topLeft: { x: 50, y: 50 },
    topRight: { x: 50, y: 50 },
    bottomLeft: { x: 6.25, y: 6.25 },
    bottomRight: { x: 6.25, y: 6.25 },
  })
  expect(decoded({ borderRadius: "50%" }).topLeft).toEqual({ x: 100, y: 50 })
  expect(decoded({ borderRadius: 20 }, { ...box, width: 0 }).topLeft).toEqual({ x: 0, y: 0 })
})

it.each(["ios", "android"] as const)("retains %s logical-radius precedence and explicit zero", (platform) => {
  const style = { borderRadius: 5, borderTopLeftRadius: 10, borderTopStartRadius: 20, borderStartStartRadius: 30 }
  const radii = decoded(style, { ...box, platform })
  expect(radii.topLeft).toEqual(platform === "ios" ? { x: 10, y: 10 } : { x: 30, y: 30 })
  const zero = decoded({ ...style, borderTopLeftRadius: 0, borderStartStartRadius: 0 }, { ...box, platform })
  expect(zero.topLeft).toEqual({ x: 0, y: 0 })
  expect(resolvePanelRadii(style, { ...box, direction: undefined }).radii).toBe("")
  expect(
    decoded({ borderTopStartRadius: undefined, borderTopLeftRadius: 20 }, { ...box, direction: undefined }).topLeft,
  ).toEqual({ x: 20, y: 20 })
})

it("uses the actual RTL direction and the locked Android swap policy", () => {
  const style = {
    borderRadius: 5,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 15,
    borderTopEndRadius: 25,
    borderEndStartRadius: 35,
  }
  const android = decoded(style, { ...box, platform: "android", direction: "rtl" })
  expect(android.topLeft).toEqual({ x: 35, y: 35 })
  const physical = decoded(
    { borderTopLeftRadius: 10, borderTopRightRadius: 15 },
    { ...box, platform: "android", direction: "rtl" },
  )
  expect(physical.topLeft.x).toBe(I18nManager.doLeftAndRightSwapInRTL ? 15 : 10)
  const ios = decoded(style, { ...box, direction: "rtl" })
  expect(ios.topLeft).toEqual({ x: 10, y: 10 })
})

const setup = async (style: ViewStyle) => {
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    changed = jest.fn()
  const tree = (style: ViewStyle, open = true) => (
    <NativeOverlayProvider>
      <Panel ref={root} accessibilityLabel="Radius panel" isOpen={open} width={200} height={100} customStyles={style}>
        <TextInput ref={editor} testID="radius-editor" value="" onChangeText={changed} />
      </Panel>
    </NativeOverlayProvider>
  )
  const view = await render(tree(style))
  const readyWindow = async () => {
    await fireEvent(row("panel-window"), "show")
    for (const ready of [false, true]) {
      const scope = row("panel-floating-host").props
      await act(() =>
        scope.onNativeScopeStatus({
          nativeEvent: {
            ownerId: scope.ownerId,
            windowId: "radius-window",
            epoch: 1,
            ready,
            windowActive: true,
            policyRevision: scope.policyRevision,
          },
        }),
      )
    }
  }
  await readyWindow()
  let revision = 0
  const geometry = async (width: number, height: number, foreign = false) => {
    const host = row(),
      snapshot = geometrySnapshot("ios")
    await act(() =>
      host.props.onNativeMotionGeometry({
        nativeEvent: geometryPacket({
          ownerId: foreign ? "retired" : host.props.ownerId,
          bindingId: host.props.nativeMotionGeometryBinding,
          scopeOwnerId: row("panel-floating-host").props.ownerId,
          windowId: "radius-window",
          epoch: 1,
          geometryRevision: ++revision,
          snapshot: JSON.stringify({
            ...snapshot,
            layout: [0, 0, width, height],
            ancestors: [{ ...snapshot.ancestors[0], layoutDirection: "ltr" }],
          }),
        }),
      }),
    )
  }
  return { ...view, root, editor, changed, tree, geometry, readyWindow }
}

it("paints mixed radii on the original Panel and editor through resize, retarget and independent opacity completion", async () => {
  const f = await setup({ borderRadius: 10, opacity: 1 })
  const root = f.root.current,
    editor = f.editor.current
  expect(root).not.toBeNull()
  expect(editor).not.toBeNull()
  await f.geometry(200, 100)
  expect(row().props.nativeMotionDrawingOwner).toBe(true)
  await f.rerender(f.tree({ borderRadius: "50%", opacity: 0.2 }))
  await advance(175)
  const progress = (1 - StyleSheet.flatten(row().props.style).opacity!) / 0.8
  const radii = () => JSON.parse(row().props.nativeMotionProjectionRadii)
  expect(radii().topLeft.x).toBeCloseTo(10 * (1 - progress) + 100 * progress, 5)
  expect(radii().topLeft.y).toBeCloseTo(10 * (1 - progress) + 50 * progress, 5)
  expect(typeof StyleSheet.flatten(row().props.style).borderRadius).not.toBe("object")
  await f.geometry(400, 160, true)
  expect(radii().topLeft.x).toBeCloseTo(10 * (1 - progress) + 100 * progress, 5)
  await f.geometry(400, 160)
  expect(radii().topLeft.x).toBeCloseTo(10 * (1 - progress) + 200 * progress, 5)
  const before = radii().topLeft
  await f.rerender(f.tree({ borderRadius: "25%", opacity: 0.2 }))
  expect(radii().topLeft).toEqual(before)
  await advance(200)
  expect(StyleSheet.flatten(row().props.style).opacity).toBe(0.2)
  expect(radii().topLeft.y).not.toBe(40)
  await advance(175)
  expect(StyleSheet.flatten(row().props.style).borderRadius).toBe("25%")
  expect(radii().topLeft).toEqual({ x: 100, y: 40 })
  expect(f.root.current).toBe(root)
  expect(f.editor.current).toBe(editor)
  expect(row("radius-editor").props.value).toBe("")
  expect(f.changed).not.toHaveBeenCalled()
})

it("restores a removed corner to its shorthand and retires geometry after all radii reach zero", async () => {
  const f = await setup({ borderRadius: 10, borderTopLeftRadius: 30 })
  await f.geometry(200, 100)
  await f.rerender(f.tree({ borderRadius: 10 }))
  await advance(175)
  const radius = JSON.parse(row().props.nativeMotionProjectionRadii).topLeft.x
  expect(radius).toBeGreaterThan(10)
  expect(radius).toBeLessThan(30)
  await advance(200)
  expect(StyleSheet.flatten(row().props.style).borderTopLeftRadius).toBeUndefined()
  expect(JSON.parse(row().props.nativeMotionProjectionRadii).topLeft).toEqual({ x: 10, y: 10 })
  await f.rerender(f.tree({ borderRadius: 0 }))
  await advance(375)
  expect(row().props.nativeMotionProjectionRadii).toBe("")
  expect(row().props.onNativeMotionGeometry).toBeUndefined()
})

it("finishes a mixed corner immediately on Reduced Motion without losing its measured ellipse", async () => {
  let changed: ((enabled: boolean) => void) | undefined
  const preferences: {
    addEventListener: (name: "reduceMotionChanged", listener: (enabled: boolean) => void) => { remove: () => void }
  } = AccessibilityInfo
  jest.spyOn(preferences, "addEventListener").mockImplementation((_name, listener) => {
    changed = listener
    return { remove: jest.fn() }
  })
  const f = await setup({ borderRadius: 10 })
  const root = f.root.current,
    editor = f.editor.current
  await f.geometry(200, 100)
  await f.rerender(f.tree({ borderRadius: "40%" }))
  await advance(100)
  await act(() => changed?.(true))
  expect(StyleSheet.flatten(row().props.style).borderRadius).toBe("40%")
  expect(JSON.parse(row().props.nativeMotionProjectionRadii).topLeft).toEqual({ x: 80, y: 40 })
  expect(f.root.current).toBe(root)
  expect(f.editor.current).toBe(editor)
})

it("transitions a removed physical corner to the next native alias rather than jumping from the shorthand", async () => {
  const f = await setup({ borderRadius: 5, borderTopLeftRadius: 30, borderTopStartRadius: 10, opacity: 1 })
  await f.geometry(200, 100)
  await f.rerender(f.tree({ borderRadius: 5, borderTopStartRadius: 10, opacity: 0.2 }))
  await advance(175)
  const progress = (1 - StyleSheet.flatten(row().props.style).opacity!) / 0.8
  expect(JSON.parse(row().props.nativeMotionProjectionRadii).topLeft.x).toBeCloseTo(30 - 20 * progress, 5)
  await advance(200)
  expect(JSON.parse(row().props.nativeMotionProjectionRadii).topLeft.x).toBe(10)
  expect(StyleSheet.flatten(row().props.style).borderTopLeftRadius).toBeUndefined()
})

it("discards a previous host's border box before the Panel reopens", async () => {
  const f = await setup({ borderRadius: "40%" })
  await f.geometry(200, 100)
  expect(JSON.parse(row().props.nativeMotionProjectionRadii).topLeft).toEqual({ x: 80, y: 40 })
  const dismissed = row("panel-window").props.onDismiss
  await f.rerender(f.tree({ borderRadius: "40%" }, false))
  await advance(300)
  await act(() => dismissed())
  expect(f.root.current).toBeNull()
  await f.rerender(f.tree({ borderRadius: "40%" }))
  expect(f.root.current).not.toBeNull()
  expect(row().props.nativeMotionProjectionRadii).toBe("")
  await f.readyWindow()
  await f.geometry(400, 160)
  expect(JSON.parse(row().props.nativeMotionProjectionRadii).topLeft).toEqual({ x: 160, y: 64 })
})

it("cycles the maintained scene's mixed corners while retaining the original empty editor", async () => {
  const editor = createRef<TextInput>()
  await render(<PanelFixture inputRef={editor} />)
  await fireEvent.press(screen.getByRole("button", { name: "Open panel" }))
  await fireEvent(row("panel-window"), "show")
  const original = editor.current
  expect(original).not.toBeNull()
  const cycle = () =>
    fireEvent.press(screen.getByRole("button", { name: "Cycle panel corners", includeHiddenElements: true }))
  await cycle()
  await advance(375)
  expect(StyleSheet.flatten(row().props.style)).toMatchObject({
    borderTopLeftRadius: "35%",
    borderBottomRightRadius: 8,
  })
  await cycle()
  await advance(375)
  expect(StyleSheet.flatten(row().props.style)).toMatchObject({
    borderTopLeftRadius: 12,
    borderBottomRightRadius: "45%",
  })
  await cycle()
  await advance(375)
  expect(StyleSheet.flatten(row().props.style).borderTopLeftRadius).toBeUndefined()
  expect(StyleSheet.flatten(row().props.style).borderBottomRightRadius).toBeUndefined()
  expect(editor.current).toBe(original)
  expect(screen.getByLabelText("Held query", { includeHiddenElements: true }).props.value).toBe("")
})
