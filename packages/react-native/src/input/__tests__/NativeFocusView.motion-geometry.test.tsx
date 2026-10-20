import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { TextInput, type View } from "react-native"

import { readNativeMotionGeometry } from "../motionGeometry"
import { NativeFocusHost, NativeFocusView } from "../NativeFocusView"
import { Commands } from "../specs/CUIFocusViewNativeComponent"

import { geometryPacket } from "./motionGeometry.fixture"

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
afterEach(() => jest.restoreAllMocks())
it("passes private owned-drawing data without replacing the original native root or controlled editor", async () => {
  // Preset native refs/props only; no UIKit/CoreAnimation drawing executes.
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    change = jest.fn()
  const radii = JSON.stringify({
    topLeft: { x: 24, y: 8 },
    topRight: null,
    bottomLeft: null,
    bottomRight: { x: 10, y: 20 },
  })
  const scene = (value: string) => (
    <NativeFocusHost ref={root} testID="drawing" nativeMotionDrawingOwner nativeMotionProjectionRadii={value}>
      <TextInput ref={editor} value="" selection={{ start: 0, end: 0 }} onChangeText={change} testID="drawing-editor" />
    </NativeFocusHost>
  )
  await render(scene(radii))
  const originalRoot = root.current,
    originalEditor = editor.current
  expect(screen.getByTestId("drawing").props.nativeMotionDrawingOwner).toBe(true)
  expect(screen.getByTestId("drawing").props.nativeMotionProjectionRadii).toBe(radii)
  await screen.rerender(scene("{}"))
  expect(root.current).toBe(originalRoot)
  expect(editor.current).toBe(originalEditor)
  expect(screen.getByTestId("drawing-editor").props.value).toBe("")
  expect(change).not.toHaveBeenCalled()
  await screen.unmount()
})
it("registers the actual native owner before its caller ref and preserves root/editor state", async () => {
  const editor = createRef<TextInput>(),
    requests = jest.fn(),
    root = createRef<View>()
  await render(
    <NativeFocusHost
      nativeMotionGeometryObservation
      nativeMotionGeometryRevision="revision"
      ref={root}
      testID="host"
      style={{ opacity: 0.5 }}
    >
      <TextInput ref={editor} value="" selection={{ start: 0, end: 0 }} onChangeText={requests} testID="editor" />
    </NativeFocusHost>,
  )
  const target = root.current!,
    input = editor.current!,
    method = input.focus,
    write = jest.spyOn(input, "setNativeProps"),
    rootWrite = jest.spyOn(target, "setNativeProps")
  const pending = readNativeMotionGeometry(target, undefined, "revision"),
    command = jest.mocked(Commands.queryMotionGeometry),
    host = screen.getByTestId("host")
  expect(command.mock.calls[0][0]).toBe(target)
  expect(command.mock.calls[0][2]).toBe(host.props.nativeMotionGeometryBinding)
  await act(() =>
    host.props.onNativeMotionGeometry({
      nativeEvent: geometryPacket({
        ownerId: host.props.ownerId,
        bindingId: host.props.nativeMotionGeometryBinding,
        requestId: command.mock.calls[0][3],
        scopeOwnerId: "",
        epoch: 0,
        commitRevision: "revision",
      }),
    }),
  )
  await expect(pending).resolves.toMatchObject({ commitRevision: "revision", snapshot: { layout: [0, 0, 100, 50] } })
  expect(root.current).toBe(target)
  expect(editor.current).toBe(input)
  expect(input.focus).toBe(method)
  expect(write).not.toHaveBeenCalled()
  expect(rootWrite).not.toHaveBeenCalled()
  expect(requests).not.toHaveBeenCalled()
  expect(screen.getByTestId("editor").props).toMatchObject({ value: "", selection: { start: 0, end: 0 } })
  expect(screen.getByTestId("host").props.style).toEqual({ opacity: 0.5 })
})
it("keeps the public standalone primitive opted out", async () => {
  const root = createRef<View>()
  await render(<NativeFocusView ref={root} testID="host" />)
  await expect(readNativeMotionGeometry(root.current)).rejects.toThrow(/no observer/)
  const host = screen.getByTestId("host")
  expect(host.props.nativeMotionGeometryBinding).toBe("")
  expect(host.props.onNativeMotionGeometry).toBeUndefined()
  expect(Commands.queryMotionGeometry).not.toHaveBeenCalled()
})
it("retires pending geometry and old event handlers with normal caller-ref cleanup", async () => {
  const cleanup = jest.fn(),
    ref = jest.fn((_view: View | null) => cleanup)
  await render(<NativeFocusHost ref={ref} nativeMotionGeometryObservation testID="host" />)
  const target = ref.mock.calls[0][0]!,
    host = screen.getByTestId("host"),
    handler = host.props.onNativeMotionGeometry
  const pending = readNativeMotionGeometry(target),
    failure = expect(pending).rejects.toThrow(/retired/)
  await screen.unmount()
  await failure
  await act(() =>
    handler({
      nativeEvent: geometryPacket({ ownerId: host.props.ownerId, bindingId: host.props.nativeMotionGeometryBinding }),
    }),
  )
  expect(cleanup).toHaveBeenCalledTimes(1)
  expect(ref).toHaveBeenCalledTimes(1)
  await expect(readNativeMotionGeometry(target)).rejects.toThrow(/no observer/)
})
it("makes the observer available inside the original caller ref callback", async () => {
  let query: ReturnType<typeof readNativeMotionGeometry> | undefined
  const ref = (target: View | null) => {
    if (target) query = readNativeMotionGeometry(target)
  }
  await render(<NativeFocusHost ref={ref} nativeMotionGeometryObservation testID="host" />)
  const host = screen.getByTestId("host"),
    command = jest.mocked(Commands.queryMotionGeometry)
  expect(command).toHaveBeenCalledTimes(1)
  await act(() =>
    host.props.onNativeMotionGeometry({
      nativeEvent: geometryPacket({
        ownerId: host.props.ownerId,
        bindingId: host.props.nativeMotionGeometryBinding,
        requestId: command.mock.calls[0][3],
        scopeOwnerId: "",
        epoch: 0,
      }),
    }),
  )
  await expect(query).resolves.toMatchObject({ target: 71 })
})
