import { render, screen } from "@testing-library/react"
import { createRef } from "react"
import { expect, it } from "vitest"

import Switch from "../../../../packages/react/src/components/Switch/Switch"

it("preserves canonical Switch root/ref/owned slots, ignored children and style-before-render order", () => {
  const ref = createRef<HTMLLabelElement>()
  const trace: string[] = []
  const view = render(
    <Switch
      ref={ref}
      aria-label="Setting"
      isSelected={false}
      leftContent="Before"
      rightContent="After"
      style={() => {
        trace.push("style")
        return {}
      }}
      render={(props, state) => {
        trace.push("render")
        return <label {...props} data-testid="rendered-switch" data-selected={String(state.isSelected)} />
      }}
    >
      Ignored
    </Switch>,
  )
  const original = ref.current
  expect(screen.getByTestId("rendered-switch")).toBe(original)
  expect(trace.slice(0, 2)).toEqual(["style", "render"])
  const ownedText = Array.from(original!.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent)
  expect(ownedText).toEqual(["Before", "After"])
  expect(screen.queryByText("Ignored")).toBeNull()
  expect(screen.getByRole("switch")).not.toBeChecked()
  view.rerender(
    <Switch
      ref={ref}
      aria-label="Setting"
      isSelected
      render={(props) => <label {...props} data-testid="rendered-switch" />}
    />,
  )
  expect(ref.current).toBe(original)
  expect(screen.getByRole("switch")).toBeChecked()
  view.unmount()
  expect(ref.current).toBeNull()
})
