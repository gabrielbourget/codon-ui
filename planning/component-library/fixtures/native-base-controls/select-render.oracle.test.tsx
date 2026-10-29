import { render, screen } from "@testing-library/react"
import { createRef } from "react"
import { expect, it } from "vitest"

import ListBoxItem from "../../../../packages/react/src/components/ListBoxItem/ListBoxItem"
import Select from "../../../../packages/react/src/components/Select/Select"

it("preserves the Select root/ref and evaluates its selected value after root rendering", () => {
  const ref = createRef<HTMLDivElement>()
  const trace: string[] = []
  const items = [{ id: "one", name: "One" }]
  const view = render(
    <Select
      ref={ref}
      aria-label="Choose"
      items={items}
      value="one"
      isOpen={false}
      customStyles={{ color: "#123456", backgroundColor: "#111111" }}
      style={() => {
        trace.push("style")
        return { color: "#abcdef" }
      }}
      render={(props) => {
        trace.push("root")
        return <div {...props} data-testid="rendered-select" />
      }}
      renderSelectedValue={({ selectedText }) => {
        trace.push("value")
        return <span data-testid="selected-value">Picked {selectedText}</span>
      }}
    >
      {(item) => (
        <ListBoxItem id={item.id} textValue={item.name}>
          {item.name}
        </ListBoxItem>
      )}
    </Select>,
  )
  const root = screen.getByTestId("rendered-select")
  expect(root).toBe(ref.current)
  expect(root.tagName).toBe("DIV")
  expect(root).toHaveStyle({ color: "#abcdef", backgroundColor: "#111111" })
  expect(trace.indexOf("style")).toBeLessThan(trace.indexOf("root"))
  expect(trace.indexOf("root")).toBeLessThan(trace.indexOf("value"))
  expect(screen.getByTestId("selected-value")).toHaveTextContent("Picked One")
  expect(screen.getByRole("button", { name: "Picked One Choose" })).toBeInTheDocument()
  view.unmount()
  expect(ref.current).toBeNull()
})
