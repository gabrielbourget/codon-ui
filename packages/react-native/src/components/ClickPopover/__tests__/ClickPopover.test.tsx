import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, type ReactNode } from "react"
import { AccessibilityInfo, TextInput, type View, type GestureResponderEvent } from "react-native"

import { Button, Input, NativeFloatingLayerHost, NativeFocusView, NativeThemeProvider, Text } from "../../.."
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
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
  jest.clearAllMocks()
  jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
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
  const acknowledge = async (epoch = 1, active = true) => {
    for (const ready of [false, true]) {
      const host = screen.getByTestId("host").props
      await act(() =>
        host.onNativeScopeStatus({
          nativeEvent: {
            ownerId: host.ownerId,
            windowId: "focus-window",
            epoch,
            policyRevision: host.policyRevision,
            ready,
            windowActive: active,
          },
        }),
      )
    }
  }
  const ready = async (arrow = false, acknowledgeWindow = true) => {
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
    if (acknowledgeWindow) await acknowledge()
  }
  const outside = async () => {
    await act(() => screen.getByTestId("host").props.onTouchStartCapture(touch()))
    const end = touch()
    await act(() => screen.getByTestId("host").props.onTouchEndCapture(end))
    return end
  }
  return { node, ready, acknowledge, outside, onOpenChange, root, trigger: () => trigger! }
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
  const first = createRef<View>(),
    second = createRef<View>()
  const f = setup(
    { initialFocusRef: first },
    <>
      <NativeFocusView ref={first} testID="first-target" />
      <NativeFocusView ref={second} testID="second-target" />
    </>,
  )
  const result = await render(f.node())
  await f.ready()
  await result.rerender(f.node({ initialFocusRef: second }))
  await act(() => {
    const pending = [...frames.values()]
    frames.clear()
    for (const callback of pending) callback(17)
  })
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledWith(
    second.current,
    screen.getByTestId("second-target", hidden).props.ownerId,
  )
})

it.each([true, false])(
  "requests portable focus on the actual owned dialog/root (childIsDialog=%s) without inventing acknowledgment",
  async (childIsDialog) => {
    const onFocus = jest.fn()
    const f = setup({ childIsDialog, onFocus })
    await render(f.node())
    expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
    await f.ready()
    await act(() => {
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach((callback) => callback(0))
    })
    const node = screen.getByTestId(childIsDialog ? "click-popover-dialog" : "click-popover", hidden)
    expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
    expect(Commands.requestKeyboardFocus).toHaveBeenCalledWith(expect.anything(), node.props.ownerId)
    if (!childIsDialog) expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls[0][0]).toBe(f.root.current)
    expect(onFocus).not.toHaveBeenCalled()
  },
)

it("keeps original bubbling focus/blur callbacks separate from the owned focus acknowledgement", async () => {
  const onFocus = jest.fn(),
    onBlur = jest.fn()
  const f = setup({ onFocus, onBlur })
  await render(f.node())
  await f.ready()
  const root = screen.getByTestId("click-popover", hidden)
  const event = focus()
  await act(() => root.props.onFocus(event))
  await act(() => root.props.onBlur(event))
  expect(onFocus.mock.calls[0][0]).toBe(event)
  expect(onBlur.mock.calls[0][0]).toBe(event)
  await act(() => root.props.onNativeFocusChange({ nativeEvent: { ownerId: root.props.ownerId, isFocused: true } }))
  expect(onFocus).toHaveBeenCalledTimes(1)
})

