import { act, cleanup, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, StyleSheet, TextInput, type View, type ViewStyle } from "react-native"

import { geometryPacket, geometrySnapshot } from "../../../input/__tests__/motionGeometry.fixture"
import { observeNativeMotionGeometry } from "../../../input/motionGeometry"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { createPanelAppearanceMixer, type TPanelAppearanceBounds } from "../appearanceValues"
import { Panel } from "../Panel"

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
const row = (id = "panel") => screen.getByTestId(id, { includeHiddenElements: true })
const style = () => StyleSheet.flatten(row().props.style)
const advance = async (milliseconds: number) => act(() => jest.advanceTimersByTime(milliseconds))
const setup = async (customStyles: ViewStyle) => {
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    changed = jest.fn()
  const tree = (customStyles: ViewStyle) => (
    <NativeOverlayProvider>
      <Panel ref={root} accessibilityLabel="Gap panel" isOpen width={300} height={500} customStyles={customStyles}>
        <TextInput ref={editor} testID="gap-editor" value="held" onChangeText={changed} />
      </Panel>
    </NativeOverlayProvider>
  )
  const view = await render(tree(customStyles))
  for (const ready of [false, true]) {
    const scope = row("panel-floating-host").props
    await act(() =>
      scope.onNativeScopeStatus({
        nativeEvent: {
          ownerId: scope.ownerId,
          windowId: "gap-window",
          epoch: 1,
          ready,
          windowActive: true,
          policyRevision: scope.policyRevision,
        },
      }),
    )
  }
  let revision = 0
  const content = async (width: number, height: number, foreign = false) => {
    const host = row()
    const observed = jest.fn()
    const release = observeNativeMotionGeometry(root.current, observed)
    await act(() =>
      host.props.onNativeMotionGeometry({
        nativeEvent: geometryPacket({
          ownerId: foreign ? "retired-owner" : host.props.ownerId,
          bindingId: host.props.nativeMotionGeometryBinding,
          scopeOwnerId: row("panel-floating-host").props.ownerId,
          windowId: "gap-window",
          epoch: 1,
          geometryRevision: ++revision,
          snapshot: JSON.stringify({ ...geometrySnapshot(), contentBox: [10, 20, width, height] }),
        }),
      }),
    )
    release()
    expect(observed).toHaveBeenCalledTimes(foreign ? 0 : 1)
  }
  return { ...view, tree, content, root, editor, changed }
}

it("uses each content axis for mixed percentage gaps and reads live geometry without changing the deadline", () => {
  const bounds: TPanelAppearanceBounds & { content?: { width: number; height: number } } = {
    width: 900,
    height: 800,
    content: { width: 100, height: 200 },
  }
  const row = createPanelAppearanceMixer("rowGap", 10, "20%", bounds, "navy")!
  const column = createPanelAppearanceMixer("columnGap", "10%", 30, bounds, "navy")!
  expect(row).toBeDefined()
  expect(row(0.5)).toBe(25)
  expect(column(0.5)).toBe(20)
  bounds.content = { width: 300, height: 400 }
  expect(row(0.5)).toBe(45)
  expect(column(0.5)).toBe(30)
  delete bounds.content
  expect(row(0.5)).toBe(10)
  expect(column(0.5)).toBe("10%")
})

it("interpolates percentage endpoints and preserves zero content dimensions", () => {
  for (const field of ["gap", "rowGap", "columnGap"])
    expect(createPanelAppearanceMixer(field, "10%", "30%", { width: 900, height: 800 }, "navy")!(0.5)).toBe("20%")
  expect(
    createPanelAppearanceMixer(
      "rowGap",
      10,
      "50%",
      { width: 900, height: 800, content: { width: 0, height: 0 } },
      "navy",
    )!(0.5),
  ).toBe(5)
})

it("animates a mixed shorthand on the original host/editor and restores its authored shape", async () => {
  const f = await setup({ gap: "10%", padding: 10, borderWidth: 2 })
  const root = f.root.current,
    editor = f.editor.current
  expect(root).not.toBeNull()
  expect(editor).not.toBeNull()
  await f.content(100, 200)
  await f.rerender(f.tree({ gap: 30, padding: 10, borderWidth: 2 }))
  await advance(175)
  expect(style().rowGap).toBeGreaterThan(24)
  expect(style().rowGap).toBeLessThan(26)
  expect(style().columnGap).toBeGreaterThan(18)
  expect(style().columnGap).toBeLessThan(22)
  await f.content(300, 400)
  expect(style().rowGap).toBeCloseTo(35, 1)
  expect(style().columnGap).toBeCloseTo(30, 1)
  await advance(200)
  expect(style().gap).toBe(30)
  expect(style().rowGap).toBeUndefined()
  expect(style().columnGap).toBeUndefined()
  expect(row().props.onNativeMotionGeometry).toBeUndefined()
  expect(f.root.current).toBe(root)
  expect(f.editor.current).toBe(editor)
  expect(row("gap-editor").props.value).toBe("held")
  expect(f.changed).not.toHaveBeenCalled()
})

it("keeps a longhand override on its own track through shorthand changes, removal and owner rejection", async () => {
  const f = await setup({ gap: "10%", rowGap: 5 })
  await f.content(100, 200)
  await f.rerender(f.tree({ gap: 30, rowGap: 5 }))
  await advance(175)
  expect(style().rowGap).toBe(5)
  expect(style().columnGap).toBeGreaterThan(18)
  expect(style().columnGap).toBeLessThan(22)
  const columnGap = style().columnGap
  await f.content(500, 700, true)
  expect(style().columnGap).toBe(columnGap)
  await advance(200)
  await f.rerender(f.tree({ gap: 30 }))
  await advance(175)
  expect(style().rowGap).toBeGreaterThan(5)
  expect(style().rowGap).toBeLessThan(30)
  await advance(200)
  expect(style().rowGap).toBeUndefined()
  expect(style().columnGap).toBeUndefined()
  expect(style().gap).toBe(30)
})

it("retargets a gap longhand without restarting the other axis", async () => {
  const f = await setup({ gap: "10%", rowGap: 5 })
  await f.content(100, 200)
  await f.rerender(f.tree({ gap: 30, rowGap: 15 }))
  await advance(100)
  const columnGap = style().columnGap
  await f.rerender(f.tree({ gap: 30, rowGap: 20 }))
  expect(style().columnGap).toBeCloseTo(columnGap as number, 5)
  await advance(260)
  expect(style().columnGap ?? style().gap).toBe(30)
  expect(style().rowGap).toBeLessThan(20)
  await advance(100)
  expect(style()).toMatchObject({ gap: 30, rowGap: 20 })
  expect(style().columnGap).toBeUndefined()
})

it("finishes both mixed gap axes when Reduced Motion becomes enabled", async () => {
  let changed: ((enabled: boolean) => void) | undefined
  const preferences: {
    addEventListener: (name: "reduceMotionChanged", listener: (enabled: boolean) => void) => { remove: () => void }
  } = AccessibilityInfo
  jest.spyOn(preferences, "addEventListener").mockImplementation((_name, listener) => {
    changed = listener
    return { remove: jest.fn() }
  })
  const f = await setup({ gap: "10%" })
  await f.content(100, 200)
  await f.rerender(f.tree({ gap: 30 }))
  await advance(100)
  await act(() => changed?.(true))
  expect(style().gap).toBe(30)
  expect(style().rowGap).toBeUndefined()
  expect(style().columnGap).toBeUndefined()
  expect(row().props.onNativeMotionGeometry).toBeUndefined()
})
