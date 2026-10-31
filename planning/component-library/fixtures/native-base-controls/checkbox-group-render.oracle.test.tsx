import { render, screen } from "@testing-library/react"
import { createRef } from "react"
import { expect, it } from "vitest"

import CheckboxGroup from "../../../../packages/react/src/components/CheckboxGroup/CheckboxGroup"
import Checkbox from "../../../../packages/react/src/components/Checkbox/Checkbox"

it("preserves canonical group rendering order, original root ref, current flags and member ownership", () => {
  const ref = createRef<HTMLDivElement>()
  const trace: string[] = []
  const view = render(
    <CheckboxGroup
      ref={ref}
      value={["one"]}
      aria-label="Original group"
      style={() => {
        trace.push("style")
        return {}
      }}
      render={(props, state) => {
        trace.push("render")
        return <div {...props} data-testid="rendered-group" data-readonly={String(state.isReadOnly)} />
      }}
    >
      {(state) => {
        trace.push("children")
        return <Checkbox value="one">{state.isReadOnly ? "Read only" : "Member"}</Checkbox>
      }}
    </CheckboxGroup>,
  )
  const original = ref.current
  expect(original).not.toBeNull()
  expect(screen.getByTestId("rendered-group")).toBe(original)
  expect(screen.getByRole("checkbox")).toBeChecked()
  expect(trace.slice(0, 3)).toEqual(["style", "children", "render"])
  view.rerender(
    <CheckboxGroup
      ref={ref}
      value={[]}
      aria-label="Original group"
      isReadOnly
      render={(props) => <div {...props} data-testid="rendered-group" />}
    >
      {(state) => <Checkbox value="one">{state.isReadOnly ? "Read only" : "Member"}</Checkbox>}
    </CheckboxGroup>,
  )
  expect(ref.current).toBe(original)
  expect(screen.getByRole("checkbox")).not.toBeChecked()
  expect(screen.getByText("Read only")).toBeInTheDocument()
  view.unmount()
  expect(ref.current).toBeNull()
})
