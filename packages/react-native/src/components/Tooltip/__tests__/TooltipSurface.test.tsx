import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, type ReactNode } from "react"
import { AccessibilityInfo, type View } from "react-native"

import { Button, Input, NativeFloatingLayerHost, NativeThemeProvider } from "../../.."
import { NativeDialogTrigger } from "../../../overlays/floating/NativeDialogTrigger"
import { useNativeFloatingHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import {
  NativeTooltipTrigger,
  type TNativeTooltipTriggerRenderState,
} from "../../../overlays/floating/NativeTooltipTrigger"
import { ClickPopover } from "../../ClickPopover/ClickPopover"
import { HoverPopover } from "../../HoverPopover/HoverPopover"
import { Tooltip } from "../Tooltip"
import type { TNativeTooltipProps } from "../types"

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
const measure = (node: View, rect: [number, number, number, number]) => {
  Object.defineProperty(node, "measureInWindow", {
    configurable: true,
    writable: true,
    value: jest.fn((callback: Parameters<View["measureInWindow"]>[0]) => callback(...rect)),
  })
}
const nativeFocus = (node: View) => {
  Object.defineProperty(node, "focus", { configurable: true, writable: true, value: jest.fn() })
}
const layout = (width: number, height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height } } })
const tick = async () =>
  act(() => {
    const pending = [...frames.values()]
    frames.clear()
    for (const callback of pending) callback(17)
  })
const variants = [
  { name: "tooltip", Component: Tooltip, arrow: true },
  { name: "hover-popover", Component: HoverPopover, arrow: false },
] as const

