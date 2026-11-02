import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createElement, createRef, forwardRef, type ComponentProps } from "react"
import type * as Native from "react-native"
import { AccessibilityInfo, View } from "react-native"

import { AlertDialog, Modal, NativeOverlayProvider, type ModalViewportProps } from "../.."

const mockPressEvents = new Map<string, unknown>()
const mockPressHandlers = new Map<string, unknown>()
const mockScrollEvents = new Map<string, unknown>()
const nativeExports = jest.requireActual<typeof Native>("react-native")
const nativeHostExports: { readonly Pressable: unknown; readonly ScrollView: unknown } = nativeExports
const OriginalPressable = nativeExports.Pressable
const OriginalScroller = nativeExports.ScrollView
const ObservedPressable = forwardRef<View, ComponentProps<typeof OriginalPressable>>((props, ref) => {
  if (props.testID) mockPressHandlers.set(props.testID, props.onPress)
  return createElement(OriginalPressable, {
    ...props,
    ref,
    onPress: (event) => {
      if (props.testID) mockPressEvents.set(props.testID, event)
      props.onPress?.(event)
    },
  })
})
const ObservedScroller = forwardRef<InstanceType<typeof OriginalScroller>, ComponentProps<typeof OriginalScroller>>(
  (props, ref) =>
    createElement(OriginalScroller, {
      ...props,
      ref,
      onScroll: (event) => {
        if (props.testID) mockScrollEvents.set(props.testID, event)
        props.onScroll?.(event)
      },
    }),
)

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})
const hidden = { includeHiddenElements: true }
const row = (id: string) => screen.getByTestId(id, hidden)
type TKind = "modal" | "alert-dialog"
type TProps = ComponentProps<typeof Modal>
type TOutside = NonNullable<TProps["shouldCloseOnInteractOutside"]>
const node = (kind: TKind, props: TProps) => (
  <NativeOverlayProvider>
    {kind === "modal" ? <Modal {...props} /> : <AlertDialog {...props} titleText="Title" bodyText="Body" />}
  </NativeOverlayProvider>
)
const press = (target = 17) => {
  const event = {
    target,
    currentTarget: target,
    nativeEvent: { target, identifier: 0, timestamp: 10, locationX: 0, locationY: 0, pageX: 0, pageY: 0 },
    defaultPrevented: false,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    persist: jest.fn(),
  }
  event.preventDefault.mockImplementation(() => {
    event.defaultPrevented = true
  })
  return event
}
beforeEach(() => {
  mockPressEvents.clear()
  mockPressHandlers.clear()
  mockScrollEvents.clear()
  jest.spyOn(nativeHostExports, "Pressable", "get").mockReturnValue(ObservedPressable)
  jest.spyOn(nativeHostExports, "ScrollView", "get").mockReturnValue(ObservedScroller)
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => undefined)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it.each(["modal", "alert-dialog"] as const)(
  "%s checks current outside predicates on the original delivered press before requesting closure",
  async (kind) => {
    const ref = createRef<View>()
    const denied = jest.fn<boolean, Parameters<TOutside>>(() => false)
    const allowed = jest.fn<boolean, Parameters<TOutside>>(() => true)
    const oldRequest = jest.fn()
    const request = jest.fn()
    const view = await render(
      node(kind, {
        accessibilityLabel: "Task",
        ref,
        isOpen: true,
        onOpenChange: oldRequest,
        shouldCloseOnInteractOutside: denied,
      }),
    )
    await fireEvent(row(`${kind}-window`), "show")
    const originalPanel = ref.current
    for (const target of [17, 18]) {
      const original = press(target)
      await fireEvent.press(row(`${kind}-backdrop`), original)
      expect(denied.mock.calls.at(-1)?.[0]).toEqual({
        target,
        event: mockPressEvents.get(`${kind}-backdrop`),
        kind: "touch",
      })
      expect(denied.mock.calls.at(-1)?.[0].event).toBe(mockPressEvents.get(`${kind}-backdrop`))
      expect(original.preventDefault).not.toHaveBeenCalled()
    }
    expect(oldRequest).not.toHaveBeenCalled()
    expect(ref.current).toBe(originalPanel)
    await view.rerender(
      node(kind, {
        accessibilityLabel: "Updated",
        ref,
        isOpen: true,
        onOpenChange: request,
        shouldCloseOnInteractOutside: allowed,
      }),
    )
    const original = press(19)
    await fireEvent.press(row(`${kind}-backdrop`), original)
    expect(denied).toHaveBeenCalledTimes(2)
    expect(allowed.mock.calls).toEqual([
      [{ target: 19, event: mockPressEvents.get(`${kind}-backdrop`), kind: "touch" }],
    ])
    expect(oldRequest).not.toHaveBeenCalled()
    expect(request.mock.calls).toEqual([[false]])
    expect(ref.current).toBe(originalPanel)
  },
)

it.each(["modal", "alert-dialog"] as const)(
  "%s keeps outside, system and explicit action guards independent",
  async (kind) => {
    const calls: string[] = []
    const predicate = jest.fn(() => {
      calls.push("predicate")
      return false
    })
    const request = jest.fn(() => {
      calls.push("request")
    })
    const props = {
      accessibilityLabel: "Task",
      isOpen: true,
      isDismissable: false,
      onOpenChange: request,
      shouldCloseOnInteractOutside: predicate,
    }
    const actions = { confirmAction: () => calls.push("confirm"), cancelAction: () => calls.push("cancel") }
    const renderNode = (dismissable: boolean) => (
      <NativeOverlayProvider>
        {kind === "modal" ? (
          <Modal {...props} isDismissable={dismissable} />
        ) : (
          <AlertDialog {...props} {...actions} isDismissable={dismissable} titleText="Title" bodyText="Body" />
        )}
      </NativeOverlayProvider>
    )
    const view = await render(renderNode(false))
    await fireEvent(row(`${kind}-window`), "show")
    await fireEvent.press(row(`${kind}-backdrop`), press())
    expect(calls).toEqual([])
    await view.rerender(renderNode(true))
    await fireEvent.press(row(`${kind}-backdrop`), press())
    expect(calls).toEqual(["predicate"])
    calls.length = 0
    await fireEvent(row(`${kind}-window`), "requestClose")
    expect(calls).toEqual(["request"])
    calls.length = 0
    await fireEvent.press(
      screen.getByRole("button", { name: kind === "modal" ? "Close Modal" : "Confirm Action", ...hidden }),
    )
    expect(calls).toEqual(kind === "modal" ? ["request"] : ["confirm", "request"])
    if (kind === "alert-dialog") {
      calls.length = 0
      await fireEvent.press(screen.getByRole("button", { name: "Cancel Action", ...hidden }))
      expect(calls).toEqual(["cancel", "request"])
    }
    expect(predicate).toHaveBeenCalledTimes(1)
  },
)

it.each(["modal", "alert-dialog"] as const)(
  "%s preserves predicate throws and does not treat preventDefault as a new native veto",
  async (kind) => {
    const request = jest.fn()
    const fail = jest.fn(() => {
      throw new Error("Outside failure")
    })
    const view = await render(
      node(kind, {
        accessibilityLabel: "Task",
        isOpen: true,
        onOpenChange: request,
        shouldCloseOnInteractOutside: fail,
      }),
    )
    await fireEvent(row(`${kind}-window`), "show")
    await expect(fireEvent.press(row(`${kind}-backdrop`), press())).rejects.toThrow("Outside failure")
    expect(request).not.toHaveBeenCalled()
    const allow: NonNullable<TProps["shouldCloseOnInteractOutside"]> = ({ event }) => {
      event.preventDefault()
      return true
    }
    await view.rerender(
      node(kind, {
        accessibilityLabel: "Task",
        isOpen: true,
        onOpenChange: request,
        shouldCloseOnInteractOutside: allow,
      }),
    )
    const original = press()
    original.defaultPrevented = true
    await fireEvent.press(row(`${kind}-backdrop`), original)
    expect(original.defaultPrevented).toBe(true)
    expect(original.preventDefault).toHaveBeenCalledTimes(1)
    expect(request.mock.calls).toEqual([[false]])
  },
)

it.each(["modal", "alert-dialog"] as const)(
  "%s retires covered, closing and unmounted outside callbacks before invoking the predicate",
  async (kind) => {
    const predicate = jest.fn(() => true)
    const request = jest.fn()
    const props = {
      accessibilityLabel: "Task",
      isOpen: true,
      onOpenChange: request,
      shouldCloseOnInteractOutside: predicate,
    }
    const renderNode = (child: boolean, open = true) =>
      node(kind, {
        ...props,
        isOpen: open,
        children: <Modal testID="child" accessibilityLabel="Child" isOpen={child} />,
      })
    const view = await render(renderNode(false))
    await fireEvent(row(`${kind}-window`), "show")
    const retained = mockPressHandlers.get(`${kind}-backdrop`) as (event: ReturnType<typeof press>) => void
    await view.rerender(renderNode(true))
    await fireEvent(row("child-window"), "show")
    await act(() => retained(press()))
    expect(predicate).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
    await view.rerender(renderNode(true, false))
    await act(() => retained(press()))
    await view.unmount()
    await act(() => retained(press()))
    expect(predicate).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
  },
)

const stockCallbacks = [
  "onClick",
  "onClickCapture",
  "onPointerOver",
  "onPointerOverCapture",
  "onPointerOut",
  "onPointerOutCapture",
  "onGotPointerCapture",
  "onGotPointerCaptureCapture",
  "onLostPointerCapture",
  "onLostPointerCaptureCapture",
  "onTouchStartCapture",
  "onTouchMoveCapture",
  "onTouchCancelCapture",
] as const satisfies readonly (keyof ModalViewportProps)[]
it.each(["modal", "alert-dialog"] as const)(
  "%s exposes the stock View callbacks omitted by upstream TypeScript without replacing the host",
  async (kind) => {
    const callbacks = Object.fromEntries(stockCallbacks.map((name) => [name, jest.fn()]))
    const view = await render(
      node(kind, { accessibilityLabel: "Task", isOpen: true, render: (props) => <View {...props} {...callbacks} /> }),
    )
    const root = row(`${kind}-floating-host-background`)
    for (const name of stockCallbacks) {
      const original = press()
      await act(() => root.props[name](original))
      expect(callbacks[name].mock.calls).toEqual([[original]])
      expect(callbacks[name].mock.calls[0][0]).toBe(original)
    }
    await view.rerender(
      node(kind, {
        accessibilityLabel: "Updated",
        isOpen: true,
        render: (props) => <View {...props} {...callbacks} />,
      }),
    )
    expect(row(`${kind}-floating-host-background`)).toBe(root)
  },
)

it.each(["modal", "alert-dialog"] as const)(
  "%s forwards the original native scroller observation and current owner",
  async (kind) => {
    const first = jest.fn()
    const current = jest.fn()
    const view = await render(node(kind, { accessibilityLabel: "Task", isOpen: true, onScroll: first }))
    await fireEvent(row(`${kind}-window`), "show")
    const root = row(`${kind}-scroll`)
    const original = {
      nativeEvent: {
        contentOffset: { x: 0, y: 25 },
        contentSize: { width: 200, height: 500 },
        layoutMeasurement: { width: 200, height: 150 },
        contentInset: { top: 0, left: 0, bottom: 0, right: 0 },
        zoomScale: 1,
      },
      target: 17,
      currentTarget: 17,
    }
    await fireEvent.scroll(root, original)
    expect(first.mock.calls).toEqual([[mockScrollEvents.get(`${kind}-scroll`)]])
    expect(first.mock.calls[0][0]).toBe(mockScrollEvents.get(`${kind}-scroll`))
    await view.rerender(node(kind, { accessibilityLabel: "Task", isOpen: true, onScroll: current }))
    await fireEvent.scroll(row(`${kind}-scroll`), original)
    expect(first).toHaveBeenCalledTimes(1)
    expect(current.mock.calls).toEqual([[mockScrollEvents.get(`${kind}-scroll`)]])
    expect(row(`${kind}-scroll`)).toBe(root)
    expect(original.nativeEvent.contentOffset.y).toBe(25)
  },
)
