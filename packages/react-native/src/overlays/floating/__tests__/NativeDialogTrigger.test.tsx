import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { Pressable, type GestureResponderEvent } from "react-native"

import { Button } from "../../../components/Button/Button"
import { Text } from "../../../components/Text/Text"
import {
  NativeDialogTrigger,
  type TNativeDialogTriggerProps,
  type TNativeDialogTriggerRenderState,
} from "../NativeDialogTrigger"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../scope"

const trigger = ({ triggerProps }: TNativeDialogTriggerRenderState) => <Button {...triggerProps}>Open</Button>
const children = ({ isOpen }: TNativeDialogTriggerRenderState) => <Text testID="state">{String(isOpen)}</Text>
const fixture = (props: Partial<TNativeDialogTriggerProps> = {}) => (
  <NativeDialogTrigger trigger={trigger} {...props}>
    {children}
  </NativeDialogTrigger>
)

it("preserves controlled false and repeated declined native requests", async () => {
  const onOpenChange = jest.fn()
  await render(fixture({ isOpen: false, defaultOpen: true, onOpenChange }))
  await fireEvent.press(screen.getByRole("button", { name: "Open" }))
  await fireEvent.press(screen.getByRole("button", { name: "Open" }))
  expect(onOpenChange.mock.calls).toEqual([[true], [true]])
  expect(screen.getByTestId("state")).toHaveTextContent("false")
  expect(screen.getByRole("button").props.accessibilityState.expanded).toBe(false)
})

it("preserves controlled true when a close is declined", async () => {
  const onOpenChange = jest.fn()
  await render(fixture({ isOpen: true, onOpenChange }))
  await fireEvent.press(screen.getByRole("button"))
  expect(onOpenChange).toHaveBeenCalledWith(false)
  expect(screen.getByTestId("state")).toHaveTextContent("true")
  expect(screen.getByRole("button").props.accessibilityState.expanded).toBe(true)
})

it("reads defaultOpen only at mount and owns subsequent uncontrolled changes", async () => {
  const onOpenChange = jest.fn()
  const result = await render(fixture({ defaultOpen: true, onOpenChange }))
  await result.rerender(fixture({ defaultOpen: false, onOpenChange }))
  expect(screen.getByTestId("state")).toHaveTextContent("true")
  await fireEvent.press(screen.getByRole("button"))
  expect(screen.getByTestId("state")).toHaveTextContent("false")
  expect(onOpenChange.mock.calls).toEqual([[false]])
})

it("provides an actual View ref and preserves the original native trigger event", async () => {
  const onPress = jest.fn()
  let state: TNativeDialogTriggerRenderState | undefined
  await render(
    fixture({
      trigger: (value) => {
        state = value
        return (
          <Button
            {...value.triggerProps}
            onPress={(event) => {
              onPress(event)
              value.triggerProps.onPress(event)
            }}
          >
            Open
          </Button>
        )
      },
    }),
  )
  expect(state?.triggerRef.current?.measureInWindow).toEqual(expect.any(Function))
  const target = screen.getByRole("button")
  const event = {
    nativeEvent: {
      kind: "activation",
      source: "android-click",
      observedAt: 0,
      ownerId: target.props.ownerId,
      target: 17,
      activationId: 1,
      scopeOwnerId: "",
      windowId: "dialog-window",
      epoch: 0,
    },
  }
  await act(() => target.props.onNativeActivation(event))
  expect(onPress.mock.calls[0]?.[0]).toBe(event)
  expect(screen.getByTestId("state")).toHaveTextContent("true")
})

it("allows explicit bindings to core Pressable without rewriting authored children", async () => {
  const authored = <Text testID="authored">Caller-owned content</Text>
  await render(
    fixture({
      trigger: ({ triggerProps, triggerRef, isDisabled }) => (
        <Pressable
          ref={triggerRef}
          accessibilityRole="button"
          accessibilityLabel="Core trigger"
          accessibilityState={triggerProps.accessibilityState}
          disabled={isDisabled}
          onPress={triggerProps.onPress}
        >
          {authored}
        </Pressable>
      ),
    }),
  )
  await fireEvent.press(screen.getByRole("button", { name: "Core trigger" }))
  expect(screen.getByTestId("state")).toHaveTextContent("true")
  expect(screen.getByTestId("authored")).toHaveTextContent("Caller-owned content")
})

