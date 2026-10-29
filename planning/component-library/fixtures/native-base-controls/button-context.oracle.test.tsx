import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { createRef } from "react"
import { ButtonContext } from "react-aria-components"
import { expect, it, vi } from "vitest"

import Button from "../../../../packages/react/src/components/Button/Button"
import ToggleButton from "../../../../packages/react/src/components/ToggleButton/ToggleButton"

it("isolates toggle actions, pending state and refs from foreign button defaults", async () => {
  const inherited = createRef<HTMLButtonElement>(),
    plain = createRef<HTMLButtonElement>(),
    toggle = createRef<HTMLButtonElement>()
  const foreign = vi.fn(),
    change = vi.fn(),
    ownPress = vi.fn()
  const example = (pending: boolean, shown = true) => (
    <ButtonContext.Provider value={{ ref: inherited, isPending: pending, onPress: foreign }}>
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
    </ButtonContext.Provider>
  )
  const view = render(example(true))
  const original = toggle.current
  expect(original).not.toBeNull()
  expect(inherited.current).toBe(plain.current)
  expect(inherited.current).not.toBe(original)
  expect(screen.getByRole("button", { name: "Plain" })).toHaveAttribute("data-pending", "true")
  expect(screen.getByRole("button", { name: "Toggle" })).not.toHaveAttribute("aria-busy", "true")
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Toggle" }))
  expect(change.mock.calls).toEqual([[true]])
  expect(ownPress).toHaveBeenCalledTimes(1)
  expect(foreign).not.toHaveBeenCalled()
  await view.rerender(example(false))
  expect(toggle.current).toBe(original)
  await user.click(screen.getByRole("button", { name: "Toggle" }))
  expect(change.mock.calls).toEqual([[true], [true]])
  expect(foreign).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "Plain" }))
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
  const foreign = vi.fn(),
    change = vi.fn()
  render(
    <ButtonContext.Provider value={{ slots: { action: { onPress: foreign } } }}>
      <ToggleButton aria-label="Toggle" onChange={change}>
        Toggle
      </ToggleButton>
      <Button slot="action" aria-label="Plain">
        Plain
      </Button>
    </ButtonContext.Provider>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Toggle" }))
  expect(change.mock.calls).toEqual([[true]])
  expect(foreign).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "Plain" }))
  expect(foreign).toHaveBeenCalledTimes(1)
})
