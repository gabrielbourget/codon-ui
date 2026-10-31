import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import {
  AccessibilityInfo,
  PlatformColor,
  processColor,
  StyleSheet,
  TextInput,
  type TextStyle,
  type View,
} from "react-native"

import { Commands, type NativeMotionColors } from "../../../input/specs/CUIFocusViewNativeComponent"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { mixNativeSRGBColors } from "../../colors"
import { Text } from "../../Text/Text"
import { createPanelNativeColorMixer } from "../nativeColors"
import { Panel } from "../Panel"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("react-native-safe-area-context", () => ({ SafeAreaProvider: jest.requireActual("react-native").View }))
jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: {
    sampleMotionColors: jest.fn(),
    queryMotionGeometry: jest.fn(),
    requestKeyboardFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    requestContainerFocus: jest.fn(),
    inspectAccessibility: jest.fn(),
  },
}))
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockReturnValue(71)
  jest.clearAllMocks()
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const first = PlatformColor("labelColor"),
  second = PlatformColor("secondaryLabelColor"),
  third = PlatformColor("tertiaryLabelColor")
const row = (id = "panel") => screen.getByTestId(id, { includeHiddenElements: true })
const style = () => StyleSheet.flatten(row().props.style)
const advance = async (milliseconds: number) => act(() => jest.advanceTimersByTime(milliseconds))
const commands = () => jest.mocked(Commands.sampleMotionColors).mock.calls
const samples = () => commands().filter(([, , , request]) => Array.isArray(JSON.parse(request).colors))
const setup = async (style: TextStyle) => {
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    changed = jest.fn()
  const tree = (style: TextStyle) => (
    <NativeOverlayProvider>
      <Panel ref={root} accessibilityLabel="Native colors" isOpen width={200} height={100} customStyles={style}>
        <Text testID="color-inherited">Native foreground</Text>
        <TextInput ref={editor} testID="color-editor" value="" onChangeText={changed} />
      </Panel>
    </NativeOverlayProvider>
  )
  const view = await render(tree(style))
  await fireEvent(row("panel-window"), "show")
  for (const ready of [false, true]) {
    const scope = row("panel-floating-host").props
    await act(() =>
      scope.onNativeScopeStatus({
        nativeEvent: {
          ownerId: scope.ownerId,
          windowId: "panel-color-window",
          epoch: 1,
          ready,
          windowActive: true,
          policyRevision: scope.policyRevision,
        },
      }),
    )
  }
  const report = async (extra: Partial<NativeMotionColors> = {}) =>
    act(() =>
      row().props.onNativeMotionColors({
        nativeEvent: {
          ownerId: row().props.ownerId,
          target: 71,
          kind: "environment",
          requestId: "",
          windowId: "panel-color-window",
          scopeOwnerId: row("panel-floating-host").props.ownerId,
          epoch: 1,
          environmentRevision: 1,
          attached: true,
          colors: "[]",
          error: "",
          observedAt: 100,
          ...extra,
        },
      }),
    )
  await report()
  const reply = async (
    call: ReturnType<typeof samples>[number],
    colors: readonly number[][],
    extra: Partial<NativeMotionColors> = {},
  ) => report({ kind: "sample", requestId: call[2], colors: JSON.stringify(colors), ...extra })
  return { ...view, tree, root, editor, changed, report, reply }
}

it("interpolates actual native background and inherited foreground samples on the original hosts and deadline", async () => {
  const f = await setup({ backgroundColor: first, color: first, opacity: 1 })
  const root = f.root.current,
    editor = f.editor.current
  expect(root).not.toBeNull()
  expect(editor).not.toBeNull()
  await f.rerender(f.tree({ backgroundColor: second, color: second, opacity: 0.2 }))
  expect(samples()).toHaveLength(2)
  for (const call of samples()) expect(JSON.parse(call[3]).colors).toEqual([processColor(first), processColor(second)])
  await advance(100)
  expect(style().backgroundColor).toBe(first)
  for (const call of samples())
    await f.reply(call, [
      [1, 0, 0, 1],
      [0, 0, 1, 1],
    ])
  const progress = (1 - style().opacity!) / 0.8
  const expected = processColor(mixNativeSRGBColors("red", "blue", 1 - progress))
  expect(processColor(style().backgroundColor)).toBe(expected)
  expect(processColor(StyleSheet.flatten(row("color-inherited").props.style).color)).toBe(expected)
  await advance(275)
  expect(style().backgroundColor).toBe(second)
  expect(StyleSheet.flatten(row("color-inherited").props.style).color).toBe(second)
  expect(style().opacity).toBe(0.2)
  expect(f.root.current).toBe(root)
  expect(f.editor.current).toBe(editor)
  expect(row("color-editor").props.value).toBe("")
  expect(f.changed).not.toHaveBeenCalled()
})