describe.each(variants)("$name measured native surface", ({ name, Component, arrow }) => {
  const setup = (initial: TNativeTooltipProps = {}, body: ReactNode = "Description") => {
    const root = createRef<View>(),
      host = createRef<View>()
    const onOpenChange = jest.fn(),
      background = jest.fn()
    let trigger: TNativeTooltipTriggerRenderState
    const node = (props = initial, mode: "light" | "dark" = "light") => (
      <NativeThemeProvider mode={mode}>
        <NativeFloatingLayerHost ref={host} testID="host">
          <Button onPress={background}>Background action</Button>
          <NativeTooltipTrigger
            isOpen
            onOpenChange={onOpenChange}
            trigger={(state) => {
              trigger = state
              return <Button {...state.triggerProps}>Trigger</Button>
            }}
          >
            <Component {...props} ref={root}>
              {body}
            </Component>
          </NativeTooltipTrigger>
        </NativeFloatingLayerHost>
      </NativeThemeProvider>
    )
    const ready = async (withArrow = initial.showOverlayArrow ?? arrow, arrowWidth = 10) => {
      measure(host.current!, [0, 0, 300, 400])
      measure(trigger!.triggerRef.current!, [100, 200, 40, 20])
      measure(root.current!, [0, 0, 100, 80])
      nativeFocus(root.current!)
      nativeFocus(trigger!.triggerRef.current!)
      if (withArrow)
        await fireEvent(screen.getByTestId(`${name}-overlay-arrow`, hidden), "layout", layout(arrowWidth, 10))
      await fireEvent(screen.getByTestId("host"), "layout", layout(300, 400))
    }
    return { node, ready, root, host, onOpenChange, background, trigger: () => trigger! }
  }

  it("uses top placement with zero base offset and the actual forwarded native ref", async () => {
    const onLayout = jest.fn()
    const f = setup({ onLayout })
    await render(f.node())
    await f.ready()
    expect(f.root.current?.measureInWindow).toEqual(expect.any(Function))
    expect(screen.getByTestId(name, hidden)).toHaveStyle({
      bottom: 200,
      left: 70,
      marginBottom: 10,
      padding: name === "tooltip" ? 5 : 10,
    })
    expect(screen.getByTestId(name, hidden).props).toMatchObject({
      role: "tooltip",
      accessibilityViewIsModal: false,
      nativeID: f.trigger().tooltipProps.nativeID,
    })
    const event = layout(100, 80)
    await fireEvent(screen.getByTestId(name, hidden), "layout", event)
    expect(onLayout).toHaveBeenCalledWith(event)
    expect(screen.queryByTestId(`${name}-overlay-arrow`, hidden) !== null).toBe(arrow)
    expect(screen.queryByTestId(`${name}-dialog`, hidden)).toBeNull()
  })

  it("keeps background actions available and never takes or restores keyboard focus", async () => {
    const f = setup()
    const result = await render(f.node())
    await f.ready()
    const root = f.root.current!,
      trigger = f.trigger().triggerRef.current!
    await tick()
    await fireEvent.press(screen.getByRole("button", { name: "Background action" }))
    expect(f.background).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("host-background").props.pointerEvents).toBe("box-none")
    expect(root.focus).not.toHaveBeenCalled()
    expect(trigger.focus).not.toHaveBeenCalled()
    await result.rerender(f.node({ isOpen: false }))
    await tick()
    expect(screen.queryByTestId(name, hidden)).toBeNull()
    expect(root.focus).not.toHaveBeenCalled()
    expect(trigger.focus).not.toHaveBeenCalled()
    expect(f.onOpenChange).not.toHaveBeenCalled()
  })

  it("retains caller-controlled empty children and independent vector/root styles through themes", async () => {
    const change = jest.fn()
    const props: TNativeTooltipProps = {
      showOverlayArrow: true,
      color: "red",
      order: "primary",
      width: 0,
      customStyles: { backgroundColor: "blue" },
      style: { padding: 0 },
      customOverlayArrowStyles: { fill: "orange", width: 0 },
    }
    const f = setup(props, <Input accessibilityLabel="Draft" value="" onChange={change} />)
    const result = await render(f.node())
    await f.ready(true, 0)
    expect(screen.getByTestId(name, hidden)).toHaveStyle({ backgroundColor: "blue", width: 0, padding: 0 })
    expect(screen.getByTestId(`${name}-overlay-arrow`, hidden)).toHaveStyle({ width: 0 })
    expect(screen.getByLabelText("Draft", hidden)).toHaveDisplayValue("")
    await result.rerender(f.node(props, "dark"))
    expect(screen.getByLabelText("Draft", hidden)).toHaveDisplayValue("")
    expect(change).not.toHaveBeenCalled()
  })

  it("forwards the original native pointer event and retires pending content close after a reopen", async () => {
    const onPointerEnter = jest.fn(),
      onPointerLeave = jest.fn()
    const f = setup({ onPointerEnter, onPointerLeave })
    const result = await render(f.node())
    await f.ready()
    jest.useFakeTimers()
    try {
      const enter = { nativeEvent: { pointerType: "mouse" } },
        leave = { nativeEvent: { pointerType: "mouse" } }
      await act(() => screen.getByTestId(name, hidden).props.onPointerEnter(enter))
      await act(() => screen.getByTestId(name, hidden).props.onPointerLeave(leave))
      expect(onPointerEnter.mock.calls[0]?.[0]).toBe(enter)
      expect(onPointerLeave.mock.calls[0]?.[0]).toBe(leave)
      await result.rerender(f.node({ isOpen: false }))
      await result.rerender(f.node({ isOpen: true }))
      measure(f.root.current!, [0, 0, 100, 80])
      if (arrow) await fireEvent(screen.getByTestId(`${name}-overlay-arrow`, hidden), "layout", layout(10, 10))
      await fireEvent(screen.getByTestId(name, hidden), "layout", layout(100, 80))
      await act(() => {
        jest.advanceTimersByTime(500)
      })
      expect(f.onOpenChange).not.toHaveBeenCalled()
      expect(screen.getByTestId(name, hidden)).toBeOnTheScreen()
    } finally {
      jest.useRealTimers()
    }
  })

  it("consumes wrapper fields and honors explicit local false over the trigger context", async () => {
    const f = setup({
      showOverlayArrow: !arrow,
      geometry: "orthogonal",
      raised: false,
      order: "secondary",
      customStyles: { margin: 0 },
    })
    const result = await render(f.node())
    await f.ready()
    const props = screen.getByTestId(name, hidden).props
    for (const field of [
      "profile",
      "showOverlayArrow",
      "geometry",
      "raised",
      "order",
      "customStyles",
      "customOverlayArrowStyles",
      "isOpen",
    ])
      expect(props).not.toHaveProperty(field)
    await result.unmount()
    const closed = setup({ defaultOpen: false })
    await render(closed.node())
    expect(screen.queryByTestId(name, hidden)).toBeNull()
    expect(closed.onOpenChange).not.toHaveBeenCalled()
  })

  it("preserves parent modal activation and routes outside dismissal around a mounted description", async () => {
    const hostRef = createRef<View>(),
      parentRoot = createRef<View>(),
      parentAnchor = createRef<View>(),
      description = createRef<View>()
    const action = jest.fn(),
      parentChange = jest.fn(),
      tooltipChange = jest.fn()
    let trigger: TNativeTooltipTriggerRenderState
    let host: ReturnType<typeof useNativeFloatingHost>
    const Probe = () => {
      host = useNativeFloatingHost()
      return null
    }
    await render(
      <NativeFloatingLayerHost ref={hostRef} testID="host">
        <Probe />
        <NativeDialogTrigger
          isOpen
          onOpenChange={parentChange}
          trigger={(state) => (
            <Button
              {...state.triggerProps}
              ref={(node) => {
                state.triggerRef.current = node
                parentAnchor.current = node
              }}
            >
              Parent trigger
            </Button>
          )}
        >
          <ClickPopover ref={parentRoot}>
            <NativeTooltipTrigger
              isOpen
              onOpenChange={tooltipChange}
              trigger={(state) => {
                trigger = state
                return (
                  <Button {...state.triggerProps} onPress={action}>
                    Parent action
                  </Button>
                )
              }}
            >
              <Component ref={description}>Nested description</Component>
            </NativeTooltipTrigger>
          </ClickPopover>
        </NativeDialogTrigger>
      </NativeFloatingLayerHost>,
    )
    measure(hostRef.current!, [0, 0, 300, 500])
    measure(parentAnchor.current!, [100, 200, 40, 20])
    measure(parentRoot.current!, [0, 0, 180, 160])
    await fireEvent(screen.getByTestId("host", hidden), "layout", layout(300, 500))
    measure(trigger!.triggerRef.current!, [100, 270, 40, 20])
    measure(description.current!, [0, 0, 100, 80])
    if (arrow) await fireEvent(screen.getByTestId(`${name}-overlay-arrow`, hidden), "layout", layout(10, 10))
    await fireEvent(screen.getByTestId(name, hidden), "layout", layout(100, 80))
    const scope = screen.getByTestId("host", hidden).props
    await act(() =>
      scope.onNativeScopeStatus({
        nativeEvent: {
          ownerId: scope.ownerId,
          windowId: "tooltip-window",
          epoch: 1,
          policyRevision: scope.policyRevision,
          ready: true,
          windowActive: true,
        },
      }),
    )
    const target = screen.getByRole("button", { name: "Parent action", ...hidden })
    await act(() =>
      target.props.onNativeActivation({
        nativeEvent: {
          kind: "activation",
          source: "android-click",
          observedAt: 0,
          target: 17,
          ownerId: target.props.ownerId,
          activationId: 1,
          scopeOwnerId: scope.ownerId,
          windowId: "tooltip-window",
          epoch: 1,
        },
      }),
    )
    expect(action).toHaveBeenCalledTimes(1)
    const order = host!.layers.presentationOrder()
    expect(order).toHaveLength(2)
    expect(host!.layers.captureOutside()?.id).toBe(order[0])
    const touch = () => ({
      nativeEvent: { identifier: "1" },
      target: 17,
      persist: jest.fn(),
      isPropagationStopped: () => false,
    })
    await act(() => screen.getByTestId("host", hidden).props.onTouchStartCapture(touch()))
    await act(() => screen.getByTestId("host", hidden).props.onTouchEndCapture(touch()))
    expect(parentChange.mock.calls).toEqual([[false]])
    expect(tooltipChange).not.toHaveBeenCalled()
    expect(screen.getByTestId("click-popover", hidden)).toBeOnTheScreen()
  })
})
