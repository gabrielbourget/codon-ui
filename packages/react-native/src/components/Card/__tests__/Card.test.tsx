import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, PlatformColor, StyleSheet, TextInput } from "react-native"
import type { View } from "react-native"

import { nativeAnimationControls } from "../../../motion/animation"
import { NativeMotionConfig } from "../../../motion/config"
import { MotionGlobalConfig, frameData, motionValue, time } from "../../../motion/kernel"
import * as MotionOwnerModule from "../../../motion/owner/NativeMotionOwner"
import { NativeThemeProvider } from "../../../theme"
import { resolveNativeTheme } from "../../../theme/defaults"
import { Card } from "../Card"
import { getNativeCardStyle } from "../styles"
import type { TNativeCardProps } from "../types"

jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: {
    requestKeyboardFocus: jest.fn(),
    requestContainerFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    inspectAccessibility: jest.fn(),
  },
}))
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let sequence = 0
const flush = async (timestamp: number) => {
  await act(() => {
    frameData.timestamp = timestamp
    time.set(timestamp)
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(timestamp))
  })
}
beforeEach(() => {
  MotionGlobalConfig.useManualTiming = true
  frameData.timestamp = 1000
  time.set(1000)
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++sequence
    frames.set(id, callback)
    return id
  })
})
afterEach(async () => {
  await flush(9000)
  frames.clear()
  MotionGlobalConfig.useManualTiming = false
  jest.restoreAllMocks()
})
const rootStyle = (identity = "card") => StyleSheet.flatten(screen.getByTestId(identity).props.style)
const observeOwners = () => {
  const OriginalOwner = MotionOwnerModule.NativeMotionOwner
  const owners: MotionOwnerModule.NativeMotionOwner[] = []
  jest.spyOn(MotionOwnerModule, "NativeMotionOwner").mockImplementation((options, parent) => {
    const owner = new OriginalOwner(options, parent)
    owners.push(owner)
    return owner
  })
  return owners
}

