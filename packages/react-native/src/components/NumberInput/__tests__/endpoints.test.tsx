import { act, render } from "@testing-library/react-native"
import { View } from "react-native"

import { useNumberInputState } from "../state"
import type { TNativeNumberInputProps } from "../types"

let current: ReturnType<typeof useNumberInputState>
const Harness = (props: TNativeNumberInputProps) => {
  current = useNumberInputState(props)
  return <View />
}
const labels = { accessibilityLabel: "Quantity", incrementLabel: "Add", decrementLabel: "Remove" }

test("endpoint requests preserve controlled veto, current bounds and guards without consuming an unrelated missing boundary", async () => {
  const onChange = jest.fn()
  const props = { ...labels, value: 0.4, minValue: 0.1, maxValue: 1.1, step: 0.3, onChange }
  const result = await render(<Harness {...props} />)
  await act(() => current.change("0.7"))
  await act(() => current.endpoint(1))
  expect(onChange.mock.calls).toEqual([[1]])
  expect(current.value).toBe(0.4)
  expect(current.inputValue).toBe("0.4")
  await result.rerender(<Harness {...props} value={1} />)
  await act(() => current.endpoint(1))
  expect(onChange).toHaveBeenCalledTimes(1)
  await result.rerender(<Harness {...props} value={1} isReadOnly />)
  await act(() => current.endpoint(-1))
  await result.rerender(<Harness {...props} value={1} isDisabled />)
  await act(() => current.endpoint(-1))
  expect(onChange).toHaveBeenCalledTimes(1)
  await result.rerender(<Harness {...props} value={1} minValue={0.2} />)
  await act(() => current.endpoint(-1))
  expect(onChange).toHaveBeenLastCalledWith(0.2)
  await result.rerender(<Harness {...props} value={1} minValue={undefined} />)
  await act(() => current.change("0.7"))
  await act(() => current.endpoint(-1))
  expect(current.inputValue).toBe("0.7")
  expect(onChange).toHaveBeenCalledTimes(2)
})

test("uncontrolled endpoints replace drafts once and normalize zero", async () => {
  const onChange = jest.fn()
  await render(<Harness {...labels} defaultValue={0.5} minValue={-0} maxValue={1} onChange={onChange} />)
  await act(() => current.endpoint(-1))
  expect(current.value).toBe(0)
  expect(Object.is(current.value, -0)).toBe(false)
  expect(current.inputValue).toBe("0")
  await act(() => current.endpoint(-1))
  expect(onChange.mock.calls).toEqual([[0]])
  await act(() => current.endpoint(1))
  expect(current.value).toBe(1)
  expect(onChange.mock.calls).toEqual([[0], [1]])
})
