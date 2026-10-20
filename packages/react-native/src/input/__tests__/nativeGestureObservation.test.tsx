import { act, render, screen } from "@testing-library/react-native"
import { useLayoutEffect } from "react"
import type { GestureResponderEvent } from "react-native"

import type { TNativeKeyScope } from "../keyScope"
import { dispatchNativeGestureWindow, observeNativeGestureWindow } from "../nativeGestureObservation"
import { NativeKeyboardScope, useNativeKeyScope } from "../NativeKeyboardScope"

it("observes original bubbling native events after caller callbacks without claiming the responder", async () => {
  const order: string[] = [],
    events: unknown[] = []
  const Probe = () => {
    const scope = useNativeKeyScope()
    useLayoutEffect(
      () =>
        observeNativeGestureWindow({
          scope: () => scope,
          current: () => true,
          move: (event) => {
            order.push("observed")
            events.push(event)
          },
          end: (event) => events.push(event),
        }),
      [scope],
    )
    return null
  }
  await render(
    <NativeKeyboardScope testID="scope" captureEnabled onTouchMove={() => order.push("caller")}>
      <Probe />
    </NativeKeyboardScope>,
  )
  const root = () => screen.getByTestId("scope")
  await act(() =>
    root().props.onNativeScopeStatus({
      nativeEvent: {
        ownerId: root().props.ownerId,
        windowId: "window",
        epoch: 1,
        policyRevision: root().props.policyRevision,
        ready: true,
        windowActive: true,
      },
    }),
  )
  const event = { nativeEvent: { identifier: "1", pageX: 1, pageY: 2 } } as GestureResponderEvent
  await act(() => root().props.onTouchMove(event))
  expect(order).toEqual(["caller", "observed"])
  expect(events[0]).toBe(event)
  expect(root().props.onStartShouldSetResponder).toBeUndefined()
  await screen.unmount()
})
it("retires passive registrations and ignores stale or foreign native windows", () => {
  let current = true
  const scope = { acknowledgedSession: () => ({ windowId: "a" }), isWindowActive: () => true } as TNativeKeyScope
  const foreign = { ...scope, acknowledgedSession: () => ({ windowId: "b" }) } as TNativeKeyScope
  const move = jest.fn(),
    end = jest.fn(),
    stop = observeNativeGestureWindow({ scope: () => scope, current: () => current, move, end })
  const event = { nativeEvent: {} } as GestureResponderEvent
  dispatchNativeGestureWindow(foreign, event, "move")
  expect(move).not.toHaveBeenCalled()
  dispatchNativeGestureWindow(scope, event, "cancel")
  expect(end).toHaveBeenCalledWith(event, true)
  current = false
  dispatchNativeGestureWindow(scope, event, "move")
  expect(move).not.toHaveBeenCalled()
  current = true
  stop()
  dispatchNativeGestureWindow(scope, event, "move")
  expect(move).not.toHaveBeenCalled()
})
