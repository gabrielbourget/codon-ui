import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { TextInput } from "react-native"
import type { View } from "react-native"

import type { NativeProjectionState } from "../projection/NativeProjectionState"
import type { NativeProjectionStyle } from "../projection/types"
import { NativeMotionVisualHost } from "../visual/NativeMotionVisualHost"

jest.mock("../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestKeyboardFocus: jest.fn(), requestContainerFocus: jest.fn(), requestKeyboardBlur: jest.fn() },
}))
it("clears removed owned projection/pop properties while preserving the original root and empty editor", async () => {
  // Explicit projection-state model; the actual native-host publication path is exercised without native paint claims.
  type TSnapshot = { style: NativeProjectionStyle; visible: boolean; radii: string }
  let write!: (snapshot: TSnapshot) => void
  const snapshot: TSnapshot = { style: {}, visible: true, radii: "" }
  const projection = {
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
    attach: () => () => {},
    detach: () => {},
    attachWriter: (writer: typeof write) => {
      write = writer
      return () => {}
    },
  } as unknown as NativeProjectionState
  const createPayload = jest.requireActual(
    "react-native/Libraries/ReactNative/ReactFabricPublicInstance/ReactNativeAttributePayload",
  ).create
  const attributes = jest.requireActual("react-native/Libraries/Components/View/ReactNativeStyleAttributes").default
  const ref = createRef<View>(),
    request = jest.fn()
  await render(
    <NativeMotionVisualHost
      ref={ref}
      testID="projection-root"
      projection={projection}
      style={{ padding: 8, transform: [{ rotate: "2deg" }] }}
    >
      <TextInput testID="editor" value="" onChangeText={request} />
    </NativeMotionVisualHost>,
  )
  const root = ref.current!,
    editor = screen.getByTestId("editor"),
    setter = jest.spyOn(root, "setNativeProps").mockImplementation((props) => {
      createPayload(props, { style: attributes })
    })
  expect(screen.getByTestId("projection-root").props.nativeMotionDrawingOwner).toBe(true)
  const radii = JSON.stringify({ topLeft: { x: 20, y: 10 }, topRight: null, bottomLeft: null, bottomRight: null })
  await act(() =>
    write({
      style: {
        transform: [{ scale: 0.8 }],
        transformOrigin: ["0%", "0%", 0],
        position: "absolute",
        left: 20,
        top: 10,
        width: 100,
        height: 50,
        boxShadow: [{ offsetX: 2, offsetY: 4, color: "navy" }],
      },
      visible: false,
      radii,
    }),
  )
  expect(setter).toHaveBeenLastCalledWith(
    expect.objectContaining({
      nativeMotionVisible: false,
      nativeMotionProjectionRadii: radii,
      style: expect.objectContaining({
        position: "absolute",
        left: 20,
        boxShadow: [{ offsetX: 2, offsetY: 4, color: "navy" }],
      }),
    }),
  )
  await act(() => write({ style: {}, visible: true, radii: "" }))
  expect(setter).toHaveBeenLastCalledWith({
    nativeMotionVisible: true,
    nativeMotionProjectionRadii: "",
    style: expect.objectContaining({
      padding: 8,
      transform: [{ rotate: "2deg" }],
      transformOrigin: ["50%", "50%", 0],
      position: null,
      left: null,
      top: null,
      width: null,
      height: null,
      boxShadow: null,
    }),
  })
  expect(ref.current).toBe(root)
  expect(screen.getByTestId("editor")).toBe(editor)
  expect(editor.props.value).toBe("")
  expect(request).not.toHaveBeenCalled()
  await screen.unmount()
})
