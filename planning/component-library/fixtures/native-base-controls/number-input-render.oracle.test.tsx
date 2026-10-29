import { render, screen } from "@testing-library/react"
import { createRef } from "react"
import { expect, it } from "vitest"

import NumberInput from "../../../../packages/react/src/components/NumberInput/NumberInput"

it("preserves canonical numeric root/ref/owned controls, ignored children and style-before-render order", () => {
  const ref = createRef<HTMLInputElement>()
  const trace: string[] = []
  const view = render(
    <NumberInput
      ref={ref}
      aria-label="Quantity"
      value={2}
      style={() => {
        trace.push("style")
        return {}
      }}
      render={(props, state) => {
        trace.push("render")
        return <div {...props} data-testid="rendered-number" data-readonly={String(state.isReadOnly)} />
      }}
    >
      Ignored
    </NumberInput>,
  )
  const original = ref.current
  expect(original?.tagName).toBe("DIV")
  expect(screen.getByTestId("rendered-number")).toBe(original)
  expect(trace.slice(0, 2)).toEqual(["style", "render"])
  expect(screen.queryByText("Ignored")).toBeNull()
  expect(screen.getAllByRole("button")).toHaveLength(2)
  expect(screen.getByRole("textbox")).toHaveValue("2")
  view.rerender(
    <NumberInput
      ref={ref}
      aria-label="Quantity"
      value={7}
      isReadOnly
      render={(props, state) => (
        <div {...props} data-testid="rendered-number" data-readonly={String(state.isReadOnly)} />
      )}
    />,
  )
  expect(ref.current).toBe(original)
  expect(screen.getByRole("textbox")).toHaveValue("7")
  expect(original).toHaveAttribute("data-readonly", "true")
  view.unmount()
  expect(ref.current).toBeNull()
})
