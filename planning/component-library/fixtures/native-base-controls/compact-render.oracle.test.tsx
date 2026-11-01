import { fireEvent, render, screen } from "@testing-library/react"
import { createRef } from "react"
import { expect, it, vi } from "vitest"

import CompactTypeaheadSearch from "../../../../packages/react/src/components/CompactTypeaheadSearch/CompactTypeaheadSearch"

it("preserves the canonical inherited root renderer, original callbacks and held editor through owner updates", () => {
  const root = createRef<HTMLDivElement>()
  const seen = vi.fn(),
    firstClick = vi.fn(),
    nextClick = vi.fn(),
    query = vi.fn()
  const node = (isReadOnly: boolean, onClick: typeof firstClick) => (
    <CompactTypeaheadSearch
      ref={root}
      aria-label="Rendered search"
      inputValue="held"
      onInputChange={query}
      isRequired
      isReadOnly={isReadOnly}
      width={0}
      customStyles={{ marginTop: 5 }}
      style={({ defaultStyle }) => ({ ...defaultStyle, marginTop: 11 })}
      onClick={onClick}
      render={(native, state) => {
        seen(state)
        return <div {...native} data-testid="rendered-public-search" />
      }}
    />
  )
  const view = render(node(false, firstClick))
  const originalRoot = root.current,
    originalEditor = screen.getByTestId("type-ahead-search-input")
  expect(originalRoot).not.toBeNull()
  expect(originalRoot).toBe(screen.getByTestId("rendered-public-search"))
  expect(originalRoot).toHaveStyle({ width: "0px", marginTop: "11px" })
  expect(seen.mock.calls.at(-1)?.[0]).toMatchObject({ isRequired: true, isReadOnly: false, isDisabled: false })
  fireEvent.click(originalRoot!)
  expect(firstClick).toHaveBeenCalledTimes(1)
  expect(firstClick.mock.calls[0]?.[0].target).toBe(originalRoot)
  view.rerender(node(true, nextClick))
  expect(root.current).toBe(originalRoot)
  expect(screen.getByTestId("type-ahead-search-input")).toBe(originalEditor)
  expect(originalEditor).toHaveValue("held")
  expect(query).not.toHaveBeenCalled()
  expect(seen.mock.calls.at(-1)?.[0]).toMatchObject({ isRequired: true, isReadOnly: true, isDisabled: false })
  fireEvent.click(originalRoot!)
  expect(nextClick).toHaveBeenCalledTimes(1)
  expect(nextClick.mock.calls[0]?.[0].target).toBe(originalRoot)
  expect(firstClick).toHaveBeenCalledTimes(1)
  view.unmount()
  expect(root.current).toBeNull()
})
