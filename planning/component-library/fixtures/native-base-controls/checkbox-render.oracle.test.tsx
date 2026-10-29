import { render, screen } from "@testing-library/react"
import { createRef } from "react"
import { expect, it } from "vitest"

import Checkbox from "../../../../packages/react/src/components/Checkbox/Checkbox"
import CheckboxGroup from "../../../../packages/react/src/components/CheckboxGroup/CheckboxGroup"

it("preserves canonical Checkbox root/ref/style-child-root order and group mixed/selection state", () => {
  const ref = createRef<HTMLLabelElement>()
  const trace: string[] = []
  const view = render(
    <CheckboxGroup aria-label="Choices" value={["one"]}>
      <Checkbox
        aria-label="Choice"
        value="one"
        ref={ref}
        isIndeterminate
        style={() => {
          trace.push("style")
          return {}
        }}
        render={(props, state) => {
          trace.push("render")
          return <label {...props} data-testid="rendered-checkbox" data-mixed={String(state.isIndeterminate)} />
        }}
      >
        {({ isIndeterminate }) => {
          trace.push("children")
          return isIndeterminate ? "Mixed" : "Choice"
        }}
      </Checkbox>
    </CheckboxGroup>,
  )
  const original = ref.current
  expect(screen.getByTestId("rendered-checkbox")).toBe(original)
  expect(screen.getByTestId("rendered-checkbox")).toHaveAttribute("data-mixed", "true")
  expect(screen.getByText("Mixed")).toBeInTheDocument()
  expect(trace.slice(0, 3)).toEqual(["style", "children", "render"])
  view.rerender(
    <CheckboxGroup aria-label="Choices" value={[]}>
      <Checkbox
        aria-label="Choice"
        value="one"
        ref={ref}
        render={(props) => <label {...props} data-testid="rendered-checkbox" />}
      >
        Choice
      </Checkbox>
    </CheckboxGroup>,
  )
  expect(ref.current).toBe(original)
  expect(screen.getByRole("checkbox")).not.toBeChecked()
  view.unmount()
  expect(ref.current).toBeNull()
})

it("preserves authored Checkbox root foreground and explicit child color precedence", () => {
  render(
    <Checkbox customStyles={{ color: "#123456" }} style={{ color: "#abcdef" }}>
      <span data-testid="inherited-label">Inherited</span>
      <span data-testid="authored-label" style={{ color: "#654321" }}>
        Authored
      </span>
    </Checkbox>,
  )
  expect(screen.getByTestId("checkbox")).toHaveStyle({ color: "#abcdef" })
  expect(getComputedStyle(screen.getByTestId("inherited-label")).color).toBe("rgb(171, 205, 239)")
  expect(getComputedStyle(screen.getByTestId("authored-label")).color).toBe("rgb(101, 67, 33)")
})
