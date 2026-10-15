import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { createRef, useLayoutEffect, useState } from "react"
import { AccessibilityInfo, Animated, Platform, View } from "react-native"

import { Button, Modal, NativeOverlayProvider, NativeThemeProvider, Select, Text, type ModalProps } from "../../.."

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})

const wrap = (children: React.ReactNode) => <NativeOverlayProvider>{children}</NativeOverlayProvider>
const dismissCallbacks = new Map<string, () => void>()
const show = async (id = "modal") => {
  const window = screen.getByTestId(`${id}-window`, { includeHiddenElements: true })
  dismissCallbacks.set(id, window.props.onDismiss)
  await fireEvent(window, "show")
}
const dismiss = async (id = "modal") => {
  if (Platform.OS === "ios") await act(() => dismissCallbacks.get(id)!())
  await act(() => jest.runAllTimers())
}
beforeEach(() => {
  dismissCallbacks.clear()
  jest.clearAllMocks()
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => undefined)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("requires a single provider, accessible name and supported native values", async () => {
  await expect(render(<Modal accessibilityLabel="Dialog" />)).rejects.toThrow("NativeOverlayProvider is required")
  await expect(render(wrap(<NativeOverlayProvider />))).rejects.toThrow("nested providers")
  for (const props of [
    { accessibilityLabel: " " },
    { width: -1 },
    { width: new Animated.Value(100) },
    { height: null },
    { height: Infinity },
    { width: "calc(100% - 1px)" },
    { overlayBlur: true },
    { color: "var(--bad)" },
    { color: "var(--bad)", style: { backgroundColor: "gold" } },
    { style: { color: "var(--bad)" } },
    { closeButtonText: <Text>Close</Text> },
  ]) {
    await expect(render(wrap(<Modal accessibilityLabel="Dialog" {...(props as ModalProps)} />))).rejects.toThrow()
  }
})

it("renders fallback content and forwards the panel, aliases and style owners", async () => {
  const ref = createRef<View>()
  await render(
    wrap(
      <NativeThemeProvider>
        <Modal
          ref={ref}
          defaultOpen
          aria-label="Dialog"
          data-testid="custom"
          order="primary"
          width="90%"
          customStyles={{ backgroundColor: "tomato", color: "navy" }}
          style={{ backgroundColor: "gold" }}
          customDialogStyles={{ padding: 7 }}
          customOverlayStyles={{ backgroundColor: "plum" }}
        />
      </NativeThemeProvider>,
    ),
  )
  await show("custom")
  expect(ref.current).toBeTruthy()
  expect(screen.getByTestId("custom")).toHaveStyle({ width: "90%", backgroundColor: "gold" })
  expect(screen.getByTestId("custom-dialog")).toHaveStyle({ padding: 7 })
  expect(screen.getByTestId("custom-backdrop")).toHaveStyle({ backgroundColor: "plum" })
  expect(screen.getByText("Placeholder text")).toHaveStyle({ color: "navy" })
  await userEvent.setup().press(screen.getByRole("button", { name: "Close Modal" }))
  await dismiss("custom")
  expect(screen.queryByText("Placeholder text")).toBeNull()
})

it("keeps backdrop and system guards independent and explicit close usable", async () => {
  const onOpenChange = jest.fn()
  const { rerender } = await render(
    wrap(<Modal accessibilityLabel="Dialog" isOpen isDismissable={false} onOpenChange={onOpenChange} />),
  )
  await show()
  await fireEvent.press(screen.getByTestId("modal-backdrop"))
  expect(onOpenChange).not.toHaveBeenCalled()
  await fireEvent(screen.getByTestId("modal-window"), "requestClose")
  expect(onOpenChange.mock.calls).toEqual([[false]])
  await rerender(
    wrap(<Modal accessibilityLabel="Dialog" isOpen isKeyboardDismissDisabled onOpenChange={onOpenChange} />),
  )
  await fireEvent(screen.getByTestId("modal-window"), "requestClose")
  expect(onOpenChange).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getByTestId("modal-backdrop"))
  await userEvent.setup().press(screen.getByRole("button", { name: "Close Modal" }))
  expect(onOpenChange.mock.calls).toEqual([[false], [false], [false]])
})

it("reads defaultOpen once and rejects changes to controlled ownership", async () => {
  const { rerender } = await render(wrap(<Modal accessibilityLabel="Dialog" />))
  await rerender(wrap(<Modal accessibilityLabel="Dialog" defaultOpen />))
  expect(screen.queryByText("Placeholder text")).toBeNull()
  await expect(rerender(wrap(<Modal accessibilityLabel="Dialog" isOpen />))).rejects.toThrow("ownership")
})

