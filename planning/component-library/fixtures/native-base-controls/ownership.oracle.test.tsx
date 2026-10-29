import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { afterAll, beforeAll, expect, it, vi } from "vitest"

import Checkbox from "../../../../packages/react/src/components/Checkbox/Checkbox"
import CheckboxGroup from "../../../../packages/react/src/components/CheckboxGroup/CheckboxGroup"
import ListBoxItem from "../../../../packages/react/src/components/ListBoxItem/ListBoxItem"
import Radio from "../../../../packages/react/src/components/Radio/Radio"
import RadioGroup from "../../../../packages/react/src/components/RadioGroup/RadioGroup"
import Select from "../../../../packages/react/src/components/Select/Select"
import ToggleButton from "../../../../packages/react/src/components/ToggleButton/ToggleButton"

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

it("retains the pinned toggle hidden default while controlled false remains authoritative", async () => {
  const request = vi.fn()
  const view = render(
    <ToggleButton isSelected={false} defaultSelected onChange={request}>
      Choice
    </ToggleButton>,
  )
  expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false")
  await view.rerender(
    <ToggleButton defaultSelected onChange={request}>
      Choice
    </ToggleButton>,
  )
  expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true")
  expect(request).not.toHaveBeenCalled()
})
const items = [
  { id: "one", name: "One" },
  { id: "two", name: "Two" },
]
const children = (item: (typeof items)[number]) => (
  <ListBoxItem id={item.id} textValue={item.name}>
    {item.name}
  </ListBoxItem>
)
it("retains the initial controlled select value when control is removed without a selection request", async () => {
  const request = vi.fn()
  const view = render(
    <Select aria-label="Choices" items={items} value="one" defaultValue="two" onChange={request}>
      {children}
    </Select>,
  )
  expect(screen.getByTestId("select-value")).toHaveTextContent("One")
  await view.rerender(
    <Select aria-label="Choices" items={items} defaultValue="two" onChange={request}>
      {children}
    </Select>,
  )
  expect(screen.getByTestId("select-value")).toHaveTextContent("One")
  expect(request).not.toHaveBeenCalled()
})

const animations = Object.getOwnPropertyDescriptor(Element.prototype, "getAnimations")
beforeAll(() => Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] }))
afterAll(() => {
  if (animations) Object.defineProperty(Element.prototype, "getAnimations", animations)
  else Reflect.deleteProperty(Element.prototype, "getAnimations")
})
const zeroItems = [
  { id: 0, name: "Numeric zero" },
  { id: "0", name: "String zero" },
]
const zeroChildren = (item: (typeof zeroItems)[number]) => (
  <ListBoxItem id={item.id} textValue={item.name}>
    {item.name}
  </ListBoxItem>
)
it("retains the declined Select value when value control is removed", async () => {
  const request = vi.fn()
  const view = render(
    <Select aria-label="Choices" items={zeroItems} value={0} isOpen onChange={request}>
      {zeroChildren}
    </Select>,
  )
  await userEvent.setup().click(screen.getByRole("option", { name: "String zero" }))
  expect(request.mock.calls).toEqual([["0"]])
  expect(screen.getByTestId("select-value")).toHaveTextContent("Numeric zero")
  await view.rerender(
    <Select aria-label="Choices" items={zeroItems} isOpen onChange={request}>
      {zeroChildren}
    </Select>,
  )
  expect(screen.getByTestId("select-value")).toHaveTextContent("String zero")
  expect(request).toHaveBeenCalledTimes(1)
})
it("retains the declined Select close when open control is removed", async () => {
  const request = vi.fn()
  const view = render(
    <Select aria-label="Choices" items={items} value="one" isOpen defaultOpen onOpenChange={request}>
      {children}
    </Select>,
  )
  await userEvent.setup().click(screen.getByRole("option", { name: "One" }))
  expect(request.mock.calls).toEqual([[false]])
  expect(screen.getByRole("option", { name: "One" })).toBeInTheDocument()
  await view.rerender(
    <Select aria-label="Choices" items={items} value="one" defaultOpen onOpenChange={request}>
      {children}
    </Select>,
  )
  expect(screen.queryByRole("option")).toBeNull()
  expect(request).toHaveBeenCalledTimes(1)
})
