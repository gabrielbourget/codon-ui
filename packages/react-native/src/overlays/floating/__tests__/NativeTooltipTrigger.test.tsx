import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { View } from "react-native"

import { Button, NativeFloatingLayerHost, Text } from "../../.."
import {
  NativeTooltipTrigger,
  useNativeTooltipTrigger,
  type TNativeTooltipTriggerProps,
  type TNativeTooltipTriggerRenderState,
} from "../NativeTooltipTrigger"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../scope"

type TPointer = Parameters<TNativeTooltipTriggerRenderState["triggerProps"]["onPointerEnter"]>[0]
type TFocus = Parameters<TNativeTooltipTriggerRenderState["triggerProps"]["onFocus"]>[0]
type TPress = Parameters<TNativeTooltipTriggerRenderState["triggerProps"]["onPressIn"]>[0]
const pointer = (pointerType = "mouse") => ({ nativeEvent: { pointerType } }) as unknown as TPointer
const focus = (target = 1, currentTarget = 1, visible = true) =>
  ({ target, currentTarget, nativeEvent: { target, isFocusVisible: visible } }) as unknown as TFocus
const press = () => ({ target: 1, currentTarget: 1, nativeEvent: {} }) as unknown as TPress
const advance = async (milliseconds: number) =>
  act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const Content = () => {
  const state = useNativeTooltipTrigger()!
  return (
    <View {...state.tooltipProps} testID="description">
      <Text testID="state">{String(state.isOpen)}</Text>
    </View>
  )
}
const setup = (initial: Partial<TNativeTooltipTriggerProps> = {}) => {
  let state: TNativeTooltipTriggerRenderState
  let active = true
  let windowReady = true
  const action = jest.fn()
  const onOpenChange = jest.fn()
  const node = (props = initial, key = "trigger") => (
    <NativeFloatingLayerHost>
      <NativeFloatingWindowContext.Provider value={() => windowReady}>
        <NativeFloatingScopeContext.Provider value={{ id: null, canAct: () => active }}>
          <NativeTooltipTrigger
            key={key}
            onOpenChange={onOpenChange}
            {...props}
            trigger={(value) => {
              state = value
              return (
                <Button {...value.triggerProps} onPress={action}>
                  Action
                </Button>
              )
            }}
          >
            <Content />
          </NativeTooltipTrigger>
        </NativeFloatingScopeContext.Provider>
      </NativeFloatingWindowContext.Provider>
    </NativeFloatingLayerHost>
  )
  return {
    node,
    state: () => state!,
    action,
    onOpenChange,
    active: (value: boolean) => {
      active = value
    },
    windowReady: (value: boolean) => {
      windowReady = value
    },
  }
}

it("binds an actual native trigger ref and distinct stable trigger/description identities", async () => {
  const f = setup()
  const result = await render(f.node())
  const identity = f.state().tooltipProps.nativeID
  expect(f.state().triggerRef.current?.measureInWindow).toEqual(expect.any(Function))
  expect(f.state().triggerProps.nativeID).not.toBe(identity)
  expect(screen.getByTestId("description").props.nativeID).toBe(identity)
  await result.rerender(f.node({ isDisabled: true }))
  expect(f.state().tooltipProps.nativeID).toBe(identity)
  expect(f.state().triggerProps).not.toHaveProperty("isDisabled")
  expect(screen.getByRole("button")).toBeEnabled()
})

it("ignores touch and keeps a duplicate hover notification from restarting cold timing", async () => {
  const f = setup()
  await render(f.node())
  await act(() => f.state().triggerProps.onPointerEnter(pointer("touch")))
  await advance(1500)
  expect(f.onOpenChange).not.toHaveBeenCalled()
  await act(() => f.state().triggerProps.onPointerEnter(pointer()))
  await advance(500)
  await act(() => f.state().triggerProps.onPointerEnter(pointer()))
  await advance(1000)
  expect(f.onOpenChange.mock.calls).toEqual([[true]])
  expect(screen.getByTestId("state")).toHaveTextContent("true")
})

it("preserves declined controlled false and current callbacks across distinct hover entries", async () => {
  const f = setup({ isOpen: false, delay: 0 })
  const result = await render(f.node())
  await act(() => f.state().triggerProps.onPointerEnter(pointer()))
  expect(f.state().isOpen).toBe(false)
  expect(f.onOpenChange.mock.calls).toEqual([[true]])
  const latest = jest.fn()
  const leave = f.state().triggerProps.onPointerLeave
  await result.rerender(f.node({ isOpen: false, delay: 0, onOpenChange: latest }))
  await act(() => leave(pointer()))
  await act(() => f.state().triggerProps.onPointerEnter(pointer("pen")))
  expect(latest.mock.calls).toEqual([[true]])
  expect(f.state().isOpen).toBe(false)
})

