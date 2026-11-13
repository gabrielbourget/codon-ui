import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, StyleSheet, TextInput } from "react-native"
import type { View } from "react-native"

import { geometryPacket, geometrySnapshot } from "../../input/__tests__/motionGeometry.fixture"
import { NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { MotionGlobalConfig, frameData, time } from "../kernel"
import { NativeMotionOwnerHost } from "../owner/NativeMotionOwnerHost"

jest.mock("../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: {
    requestKeyboardFocus: jest.fn(),
    requestContainerFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    queryMotionGeometry: jest.fn(),
  },
}))

// Actual React/owner/projection/visual lifetimes with modeled native geometry and frames.
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
  jest.spyOn(jest.requireActual<typeof import("react-native")>("react-native"), "findNodeHandle").mockReturnValue(71)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++sequence, callback)
    return sequence
  })
})
afterEach(async () => {
  await flush(10000)
  frames.clear()
  MotionGlobalConfig.useManualTiming = false
  jest.restoreAllMocks()
})

it("retires a projected owner during insertion effects without scheduling React updates", async () => {
  const error = jest.spyOn(console, "error").mockImplementation(() => {})
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    changed = jest.fn()
  let active = true,
    revision = 0,
    intent = 0
  const isActive = () => active
  const tree = () => (
    <NativeFloatingWindowContext.Provider value={isActive}>
      <NativeMotionOwnerHost
        ref={root}
        testID="projection-owner"
        motion={{ layout: true, layoutDependency: ++intent, transition: { duration: 0.1, ease: "linear" } }}
        style={{ padding: 8 }}
      >
        <TextInput ref={editor} testID="projection-editor" value="heldq" onChangeText={changed} />
      </NativeMotionOwnerHost>
    </NativeFloatingWindowContext.Provider>
  )
  const send = async (kind: "mount-before" | "mount-after", transactionId: string, x: number) => {
    const props = screen.getByTestId("projection-owner").props
    const snapshot = geometrySnapshot()
    const box = { box: [x, 20, 100, 50], quad: [x, 20, x + 100, 20, x + 100, 70, x, 70] }
    Object.assign(snapshot, { layout: [x, 20, 100, 50], model: box, untransformed: box })
    Object.assign(snapshot.ancestors[0], { projectionRevision: props.nativeMotionProjectionRevision })
    await act(() =>
      props.onNativeMotionGeometry({
        nativeEvent: geometryPacket({
          ownerId: props.ownerId,
          bindingId: props.nativeMotionGeometryBinding,
          commitRevision: props.nativeMotionGeometryRevision ?? "",
          scopeOwnerId: "",
          epoch: 0,
          geometryRevision: ++revision,
          kind,
          transactionId,
          snapshot: JSON.stringify(snapshot),
        }),
      }),
    )
  }
  await render(tree())
  const originalRoot = root.current!,
    originalEditor = editor.current
  Object.assign(originalRoot, { isConnected: true, ownerDocument: {} })
  await send("mount-after", "initial", 10)
  await screen.rerender(tree())
  await send("mount-before", "move", 10)
  await send("mount-after", "move", 110)
  await flush(1016)
  expect(StyleSheet.flatten(screen.getByTestId("projection-owner").props.style).transform).toContainEqual({
    translateX: -84,
  })

  active = false
  await screen.rerender(tree())
  expect(StyleSheet.flatten(screen.getByTestId("projection-owner").props.style)).toEqual({ padding: 8 })
  expect(root.current).toBe(originalRoot)
  expect(editor.current).toBe(originalEditor)
  expect(screen.getByTestId("projection-editor").props.value).toBe("heldq")
  expect(changed).not.toHaveBeenCalled()
  await screen.unmount()
  expect(error).not.toHaveBeenCalled()
})