it("maps canonical root assertion 1: native identity and computed/custom/final style precedence", async () => {
  await render(
    <Card
      accessibilityLabel="Card root"
      accessible
      data-testid="card"
      role="group"
      customStyles={{ backgroundColor: "turquoise", marginTop: 5 }}
      style={[{ backgroundColor: "tomato" }, { marginBottom: 10 }]}
    >
      Card content
    </Card>,
  )
  expect(screen.getByRole("group", { name: "Card root" })).toBe(screen.getByTestId("card"))
  expect(screen.getByText("Card content")).toBeTruthy()
  expect(rootStyle()).toMatchObject({
    flexDirection: "column",
    justifyContent: "flex-start",
    padding: 15,
    gap: 15,
    borderRadius: 10,
    backgroundColor: "tomato",
    marginTop: 5,
    marginBottom: 10,
  })
})
it("maps canonical root assertion 2: native zero/percentage/auto dimensions with final overrides", async () => {
  await render(<Card data-testid="card" width={320} height="50%" borderRadius="25%" style={{ width: "80%" }} />)
  expect(rootStyle()).toMatchObject({ width: "80%", height: "50%", borderRadius: "25%" })
  await screen.rerender(<Card testID="card" width={0} height="auto" borderRadius={0} />)
  expect(rootStyle()).toMatchObject({ width: 0, height: "auto", borderRadius: 0 })
})
it("maps canonical root assertion 3: consumes owned and inherited motion props before the native receiver", async () => {
  const owners = observeOwners()
  const ended = jest.fn(),
    measure = jest.fn()
  await render(
    <NativeMotionConfig isStatic>
      <Card
        data-testid="card"
        width={300}
        height={200}
        borderRadius={15}
        raised={false}
        customStyles={{ marginTop: 5 }}
        layoutMode="position"
        layout="size"
        animate="ready"
        variants={{ ready: { opacity: 1 } }}
        onAnimationComplete={ended}
        onLayoutMeasure={measure}
        globalTapTarget
        propagate={{ tap: false }}
      />
    </NativeMotionConfig>,
  )
  for (const name of [
    "data-testid",
    "width",
    "height",
    "borderRadius",
    "raised",
    "customStyles",
    "layoutMode",
    "layout",
    "animate",
    "variants",
    "onAnimationComplete",
    "onLayoutMeasure",
    "globalTapTarget",
    "propagate",
  ])
    expect(screen.getByTestId("card").props).not.toHaveProperty(name)
  expect(owners[0].getProps()).toMatchObject({
    layout: "position",
    onAnimationComplete: ended,
    onLayoutMeasure: measure,
    globalTapTarget: true,
    propagate: { tap: false },
  })
})
it.each([true, "size", "position", false] as const)(
  "preserves canonical ignored inherited layout=%s when layoutMode is absent",
  async (layout) => {
    const owners = observeOwners()
    await render(
      <NativeMotionConfig isStatic>
        <Card testID="card" layout={layout} />
      </NativeMotionConfig>,
    )
    expect(owners[0].getProps().layout).toBeUndefined()
  },
)
it("preserves the pinned raised recipe, native testID precedence and current theme spacing", async () => {
  await render(
    <NativeThemeProvider mode="dark" overrides={{ spacing: { unit: 7 } }}>
      <Card testID="card" data-testid="alias" />
    </NativeThemeProvider>,
  )
  expect(screen.queryByTestId("alias")).toBeNull()
  expect(rootStyle()).toMatchObject({
    width: "auto",
    height: "auto",
    padding: 21,
    gap: 21,
    boxShadow: [
      { offsetX: 0, offsetY: 2, blurRadius: 3, color: "rgba(0,0,0,0.35)" },
      { offsetX: 0, offsetY: 2, blurRadius: 2, color: "rgba(0,0,0,0.28)" },
    ],
  })
  await screen.rerender(<Card testID="card" raised={false} customStyles={{ padding: 0 }} style={{ gap: 0 }} />)
  expect(rootStyle()).not.toHaveProperty("boxShadow")
  expect(rootStyle()).toMatchObject({ padding: 0, gap: 0 })
})
it("retains opaque native colors and inherits foreground without imposing a Card background", async () => {
  const foreground = PlatformColor("labelColor")
  await render(
    <Card testID="card" style={{ color: foreground }}>
      Content
    </Card>,
  )
  expect(StyleSheet.flatten(screen.getByText("Content").props.style).color).toBe(foreground)
  expect(rootStyle()).not.toHaveProperty("backgroundColor")
})
it("runs source controls on the actual Card ref while retaining a held-empty editor and definition identity", async () => {
  const controls = nativeAnimationControls(),
    stop = controls.mount()
  const ref = createRef<View>(),
    editor = createRef<TextInput>(),
    request = jest.fn(),
    started = jest.fn(),
    completed = jest.fn()
  await render(
    <NativeMotionConfig transition={{ duration: 0.1, ease: "linear" }}>
      <Card
        ref={ref}
        testID="card"
        initial={{ x: 0, opacity: 1 }}
        animate={controls}
        onAnimationStart={started}
        onAnimationComplete={completed}
      >
        <TextInput ref={editor} testID="editor" value="" selection={{ start: 0, end: 0 }} onChangeText={request} />
      </Card>
    </NativeMotionConfig>,
  )
  const originalRoot = ref.current!,
    originalEditor = editor.current!,
    focus = originalEditor.focus,
    definition = { x: 100, opacity: 0 }
  const write = jest.spyOn(originalEditor, "setNativeProps")
  let pending!: Promise<unknown[]>
  await act(() => {
    pending = controls.start(definition)
  })
  expect(started.mock.calls[0][0]).toBe(definition)
  await flush(1050)
  expect(rootStyle()).toMatchObject({ opacity: 0.5, transform: [{ translateX: 50 }] })
  await flush(1100)
  await pending
  expect(completed.mock.calls[0][0]).toBe(definition)
  expect(ref.current).toBe(originalRoot)
  expect(editor.current).toBe(originalEditor)
  expect(originalEditor.focus).toBe(focus)
  expect(screen.getByTestId("editor").props).toMatchObject({ value: "", selection: { start: 0, end: 0 } })
  expect(write).not.toHaveBeenCalled()
  expect(request).not.toHaveBeenCalled()
  await screen.unmount()
  expect(ref.current).toBeNull()
  stop()
})
it("hands off React19 cleanup refs without replacing the root or dirty editor", async () => {
  const firstCleanup = jest.fn(),
    secondCleanup = jest.fn(),
    first = jest.fn((_target: View | null) => firstCleanup),
    second = jest.fn((_target: View | null) => secondCleanup),
    editor = createRef<TextInput>()
  await render(
    <Card ref={first}>
      <TextInput ref={editor} value="dirty" />
    </Card>,
  )
  const originalEditor = editor.current,
    originalRoot = first.mock.calls[0][0]
  await screen.rerender(
    <Card ref={second} style={{ padding: 0 }}>
      <TextInput ref={editor} value="dirty" />
    </Card>,
  )
  expect(second.mock.calls[0][0]).toBe(originalRoot)
  expect(editor.current).toBe(originalEditor)
  expect(firstCleanup).toHaveBeenCalledTimes(1)
  expect(secondCleanup).not.toHaveBeenCalled()
  await screen.unmount()
  expect(secondCleanup).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledTimes(1)
})
it("keeps caller values live through the private erased owner protocol without taking ownership", async () => {
  const opacity = motionValue(1)
  await render(<Card testID="card" values={{ opacity }} />)
  await act(() => opacity.set(0.4))
  await flush(1050)
  expect(rootStyle().opacity).toBe(0.4)
  expect(screen.getByTestId("card").props).not.toHaveProperty("values")
  await screen.unmount()
  opacity.set(0.8)
  expect(opacity.get()).toBe(0.8)
  opacity.destroy()
})
it.each([
  { width: "12px" },
  { height: -1 },
  { width: Infinity },
  { borderRadius: "auto" },
  { borderRadius: "2rem" },
  { borderRadius: NaN },
  { raised: "false" },
  { layoutMode: true },
])("rejects invalid native Card inputs %p", (props) => {
  expect(() => getNativeCardStyle(props as unknown as TNativeCardProps, resolveNativeTheme("light"))).toThrow()
})