it("gates the active leaf and retains parent content through nested Select and Modal", async () => {
  const parentClose = jest.fn()
  const Fixture = () => {
    const [child, setChild] = useState(false)
    return (
      <Modal testID="parent" accessibilityLabel="Parent" defaultOpen onOpenChange={parentClose}>
        <Text>Retained parent</Text>
        <Button onPress={() => setChild(true)}>Open child</Button>
        <Modal testID="child" accessibilityLabel="Child" isOpen={child} onOpenChange={setChild} />
        <Select
          accessibilityLabel="Choices"
          closeLabel="Close choices"
          items={["One"]}
          getKey={(x) => x}
          getTextValue={(x) => x}
        />
      </Modal>
    )
  }
  await render(wrap(<Fixture />))
  await show("parent")
  await userEvent.setup().press(screen.getByRole("button", { name: "Open child" }))
  expect(screen.getByTestId("parent", { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true)
  await show("child")
  await fireEvent(screen.getByTestId("parent-window", { includeHiddenElements: true }), "requestClose")
  expect(parentClose).not.toHaveBeenCalled()
  // The mock keeps nested windows inside the hidden parent React tree.
  await fireEvent(screen.getByTestId("child-window", { includeHiddenElements: true }), "requestClose")
  await dismiss("child")
  expect(screen.getByText("Retained parent")).toBeOnTheScreen()
  await userEvent.setup().press(screen.getByRole("button", { name: "Choices" }))
  await show("select")
  await fireEvent(screen.getByTestId("select-window", { includeHiddenElements: true }), "requestClose")
  await dismiss("select")
  expect(screen.getByRole("button", { name: "Choices" }).props.accessibilityValue.text).toBe("")
  expect(parentClose).not.toHaveBeenCalled()
})

it("cancels pending focus on closure and owner unmount", async () => {
  const target = createRef<View>()
  const { unmount } = await render(
    wrap(
      <Modal accessibilityLabel="Dialog" defaultOpen initialFocusRef={target}>
        <View ref={target} />
        <Text>Custom only</Text>
      </Modal>,
    ),
  )
  await show()
  expect(screen.queryByText("Placeholder text")).toBeNull()
  await unmount()
  await act(() => jest.runAllTimers())
  expect(AccessibilityInfo.sendAccessibilityEvent).not.toHaveBeenCalled()
})

it.each(["ios", "android"] as const)(
  "serializes a root replacement even when the new root is declared first on %s",
  async (platformName) => {
    jest.replaceProperty(Platform, "OS", platformName)
    const Fixture = () => {
      const [next, setNext] = useState(false)
      return (
        <>
          <Button onPress={() => setNext(true)}>Replace root</Button>
          {next && <Modal accessibilityLabel="Next" testID="next" defaultOpen />}
          <Modal accessibilityLabel="Old" testID="old" isOpen={!next} />
        </>
      )
    }
    await render(wrap(<Fixture />))
    await show("old")
    await userEvent.setup().press(screen.getByRole("button", { name: "Replace root" }))
    if (Platform.OS === "ios") expect(screen.queryByTestId("next-window")).toBeNull()
    await dismiss("old")
    expect(screen.getByTestId("next-window")).toBeOnTheScreen()
    await show("next")
  },
)

it.each(["ios", "android"] as const)(
  "replaces a presentation closed by its own body layout before native onShow on %s",
  async (platformName) => {
    jest.replaceProperty(Platform, "OS", platformName)
    const Replace = ({ replace }: { replace: () => void }) => {
      useLayoutEffect(() => {
        replace()
      }, [])
      return <Text>Pending body</Text>
    }
    const Fixture = () => {
      const [pending, setPending] = useState(true)
      const [next, setNext] = useState(false)
      return (
        <>
          <Modal testID="pending" accessibilityLabel="Pending" isOpen={pending}>
            <Replace
              replace={() => {
                setPending(false)
                setNext(true)
              }}
            />
          </Modal>
          <Modal testID="next" accessibilityLabel="Next" isOpen={next}>
            Replacement content
          </Modal>
        </>
      )
    }
    await render(wrap(<Fixture />))
    expect(screen.getByTestId("pending-window")).toBeOnTheScreen()
    expect(screen.queryByTestId("next-window")).toBeNull()
    await show("pending")
    expect(screen.queryByTestId("next-window")).toBeNull()
    await dismiss("pending")
    await show("next")
    expect(screen.getByText("Replacement content")).toBeOnTheScreen()
  },
)

it("wraps custom native phrases without replacing authored children or their context", async () => {
  await render(
    wrap(
      <Modal aria-label="Custom" defaultOpen customStyles={{ color: "navy" }}>
        Custom {0} content. <Text testID="authored">Authored text</Text>
      </Modal>,
    ),
  )
  await show()
  expect(screen.getByText("Custom 0 content. ")).toHaveStyle({ color: "navy" })
  expect(screen.getByTestId("authored")).toHaveTextContent("Authored text")
  expect(screen.queryByText("Placeholder text")).toBeNull()
})