it("resolves changed shadow/filter colors while retaining unchanged opaque colors and authored final lists", async () => {
  const before: TextStyle = {
    boxShadow: [
      { offsetX: 0, offsetY: 0, color: first },
      { offsetX: 1, offsetY: 1, color: third },
    ],
    filter: [{ dropShadow: { offsetX: 0, offsetY: 0, color: first } }],
  }
  const after: TextStyle = {
    boxShadow: [
      { offsetX: 8, offsetY: 4, color: second },
      { offsetX: 2, offsetY: 2, color: third },
    ],
    filter: [{ dropShadow: { offsetX: 8, offsetY: 4, color: second } }],
  }
  const f = await setup(before)
  await f.rerender(f.tree(after))
  expect(samples()).toHaveLength(2)
  for (const call of samples()) {
    expect(JSON.parse(call[3]).colors).toEqual([processColor(first), processColor(second)])
    await f.reply(call, [
      [1, 0, 0, 1],
      [0, 0, 1, 1],
    ])
  }
  await advance(175)
  const shadows = style().boxShadow as { offsetX: number; color: unknown }[]
  expect(shadows[0].offsetX).toBeGreaterThan(0)
  expect(shadows[0].offsetX).toBeLessThan(8)
  expect(shadows[1].color).toBe(third)
  const filters = style().filter as { dropShadow: { color: unknown } }[]
  expect(filters[0].dropShadow.color).toBe(shadows[0].color)
  await advance(200)
  expect(style().boxShadow).toBe(after.boxShadow)
  expect((style().filter as { dropShadow: { color: unknown } }[])[0].dropShadow.color).toBe(second)
})

it("retires superseded samples and keeps a color lease through a simultaneous geometry change", async () => {
  const f = await setup({ backgroundColor: first, opacity: 1 })
  const root = f.root.current,
    editor = f.editor.current
  await f.rerender(f.tree({ backgroundColor: second, opacity: 0.2 }))
  const old = samples()[0]
  await advance(100)
  await f.rerender(f.tree({ backgroundColor: third, opacity: 0.2, borderRadius: 20 }))
  expect(samples()).toHaveLength(2)
  await f.reply(old, [
    [1, 0, 0, 1],
    [0, 0, 1, 1],
  ])
  expect(style().backgroundColor).toBe(first)
  await f.reply(samples()[1], [
    [1, 0, 0, 1],
    [0, 1, 0, 1],
  ])
  await advance(275)
  expect(style().opacity).toBe(0.2)
  expect(style().backgroundColor).not.toBe(third)
  await advance(100)
  expect(style().backgroundColor).toBe(third)
  expect(style().borderRadius).toBe(20)
  expect(f.root.current).toBe(root)
  expect(f.editor.current).toBe(editor)
  expect(f.changed).not.toHaveBeenCalled()
})

it("retires old-environment color work without replaying it or extending an unrelated opacity track", async () => {
  const f = await setup({ backgroundColor: first, opacity: 1 })
  await f.rerender(f.tree({ backgroundColor: second, opacity: 0.2 }))
  const old = samples()[0]
  await advance(100)
  await f.report({ environmentRevision: 2 })
  expect(style().backgroundColor).toBe(second)
  await f.reply(old, [
    [1, 0, 0, 1],
    [0, 0, 1, 1],
  ])
  expect(style().backgroundColor).toBe(second)
  await advance(275)
  expect(style().opacity).toBe(0.2)
  expect(samples()).toHaveLength(1)
})

it("keeps identical opaque shadow colors native while their geometry interpolates without a query", async () => {
  const f = await setup({ boxShadow: [{ offsetX: 0, offsetY: 0, color: first }] })
  await f.rerender(f.tree({ boxShadow: [{ offsetX: 8, offsetY: 4, color: first }] }))
  await advance(175)
  expect((style().boxShadow as { color: unknown }[])[0].color).toBe(first)
  expect(commands()).toHaveLength(0)
})

