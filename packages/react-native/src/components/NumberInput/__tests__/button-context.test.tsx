import { render, screen, userEvent } from "@testing-library/react-native"
import { createRef } from "react"
import type { View } from "react-native"

import { Button, NativeButtonContext, NumberInput, Stepper } from "../../.."

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
const names = { accessibilityLabel: "Quantity", incrementLabel: "Add quantity", decrementLabel: "Reduce quantity" }
it.each([
  ["number-input", NumberInput],
  ["stepper", Stepper],
] as const)("%s scopes its buttons away from foreign pending/action/ref defaults", async (identity, Component) => {
  const foreignRef = createRef<View>(),
    plainRef = createRef<View>()
  const foreign = jest.fn(),
    change = jest.fn()
  const view = await render(
    <NativeButtonContext.Provider value={{ isPending: true, onPress: foreign, ref: foreignRef }}>
      <Component {...names} defaultValue={2} onChange={change} />
      <Button ref={plainRef} aria-label="Plain">
        Plain
      </Button>
    </NativeButtonContext.Provider>,
  )
  expect(foreignRef.current).toBe(plainRef.current)
  expect(screen.getByRole("button", { name: "Plain" }).props.accessibilityState.busy).toBe(true)
  const increment = screen.getByRole("button", { name: names.incrementLabel })
  const decrement = screen.getByRole("button", { name: names.decrementLabel })
  expect(increment.props.accessibilityState.busy).toBe(false)
  const user = userEvent.setup()
  await user.press(increment)
  expect(screen.getByTestId(`${identity}-input`)).toHaveDisplayValue("3")
  await user.press(decrement)
  expect(screen.getByTestId(`${identity}-input`)).toHaveDisplayValue("2")
  expect(change.mock.calls).toEqual([[3], [2]])
  expect(foreign).not.toHaveBeenCalled()
  await view.unmount()
  expect(foreignRef.current).toBeNull()
})
it.each([
  ["number-input", NumberInput],
  ["stepper", Stepper],
] as const)("%s does not require a slot from an unrelated button provider", async (_, Component) => {
  const foreign = jest.fn(),
    change = jest.fn()
  await render(
    <NativeButtonContext.Provider value={{ slots: { action: { onPress: foreign } } }}>
      <Component {...names} defaultValue={2} onChange={change} />
      <Button slot="action" aria-label="Plain">
        Plain
      </Button>
    </NativeButtonContext.Provider>,
  )
  await userEvent.setup().press(screen.getByRole("button", { name: names.incrementLabel }))
  expect(change.mock.calls).toEqual([[3]])
  expect(foreign).not.toHaveBeenCalled()
  await userEvent.setup().press(screen.getByRole("button", { name: "Plain" }))
  expect(foreign).toHaveBeenCalledTimes(1)
})