it("retires captured entry frames on close and unmount, even if a cancelled callback is retained", async () => {
  const f = setup()
  await render(f.node())
  await f.ready()
  const pending = [...frames.values()]
  await screen.rerender(f.node({ isOpen: false }))
  await act(() => pending.forEach((callback) => callback(0)))
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  await screen.unmount()
  await act(() => pending.forEach((callback) => callback(0)))
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

it("does not move focus for a ready nonmodal surface without a dialog or explicit target", async () => {
  const f = setup({ isNonModal: true, childIsDialog: false })
  await render(f.node())
  await f.ready()
  await act(() => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(0))
  })
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

it("restores the actual owned trigger after close and refuses a cancelled restoration after reopen", async () => {
  const f = setup()
  await render(f.node())
  await f.ready()
  await act(() => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(0))
  })
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  await screen.rerender(f.node({ isOpen: false }))
  await f.acknowledge()
  const pending = [...frames.values()]
  expect(pending.length).toBeGreaterThan(0)
  await act(() => {
    frames.clear()
    pending.forEach((callback) => callback(0))
  })
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledWith(
    f.trigger().triggerRef.current,
    screen.getByTestId("trigger").props.ownerId,
  )
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  await screen.rerender(f.node())
  await f.ready()
  await screen.rerender(f.node({ isOpen: false }))
  await f.acknowledge()
  const stale = [...frames.values()]
  await screen.rerender(f.node())
  await act(() => stale.forEach((callback) => callback(0)))
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

it("uses a registered core editor's unchanged focus method without writing its controlled empty value", async () => {
  const target = createRef<TextInput>(),
    change = jest.fn()
  const f = setup(
    { initialFocusRef: target },
    <TextInput ref={target} testID="editor" value="" onChangeText={change} />,
  )
  await render(f.node())
  const actual = target.current!
  const state = jest.requireActual<{
    default: { registerInput: (view: TextInput) => void; unregisterInput: (view: TextInput) => void }
  }>("react-native/Libraries/Components/TextInput/TextInputState").default
  state.registerInput(actual)
  const focus = jest.spyOn(actual, "focus"),
    write = jest.spyOn(actual, "setNativeProps")
  try {
    await f.ready()
    await act(() => {
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach((callback) => callback(0))
    })
    expect(focus).toHaveBeenCalledTimes(1)
    expect(write).not.toHaveBeenCalled()
    expect(change).not.toHaveBeenCalled()
    expect(screen.getByTestId("editor", hidden).props.value).toBe("")
    expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  } finally {
    state.unregisterInput(actual)
  }
})

it("recaptures modal outside focus through the owned backend while forwarding the original owner event", async () => {
  const f = setup()
  await render(f.node())
  await f.ready()
  const event = focus()
  await act(() => screen.getByTestId("host").props.onFocusCapture(event))
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(
    expect.anything(),
    screen.getByTestId("click-popover-dialog", hidden).props.ownerId,
  )
  expect(f.onOpenChange).not.toHaveBeenCalled()
})

it("rejects entry requests to an explicitly ineligible native target", async () => {
  const target = createRef<View>()
  const f = setup({ initialFocusRef: target }, <NativeFocusView ref={target} focusable={false} />)
  await render(f.node())
  await f.ready()
  await act(() => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(0))
  })
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

it("preserves explicit root focusable=false and zero dimensions without admitting the default root request", async () => {
  const f = setup({ childIsDialog: false, focusable: false, style: { width: 0, height: 0 } })
  await render(f.node())
  await f.ready()
  await act(() => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(0))
  })
  expect(screen.getByTestId("click-popover", hidden).props.keyboardFocusable).toBe(false)
  expect(screen.getByTestId("click-popover", hidden)).toHaveStyle({ width: 0, height: 0 })
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

it("uses a replacement restore ref before its queued frame without losing the close request", async () => {
  const first = createRef<View>(),
    second = createRef<View>()
  const f = setup({ restoreFocusRef: first })
  const node = (props: Partial<TNativeClickPopoverProps>) => (
    <>
      <NativeFocusView ref={first} testID="restore-first" />
      <NativeFocusView ref={second} testID="restore-second" />
      {f.node(props)}
    </>
  )
  await render(node({ restoreFocusRef: first }))
  await f.ready()
  await act(() => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(0))
  })
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  await screen.rerender(node({ isOpen: false, restoreFocusRef: first }))
  await f.acknowledge()
  const stale = [...frames.values()]
  await screen.rerender(node({ isOpen: false, restoreFocusRef: second }))
  await act(() => {
    const pending = [...frames.values()]
    frames.clear()
    ;[...stale, ...pending].forEach((callback) => callback(0))
  })
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledWith(
    second.current,
    screen.getByTestId("restore-second").props.ownerId,
  )
})

it("waits for native readiness and retires entry frames from earlier window epochs", async () => {
  const f = setup()
  await render(f.node())
  await f.ready(false, false)
  await act(() => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(0))
  })
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  await f.acknowledge()
  const stale = [...frames.values()]
  expect(stale.length).toBeGreaterThan(0)
  await f.acknowledge(2, false)
  await f.acknowledge(3, true)
  await act(() => stale.forEach((callback) => callback(0)))
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  await act(() => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(0))
  })
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
})

it("does not replay a close restoration in a later native window epoch", async () => {
  const f = setup()
  await render(f.node())
  await f.ready()
  await act(() => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(0))
  })
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  await screen.rerender(f.node({ isOpen: false }))
  await f.acknowledge()
  const stale = [...frames.values()]
  expect(stale.length).toBeGreaterThan(0)
  await f.acknowledge(2, false)
  await f.acknowledge(3, true)
  await act(() => {
    const pending = [...frames.values()]
    frames.clear()
    ;[...stale, ...pending].forEach((callback) => callback(0))
  })
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})
