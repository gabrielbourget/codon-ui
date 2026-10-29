import { render, screen } from "@testing-library/react"
import { createRef } from "react"
import { expect, it } from "vitest"

import RadioGroup from "../../../../packages/react/src/components/RadioGroup/RadioGroup"
import Radio from "../../../../packages/react/src/components/Radio/Radio"

it("preserves canonical radio group root/ref/state/order and member context", () => {
  const ref = createRef<HTMLDivElement>()
  const trace: string[] = []
  const view = render(
    <RadioGroup
      ref={ref}
      value="one"
      aria-label="Choices"
      style={() => {
        trace.push("style")
        return {}
      }}
      render={(props, state) => {
        trace.push("render")
        return <div {...props} data-testid="rendered-group" data-readonly={String(state.isReadOnly)} />
      }}
    >
      <Radio aria-label="First" value="one">
        First
      </Radio>
    </RadioGroup>,
  )
  const original = ref.current
  expect(original).not.toBeNull()
  expect(screen.getByTestId("rendered-group")).toBe(original)
  expect(screen.getByRole("radio")).toBeChecked()
  expect(trace.slice(0, 2)).toEqual(["style", "render"])
  view.rerender(
    <RadioGroup
      ref={ref}
      value={null}
      aria-label="Choices"
      isReadOnly
      render={(props, state) => (
        <div {...props} data-testid="rendered-group" data-readonly={String(state.isReadOnly)} />
      )}
    >
      <Radio aria-label="First" value="one">
        First
      </Radio>
    </RadioGroup>,
  )
  expect(ref.current).toBe(original)
  expect(screen.getByRole("radio")).not.toBeChecked()
  expect(original).toHaveAttribute("data-readonly", "true")
  view.unmount()
  expect(ref.current).toBeNull()
})
