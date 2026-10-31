import { render, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { createRef } from "react"
import { ButtonContext } from "react-aria-components"
import { expect, it, vi } from "vitest"

import Button from "../../../../packages/react/src/components/Button/Button"
import NumberInput from "../../../../packages/react/src/components/NumberInput/NumberInput"
import Stepper from "../../../../packages/react/src/components/Stepper/Stepper"

it.each([
  ["NumberInput", NumberInput],
  ["Stepper", Stepper],
] as const)("%s scopes its buttons away from foreign pending/action/ref defaults", async (kind, Component) => {
  const foreignRef = createRef<HTMLButtonElement>(),
    plainRef = createRef<HTMLButtonElement>()
  const foreign = vi.fn(),
    change = vi.fn()
  const view = render(
    <ButtonContext.Provider value={{ isPending: true, onPress: foreign, ref: foreignRef }}>
      <Component data-testid="field" aria-label="Quantity" defaultValue={2} onChange={change} />
      <Button ref={plainRef} aria-label="Plain">
        Plain
      </Button>
    </ButtonContext.Provider>,
  )
  expect(foreignRef.current).toBe(plainRef.current)
  expect(screen.getByRole("button", { name: "Plain" })).toHaveAttribute("data-pending", "true")
  const controls = within(screen.getByTestId("field")).getAllByRole("button")
  expect(controls).toHaveLength(2)
  const increment = kind === "NumberInput" ? controls[0] : controls[1]
  const decrement = kind === "NumberInput" ? controls[1] : controls[0]
  expect(increment).not.toHaveAttribute("data-pending", "true")
  const user = userEvent.setup()
  await user.click(increment)
  expect(screen.getByRole("textbox", { name: "Quantity" })).toHaveValue("3")
  await user.click(decrement)
  expect(screen.getByRole("textbox", { name: "Quantity" })).toHaveValue("2")
  expect(change.mock.calls).toEqual([[3], [2]])
  expect(foreign).not.toHaveBeenCalled()
  await view.unmount()
  expect(foreignRef.current).toBeNull()
})
it.each([
  ["NumberInput", NumberInput],
  ["Stepper", Stepper],
] as const)("%s does not require a slot from an unrelated button provider", async (kind, Component) => {
  const foreign = vi.fn(),
    change = vi.fn()
  render(
    <ButtonContext.Provider value={{ slots: { action: { onPress: foreign } } }}>
      <Component data-testid="field" aria-label="Quantity" defaultValue={2} onChange={change} />
      <Button slot="action" aria-label="Plain">
        Plain
      </Button>
    </ButtonContext.Provider>,
  )
  const controls = within(screen.getByTestId("field")).getAllByRole("button")
  await userEvent.setup().click(kind === "NumberInput" ? controls[0] : controls[1])
  expect(change.mock.calls).toEqual([[3]])
  expect(foreign).not.toHaveBeenCalled()
  await userEvent.setup().click(screen.getByRole("button", { name: "Plain" }))
  expect(foreign).toHaveBeenCalledTimes(1)
})