it("applies the authored native descriptor before a window identity is acknowledged without querying an unknown scope", async () => {
  const root = createRef<View>(),
    editor = createRef<TextInput>()
  const node = (backgroundColor: TextStyle["backgroundColor"]) => (
    <NativeOverlayProvider>
      <Panel ref={root} accessibilityLabel="Pending window colors" isOpen backgroundColor={backgroundColor}>
        <TextInput ref={editor} testID="pending-color-editor" value="" />
      </Panel>
    </NativeOverlayProvider>
  )
  const view = await render(node(first))
  const original = root.current,
    input = editor.current
  await view.rerender(node(second))
  await advance(375)
  expect(style().backgroundColor).toBe(second)
  expect(commands()).toHaveLength(0)
  expect(root.current).toBe(original)
  expect(editor.current).toBe(input)
})

it("retains the first native query failure and does not repeat it at completion", async () => {
  const f = await setup({})
  const failed = jest.fn(),
    changed = jest.fn()
  const job = createPanelNativeColorMixer(
    "backgroundColor",
    first,
    second,
    { width: 200, height: 100 },
    "black",
    f.root,
    changed,
    failed,
  )!
  await f.reply(samples()[0], [], { error: "unsupported current native color" })
  expect(failed).toHaveBeenCalledTimes(1)
  expect(failed.mock.calls[0][0].message).toMatch(/unsupported current native color/)
  job.release(true)
  expect(failed).toHaveBeenCalledTimes(1)
  expect(changed).not.toHaveBeenCalled()
})

it("cancels pending native color work when Reduced Motion finishes the authored target", async () => {
  let changed: ((enabled: boolean) => void) | undefined
  const preferences: {
    addEventListener: (name: "reduceMotionChanged", listener: (enabled: boolean) => void) => { remove: () => void }
  } = AccessibilityInfo
  jest.spyOn(preferences, "addEventListener").mockImplementation((_name, listener) => {
    changed = listener
    return { remove: jest.fn() }
  })
  const f = await setup({ backgroundColor: first, opacity: 1 })
  const root = f.root.current,
    editor = f.editor.current
  await f.rerender(f.tree({ backgroundColor: second, opacity: 0.2 }))
  const old = samples()[0]
  await advance(100)
  await act(() => changed?.(true))
  expect(style().backgroundColor).toBe(second)
  expect(style().opacity).toBe(0.2)
  await f.reply(old, [
    [1, 0, 0, 1],
    [0, 0, 1, 1],
  ])
  expect(style().backgroundColor).toBe(second)
  expect(f.root.current).toBe(root)
  expect(f.editor.current).toBe(editor)
  expect(f.changed).not.toHaveBeenCalled()
})

it("rejects an unresolved property deadline and ignores the later retired sample", async () => {
  const f = await setup({})
  const failed = jest.fn(),
    changed = jest.fn()
  const job = createPanelNativeColorMixer(
    "backgroundColor",
    first,
    second,
    { width: 200, height: 100 },
    "black",
    f.root,
    changed,
    failed,
  )!
  const old = samples()[0]
  job.release(true)
  expect(failed).toHaveBeenCalledTimes(1)
  expect(failed.mock.calls[0][0].message).toMatch(/appearance deadline/)
  await f.reply(old, [
    [1, 0, 0, 1],
    [0, 0, 1, 1],
  ])
  expect(changed).not.toHaveBeenCalled()
  expect(samples()).toHaveLength(1)
})

it("retires pending work with the original host on unmount", async () => {
  const f = await setup({ backgroundColor: first })
  await f.rerender(f.tree({ backgroundColor: second }))
  const count = commands().length,
    host = row(),
    old = samples()[0]
  const late = host.props.onNativeMotionColors
  await f.unmount()
  await act(() =>
    late({
      nativeEvent: {
        ownerId: host.props.ownerId,
        target: 71,
        kind: "sample",
        requestId: old[2],
        attached: true,
        colors: "[[1,0,0,1],[0,0,1,1]]",
      },
    }),
  )
  await advance(375)
  expect(f.root.current).toBeNull()
  expect(f.editor.current).toBeNull()
  expect(commands()).toHaveLength(count)
  expect(f.changed).not.toHaveBeenCalled()
})
