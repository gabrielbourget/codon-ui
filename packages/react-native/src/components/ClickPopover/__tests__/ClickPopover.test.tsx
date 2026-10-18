import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, type ReactNode } from "react"
import { AccessibilityInfo, type GestureResponderEvent, type View } from "react-native"

import { Button, Input, NativeFloatingLayerHost, NativeThemeProvider, Text } from "../../.."
import type { TNativeFloatingFocusEvent } from "../../../overlays/floating/interaction"
import {
  NativeDialogTrigger,
  type TNativeDialogTriggerRenderState,
} from "../../../overlays/floating/NativeDialogTrigger"
import { ClickPopover } from "../ClickPopover"
import type { TNativeClickPopoverProps } from "../types"

const hidden = { includeHiddenElements: true }
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let frameId = 0
beforeEach(() => {
  frames.clear()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++frameId
    frames.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (id !== null && id !== undefined) frames.delete(id)
  })
})
afterEach(() => jest.restoreAllMocks())
const touch = () =>
  ({
    nativeEvent: { identifier: "1" },
    target: 17,
    persist: jest.fn(),
    isPropagationStopped: () => false,
  }) as unknown as GestureResponderEvent
const focus = () =>
  ({
    nativeEvent: { target: 29 },
    target: 29,
    persist: jest.fn(),
    isPropagationStopped: () => false,
  }) as unknown as TNativeFloatingFocusEvent
const setup = (initial: Partial<TNativeClickPopoverProps> = {}, body: ReactNode = "Popover body") => {
  const root = createRef<View>(),
    host = createRef<View>()
  const onOpenChange = jest.fn()
  let trigger: TNativeDialogTriggerRenderState
  const node = (props = initial, theme: "light" | "dark" = "light") => (
    <NativeThemeProvider mode={theme}>
      <NativeFloatingLayerHost ref={host} testID="host">
        <NativeDialogTrigger
          isOpen
          onOpenChange={onOpenChange}
          trigger={(state) => {
            trigger = state
            return (
              <Button {...state.triggerProps} testID="trigger">
                Open
              </Button>
            )
          }}
        >
          <ClickPopover {...props} ref={root}>
            {body}
          </ClickPopover>
        </NativeDialogTrigger>
      </NativeFloatingLayerHost>
    </NativeThemeProvider>
  )
  const ready = async (arrow = false) => {
    const measure = (node: View, rect: [number, number, number, number]) => {
      Object.defineProperty(node, "measureInWindow", {
        configurable: true,
        writable: true,
        value: jest.fn((callback: Parameters<View["measureInWindow"]>[0]) => callback(...rect)),
      })
    }
    expect(root.current).not.toBe(host.current)
    // The RN preset shares its default method mocks; each actual ref needs an independent measurement fixture.
    measure(host.current!, [0, 0, 300, 400])
    measure(trigger!.triggerRef.current!, [100, 100, 40, 20])
    measure(root.current!, [0, 0, 100, 80])
    if (arrow)
      await fireEvent(screen.getByTestId("click-popover-overlay-arrow", hidden), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 10, height: 10 } },
      })
    await fireEvent(screen.getByTestId("host"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 400 } },
    })
  }
  const outside = async () => {
    await act(() => screen.getByTestId("host").props.onTouchStartCapture(touch()))
    const end = touch()
    await act(() => screen.getByTestId("host").props.onTouchEndCapture(end))
    return end
  }
  return { node, ready, outside, onOpenChange, root, trigger: () => trigger! }
}

it("composes a measured native dialog, real root ref and original onLayout event", async () => {
  const onLayout = jest.fn()
  const f = setup({ onLayout })
  await render(f.node())
  await f.ready()
  expect(f.root.current?.measureInWindow).toEqual(expect.any(Function))
  expect(screen.getByTestId("click-popover", hidden)).toHaveStyle({
    position: "absolute",
    top: 128,
    left: 70,
    marginTop: 10,
    padding: 10,
    borderRadius: 5,
  })
  expect(screen.getByTestId("click-popover-dialog", hidden).props.role).toBe("dialog")
  expect(screen.queryByTestId("click-popover-overlay-arrow", hidden)).toBeNull()
  const event = { nativeEvent: { layout: { x: 70, y: 138, width: 100, height: 80 } } }
  await fireEvent(screen.getByTestId("click-popover", hidden), "layout", event)
  expect(onLayout).toHaveBeenCalledWith(event)
})

it("keeps controlled owner state authoritative after outside dismissal and honors the original-event veto", async () => {
  const veto = jest.fn().mockReturnValue(false)
  const f = setup({ shouldCloseOnInteractOutside: veto })
  const result = await render(f.node())
  await f.ready()
  const end = await f.outside()
  expect(veto).toHaveBeenCalledWith({ target: 17, event: end })
  expect(veto.mock.calls[0]?.[0].event).toBe(end)
  expect(f.onOpenChange).not.toHaveBeenCalled()
  await result.rerender(f.node({}))
  await f.outside()
  expect(f.onOpenChange.mock.calls).toEqual([[false]])
  expect(screen.getByTestId("click-popover", hidden)).toBeOnTheScreen()
})

