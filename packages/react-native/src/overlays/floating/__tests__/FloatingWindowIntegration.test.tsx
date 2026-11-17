import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { useContext, useLayoutEffect } from "react"
import { AccessibilityInfo, BackHandler, Platform } from "react-native"

import { AlertDialog, Modal, NativeFloatingLayerHost, NativeOverlayProvider, Select } from "../../.."
import { useNativeFloatingHost } from "../NativeFloatingLayerHost"
import { NativeFloatingScopeContext } from "../scope"
import { useNativeFloatingLayer } from "../useFloatingLayer"

import { prepareSelectPopover } from "./selectPopoverFixture"

type TLayer = ReturnType<typeof useNativeFloatingLayer>
const hidden = { includeHiddenElements: true }
const Actor = ({
  observe,
  onDismiss,
  open = true,
  modal = true,
}: {
  observe: (layer: TLayer) => void
  onDismiss: Parameters<typeof useNativeFloatingLayer>[0]["onDismiss"]
  open?: boolean
  modal?: boolean
}) => {
  const host = useNativeFloatingHost()
  const parent = useContext(NativeFloatingScopeContext)
  const layer = useNativeFloatingLayer({
    registry: host.layers,
    parent: parent?.id ?? null,
    isOpen: open,
    isModal: modal,
    isKeyboardDismissDisabled: false,
    onDismiss,
  })
  useLayoutEffect(() => {
    observe(layer)
  })
  return null
}
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => undefined)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})

it("keeps the modal background isolated through exit and consumes escape before the caller fallback", async () => {
  let layer: TLayer
  const dismiss = jest.fn()
  const fallback = jest.fn()
  const node = (open: boolean) => (
    <NativeFloatingLayerHost testID="host" onAccessibilityEscape={fallback}>
      <Actor
        open={open}
        onDismiss={dismiss}
        observe={(value) => {
          layer = value
        }}
      />
    </NativeFloatingLayerHost>
  )
  const result = await render(node(true))
  await act(() => {
    layer!.entered()
  })
  expect(screen.getByTestId("host-background", hidden).props).toMatchObject({
    pointerEvents: "none",
    accessibilityElementsHidden: true,
    importantForAccessibility: "no-hide-descendants",
  })
  await fireEvent(screen.getByTestId("host"), "accessibilityEscape")
  expect(dismiss).toHaveBeenCalledWith("accessibilityEscape")
  expect(fallback).not.toHaveBeenCalled()
  await result.rerender(node(false))
  await fireEvent(screen.getByTestId("host"), "accessibilityEscape")
  expect(dismiss).toHaveBeenCalledTimes(1)
  expect(fallback).not.toHaveBeenCalled()
  await act(() => {
    layer!.exited()
  })
  expect(screen.getByTestId("host-background").props).toMatchObject({
    pointerEvents: "box-none",
    accessibilityElementsHidden: false,
    importantForAccessibility: "auto",
  })
  await fireEvent(screen.getByTestId("host"), "accessibilityEscape")
  expect(fallback).toHaveBeenCalledTimes(1)
})

it("retains background interaction for a nonmodal layer", async () => {
  let layer: TLayer
  await render(
    <NativeFloatingLayerHost testID="host">
      <Actor
        modal={false}
        onDismiss={jest.fn()}
        observe={(value) => {
          layer = value
        }}
      />
    </NativeFloatingLayerHost>,
  )
  await act(() => {
    layer!.entered()
  })
  expect(screen.getByTestId("host-background").props).toMatchObject({
    pointerEvents: "box-none",
    accessibilityElementsHidden: false,
  })
})

it.each([
  { label: "Modal", Component: Modal },
  { label: "AlertDialog", Component: AlertDialog },
])("dismisses the floating child before the controlled $label window", async ({ Component }) => {
  let layer: TLayer
  const dismiss = jest.fn()
  const windowChanged = jest.fn()
  const node = (open: boolean) => (
    <NativeOverlayProvider>
      <Component
        testID="owner"
        isOpen
        titleText="Title"
        bodyText="Body"
        accessibilityLabel="Owner"
        onOpenChange={windowChanged}
      >
        <Actor
          open={open}
          onDismiss={dismiss}
          observe={(value) => {
            layer = value
          }}
        />
      </Component>
    </NativeOverlayProvider>
  )
  const result = await render(node(true))
  await act(() => {
    expect(layer!.entered()).toBe(false)
  })
  await fireEvent(screen.getByTestId("owner-window"), "show")
  await act(() => {
    expect(layer!.entered()).toBe(true)
  })
  await act(() => screen.getByTestId("owner-window").props.onRequestClose())
  expect(dismiss).toHaveBeenCalledWith("keyboard")
  expect(windowChanged).not.toHaveBeenCalled()
  await result.rerender(node(false))
  await act(() => screen.getByTestId("owner-window").props.onRequestClose())
  expect(windowChanged).not.toHaveBeenCalled()
  await act(() => {
    layer!.exited()
  })
  await act(() => screen.getByTestId("owner-window").props.onRequestClose())
  expect(windowChanged.mock.calls).toEqual([[false]])
  expect(screen.getByTestId("owner-window").props.visible).toBe(true)
})

