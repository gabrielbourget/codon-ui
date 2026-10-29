import { render, screen } from "@testing-library/react"
import { createRef } from "react"
import { expect, it } from "vitest"

import Button from "../../../../packages/react/src/components/Button/Button"

it("retains the actual canonical Button ref, content and current pending state through render", () => {
  const ref = createRef<HTMLButtonElement>()
  const states: unknown[] = []
  const view = render(
    <Button
      ref={ref}
      render={(props, state) => {
        states.push(state)
        return <button {...props} data-testid="rendered-button" />
      }}
    >
      Original content
    </Button>,
  )
  const original = ref.current
  expect(original).not.toBeNull()
  expect(screen.getByRole("button")).toBe(original)
  expect(screen.getByText("Original content")).toBeInTheDocument()
  expect(states.at(-1)).toMatchObject({ isDisabled: false, isPending: false })
  view.rerender(
    <Button
      ref={ref}
      isPending
      render={(props, state) => {
        states.push(state)
        return <button {...props} data-testid="rendered-button" />
      }}
    >
      Updated content
    </Button>,
  )
  expect(ref.current).toBe(original)
  expect(screen.getByText("Updated content")).toBeInTheDocument()
  expect(states.at(-1)).toMatchObject({ isDisabled: false, isPending: true })
  view.unmount()
  expect(ref.current).toBeNull()
})
