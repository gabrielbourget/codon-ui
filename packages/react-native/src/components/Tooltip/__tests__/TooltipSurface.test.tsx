import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, type ReactNode } from "react"
import { AccessibilityInfo, TextInput, View } from "react-native"

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

const ReactNative = jest.requireActual<typeof import("react-native")>("react-native")
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

  it("binds the measured description to the actual owned trigger only while ready/open, preserving an empty caption", async () => {
    jest.spyOn(ReactNative, "findNodeHandle").mockReturnValue(91)
    const f = setup({ descriptionLabel: "" })
    await render(f.node())
    const trigger = () => screen.getByRole("button", { name: "Trigger", ...hidden })
    expect(trigger().props.nativeDescriptionTag).toBe(0)
    await f.ready()
    await tick()
    expect(ReactNative.findNodeHandle).toHaveBeenCalledWith(f.root.current)
    expect(trigger().props.nativeDescriptionTag).toBe(91)
    expect(trigger().props.nativeDescriptionLabel).toBe("")
    await screen.rerender(f.node({ isOpen: false, descriptionLabel: "" }))
    expect(trigger().props.nativeDescriptionTag).toBe(0)
  })

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

  it("requests closure on actual ancestor scroll while retaining a declined owner, and ignores internal scroll and foreign windows", async () => {
    jest.spyOn(ReactNative, "findNodeHandle").mockReturnValue(91)
    const f = setup({ shouldUpdatePosition: false })
    const result = await render(f.node())
    await f.ready()
    await tick()
    const acknowledge = screen.getByTestId("host").props
    await act(() =>
      acknowledge.onNativeScopeStatus({
        nativeEvent: {
          ownerId: acknowledge.ownerId,
          windowId: "tooltip-scroll",
          epoch: 1,
          policyRevision: acknowledge.policyRevision,
          ready: true,
          windowActive: true,
        },
      }),
    )
    const props = screen.getByTestId("host").props
    const packet = {
      ownerId: props.ownerId,
      windowId: "tooltip-scroll",
      epoch: 1,
      ...props.floatingTargets[0],
      x: 0,
      y: 0,
      width: 300,
      height: 400,
      scrollRevision: 0,
      revision: 1,
    }
    await act(() => props.onNativeFloatingObservation({ nativeEvent: packet }))
    // Internal content scrolling never changes the anchor-ancestor revision produced by the native observer.
    await act(() => props.onNativeFloatingObservation({ nativeEvent: packet }))
    await act(() =>
      props.onNativeFloatingObservation({
        nativeEvent: { ...packet, windowId: "foreign", revision: 2, scrollRevision: 1 },
      }),
    )
    expect(f.onOpenChange).not.toHaveBeenCalled()
    await act(() => props.onNativeFloatingObservation({ nativeEvent: { ...packet, revision: 2, scrollRevision: 1 } }))
    expect(f.onOpenChange.mock.calls).toEqual([[false]])
    expect(screen.getByTestId(name, hidden)).toBeOnTheScreen()
    await result.rerender(f.node({ isOpen: false }))
    await act(() => props.onNativeFloatingObservation({ nativeEvent: { ...packet, revision: 3, scrollRevision: 2 } }))
    expect(f.onOpenChange).toHaveBeenCalledTimes(1)
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

  it("routes raw View and core editor description leases to actual tags, preserves metadata/values and retires native window loss", async () => {
    const anchor = createRef<View>(),
      editor = createRef<TextInput>(),
      root = createRef<View>(),
      host = createRef<View>()
    const change = jest.fn()
    jest
      .spyOn(ReactNative, "findNodeHandle")
      .mockImplementation((target) =>
        target === anchor.current ? 17 : target === editor.current ? 18 : target === root.current ? 91 : 92,
      )
    const node = (useEditor = false) => (
      <NativeFloatingLayerHost testID="host" ref={host}>
        <View
          ref={anchor}
          testID="generic-anchor"
          accessibilityLabel="Authored label"
          accessibilityHint="Authored hint"
        />
        <TextInput
          ref={editor}
          testID="generic-editor"
          value=""
          onChangeText={change}
          accessibilityLabel="Editor label"
          accessibilityHint="Editor hint"
        />
        <Component
          isOpen
          triggerRef={useEditor ? editor : anchor}
          ref={root}
          showOverlayArrow={false}
          descriptionLabel=""
          aria-labelledby="label-one label-two"
          aria-describedby=""
          aria-details="detail"
          detailsLabel="More information"
        >
          Live description
        </Component>
      </NativeFloatingLayerHost>
    )
    const result = await render(node())
    measure(host.current!, [0, 0, 300, 400])
    measure(anchor.current!, [100, 200, 40, 20])
    measure(editor.current!, [100, 250, 40, 20])
    measure(root.current!, [0, 0, 100, 80])
    await fireEvent(screen.getByTestId("host"), "layout", layout(300, 400))
    await tick()
    const descriptions = () =>
      screen
        .getByTestId("host")
        .props.floatingTargets.filter((target: { descriptionTag: number }) => target.descriptionTag > 0)
    expect(descriptions()).toEqual([
      expect.objectContaining({ targetTag: 17, descriptionTag: 91, descriptionLabel: "" }),
    ])
    expect(screen.getByTestId(name, hidden).props).toMatchObject({
      nativeLabelledBy: ["label-one", "label-two"],
      nativeDescribedBy: [],
      nativeDetailsBy: ["detail"],
      nativeDetailsLabel: "More information",
      keyboardFocusable: false,
    })
    expect(screen.getByTestId("generic-anchor").props).toMatchObject({
      accessibilityLabel: "Authored label",
      accessibilityHint: "Authored hint",
    })
    const retired = descriptions()[0].id
    await result.rerender(node(true))
    await tick()
    expect(descriptions()).toEqual([expect.objectContaining({ targetTag: 18, descriptionTag: 91 })])
    expect(descriptions()[0].id).not.toBe(retired)
    expect(screen.getByTestId("generic-editor")).toHaveDisplayValue("")
    expect(change).not.toHaveBeenCalled()
    const scope = screen.getByTestId("host").props
    await act(() =>
      scope.onNativeScopeStatus({
        nativeEvent: {
          ownerId: scope.ownerId,
          windowId: "inactive-window",
          epoch: 2,
          policyRevision: scope.policyRevision,
          ready: false,
          windowActive: false,
        },
      }),
    )
    expect(descriptions()).toEqual([])
    expect(change).not.toHaveBeenCalled()
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
