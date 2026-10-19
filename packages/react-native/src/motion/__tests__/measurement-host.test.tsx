import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { StyleSheet, TextInput, type View } from "react-native"

import { geometryPacket, geometrySnapshot } from "../../input/__tests__/motionGeometry.fixture"
import { Commands } from "../../input/specs/CUIFocusViewNativeComponent"
import { NativeMotionMeasurementState } from "../measurement"
import { NativeMotionVisualHost } from "../visual/NativeMotionVisualHost"

import { measurementToken, measurementTurn } from "./measurement.fixture"

jest.mock("../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: {
    queryMotionGeometry: jest.fn(),
    sampleMotionColors: jest.fn(),
    requestKeyboardFocus: jest.fn(),
    requestContainerFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    inspectAccessibility: jest.fn(),
  },
}))
beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockReturnValue(71)
})
afterEach(() => jest.restoreAllMocks())
it("renders measured overrides and restores current authored styles before resolving, without retiring ref/editor ownership", async () => {
  const input = createRef<TextInput>(),
    changes = jest.fn(),
    oldCleanup = jest.fn(),
    newCleanup = jest.fn(),
    first = jest.fn((_view: View | null) => oldCleanup),
    second = jest.fn((_view: View | null) => newCleanup)
  let held = false
  const release = jest.fn(async () => {
      held = false
    }),
    abort = jest.fn(async () => {
      held = false
    })
  const state = new NativeMotionMeasurementState({
      begin: async (target) => {
        held = true
        return { target, release, abort }
      },
    }),
    attach = jest.spyOn(state, "attach")
  const tree = (ref: typeof first, authoredWidth: number) => (
    <NativeMotionVisualHost
      testID="root"
      ref={ref}
      measurement={state}
      style={{ width: authoredWidth, height: 40 }}
      nativeMotionGeometryRevision="authored"
    >
      <TextInput ref={input} testID="editor" value="" selection={{ start: 0, end: 0 }} onChangeText={changes} />
    </NativeMotionVisualHost>
  )
  await render(tree(first, 120))
  const actual = first.mock.calls[0][0]!,
    editor = input.current!,
    focus = editor.focus,
    write = jest.spyOn(editor, "setNativeProps"),
    rootWrite = jest.spyOn(actual, "setNativeProps")
  const style = () => StyleSheet.flatten(screen.getByTestId("root").props.style)
  let revision = 0
  const report = async (requestId = "") => {
    const host = screen.getByTestId("root"),
      width = style().width === "auto" ? 240 : Number(style().width),
      box = { box: [0, 0, width, 40], quad: [0, 0, width, 0, width, 40, 0, 40] },
      snapshot = { ...geometrySnapshot(), layout: [0, 0, width, 40], model: box, untransformed: box }
    await act(() =>
      host.props.onNativeMotionGeometry({
        nativeEvent: geometryPacket({
          ownerId: host.props.ownerId,
          bindingId: host.props.nativeMotionGeometryBinding,
          scopeOwnerId: "",
          epoch: 0,
          geometryRevision: ++revision,
          kind: requestId ? "sample" : "mount-after",
          requestId,
          commitRevision: host.props.nativeMotionGeometryRevision,
          transactionId: "fixture-cohort",
          snapshot: JSON.stringify(snapshot),
        }),
      }),
    )
  }
  let pending!: ReturnType<typeof state.measure>
  await act(async () => {
    pending = state.measure({
      name: "width",
      keyframes: [120, "auto"],
      metric: (record) => record.snapshot!.layout[2],
      token: measurementToken(),
    })
    await measurementTurn()
  })
  const query = jest.mocked(Commands.queryMotionGeometry)
  expect(query).toHaveBeenCalledTimes(1)
  await report(query.mock.calls[0][3])
  expect(style().width).toBe(120)
  await report()
  expect(style().width).toBe("auto")
  expect(held).toBe(true)
  await screen.rerender(tree(second, 90))
  expect(second.mock.calls[0][0]).toBe(actual)
  expect(input.current).toBe(editor)
  expect(attach).toHaveBeenCalledTimes(1)
  await report()
  expect(style().width).toBe(90)
  expect(release).not.toHaveBeenCalled()
  await report()
  await expect(pending).resolves.toEqual({ keyframes: [120, 240], finalKeyframe: "auto" })
  expect(release).toHaveBeenCalledTimes(1)
  expect(abort).not.toHaveBeenCalled()
  expect(held).toBe(false)
  expect(screen.getByTestId("root").props.nativeMotionGeometryRevision).toBe("authored")
  expect(editor.focus).toBe(focus)
  expect(write).not.toHaveBeenCalled()
  expect(rootWrite).not.toHaveBeenCalled()
  expect(changes).not.toHaveBeenCalled()
  expect(screen.getByTestId("editor").props).toMatchObject({ value: "", selection: { start: 0, end: 0 } })
  expect(oldCleanup).toHaveBeenCalledTimes(1)
  expect(newCleanup).not.toHaveBeenCalled()
  await screen.unmount()
  expect(newCleanup).toHaveBeenCalledTimes(1)
})
