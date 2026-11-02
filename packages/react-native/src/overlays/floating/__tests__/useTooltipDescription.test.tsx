import { act, render, screen } from "@testing-library/react-native"
import { createRef, type RefObject } from "react"
import { TextInput, View } from "react-native"

import { NativeFocusHost } from "../../../input/NativeFocusView"
import { useNativeTooltipDescription } from "../useTooltipDescription"

jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestKeyboardFocus: jest.fn(), requestKeyboardBlur: jest.fn(), inspectAccessibility: jest.fn() },
}))
const ReactNative = jest.requireActual<typeof import("react-native")>("react-native")
let frames: Map<number, (time: number) => void>
let nextFrame: number
beforeEach(() => {
  frames = new Map()
  nextFrame = 0
  jest.spyOn(ReactNative, "findNodeHandle").mockReturnValue(71)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((frame) => {
    if (frame != null) frames.delete(frame)
  })
})
afterEach(() => jest.restoreAllMocks())

const tick = async () => {
  const pending = [...frames.values()]
  frames.clear()
  await act(() => pending.forEach((callback) => callback(0)))
}
const Probe = ({
  anchor,
  content,
  enabled = true,
  label = "",
}: {
  anchor: RefObject<View | null>
  content: RefObject<View | null>
  enabled?: boolean
  label?: string
}) => {
  useNativeTooltipDescription(enabled, anchor, content, label)
  return null
}
const fixture = () => {
  const anchor = createRef<View>(),
    otherAnchor = createRef<View>(),
    content = createRef<View>(),
    otherContent = createRef<View>()
  const node = (enabled = true, label = "") => (
    <>
      <NativeFocusHost
        ref={anchor}
        testID="anchor"
        accessibilityLabel="Authored label"
        accessibilityHint="Authored hint"
        accessibilityValue={{ now: 0, text: "" }}
      />
      <NativeFocusHost ref={otherAnchor} testID="other-anchor" />
      <View ref={content} />
      <View ref={otherContent} />
      <Probe anchor={anchor} content={content} enabled={enabled} label={label} />
    </>
  )
  return { anchor, otherAnchor, content, otherContent, node }
}

it("keeps the original owned target and authored metadata across caption updates, close and reopen", async () => {
  const f = fixture()
  const result = await render(f.node())
  const original = f.anchor.current
  expect(screen.getByTestId("anchor").props).toMatchObject({
    nativeDescriptionTag: 71,
    nativeDescriptionLabel: "",
    accessibilityLabel: "Authored label",
    accessibilityHint: "Authored hint",
    accessibilityValue: { now: 0, text: "" },
  })
  await result.rerender(f.node(true, "Details"))
  expect(f.anchor.current).toBe(original)
  expect(screen.getByTestId("anchor").props.nativeDescriptionLabel).toBe("Details")
  await result.rerender(f.node(false))
  expect(screen.getByTestId("anchor").props.nativeDescriptionTag).toBe(0)
  expect(frames.size).toBe(0)
  await result.rerender(f.node())
  expect(screen.getByTestId("anchor").props.nativeDescriptionTag).toBe(71)
  expect(f.anchor.current).toBe(original)
  const retired = [...frames.values()]
  await result.unmount()
  expect(frames.size).toBe(0)
  await act(() => retired.forEach((callback) => callback(0)))
  expect(frames.size).toBe(0)
})

it("retires the old lease when the actual anchor or description ref changes without a render", async () => {
  const f = fixture()
  const result = await render(f.node())
  f.anchor.current = f.otherAnchor.current
  f.content.current = f.otherContent.current
  jest.mocked(ReactNative.findNodeHandle).mockReturnValue(72)
  await tick()
  expect(screen.getByTestId("anchor").props.nativeDescriptionTag).toBe(0)
  expect(screen.getByTestId("other-anchor").props.nativeDescriptionTag).toBe(72)
  f.content.current = null
  await tick()
  expect(screen.getByTestId("other-anchor").props.nativeDescriptionTag).toBe(0)
  await result.unmount()
})

it.each([null, 0, -1, Number.NaN, 1.5])("retries a temporarily unavailable description tag %s", async (tag) => {
  jest.mocked(ReactNative.findNodeHandle).mockReturnValue(tag)
  const f = fixture()
  const result = await render(f.node())
  expect(screen.getByTestId("anchor").props.nativeDescriptionTag).toBe(0)
  jest.mocked(ReactNative.findNodeHandle).mockReturnValue(71)
  await tick()
  expect(screen.getByTestId("anchor").props.nativeDescriptionTag).toBe(71)
  await result.unmount()
})

it.each(["View", "TextInput"])("explicitly rejects a live core %s trigger", async (kind) => {
  const anchor = createRef<View>(),
    content = createRef<View>()
  const node = (
    <>
      {kind === "View" ? <View ref={anchor} /> : <TextInput ref={anchor as RefObject<TextInput | null>} value="" />}
      <View ref={content} />
      <Probe anchor={anchor} content={content} />
    </>
  )
  await expect(render(node)).rejects.toThrow(
    "Tooltip/HoverPopover supplementary descriptions require a NativeFocusView trigger",
  )
  expect(frames.size).toBe(0)
})

it("rejects replacement by an unsupported trigger after releasing the supported target", async () => {
  const f = fixture()
  const raw = createRef<View>()
  const result = await render(
    <>
      {f.node()}
      <View ref={raw} />
    </>,
  )
  f.anchor.current = raw.current
  const pending = [...frames.values()]
  frames.clear()
  await act(() => {
    expect(() => pending.forEach((callback) => callback(0))).toThrow("require a NativeFocusView trigger")
  })
  expect(screen.getByTestId("anchor").props.nativeDescriptionTag).toBe(0)
  expect(frames.size).toBe(0)
  await result.unmount()
})

it("restores the preceding live description when a later hook lease closes", async () => {
  const f = fixture()
  const node = (latest: boolean) => (
    <>
      {f.node(true, "First")}
      <Probe anchor={f.anchor} content={f.otherContent} enabled={latest} label="Latest" />
    </>
  )
  const result = await render(node(true))
  expect(screen.getByTestId("anchor").props.nativeDescriptionLabel).toBe("Latest")
  await result.rerender(node(false))
  expect(screen.getByTestId("anchor").props.nativeDescriptionLabel).toBe("First")
  await result.unmount()
})
