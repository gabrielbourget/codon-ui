import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { NumberInput } from "../../.."

const names = { accessibilityLabel: "Quantity", incrementLabel: "Add quantity", decrementLabel: "Reduce quantity" }
const input = () => screen.getByTestId("number-input-input")
const step = (name: string, timestamp: number) =>
  fireEvent.press(screen.getByRole("button", { name }), { nativeEvent: { timestamp } })

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it("publishes an uncontrolled increment and return step before one React commit", async () => {
  const onChange = jest.fn()
  await render(<NumberInput {...names} defaultValue={5} onChange={onChange} />)
  await act(async () => {
    await step("Add quantity", 100)
    await step("Reduce quantity", 101)
  })
  expect(onChange.mock.calls).toEqual([[6], [5]])
  expect(input()).toHaveDisplayValue("5")
})

it("publishes an uncontrolled edit and return commit before one React commit", async () => {
  const onChange = jest.fn()
  await render(<NumberInput {...names} defaultValue={5} onChange={onChange} />)
  await act(async () => {
    await fireEvent.changeText(input(), "6")
    await fireEvent(input(), "endEditing", { nativeEvent: { text: "6" } })
    await fireEvent.changeText(input(), "5")
    await fireEvent(input(), "endEditing", { nativeEvent: { text: "5" } })
  })
  expect(onChange.mock.calls).toEqual([[6], [5]])
  expect(input()).toHaveDisplayValue("5")
})

it("suppresses a repeated uncontrolled numeric commit before one React commit", async () => {
  const onChange = jest.fn()
  await render(<NumberInput {...names} defaultValue={5} onChange={onChange} />)
  await act(async () => {
    await fireEvent.changeText(input(), "6")
    await fireEvent(input(), "endEditing", { nativeEvent: { text: "6" } })
    await fireEvent.changeText(input(), "6")
    await fireEvent(input(), "endEditing", { nativeEvent: { text: "6" } })
  })
  expect(onChange.mock.calls).toEqual([[6]])
  expect(input()).toHaveDisplayValue("6")
})

it("keeps controlled owner veto authoritative across batched numeric step requests", async () => {
  const onChange = jest.fn()
  await render(<NumberInput {...names} value={5} onChange={onChange} />)
  await act(async () => {
    await step("Add quantity", 100)
    await step("Reduce quantity", 101)
  })
  expect(onChange.mock.calls).toEqual([[6], [4]])
  expect(input()).toHaveDisplayValue("5")
})
