import { fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { createRef } from "react"

import { ListBoxItem, type TNativeListBoxItemRef } from "../../.."

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it("retains the original row ref and activation object while metadata owns its name and selection", async () => {
  const ref = createRef<TNativeListBoxItemRef>(),
    onPress = jest.fn()
  const view = await render(
    <ListBoxItem ref={ref} id={0} textValue="Choice zero" testID="native" data-testid="alias" onPress={onPress} />,
  )
  const original = ref.current
  expect(original).not.toBeNull()
  const row = screen.getByRole("radio", { name: "Choice zero" })
  expect(screen.getByTestId("native")).toBe(row)
  expect(screen.queryByTestId("alias")).toBeNull()
  for (const prop of ["id", "textValue", "isSelected", "isDisabled", "isReadOnly", "textSize", "customStyles"]) {
    expect(row.props[prop]).toBeUndefined()
  }
  const event = { nativeEvent: { target: 17, timestamp: 100 } }
  await fireEvent(row, "press", event)
  expect(onPress.mock.calls).toEqual([[event]])
  expect(onPress.mock.calls[0][0]).toBe(event)
  expect(row.props.accessibilityState.checked).toBe(false)
  await view.rerender(<ListBoxItem ref={ref} id="" textValue="Empty key" isSelected testID="" data-testid="alias" />)
  expect(ref.current).toBe(original)
  expect(screen.getByTestId("")).toBe(screen.getByRole("radio", { name: "Empty key" }))
  expect(screen.getByTestId("").props.accessibilityState.checked).toBe(true)
  expect(onPress).toHaveBeenCalledTimes(1)
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("owns one named radio root, preserves controlled state and wraps composed labels", async () => {
  const onPress = jest.fn()
  await render(
    <ListBoxItem id={0} textValue="Choice zero" onPress={onPress}>
      {({ isSelected }) => <>Choice {isSelected ? 1 : 0}</>}
    </ListBoxItem>,
  )
  const row = screen.getByRole("radio", { name: "Choice zero" })
  expect(row).toHaveStyle({ minHeight: 44, minWidth: 44 })
  expect(row.props.accessibilityState.checked).toBe(false)
  expect(screen.getByText("Choice 0").props.selectable).toBe(false)
  await userEvent.setup().press(row)
  expect(onPress).toHaveBeenCalledTimes(1)
  expect(row.props.accessibilityState.checked).toBe(false)
})

it.each(["isDisabled", "isReadOnly"] as const)("blocks activation with %s", async (flag) => {
  const onPress = jest.fn()
  await render(<ListBoxItem id="row" textValue="Row" {...{ [flag]: true, onPress }} />)
  await fireEvent.press(screen.getByRole("radio"), { nativeEvent: { timestamp: 1 } })
  expect(onPress).not.toHaveBeenCalled()
  expect(screen.getByRole("radio").props.accessibilityState.disabled).toBe(flag === "isDisabled")
})

it("uses selected theme roles and post-custom callback dimensions", async () => {
  await render(
    <ListBoxItem
      id="row"
      textValue="Row"
      isSelected
      textSize="large"
      customStyles={{ width: 24, height: 24 }}
      style={({ defaultStyle }) => defaultStyle}
    />,
  )
  expect(screen.getByRole("radio")).toHaveStyle({ width: 24, height: 24, backgroundColor: "#2563eb" })
  expect(screen.getByRole("radio").props.style.minHeight).toBeUndefined()
  expect(screen.getByText("Row")).toHaveStyle({ fontSize: 16, color: "#ffffff" })
})

it("validates metadata and all supplied native style colors", async () => {
  await expect(render(<ListBoxItem id={NaN} textValue="Row" />)).rejects.toThrow(TypeError)
  await expect(render(<ListBoxItem id="row" textValue=" " />)).rejects.toThrow(TypeError)
  await expect(
    render(<ListBoxItem id="row" textValue="Row" customStyles={{ backgroundColor: "var(--row)" }} />),
  ).rejects.toThrow(TypeError)
})
