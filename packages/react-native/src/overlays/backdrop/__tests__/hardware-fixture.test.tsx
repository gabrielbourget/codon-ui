import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react-native"
import { createRef, forwardRef } from "react"
import { TextInput, View, type NativeSyntheticEvent } from "react-native"

import { NativeBackdropHost, NativeOverlayProvider, NativeThemeProvider } from "../../.."

import {
  createHardwareCaptureFixture,
  type THardwareCaptureState,
  type THardwareTargetProps,
} from "./fixtures/HardwareCaptureFixture"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.unmock("react-native/Libraries/Components/View/View")
jest.unmock("react-native/Libraries/Components/View/ViewNativeComponent")
afterEach(cleanup)

// Source command/ref controls only: View stands in for the separately compiler-checked hardware target.
const setup = async (nested = false) => {
  const seen = new Map<string, THardwareTargetProps>()
  const NativeTarget = forwardRef<View, THardwareTargetProps>((props, ref) => {
    seen.set(props.testID!, props)
    return <View {...props} ref={ref} />
  })
  const { Provider, adapter } = createHardwareCaptureFixture(NativeTarget)
  const root = createRef<View>(),
    inner = createRef<View>(),
    editor = createRef<TextInput>(),
    change = jest.fn()
  const node = (opacity = 1) => (
    <NativeThemeProvider>
      <Provider>
        <NativeOverlayProvider backdropAdapter={adapter}>
          <NativeBackdropHost
            ref={root}
            testID="hardware-source"
            accessibilityLabel="Original source"
            style={{ opacity }}
          >
            <TextInput ref={editor} testID="original-editor" value="" onChangeText={change} />
            {nested && (
              <NativeBackdropHost ref={inner} testID="inner-source">
                <View />
              </NativeBackdropHost>
            )}
          </NativeBackdropHost>
        </NativeOverlayProvider>
      </Provider>
    </NativeThemeProvider>
  )
  const view = await render(node())
  return { view, node, seen, root, inner, editor, change }
}

it("forwards original target props/ref and keeps the original empty editor through an appearance rerender", async () => {
  const f = await setup(),
    root = f.root.current,
    editor = f.editor.current
  expect(root).not.toBeNull()
  expect(editor).not.toBeNull()
  expect(f.seen.get("hardware-source")).toMatchObject({
    accessibilityLabel: "Original source",
    captureMode: 0,
    providerVersion: 0,
    deliverVersion: 0,
    inspectVersion: 0,
    collapsable: false,
  })
  await f.view.rerender(f.node(0.6))
  expect(f.seen.get("hardware-source")!.style).toEqual({ opacity: 0.6 })
  expect(f.root.current).toBe(root)
  expect(f.editor.current).toBe(editor)
  expect(screen.getByTestId("original-editor").props.value).toBe("")
  expect(f.change).not.toHaveBeenCalled()
})

it("routes each explicit native capture command without replacing the original target or editor", async () => {
  const f = await setup(),
    root = f.root.current,
    editor = f.editor.current
  const controls = within(screen.getByTestId("hardware-source-capture-controls"))
  await fireEvent.press(controls.getByText("Move capture controls"))
  expect(screen.getByTestId("hardware-source-capture-controls").props.style).toMatchObject({ left: 0 })
  await fireEvent.press(controls.getByText("Toggle capture controls"))
  for (const [label, expected] of [
    ["Hold capture completion", { captureMode: 3 }],
    ["Replace capture provider", { providerVersion: 1 }],
    ["Deliver held capture", { deliverVersion: 1 }],
    ["Inspect native capture", { inspectVersion: 1 }],
    ["Use complete capture", { captureMode: 0 }],
    ["Remove capture registration", { captureMode: 1 }],
    ["Return incomplete capture", { captureMode: 2 }],
  ] as const) {
    await fireEvent.press(controls.getByText(label))
    expect(f.seen.get("hardware-source")).toMatchObject(expected)
    expect(f.root.current).toBe(root)
    expect(f.editor.current).toBe(editor)
  }
  expect(f.change).not.toHaveBeenCalled()
})

it("records native diagnostics without treating them as capture output or changing the held editor", async () => {
  const f = await setup(),
    root = f.root.current,
    editor = f.editor.current
  const state: THardwareCaptureState = {
    target: 81,
    engineSequence: 3,
    hardwareReady: true,
    registered: true,
    captures: 2,
    cancellations: 1,
    held: 1,
    staleDeliveries: 0,
    failure: "",
  }
  await act(() =>
    f.seen
      .get("hardware-source")!
      .onCaptureState({ nativeEvent: state } as NativeSyntheticEvent<THardwareCaptureState>),
  )
  expect(JSON.parse(screen.getByTestId("hardware-source-capture-state").props.children)).toEqual({ 81: state })
  expect(f.root.current).toBe(root)
  expect(f.editor.current).toBe(editor)
  expect(f.change).not.toHaveBeenCalled()
})

it("keeps distinct nested target identities while broadcasting a provider replacement", async () => {
  const f = await setup(true),
    outer = f.root.current,
    inner = f.inner.current
  expect(outer).not.toBeNull()
  expect(inner).not.toBeNull()
  expect(outer).not.toBe(inner)
  const controls = within(screen.getByTestId("inner-source-capture-controls"))
  await fireEvent.press(controls.getByText("Toggle capture controls"))
  await fireEvent.press(controls.getByText("Replace capture provider"))
  expect(f.seen.get("hardware-source")!.providerVersion).toBe(1)
  expect(f.seen.get("inner-source")!.providerVersion).toBe(1)
  expect(f.root.current).toBe(outer)
  expect(f.inner.current).toBe(inner)
})
