import { act, render, screen } from "@testing-library/react-native"
import { createRef, useEffect, useState } from "react"
import type { View } from "react-native"
import { PlatformColor, StyleSheet, Text as NativeText, TextInput } from "react-native"

import { Text } from "../../components/Text/Text"
import { NativeThemeProvider } from "../../theme"
import { JSAnimation, MotionGlobalConfig, frameData, motionValue, time } from "../kernel"
import { NativeMotionVisualHost } from "../visual/NativeMotionVisualHost"

jest.mock("../../input/specs/CUIFocusViewNativeComponent", () => ({
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
let nextFrame = 0
const flush = async (timestamp = 1016) => {
  await act(() => {
    frameData.timestamp = timestamp
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach((callback) => callback(timestamp))
  })
}
beforeEach(() => {
  frameData.timestamp = 1000
  MotionGlobalConfig.useManualTiming = true
  time.set(1000)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const handle = ++nextFrame
    frames.set(handle, callback)
    return handle
  })
})
afterEach(async () => {
  await flush(9000)
  MotionGlobalConfig.useManualTiming = false
  frames.clear()
  jest.restoreAllMocks()
})
const rootStyle = () => StyleSheet.flatten(screen.getByTestId("visual").props.style)

it("updates only owned visual styles through the source animation and native frame phases", async () => {
  const x = motionValue(0),
    opacity = motionValue(1)
  const ref = createRef<View>()
  const update = jest.fn()
  await render(
    <NativeMotionVisualHost
      ref={ref}
      testID="visual"
      bindings={{ x, opacity }}
      computedStyles={{ width: 10, padding: 4 }}
      customStyles={{ width: 20 }}
      style={{ width: 0 }}
      onUpdate={update}
    >
      Owned
    </NativeMotionVisualHost>,
  )
  const actual = ref.current
  const write = jest.spyOn(actual!, "setNativeProps")
  void x.start(
    (resolve) =>
      new JSAnimation({
        keyframes: [0, 100],
        duration: 100,
        ease: "linear",
        motionValue: x,
        onUpdate: (value) => x.set(value),
        onComplete: resolve,
      }),
  )
  await act(() => opacity.set(0.5))
  await flush(1050)
  expect(rootStyle()).toMatchObject({ width: 0, padding: 4, opacity: 0.5, transform: [{ translateX: 50 }] })
  expect(ref.current).toBe(actual)
  expect(update).toHaveBeenCalledTimes(1)
  expect(write).not.toHaveBeenCalled()
  x.stop()
})
it("preserves original callback-ref cleanup across visual updates", async () => {
  const x = motionValue(0)
  const cleanup = jest.fn(),
    ref = jest.fn((_target: View | null) => cleanup)
  await render(<NativeMotionVisualHost ref={ref} testID="visual" bindings={{ x }} />)
  const actual = ref.mock.calls[0][0]
  await act(() => x.set(20))
  await flush()
  expect(ref).toHaveBeenCalledTimes(1)
  expect(cleanup).not.toHaveBeenCalled()
  expect(typeof actual?.measureInWindow).toBe("function")
  await screen.unmount()
  expect(cleanup).toHaveBeenCalledTimes(1)
  expect(ref).toHaveBeenCalledTimes(1)
})
it("uses normal legacy callback null cleanup and object-ref cleanup", async () => {
  const callback = jest.fn((_target: View | null) => {})
  await render(<NativeMotionVisualHost ref={callback} testID="visual" />)
  await screen.unmount()
  expect(callback.mock.calls).toHaveLength(2)
  expect(callback.mock.calls[1][0]).toBeNull()
  const ref = createRef<View>()
  await render(<NativeMotionVisualHost ref={ref} testID="visual" />)
  expect(ref.current).not.toBeNull()
  await screen.unmount()
  expect(ref.current).toBeNull()
})
it("replaces callback refs without remounting the host or child editor", async () => {
  const firstCleanup = jest.fn(),
    secondCleanup = jest.fn()
  const first = jest.fn((_target: View | null) => firstCleanup),
    second = jest.fn((_target: View | null) => secondCleanup)
  const input = createRef<TextInput>()
  await render(
    <NativeMotionVisualHost ref={first} testID="visual">
      <TextInput ref={input} testID="editor" value="" />
    </NativeMotionVisualHost>,
  )
  const editor = input.current,
    root = first.mock.calls[0][0]
  await screen.rerender(
    <NativeMotionVisualHost ref={second} testID="visual">
      <TextInput ref={input} testID="editor" value="" />
    </NativeMotionVisualHost>,
  )
  expect(input.current).toBe(editor)
  expect(second.mock.calls[0][0]).toBe(root)
  expect(firstCleanup).toHaveBeenCalledTimes(1)
  await screen.unmount()
  expect(secondCleanup).toHaveBeenCalledTimes(1)
})
it("does not mirror editor values/selection, patch focus methods or issue extra requests", async () => {
  const opacity = motionValue(1),
    x = motionValue(0),
    input = createRef<TextInput>()
  const requests = jest.fn()
  await render(
    <NativeMotionVisualHost testID="visual" bindings={{ opacity, x }}>
      <TextInput ref={input} testID="editor" value="" selection={{ start: 0, end: 0 }} onChangeText={requests} />
    </NativeMotionVisualHost>,
  )
  const actual = input.current!,
    focus = actual.focus,
    blur = actual.blur
  const write = jest.spyOn(actual, "setNativeProps")
  await act(() => {
    opacity.set(0)
    x.set(20)
  })
  await flush()
  expect(input.current).toBe(actual)
  expect(actual.focus).toBe(focus)
  expect(actual.blur).toBe(blur)
  expect(write).not.toHaveBeenCalled()
  expect(requests).not.toHaveBeenCalled()
  expect(screen.getByTestId("editor").props).toMatchObject({ value: "", selection: { start: 0, end: 0 } })
})
it("preserves keyed child state through frame and style updates", async () => {
  const mounted = jest.fn(),
    unmounted = jest.fn(),
    x = motionValue(0)
  const Child = () => {
    const [value] = useState(() => "retained")
    useEffect(() => {
      mounted()
      return () => {
        unmounted()
      }
    }, [])
    return <NativeText>{value}</NativeText>
  }
  await render(
    <NativeMotionVisualHost testID="visual" bindings={{ x }}>
      <Child key="child" />
    </NativeMotionVisualHost>,
  )
  await act(() => x.set(20))
  await flush()
  await screen.rerender(
    <NativeMotionVisualHost testID="visual" bindings={{ x }} style={{ padding: 0 }}>
      <Child key="child" />
    </NativeMotionVisualHost>,
  )
  expect(screen.getByText("retained")).toBeTruthy()
  expect(mounted).toHaveBeenCalledTimes(1)
  expect(unmounted).not.toHaveBeenCalled()
})
it("updates owned primitive typography and foreground context while authored typography stays owned", async () => {
  const color = motionValue("red"),
    fontSize = motionValue(20)
  await render(
    <NativeMotionVisualHost testID="visual" bindings={{ color, fontSize }}>
      <>
        {"Owned"}
        <Text style={{ fontSize: 31 }} testID="authored">
          Authored
        </Text>
      </>
    </NativeMotionVisualHost>,
  )
  await act(() => {
    color.set("blue")
    fontSize.set(0)
  })
  await flush()
  expect(StyleSheet.flatten(screen.getByText("Owned").props.style)).toMatchObject({ color: "blue", fontSize: 0 })
  expect(StyleSheet.flatten(screen.getByTestId("authored").props.style)).toMatchObject({ color: "blue", fontSize: 31 })
  expect(rootStyle()).not.toHaveProperty("color")
  expect(rootStyle()).not.toHaveProperty("fontSize")
})
it("keeps an opaque static foreground intact and follows theme changes", async () => {
  const color = PlatformColor("labelColor")
  await render(
    <NativeMotionVisualHost testID="visual" style={{ color }}>
      Owned
    </NativeMotionVisualHost>,
  )
  expect(StyleSheet.flatten(screen.getByText("Owned").props.style).color).toBe(color)
  await screen.rerender(
    <NativeThemeProvider overrides={{ colors: { foreground: "green" } }}>
      <NativeMotionVisualHost testID="visual">Owned</NativeMotionVisualHost>
    </NativeThemeProvider>,
  )
  expect(StyleSheet.flatten(screen.getByText("Owned").props.style).color).toBe("green")
})
it.each([
  [undefined, undefined, false],
  [0, false, true],
  [-1, true, false],
  [undefined, true, true],
] as const)("retains core tabIndex precedence (%p,%p)", async (tabIndex, focusable, expected) => {
  await render(<NativeMotionVisualHost testID="visual" tabIndex={tabIndex} focusable={focusable} />)
  expect(screen.getByTestId("visual").props.focusable).toBe(expected)
})
it("forwards original native events and root metadata without consuming caller event objects", async () => {
  const layout = jest.fn(),
    pointer = jest.fn(),
    focus = jest.fn()
  await render(
    <NativeMotionVisualHost
      testID="visual"
      nativeID="owned"
      onLayout={layout}
      onPointerEnter={pointer}
      onBubbledFocus={focus}
      accessibilityLabel="Card"
    />,
  )
  const root = screen.getByTestId("visual")
  const event = { nativeEvent: { target: 11 } }
  await act(() => {
    root.props.onLayout(event)
    root.props.onPointerEnter(event)
    root.props.onFocus(event)
  })
  expect(layout.mock.calls[0][0]).toBe(event)
  expect(pointer.mock.calls[0][0]).toBe(event)
  expect(focus.mock.calls[0][0]).toBe(event)
  expect(root.props).toMatchObject({ nativeID: "owned", accessibilityLabel: "Card" })
})
it("removes replaced bindings, restores static values and retires pending callbacks on unmount", async () => {
  const x = motionValue(0),
    opacity = motionValue(1),
    update = jest.fn()
  await render(
    <NativeMotionVisualHost testID="visual" bindings={{ x, opacity }} onUpdate={update} style={{ opacity: 0.8 }} />,
  )
  await act(() => {
    opacity.set(0.3)
    x.set(20)
  })
  await flush()
  await screen.rerender(
    <NativeMotionVisualHost testID="visual" bindings={{ x }} onUpdate={update} style={{ opacity: 0.8 }} />,
  )
  expect(rootStyle().opacity).toBe(0.8)
  await act(() => x.set(50))
  const calls = update.mock.calls.length
  await screen.unmount()
  await flush(1032)
  expect(update).toHaveBeenCalledTimes(calls)
})

it("observes values changed by the initial actual-ref callback with source notification arguments", async () => {
  const x = motionValue(0),
    update = jest.fn()
  const ref = jest.fn((_target: View | null) => {
    x.set(5)
  })
  await render(<NativeMotionVisualHost testID="visual" ref={ref} bindings={{ x }} onUpdate={update} />)
  await flush()
  expect(rootStyle().transform).toEqual([{ translateX: 5 }])
  expect(update.mock.calls).toEqual([[{ x: 5 }, undefined, undefined]])
})
