import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import type { View } from "react-native"
import { PlatformColor, TextInput } from "react-native"

import { sampleNativeMotionColors } from "../motionColors"
import { NativeFocusHost, NativeFocusView } from "../NativeFocusView"
import { Commands, type NativeMotionColors } from "../specs/CUIFocusViewNativeComponent"

jest.mock("../specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: {
    queryMotionGeometry: jest.fn(),
    sampleMotionColors: jest.fn(),
    requestKeyboardFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    requestContainerFocus: jest.fn(),
    inspectAccessibility: jest.fn(),
  },
}))
beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockReturnValue(71)
})

it("keeps a pending color batch and original caller ref while geometry observation changes", async () => {
  const root = createRef<View>(),
    cleanup = jest.fn(),
    caller = jest.fn((target: View | null) => {
      root.current = target
      return cleanup
    })
  const node = (geometry: boolean) => (
    <NativeFocusHost
      ref={caller}
      testID="host"
      nativeMotionColorObservation
      nativeMotionGeometryObservation={geometry}
    />
  )
  const view = await render(node(false))
  const target = root.current!
  const pending = sampleNativeMotionColors(target, [PlatformColor("labelColor")])
  const outcome = pending.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  )
  const command = jest.mocked(Commands.sampleMotionColors)
  await view.rerender(node(true))
  await view.rerender(node(false))
  expect(caller).toHaveBeenCalledTimes(1)
  expect(cleanup).not.toHaveBeenCalled()
  expect(root.current).toBe(target)
  const host = screen.getByTestId("host")
  await act(() =>
    host.props.onNativeMotionColors({
      nativeEvent: report(host.props.ownerId, { requestId: command.mock.calls[0][2] }),
    }),
  )
  await act(() =>
    host.props.onNativeMotionColors({
      nativeEvent: report(host.props.ownerId, {
        kind: "sample",
        requestId: command.mock.calls[1][2],
        colors: "[[1,0,0,1]]",
      }),
    }),
  )
  expect(await outcome).toMatchObject({ value: { colors: [{ red: 1 }] } })
})
afterEach(() => jest.restoreAllMocks())
it("retires the color observer when it is disabled while retaining the original native host", async () => {
  const root = createRef<View>()
  const node = (enabled: boolean) => <NativeFocusHost ref={root} testID="host" nativeMotionColorObservation={enabled} />
  const view = await render(node(true))
  const target = root.current!
  const pending = sampleNativeMotionColors(target, [PlatformColor("labelColor")])
  const failure = expect(pending).rejects.toThrow(/retired/)
  await view.rerender(node(false))
  await failure
  expect(root.current).toBe(target)
  await expect(sampleNativeMotionColors(target, ["red"])).rejects.toThrow(/no sampler/)
})
const report = (ownerId: string, extra: Partial<NativeMotionColors> = {}): NativeMotionColors => ({
  ownerId,
  target: 71,
  kind: "environment",
  requestId: "",
  windowId: "native-window",
  scopeOwnerId: "",
  epoch: 0,
  environmentRevision: 2,
  attached: true,
  colors: "[]",
  error: "",
  observedAt: 100,
  ...extra,
})

it("binds opt-in queries to the actual host and leaves root/editor styles, refs and held values untouched", async () => {
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    requests = jest.fn()
  await render(
    <NativeFocusHost testID="host" ref={root} nativeMotionColorObservation style={{ opacity: 0 }}>
      <TextInput testID="editor" ref={editor} value="" selection={{ start: 0, end: 0 }} onChangeText={requests} />
    </NativeFocusHost>,
  )
  const target = root.current!,
    input = editor.current!,
    focus = input.focus,
    write = jest.spyOn(input, "setNativeProps"),
    rootWrite = jest.spyOn(target, "setNativeProps")
  const color = PlatformColor("labelColor"),
    pending = sampleNativeMotionColors(target, [color])
  const command = jest.mocked(Commands.sampleMotionColors)
  expect(command.mock.calls[0][0]).toBe(target)
  const host = screen.getByTestId("host"),
    ownerId = host.props.ownerId
  await act(() =>
    host.props.onNativeMotionColors({ nativeEvent: report(ownerId, { requestId: command.mock.calls[0][2] }) }),
  )
  expect(command).toHaveBeenCalledTimes(2)
  await act(() =>
    host.props.onNativeMotionColors({
      nativeEvent: report(ownerId, {
        kind: "sample",
        requestId: command.mock.calls[1][2],
        colors: "[[0.1,0.2,0.3,1]]",
      }),
    }),
  )
  await expect(pending).resolves.toMatchObject({ colors: [{ red: 0.1, green: 0.2, blue: 0.3, alpha: 1 }] })
  expect(root.current).toBe(target)
  expect(editor.current).toBe(input)
  expect(input.focus).toBe(focus)
  expect(write).not.toHaveBeenCalled()
  expect(rootWrite).not.toHaveBeenCalled()
  expect(requests).not.toHaveBeenCalled()
  expect(screen.getByTestId("editor").props).toMatchObject({ value: "", selection: { start: 0, end: 0 } })
  expect(screen.getByTestId("host").props.style).toEqual({ opacity: 0 })
})
it("keeps the public standalone primitive opted out and does not expose a sampler by default", async () => {
  const ref = createRef<View>()
  await render(<NativeFocusView testID="host" ref={ref} />)
  await expect(sampleNativeMotionColors(ref.current, ["red"])).rejects.toThrow(/no sampler/)
  expect(screen.getByTestId("host").props.nativeMotionColorObservation).toBe(false)
  expect(screen.getByTestId("host").props.onNativeMotionColors).toBeUndefined()
  expect(Commands.sampleMotionColors).not.toHaveBeenCalled()
})
it("retires pending queries and old event handlers on unmount with normal ref cleanup", async () => {
  const cleanup = jest.fn(),
    ref = jest.fn((_target: View | null) => cleanup)
  await render(<NativeFocusHost testID="host" ref={ref} nativeMotionColorObservation />)
  const target = ref.mock.calls[0][0]!,
    host = screen.getByTestId("host"),
    handler = host.props.onNativeMotionColors,
    ownerId = host.props.ownerId
  const pending = sampleNativeMotionColors(target, ["red"]),
    failure = expect(pending).rejects.toThrow(/retired/)
  await screen.unmount()
  await failure
  await act(() => handler({ nativeEvent: report(ownerId) }))
  expect(cleanup).toHaveBeenCalledTimes(1)
  expect(ref).toHaveBeenCalledTimes(1)
  expect(Commands.sampleMotionColors).toHaveBeenCalledTimes(1)
  await expect(sampleNativeMotionColors(target, ["red"])).rejects.toThrow(/no sampler/)
})