it("guards disabled native activation while keeping explicit owner actions available", async () => {
  let state: TNativeDialogTriggerRenderState | undefined
  const onOpenChange = jest.fn()
  await render(
    fixture({
      isDisabled: true,
      onOpenChange,
      trigger: (value) => {
        state = value
        return trigger(value)
      },
    }),
  )
  expect(screen.getByRole("button")).toBeDisabled()
  await fireEvent.press(screen.getByRole("button"))
  await act(() => state!.triggerProps.onPress({ nativeEvent: {} } as GestureResponderEvent))
  expect(onOpenChange).not.toHaveBeenCalled()
  await act(() => state!.open())
  expect(onOpenChange).toHaveBeenCalledWith(true)
})

it("checks current scope eligibility at native delivery without changing programmatic ownership", async () => {
  let eligible = false
  let state: TNativeDialogTriggerRenderState | undefined
  const onOpenChange = jest.fn()
  await render(
    <NativeFloatingScopeContext.Provider value={{ id: "parent", canAct: () => eligible }}>
      {fixture({
        onOpenChange,
        trigger: (value) => {
          state = value
          return trigger(value)
        },
      })}
    </NativeFloatingScopeContext.Provider>,
  )
  await fireEvent.press(screen.getByRole("button"))
  expect(onOpenChange).not.toHaveBeenCalled()
  eligible = true
  await fireEvent.press(screen.getByRole("button"))
  expect(onOpenChange).toHaveBeenCalledWith(true)
  eligible = false
  await act(() => state!.close())
  expect(onOpenChange.mock.calls).toEqual([[true], [false]])
})

it("uses current props/callbacks even when an earlier native handler was retained", async () => {
  let state: TNativeDialogTriggerRenderState | undefined
  const first = jest.fn()
  const next = jest.fn()
  const renderTrigger = (value: TNativeDialogTriggerRenderState) => {
    state = value
    return trigger(value)
  }
  const result = await render(fixture({ isOpen: false, onOpenChange: first, trigger: renderTrigger }))
  const retained = state!.triggerProps.onPress
  await result.rerender(fixture({ isOpen: true, onOpenChange: next, trigger: renderTrigger }))
  await act(() => retained({ nativeEvent: {} } as GestureResponderEvent))
  expect(first).not.toHaveBeenCalled()
  expect(next).toHaveBeenCalledWith(false)
})

it("retires retained handlers and owner actions on keyed replacement and unmount", async () => {
  const states: TNativeDialogTriggerRenderState[] = []
  const onOpenChange = jest.fn()
  const make = (key: string) => (
    <NativeDialogTrigger
      key={key}
      onOpenChange={onOpenChange}
      trigger={(value) => {
        states.push(value)
        return trigger(value)
      }}
    />
  )
  const result = await render(make("first"))
  const old = states[0]!
  await result.rerender(make("replacement"))
  await act(() => {
    old.open()
    old.toggle()
    old.triggerProps.onPress({ nativeEvent: {} } as GestureResponderEvent)
  })
  expect(onOpenChange).not.toHaveBeenCalled()
  const current = states.at(-1)!
  expect(current.triggerProps.nativeID).not.toBe(old.triggerProps.nativeID)
  await result.unmount()
  await act(() => current.open())
  expect(onOpenChange).not.toHaveBeenCalled()
})

it.each([false, true])("rejects a controlled-ownership switch from %s", async (controlled) => {
  const result = await render(fixture({ isOpen: controlled ? false : undefined }))
  await expect(result.rerender(fixture({ isOpen: controlled ? undefined : false }))).rejects.toThrow(
    "changing controlled/uncontrolled ownership",
  )
})

it("checks live native-window eligibility before delivering a retained trigger press", async () => {
  let ready = false
  const onOpenChange = jest.fn()
  await render(
    <NativeFloatingWindowContext.Provider value={() => ready}>
      {fixture({ isOpen: false, onOpenChange })}
    </NativeFloatingWindowContext.Provider>,
  )
  await fireEvent.press(screen.getByRole("button"))
  expect(onOpenChange).not.toHaveBeenCalled()
  ready = true
  await fireEvent.press(screen.getByRole("button"))
  expect(onOpenChange.mock.calls).toEqual([[true]])
  expect(screen.getByTestId("state")).toHaveTextContent("false")
})
