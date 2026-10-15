import * as Alert from "@rn-primitives/alert-dialog"
import * as Dialog from "@rn-primitives/dialog"
import * as Select from "@rn-primitives/select"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import React from "react"
import { AccessibilityInfo, BackHandler, Text } from "react-native"

const node = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const popupState = () =>
  JSON.parse(node("popup-state").props.children) as { open: boolean; trigger: unknown; content: unknown }

const ContextProbe = () => {
  const state = Select.useRootContext()
  return (
    <>
      <Text testID="popup-state">
        {JSON.stringify({ open: state.open, trigger: state.triggerPosition, content: state.contentLayout })}
      </Text>
      <Text
        testID="set-geometry"
        onPress={() => {
          state.setTriggerPosition({ width: 100, height: 44, pageX: 10, pageY: 20 })
          state.setContentLayout({ x: 0, y: 0, width: 200, height: 300 })
        }}
      >
        Measure
      </Text>
      <Text testID="request-close" onPress={() => state.onOpenChange(false)}>
        Close
      </Text>
    </>
  )
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockReturnValue(7)
  jest.spyOn(AccessibilityInfo, "setAccessibilityFocus").mockImplementation(() => undefined)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("keeps controlled false authoritative across repeated trigger open requests", async () => {
  const request = jest.fn()
  await render(
    <Select.Root open={false} onOpenChange={request}>
      <Select.Trigger testID="trigger" />
      <ContextProbe />
    </Select.Root>,
  )
  await fireEvent.press(node("trigger"))
  await fireEvent.press(node("trigger"))
  expect(request.mock.calls).toEqual([[true], [true]])
  expect(popupState().open).toBe(false)
})

it("retains geometry after rejected closure and clears it only after accepted closure", async () => {
  const request = jest.fn()
  const tree = (open: boolean) => (
    <Select.Root open={open} onOpenChange={request}>
      <ContextProbe />
      <Select.Overlay testID="backdrop" />
      <Select.Item testID="item" value="one" label="One" />
      <Select.Content testID="content" />
    </Select.Root>
  )
  const view = await render(tree(true))
  await fireEvent.press(node("set-geometry"))
  const measured = node("popup-state").props.children
  await fireEvent.press(node("request-close"))
  await fireEvent.press(node("backdrop"))
  await fireEvent.press(node("item"))
  await fireEvent(node("content"), "accessibilityEscape")
  expect(request.mock.calls).toEqual([[false], [false], [false], [false]])
  expect(node("popup-state").props.children).toEqual(measured)
  await view.rerender(tree(false))
  expect(popupState()).toEqual({ open: false, trigger: null, content: null })
})

it("supports defaultOpen and external controlled opening without a trigger press", async () => {
  const view = await render(
    <Select.Root defaultOpen>
      <ContextProbe />
    </Select.Root>,
  )
  expect(popupState().open).toBe(true)
  await fireEvent.press(node("request-close"))
  expect(popupState().open).toBe(false)
  await view.unmount()
  const controlled = await render(
    <Select.Root open={false}>
      <ContextProbe />
    </Select.Root>,
  )
  await controlled.rerender(
    <Select.Root open>
      <ContextProbe />
    </Select.Root>,
  )
  expect(popupState().open).toBe(true)
})

it("keeps repeated Android Back closure requests live while controlled closure is rejected", async () => {
  let back: Parameters<typeof BackHandler.addEventListener>[1] | undefined
  const request = jest.fn()
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_name, callback) => {
    back = callback
    return { remove: jest.fn() }
  })
  await render(
    <Select.Root open onOpenChange={request}>
      <ContextProbe />
      <Select.Content />
    </Select.Root>,
  )
  await fireEvent.press(node("set-geometry"))
  await act(() => {
    expect(back?.({ type: "hardwareBackPress", timeStamp: 1 })).toBe(true)
    expect(back?.({ type: "hardwareBackPress", timeStamp: 1 })).toBe(true)
  })
  expect(request.mock.calls).toEqual([[false], [false]])
  expect(popupState().trigger).toEqual({ width: 100, height: 44, pageX: 10, pageY: 20 })
})

const PRIMITIVES = [
  { name: "Dialog", Root: Dialog.Root, Content: Dialog.Content },
  { name: "AlertDialog", Root: Alert.Root, Content: Alert.Content },
  { name: "Select", Root: Select.Root, Content: Select.Content },
] as const

it.each(PRIMITIVES)(
  "lets the host own $name focus, Back and escape without leaking its private flag",
  async ({ Root, Content }) => {
    const subscribe = jest.spyOn(BackHandler, "addEventListener")
    const request = jest.fn()
    const tree = (open: boolean) => (
      <Root open={open} onOpenChange={request}>
        <Content forceMount nativeHostManaged testID="host-content" />
      </Root>
    )
    const view = await render(tree(true))
    expect(subscribe).not.toHaveBeenCalled()
    expect(node("host-content").props.onAccessibilityEscape).toBeUndefined()
    expect(node("host-content").props.nativeHostManaged).toBeUndefined()
    await act(() => jest.advanceTimersByTime(60))
    expect(AccessibilityInfo.setAccessibilityFocus).not.toHaveBeenCalled()
    await view.rerender(tree(false))
    expect(subscribe).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
  },
)

it.each(PRIMITIVES)("retains primitive-managed $name focus and dismissal by default", async ({ Root, Content }) => {
  let back: Parameters<typeof BackHandler.addEventListener>[1] | undefined
  const remove = jest.fn(),
    request = jest.fn()
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_name, callback) => {
    back = callback
    return { remove }
  })
  const view = await render(
    <Root open onOpenChange={request}>
      <Content testID="primitive-content" />
    </Root>,
  )
  await act(() => jest.advanceTimersByTime(60))
  expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledWith(7)
  await fireEvent(node("primitive-content"), "accessibilityEscape")
  await act(() => {
    expect(back?.({ type: "hardwareBackPress", timeStamp: 1 })).toBe(true)
  })
  expect(request.mock.calls).toEqual([[false], [false]])
  await view.unmount()
  expect(remove).toHaveBeenCalled()
})
