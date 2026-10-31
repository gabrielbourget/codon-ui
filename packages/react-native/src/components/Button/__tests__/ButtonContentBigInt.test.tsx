import { fireEvent, render, screen } from "@testing-library/react-native"
import { Fragment, useState } from "react"

import { Button, FormField, Text } from "../../.."

it("renders bigint phrases inside native Button Text while retaining activation and owned foreground", async () => {
  const press = jest.fn()
  await render(
    <Button onPress={press} customStyles={{ color: "purple" }}>
      {[0n, " + ", 12n]}
    </Button>,
  )
  expect(screen.getByText("0 + 12")).toHaveStyle({ color: "purple" })
  await fireEvent.press(screen.getByRole("button", { name: "0 + 12" }))
  expect(press).toHaveBeenCalledTimes(1)
})

it("preserves caller bigint/zero/empty content through native FormField cradles", async () => {
  await render(
    <FormField topRightContent={13n} errorMessages={[]} bottomRightContent={0n}>
      {14n}
    </FormField>,
  )
  expect(screen.getByText("13")).toBeOnTheScreen()
  expect(screen.getByText("14")).toBeOnTheScreen()
  expect(screen.getByText("0")).toBeOnTheScreen()
})

it("retains keyed child state while bigint phrases change around authored elements", async () => {
  const Child = () => {
    const [count, setCount] = useState(0)
    return <Text onPress={() => setCount((current) => current + 1)}>Child {count}</Text>
  }
  const fixture = (number: bigint) => (
    <FormField>
      {[
        number,
        <Fragment key="stable">
          <Child />
        </Fragment>,
        0n,
      ]}
    </FormField>
  )
  const { rerender } = await render(fixture(1n))
  await fireEvent.press(screen.getByText("Child 0"))
  await rerender(fixture(2n))
  expect(screen.getByText("Child 1")).toBeOnTheScreen()
  expect(screen.getByText("2")).toBeOnTheScreen()
})
