import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { expect, it, vi } from "vitest"

import Checkbox from "../../../../packages/react/src/components/Checkbox/Checkbox"
import CheckboxGroup from "../../../../packages/react/src/components/CheckboxGroup/CheckboxGroup"
import Radio from "../../../../packages/react/src/components/Radio/Radio"
import RadioGroup from "../../../../packages/react/src/components/RadioGroup/RadioGroup"

it("retains the last declined standalone checkbox request when the owner hands back control", async () => {
  const request = vi.fn()
  const view = render(
    <Checkbox isSelected={false} onChange={request}>
      Choice
    </Checkbox>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole("checkbox"))
  await user.click(screen.getByRole("checkbox"))
  expect(request.mock.calls).toEqual([[true], [true]])
  expect(screen.getByRole("checkbox")).not.toBeChecked()
  await view.rerender(<Checkbox onChange={request}>Choice</Checkbox>)
  expect(screen.getByRole("checkbox")).toBeChecked()
  expect(request).toHaveBeenCalledTimes(2)
})
it("retains the last declined group checkbox request when the owner hands back control", async () => {
  const request = vi.fn()
  const children = (
    <>
      <Checkbox value="one">One</Checkbox>
      <Checkbox value="two">Two</Checkbox>
    </>
  )
  const view = render(
    <CheckboxGroup value={["one"]} onChange={request} aria-label="Choices">
      {children}
    </CheckboxGroup>,
  )
  await userEvent.setup().click(screen.getByRole("checkbox", { name: "Two" }))
  expect(request.mock.calls).toEqual([[["one", "two"]]])
  expect(screen.getByRole("checkbox", { name: "Two" })).not.toBeChecked()
  await view.rerender(
    <CheckboxGroup onChange={request} aria-label="Choices">
      {children}
    </CheckboxGroup>,
  )
  expect(screen.getByRole("checkbox", { name: "One" })).toBeChecked()
  expect(screen.getByRole("checkbox", { name: "Two" })).toBeChecked()
  expect(request).toHaveBeenCalledTimes(1)
})
it("retains the last declined radio request when the owner hands back control", async () => {
  const request = vi.fn()
  const children = (
    <>
      <Radio value="one">One</Radio>
      <Radio value="two">Two</Radio>
    </>
  )
  const view = render(
    <RadioGroup value="one" onChange={request} aria-label="Choices">
      {children}
    </RadioGroup>,
  )
  await userEvent.setup().click(screen.getByRole("radio", { name: "Two" }))
  expect(request.mock.calls).toEqual([["two"]])
  expect(screen.getByRole("radio", { name: "One" })).toBeChecked()
  await view.rerender(
    <RadioGroup onChange={request} aria-label="Choices">
      {children}
    </RadioGroup>,
  )
  expect(screen.getByRole("radio", { name: "Two" })).toBeChecked()
  expect(request).toHaveBeenCalledTimes(1)
})
