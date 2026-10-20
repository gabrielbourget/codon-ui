import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import type { View } from "react-native"

import { NATIVE_DEFAULT_SLOT } from "../../../collection/context"
import { Button } from "../Button"
import { NativeButtonContext } from "../context"

it("merges slot defaults with caller precedence and forwards the same event and actual refs", async () => {
  const inheritedRef = createRef<View>(),
    callerRef = createRef<View>()
  const seen: unknown[] = []
  const view = await render(
    <NativeButtonContext.Provider
      value={{
        slots: {
          action: {
            ref: inheritedRef,
            accessibilityLabel: "Inherited",
            isDisabled: true,
            onPress: (event) => seen.push(event),
            style: { padding: 11, backgroundColor: "red" },
          },
        },
      }}
    >
      <Button
        slot="action"
        ref={callerRef}
        accessibilityLabel="Caller"
        isDisabled={false}
        onPress={(event) => seen.push(event)}
        style={{ padding: 3 }}
      >
        Action
      </Button>
    </NativeButtonContext.Provider>,
  )
  const button = screen.getByRole("button", { name: "Caller" })
  expect(button.props.slot).toBeUndefined()
  expect(button).toHaveStyle({ padding: 3, backgroundColor: "red" })
  expect(callerRef.current).not.toBeNull()
  expect(callerRef.current).toBe(inheritedRef.current)
  const event = {
    target: 17,
    currentTarget: 17,
    persist: jest.fn(),
    preventDefault: jest.fn(),
    isDefaultPrevented: () => false,
    nativeEvent: { target: 17, timestamp: 100, identifier: 1, pageX: 10, pageY: 20, locationX: 0, locationY: 0 },
  }
  await act(() => button.props.onResponderGrant(event))
  await act(() => button.props.onResponderRelease(event))
  expect(seen).toEqual([event, event])
  expect(seen[0]).toBe(event)
  expect(seen[1]).toBe(event)
  await view.unmount()
  expect(callerRef.current).toBeNull()
  expect(inheritedRef.current).toBeNull()
})

it("keeps default and null slots distinct", async () => {
  await render(
    <NativeButtonContext.Provider
      value={{ slots: { [NATIVE_DEFAULT_SLOT]: { accessibilityLabel: "Default", isDisabled: true } } }}
    >
      <Button testID="inherited">Inherited</Button>
      <Button slot={null} testID="independent">
        Independent
      </Button>
    </NativeButtonContext.Provider>,
  )
  expect(screen.getByTestId("inherited").props.accessibilityLabel).toBe("Default")
  expect(screen.getByTestId("inherited").props.accessibilityState.disabled).toBe(true)
  expect(screen.getByTestId("independent").props.accessibilityLabel).toBeUndefined()
  expect(screen.getByTestId("independent").props.accessibilityState.disabled).toBe(false)
})

it("rejects a missing slot rather than silently binding an unrelated button", async () => {
  await expect(
    render(
      <NativeButtonContext.Provider value={{ slots: { remove: {} } }}>
        <Button>Unslotted</Button>
      </NativeButtonContext.Provider>,
    ),
  ).rejects.toThrow("A slot prop is required")
})
