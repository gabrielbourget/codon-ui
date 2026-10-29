import { render, screen, userEvent } from "@testing-library/react-native"
import { createRef } from "react"

import { Button, NativeButtonContext, ToggleButton, type TNativeToggleButtonRef } from "../../.."

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it("isolates toggle actions, pending state and refs from foreign button defaults", async () => {
  const inherited = createRef<TNativeToggleButtonRef>(),
    plain = createRef<TNativeToggleButtonRef>(),
    toggle = createRef<TNativeToggleButtonRef>()
  const foreign = jest.fn(),
    change = jest.fn(),
    ownPress = jest.fn()
  const example = (pending: boolean, shown = true) => (
    <NativeButtonContext.Provider value={{ ref: inherited, isPending: pending, onPress: foreign }}>
      {shown && (
        <ToggleButton
          key="toggle"
          ref={toggle}
          aria-label="Toggle"
          isSelected={false}
          onChange={change}
          onPress={ownPress}
        >
          Toggle
        </ToggleButton>
      )}
      <Button key="plain" ref={plain} aria-label="Plain">
        Plain
      </Button>
    </NativeButtonContext.Provider>
  )
  const view = await render(example(true))
  const original = toggle.current
  expect(original).not.toBeNull()
  expect(inherited.current).toBe(plain.current)
  expect(inherited.current).not.toBe(original)
  expect(screen.getByRole("button", { name: "Plain" }).props.accessibilityState.busy).toBe(true)
  expect(screen.getByRole("button", { name: "Toggle" }).props.accessibilityState.busy).toBe(false)
  const user = userEvent.setup()
  await user.press(screen.getByRole("button", { name: "Toggle" }))
  expect(change.mock.calls).toEqual([[true]])
  expect(ownPress).toHaveBeenCalledTimes(1)
  expect(foreign).not.toHaveBeenCalled()
  await view.rerender(example(false))
  expect(toggle.current).toBe(original)
  await user.press(screen.getByRole("button", { name: "Toggle" }))
  expect(change.mock.calls).toEqual([[true], [true]])
  expect(foreign).not.toHaveBeenCalled()
  await user.press(screen.getByRole("button", { name: "Plain" }))
  expect(foreign).toHaveBeenCalledTimes(1)
  const originalPlain = plain.current
  await view.rerender(example(false, false))
  expect(toggle.current).toBeNull()
  expect(plain.current).toBe(originalPlain)
  expect(inherited.current).toBe(originalPlain)
  await view.unmount()
  expect(inherited.current).toBeNull()
})
it("does not require a foreign button slot to render or activate a toggle", async () => {
  const foreign = jest.fn(),
    change = jest.fn()
  await render(
    <NativeButtonContext.Provider value={{ slots: { action: { onPress: foreign } } }}>
      <ToggleButton aria-label="Toggle" onChange={change}>
        Toggle
      </ToggleButton>
      <Button slot="action" aria-label="Plain">
        Plain
      </Button>
    </NativeButtonContext.Provider>,
  )
  const user = userEvent.setup()
  await user.press(screen.getByRole("button", { name: "Toggle" }))
  expect(change.mock.calls).toEqual([[true]])
  expect(foreign).not.toHaveBeenCalled()
  await user.press(screen.getByRole("button", { name: "Plain" }))
  expect(foreign).toHaveBeenCalledTimes(1)
})