it("retains independent root/dialog/arrow style owners and the canonical arrow graphic", async () => {
  const f = setup({
    showOverlayArrow: true,
    order: "primary",
    color: "red",
    customStyles: { backgroundColor: "blue" },
    customDialogStyles: { gap: 0, color: "purple" },
    customOverlayArrowStyles: { fill: "orange", backgroundColor: "green" },
  })
  await render(f.node())
  await f.ready(true)
  expect(screen.getByTestId("click-popover", hidden)).toHaveStyle({ backgroundColor: "blue" })
  expect(screen.getByTestId("click-popover-dialog", hidden)).toHaveStyle({ gap: 0 })
  expect(screen.getByTestId("click-popover-overlay-arrow", hidden)).toHaveStyle({
    backgroundColor: "green",
    bottom: "100%",
  })
  expect(screen.getByText("Popover body", hidden)).toHaveStyle({ color: "purple" })
})

it("renders childIsDialog false with root foreground and preserves authored controlled children through theme replacement", async () => {
  const change = jest.fn()
  const f = setup(
    { childIsDialog: false, color: "red", style: { width: 0 } },
    <>
      <Input accessibilityLabel="Draft" value="" onChange={change} />
      <Text>Authored</Text>
    </>,
  )
  const result = await render(f.node())
  await f.ready()
  expect(screen.queryByTestId("click-popover-dialog", hidden)).toBeNull()
  expect(screen.getByTestId("click-popover", hidden)).toHaveStyle({ width: 0 })
  expect(screen.getByLabelText("Draft", hidden)).toHaveDisplayValue("")
  await result.rerender(f.node({ childIsDialog: false, color: "red", style: { width: 0 } }, "dark"))
  expect(screen.getByLabelText("Draft", hidden)).toHaveDisplayValue("")
  expect(change).not.toHaveBeenCalled()
})

it("closes an unpositioned presentation without leaving the modal background blocked", async () => {
  const f = setup()
  const result = await render(f.node())
  expect(screen.getByTestId("host-background", hidden).props.pointerEvents).toBe("none")
  await result.rerender(f.node({ isOpen: false }))
  expect(screen.queryByTestId("click-popover", hidden)).toBeNull()
  expect(screen.getByTestId("host-background").props.pointerEvents).toBe("box-none")
})

it("keeps nonmodal outside touch interactive and dismisses only on an allowed outside focus", async () => {
  const veto = jest.fn().mockReturnValue(false)
  const f = setup({ isNonModal: true, shouldCloseOnInteractOutside: veto })
  const result = await render(f.node())
  await f.ready()
  await f.outside()
  expect(veto).not.toHaveBeenCalled()
  expect(f.onOpenChange).not.toHaveBeenCalled()
  expect(screen.queryByTestId("click-popover-underlay", hidden)).toBeNull()
  expect(screen.getByTestId("host-background").props.pointerEvents).toBe("box-none")
  const event = focus()
  await act(() => screen.getByTestId("host").props.onFocusCapture(event))
  expect(veto).toHaveBeenCalledWith({ target: 29, event, kind: "focus" })
  expect(f.onOpenChange).not.toHaveBeenCalled()
  await result.rerender(f.node({ isNonModal: true }))
  await act(() => screen.getByTestId("host").props.onFocusCapture(focus()))
  expect(f.onOpenChange.mock.calls).toEqual([[false]])
  expect(screen.getByTestId("click-popover", hidden)).toBeOnTheScreen()
})

it("recognizes descendant focus during capture and keeps modal focus from dismissing the layer", async () => {
  const f = setup({ isNonModal: true })
  const result = await render(f.node())
  await f.ready()
  const event = focus()
  await act(() => {
    screen.getByTestId("host").props.onFocusCapture(event)
    screen.getByTestId("click-popover", hidden).props.onFocusCapture(event)
  })
  expect(f.onOpenChange).not.toHaveBeenCalled()
  await result.rerender(f.node({}))
  await act(() => screen.getByTestId("host").props.onFocusCapture(focus()))
  expect(f.onOpenChange).not.toHaveBeenCalled()
})

it("honors explicit controlled false over an open trigger context and never requests an owner change", async () => {
  const f = setup({ isOpen: false })
  await render(f.node())
  expect(screen.queryByTestId("click-popover", hidden)).toBeNull()
  expect(screen.getByTestId("host-background").props.pointerEvents).toBe("box-none")
  expect(f.onOpenChange).not.toHaveBeenCalled()
})

it("retires retained native layout callbacks when the presentation unmounts", async () => {
  const onLayout = jest.fn()
  const f = setup({ onLayout })
  const result = await render(f.node())
  await f.ready()
  const callback = screen.getByTestId("click-popover", hidden).props.onLayout
  await result.unmount()
  await act(() => callback({ nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 0 } } }))
  expect(onLayout).not.toHaveBeenCalled()
  expect(frames.size).toBe(0)
})

it("focuses the current explicit target when a queued focus is cancelled by target replacement", async () => {
  const first = { current: { focus: jest.fn() } },
    second = { current: { focus: jest.fn() } }
  const f = setup({ initialFocusRef: first })
  const result = await render(f.node())
  await f.ready()
  await result.rerender(f.node({ initialFocusRef: second }))
  await act(() => {
    const pending = [...frames.values()]
    frames.clear()
    for (const callback of pending) callback(17)
  })
  expect(first.current.focus).not.toHaveBeenCalled()
  expect(second.current.focus).toHaveBeenCalledTimes(1)
})
