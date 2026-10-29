import { render, screen } from "@testing-library/react"
import { createRef } from "react"
import { expect, it } from "vitest"

import Radio from "../../../../packages/react/src/components/Radio/Radio"
import RadioGroup from "../../../../packages/react/src/components/RadioGroup/RadioGroup"

it("preserves canonical radio root/ref/style-child-root order and group echo", () => {
  const ref = createRef<HTMLLabelElement>()
  const trace: string[] = []
  const view = render(
    <RadioGroup aria-label="Choices" value="one">
      <Radio
        aria-label="Choice"
        value="one"
        ref={ref}
        style={() => {
          trace.push("style")
          return {}
        }}
        render={(props, state) => {
          trace.push("render")
          return <label {...props} data-testid="rendered-radio" data-selected={String(state.isSelected)} />
        }}
      >
        {({ isSelected }) => {
          trace.push("children")
          return isSelected ? "Chosen" : "Choice"
        }}
      </Radio>
    </RadioGroup>,
  )
  const original = ref.current
  expect(screen.getByTestId("rendered-radio")).toBe(original)
  expect(screen.getByRole("radio")).toBeChecked()
  expect(trace.slice(0, 3)).toEqual(["style", "children", "render"])
  view.rerender(
    <RadioGroup aria-label="Choices" value={null}>
      <Radio
        aria-label="Choice"
        value="one"
        ref={ref}
        render={(props) => <label {...props} data-testid="rendered-radio" />}
      >
        Choice
      </Radio>
    </RadioGroup>,
  )
  expect(ref.current).toBe(original)
  expect(screen.getByRole("radio")).not.toBeChecked()
  view.unmount()
  expect(ref.current).toBeNull()
})
