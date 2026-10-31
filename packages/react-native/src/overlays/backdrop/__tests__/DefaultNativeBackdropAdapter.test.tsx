import { act, cleanup, fireEvent, render } from "@testing-library/react-native"
import { createRef } from "react"
import { TextInput, View } from "react-native"

import * as keyboard from "../../../input/NativeKeyboardScope"
import NativeCUIMotionSnapshot from "../../../input/specs/NativeCUIMotionSnapshot"
import { DefaultNativeBackdropAdapter } from "../DefaultNativeBackdropAdapter"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.unmock("react-native/Libraries/Components/View/View")
jest.unmock("react-native/Libraries/Components/View/ViewNativeComponent")
jest.mock("../../../input/specs/NativeCUIMotionSnapshot", () => ({
  __esModule: true,
  default: { backdropFrame: jest.fn() },
}))
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("keeps an in-flight frame and original source/editor across unrelated appearance rerenders", async () => {
  jest.useFakeTimers()
  const input = { ownerId: "scope", acknowledgedSession: () => ({ windowId: "window", epoch: 2 }) }
  jest.spyOn(keyboard, "useNativeKeyScope").mockReturnValue(input as ReturnType<typeof keyboard.useNativeKeyScope>)
  const source = createRef<View>(),
    editor = createRef<TextInput>(),
    commands: Record<string, unknown>[] = []
  let complete: (() => void) | undefined
  const native = jest.mocked(NativeCUIMotionSnapshot!.backdropFrame)
  native.mockImplementation((encoded: string) => {
    const request = JSON.parse(encoded) as Record<string, unknown>
    commands.push(request)
    if (request.action === "capture")
      return new Promise((resolve) => {
        complete = () => resolve(JSON.stringify({ ...request, staged: true }))
      })
    return Promise.resolve(JSON.stringify({ ...request, published: true }))
  })
  const lease = { ownerId: "effect", generation: 1, isCurrent: () => true }
  const Effect = DefaultNativeBackdropAdapter.Effect
  const Target = DefaultNativeBackdropAdapter.Target
  const node = (opacity: number) => (
    <View>
      <Target ref={source}>
        <TextInput ref={editor} value="held" onChangeText={() => {}} />
      </Target>
      <Effect targetRef={source} lease={lease} radius={10} isPaused={false} style={{ opacity }} />
    </View>
  )
  const view = await render(node(1))
  const originalSource = source.current,
    originalEditor = editor.current
  expect(originalSource).not.toBeNull()
  expect(originalEditor).not.toBeNull()
  const findReceiver = () =>
    view
      .root!.queryAll(
        (instance) => instance.props.pointerEvents === "none" && typeof instance.props.onLayout === "function",
      )
      .at(-1)!
  const receiver = findReceiver()
  await fireEvent(receiver, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 600 } } })
  await act(() => jest.advanceTimersByTime(32))
  expect(commands.filter((command) => command.action === "capture")).toHaveLength(1)
  const count = commands.length
  await view.rerender(node(0.5))
  expect(commands).toHaveLength(count)
  await act(async () => {
    complete?.()
    await Promise.resolve()
  })
  expect(commands.at(-1)).toMatchObject({ action: "publish", generation: 1 })
  expect(source.current).toBe(originalSource)
  expect(editor.current).toBe(originalEditor)
  expect(findReceiver()).toBe(receiver)
})