it("opens immediately for direct native focus in focus-only mode and ignores descendant focus", async () => {
  const f = setup({ triggerMode: "focus" })
  await render(f.node())
  await act(() => f.state().triggerProps.onPointerEnter(pointer()))
  await advance(1500)
  await act(() => f.state().triggerProps.onFocus(focus(2, 1)))
  expect(f.onOpenChange).not.toHaveBeenCalled()
  await act(() => f.state().triggerProps.onFocus(focus()))
  expect(f.onOpenChange.mock.calls).toEqual([[true]])
  await act(() => f.state().triggerProps.onBlur(focus()))
  expect(f.onOpenChange.mock.calls).toEqual([[true], [false]])
})

it("opens only for genuine visible native focus, preserving pointer/unknown focus and the underlying action", async () => {
  const f = setup({ triggerMode: "focus" })
  await render(f.node())
  await act(() => f.state().triggerProps.onFocus(focus(1, 1, false)))
  await act(() =>
    f.state().triggerProps.onFocus({ target: 1, currentTarget: 1, nativeEvent: { target: 1 } } as unknown as TFocus),
  )
  expect(f.onOpenChange).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("button", { name: "Action" }))
  expect(f.action).toHaveBeenCalledTimes(1)
  await act(() => f.state().triggerProps.onFocus(focus()))
  expect(f.onOpenChange.mock.calls).toEqual([[true]])
})

it("admits an ordinary native focus event only with observed keyboard input from its current window", async () => {
  const f = setup({ triggerMode: "focus" })
  await render(f.node())
  const host = () => screen.getByTestId("native-floating-layer-host").props
  const status = (ready: boolean) => {
    const props = host()
    props.onNativeScopeStatus({
      nativeEvent: {
        ownerId: props.ownerId,
        windowId: "native",
        epoch: 1,
        policyRevision: props.policyRevision,
        ready,
        windowActive: true,
      },
    })
  }
  await act(() => status(false))
  await act(() => status(true))
  const input = (origin: "keyboard" | "pointer", timestamp: number) => {
    const props = host()
    props.onNativeInputModality({
      nativeEvent: {
        ownerId: props.ownerId,
        windowId: props.acceptedWindowId,
        epoch: props.acceptedEpoch,
        origin,
        timestamp,
      },
    })
  }
  const ordinary = { target: 1, currentTarget: 1, nativeEvent: { target: 1 } } as unknown as TFocus
  await act(() => input("keyboard", 0))
  await act(() => f.state().triggerProps.onFocus(ordinary))
  expect(f.onOpenChange.mock.calls).toEqual([[true]])
  await act(() => f.state().triggerProps.onBlur(focus()))
  await act(() => input("pointer", 1))
  await act(() => f.state().triggerProps.onFocus(ordinary))
  expect(f.onOpenChange.mock.calls).toEqual([[true], [false]])
})

it("keeps the underlying action enabled while tooltip disablement guards native opening", async () => {
  const f = setup({ isDisabled: true, delay: 0 })
  await render(f.node())
  await act(() => {
    f.state().triggerProps.onPointerEnter(pointer())
    f.state().triggerProps.onFocus(focus())
  })
  await advance(1500)
  await fireEvent.press(screen.getByRole("button", { name: "Action" }))
  expect(f.action).toHaveBeenCalledTimes(1)
  expect(f.onOpenChange).not.toHaveBeenCalled()
  await act(() => f.state().open(true))
  expect(f.state().isOpen).toBe(true)
})

it("requests immediate press-start closure while preserving a declined owner and the action", async () => {
  const f = setup({ isOpen: true })
  const result = await render(f.node())
  await act(() => f.state().triggerProps.onPressIn(press()))
  expect(f.onOpenChange.mock.calls).toEqual([[false]])
  expect(f.state().isOpen).toBe(true)
  await fireEvent.press(screen.getByRole("button", { name: "Action" }))
  expect(f.action).toHaveBeenCalledTimes(1)
  await result.rerender(f.node({ isOpen: true, shouldCloseOnPress: false }))
  await act(() => f.state().triggerProps.onPressIn(press()))
  expect(f.onOpenChange).toHaveBeenCalledTimes(1)
})

