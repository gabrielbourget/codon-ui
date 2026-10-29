import { fireEvent, render, screen } from "@testing-library/react-native"

import { Checkbox, CheckboxGroup, Radio, RadioGroup } from "../../.."

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("retains the last declined standalone checkbox request when the owner hands back control", async () => {
  const request = jest.fn()
  const view = await render(<Checkbox isSelected={false} onChange={request} aria-label="Choice" />)
  await fireEvent.press(screen.getByRole("checkbox"), { nativeEvent: { timestamp: 100 } })
  await fireEvent.press(screen.getByRole("checkbox"), { nativeEvent: { timestamp: 101 } })
  expect(request.mock.calls).toEqual([[true], [true]])
  expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe(false)
  await view.rerender(<Checkbox onChange={request} aria-label="Choice" />)
  expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe(true)
  expect(request).toHaveBeenCalledTimes(2)
})
it("retains the last declined group checkbox request when the owner hands back control", async () => {
  const request = jest.fn()
  const children = (
    <>
      <Checkbox value="one" aria-label="One" />
      <Checkbox value="two" aria-label="Two" />
    </>
  )
  const view = await render(
    <CheckboxGroup value={["one"]} onChange={request} aria-label="Choices">
      {children}
    </CheckboxGroup>,
  )
  await fireEvent.press(screen.getByRole("checkbox", { name: "Two" }), { nativeEvent: { timestamp: 100 } })
  expect(request.mock.calls).toEqual([[["one", "two"]]])
  expect(screen.getByRole("checkbox", { name: "Two" }).props.accessibilityState.checked).toBe(false)
  await view.rerender(
    <CheckboxGroup onChange={request} aria-label="Choices">
      {children}
    </CheckboxGroup>,
  )
  expect(screen.getByRole("checkbox", { name: "One" }).props.accessibilityState.checked).toBe(true)
  expect(screen.getByRole("checkbox", { name: "Two" }).props.accessibilityState.checked).toBe(true)
  expect(request).toHaveBeenCalledTimes(1)
})
it("retains the last declined radio request when the owner hands back control", async () => {
  const request = jest.fn()
  const children = (
    <>
      <Radio value="one" aria-label="One" />
      <Radio value="two" aria-label="Two" />
    </>
  )
  const view = await render(
    <RadioGroup value="one" onChange={request} aria-label="Choices">
      {children}
    </RadioGroup>,
  )
  await fireEvent.press(screen.getByRole("radio", { name: "Two" }), { nativeEvent: { timestamp: 100 } })
  expect(request.mock.calls).toEqual([["two"]])
  expect(screen.getByRole("radio", { name: "One" }).props.accessibilityState.checked).toBe(true)
  await view.rerender(
    <RadioGroup onChange={request} aria-label="Choices">
      {children}
    </RadioGroup>,
  )
  expect(screen.getByRole("radio", { name: "Two" }).props.accessibilityState.checked).toBe(true)
  expect(request).toHaveBeenCalledTimes(1)
})
