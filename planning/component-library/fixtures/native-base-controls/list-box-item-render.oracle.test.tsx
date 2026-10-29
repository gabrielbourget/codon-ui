import { render, screen } from "@testing-library/react"
import type { ComponentPropsWithRef } from "react"
import { ListBox } from "react-aria-components"
import { expect, it } from "vitest"

import ListBoxItem from "../../../../packages/react/src/components/ListBoxItem/ListBoxItem"

it("preserves the actual option root/ref, style-child-render order and authored foreground", () => {
  const trace: string[] = []
  const probe = (selected: boolean) => (
    <ListBox aria-label="Choices" selectionMode="single" selectedKeys={selected ? ["row"] : []}>
      <ListBoxItem
        id="row"
        textValue="Choice"
        customStyles={{ color: "#123456" }}
        style={() => {
          trace.push("style")
          return { color: "#abcdef" }
        }}
        render={(props, state) => {
          trace.push("render")
          expect(props.ref).toBeDefined()
          expect("href" in props ? props.href : undefined).toBeUndefined()
          return (
            <div
              {...(props as ComponentPropsWithRef<"div">)}
              data-testid="rendered-row"
              data-selected={String(state.isSelected)}
            />
          )
        }}
      >
        {(state) => {
          trace.push("child")
          expect(state).toHaveProperty("defaultChildren", undefined)
          return state.isSelected ? "Selected" : "Available"
        }}
      </ListBoxItem>
    </ListBox>
  )
  const view = render(probe(false))
  const original = screen.getByRole("option")
  expect(original).toBe(screen.getByTestId("rendered-row"))
  expect(original.tagName).toBe("DIV")
  expect(trace.slice(0, 3)).toEqual(["style", "child", "render"])
  expect(original).toHaveStyle({ color: "#abcdef" })
  expect(original).toHaveTextContent("Available")
  view.rerender(probe(true))
  expect(screen.getByRole("option")).toBe(original)
  expect(original).toHaveTextContent("Selected")
  view.unmount()
  expect(original.isConnected).toBe(false)
})