it("keeps content hover alive across the trigger-to-content gap and closes after leaving it", async () => {
  const f = setup({ delay: 0 })
  await render(f.node())
  await act(() => f.state().triggerProps.onPointerEnter(pointer()))
  await act(() => f.state().triggerProps.onPointerLeave(pointer()))
  await advance(250)
  await act(() => screen.getByTestId("description").props.onPointerEnter(pointer()))
  await advance(500)
  expect(f.state().isOpen).toBe(true)
  expect(f.onOpenChange.mock.calls).toEqual([[true]])
  await act(() => screen.getByTestId("description").props.onPointerLeave(pointer()))
  await advance(500)
  expect(f.state().isOpen).toBe(false)
  expect(f.onOpenChange.mock.calls).toEqual([[true], [false]])
})

it("preserves the source virtual-activation distinction and deduplicates a shared native touch start", async () => {
  const f = setup({ isOpen: true })
  await render(f.node())
  const host = screen.getByTestId("native-floating-layer-host").props
  await act(() =>
    host.onNativeScopeStatus({
      nativeEvent: {
        ownerId: host.ownerId,
        windowId: "activation",
        epoch: 1,
        policyRevision: host.policyRevision,
        ready: true,
        windowActive: true,
      },
    }),
  )
  const action = screen.getByRole("button", { name: "Action" })
  await act(() =>
    action.props.onNativeActivation({
      nativeEvent: {
        kind: "activation",
        source: "android-click",
        ownerId: action.props.ownerId,
        target: 17,
        observedAt: 0,
        activationId: 1,
        scopeOwnerId: host.ownerId,
        windowId: "activation",
        epoch: 1,
      },
    }),
  )
  expect(f.onOpenChange).not.toHaveBeenCalled()
  expect(f.action).toHaveBeenCalledTimes(1)
  const touch = press()
  await act(() => {
    f.state().triggerProps.onPressStart(touch)
    f.state().triggerProps.onPressIn(touch)
  })
  expect(f.onOpenChange.mock.calls).toEqual([[false]])
})

it("rechecks current window and parent eligibility for pending native opens and closes", async () => {
  const f = setup({ isOpen: false })
  const result = await render(f.node())
  await act(() => f.state().triggerProps.onPointerEnter(pointer()))
  f.windowReady(false)
  await advance(1500)
  expect(f.onOpenChange).not.toHaveBeenCalled()
  await act(() => f.state().triggerProps.onPointerLeave(pointer()))
  f.windowReady(true)
  await result.rerender(f.node({ isOpen: true }))
  await act(() => f.state().triggerProps.onPointerEnter(pointer()))
  await act(() => f.state().triggerProps.onPointerLeave(pointer()))
  f.active(false)
  await advance(500)
  expect(f.onOpenChange).not.toHaveBeenCalled()
  await act(() => f.state().close(true))
  expect(f.onOpenChange.mock.calls).toEqual([[false]])
})

it("retires a pending native hover open when the physical window becomes inactive", async () => {
  const f = setup()
  await render(f.node())
  await act(() => f.state().triggerProps.onPointerEnter(pointer()))
  const props = screen.getByTestId("native-floating-layer-host").props
  await act(() =>
    props.onNativeScopeStatus({
      nativeEvent: {
        ownerId: props.ownerId,
        windowId: "native",
        epoch: 1,
        policyRevision: props.policyRevision,
        ready: false,
        windowActive: false,
      },
    }),
  )
  await advance(1500)
  expect(f.onOpenChange).not.toHaveBeenCalled()
})

it("retires retained native handlers, timers and explicit actions on replacement and unmount", async () => {
  const f = setup()
  const result = await render(f.node())
  const old = f.state()
  await act(() => old.triggerProps.onPointerEnter(pointer()))
  await result.rerender(f.node({}, "replacement"))
  expect(f.state().tooltipProps.nativeID).not.toBe(old.tooltipProps.nativeID)
  await act(() => {
    old.triggerProps.onFocus(focus())
    old.open(true)
    old.close(true)
  })
  await advance(1500)
  expect(f.onOpenChange).not.toHaveBeenCalled()
  const current = f.state()
  await result.unmount()
  await act(() => {
    current.triggerProps.onFocus(focus())
    current.open(true)
  })
  expect(f.onOpenChange).not.toHaveBeenCalled()
})