it("dismisses an anchored Select before its Modal and preserves the controlled zero", async () => {
  const onChange = jest.fn()
  const onOpenChange = jest.fn()
  const windowChanged = jest.fn()
  const node = (open: boolean) => (
    <NativeOverlayProvider>
      <Modal testID="select-window-owner" accessibilityLabel="Owner" isOpen onOpenChange={windowChanged}>
        <Select
          testID="select-owner"
          accessibilityLabel="Choose"
          isOpen={open}
          value={0}
          onChange={onChange}
          onOpenChange={onOpenChange}
          items={[{ id: 0, name: "Zero" }]}
          getKey={(item) => item.id}
          getTextValue={(item) => item.name}
        />
      </Modal>
    </NativeOverlayProvider>
  )
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  const result = await render(node(true))
  const owner = () => screen.getByTestId("select-window-owner-window", hidden)
  await fireEvent(owner(), "show")
  await prepareSelectPopover("select-owner")
  await act(() => owner().props.onRequestClose())
  expect(onOpenChange.mock.calls).toEqual([[false]])
  expect(windowChanged).not.toHaveBeenCalled()
  expect(onChange).not.toHaveBeenCalled()
  expect(screen.getByTestId("select-owner-trigger", hidden).props.accessibilityValue.text).toBe("Zero")
  await result.rerender(node(false))
  await act(() => owner().props.onRequestClose())
  expect(windowChanged.mock.calls).toEqual([[false]])
})

it("owns and retires the Android Back subscription without swallowing an empty host", async () => {
  jest.replaceProperty(Platform, "OS", "android")
  let back: Parameters<typeof BackHandler.addEventListener>[1] | undefined
  const event = { type: "hardwareBackPress", timeStamp: 17 }
  const remove = jest.fn()
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, listener) => {
    back = listener
    return { remove }
  })
  let layer: TLayer
  const dismiss = jest.fn()
  const node = (open: boolean) => (
    <NativeFloatingLayerHost>
      <Actor
        open={open}
        onDismiss={dismiss}
        observe={(value) => {
          layer = value
        }}
      />
    </NativeFloatingLayerHost>
  )
  const result = await render(node(false))
  expect(back!(event)).toBe(false)
  await result.rerender(node(true))
  await act(() => {
    layer!.entered()
  })
  await act(() => {
    expect(back!(event)).toBe(true)
  })
  expect(dismiss).toHaveBeenCalledWith("keyboard")
  const retained = back!
  await result.unmount()
  expect(remove).toHaveBeenCalledTimes(1)
  expect(retained(event)).toBe(false)
})

it.each([
  { label: "Modal", Component: Modal },
  { label: "AlertDialog", Component: AlertDialog },
])(
  "updates the application host when $label admission and native dismissal change the active window",
  async ({ Component }) => {
    jest.replaceProperty(Platform, "OS", "ios")
    const node = (open: boolean) => (
      <NativeOverlayProvider>
        <NativeFloatingLayerHost testID="application-host">
          <Component testID="window-owner" accessibilityLabel="Owner" titleText="Title" bodyText="Body" isOpen={open} />
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    )
    const { rerender } = await render(node(false))
    expect(screen.getByTestId("application-host").props.enabled).toBe(true)
    await rerender(node(true))
    expect(screen.getByTestId("application-host").props.enabled).toBe(false)
    await fireEvent(screen.getByTestId("window-owner-window"), "show")
    const dismissed = screen.getByTestId("window-owner-window").props.onDismiss
    await rerender(node(false))
    expect(screen.getByTestId("application-host").props.enabled).toBe(false)
    await act(() => dismissed())
    expect(screen.getByTestId("application-host").props.enabled).toBe(true)
  },
)
