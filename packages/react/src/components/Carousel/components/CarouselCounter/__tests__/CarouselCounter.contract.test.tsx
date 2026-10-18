import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createCarouselContextValue, renderWithCarouselContext } from "../../../__tests__/emblaTestHarness"
import { CarouselContext, DEFAULT_CAROUSEL_LABELS } from "../../../helpers"
import CarouselCounter from "../CarouselCounter"

describe("CarouselCounter composition contract", () => {
  it.each([
    { name: "context default", expected: "Context items" },
    { name: "grouped label", labels: { counterText: "Grouped items" }, expected: "Grouped items" },
    {
      name: "explicit label",
      counterText: "Explicit items",
      labels: { counterText: "Grouped items" },
      expected: "Explicit items",
    },
    { name: "explicit empty", counterText: "", labels: { counterText: "Grouped items" }, expected: undefined },
    { name: "grouped empty", labels: { counterText: "" }, expected: undefined },
  ])("preserves $name label precedence", ({ counterText, labels, expected }) => {
    renderWithCarouselContext(<CarouselCounter counterText={counterText} labels={labels} />, {
      labels: { ...DEFAULT_CAROUSEL_LABELS, counter: { ariaLabel: "Context counter", counterText: "Context items" } },
    })
    const counter = screen.getByTestId("counter")
    expect(counter).toHaveAttribute("aria-label", "Context counter")
    const label = Array.from(counter.children).find((child) => child.getAttribute("data-testid") === "text")
    if (expected === undefined) expect(label).toBeUndefined()
    else expect(label).toHaveTextContent(expected)
  })

  it.each([undefined, "Grouped counter", ""])("retains grouped accessible label %s", (ariaLabel) => {
    renderWithCarouselContext(<CarouselCounter labels={{ ariaLabel }} />, {
      labels: { ...DEFAULT_CAROUSEL_LABELS, counter: { ariaLabel: "Context counter", counterText: "Items" } },
    })
    expect(screen.getByTestId("counter")).toHaveAttribute("aria-label", ariaLabel ?? "Context counter")
  })

  it("uses current context selection and count, including zero, without retaining earlier display state", () => {
    const initial = createCarouselContextValue({ selectedIndex: 2, itemCount: 8 })
    const { rerender } = render(
      <CarouselContext.Provider value={initial}>
        <CarouselCounter />
      </CarouselContext.Provider>,
    )
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("/8")).toBeInTheDocument()
    rerender(
      <CarouselContext.Provider value={{ ...initial, selectedIndex: 0, itemCount: 0 }}>
        <CarouselCounter />
      </CarouselContext.Provider>,
    )
    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.queryByText("/8")).not.toBeInTheDocument()
    expect(screen.queryByText("/0")).not.toBeInTheDocument()
  })

  it("preserves late zero/empty counter values and wrapper-owned label children", () => {
    renderWithCarouselContext(
      <CarouselCounter customCounterProps={{ value: 0, maxValue: 0, children: "Discarded child" }} />,
      { selectedIndex: 2, itemCount: 8 },
    )
    expect(screen.getByText("0")).toBeInTheDocument()
    expect(screen.queryByText("3")).not.toBeInTheDocument()
    expect(screen.queryByText("/8")).not.toBeInTheDocument()
    expect(screen.queryByText("/0")).not.toBeInTheDocument()
    expect(screen.queryByText("Discarded child")).not.toBeInTheDocument()
    expect(screen.getByText("Items")).toBeInTheDocument()
  })

  it("preserves late false display flags while allowing late progress composition", () => {
    renderWithCarouselContext(
      <CarouselCounter
        customCounterProps={{ value: 0, maxValue: 10, showMaxValue: false, showProgressIndicator: true }}
      />,
    )
    expect(screen.queryByText("/10")).not.toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Carousel Counter Progress" })).toHaveAttribute("aria-valuenow", "0")
  })

  it("keeps the injected aria-label ahead of the inner alias, while an exact late empty label wins", () => {
    const { unmount } = renderWithCarouselContext(<CarouselCounter customCounterProps={{ ariaLabel: "Inner alias" }} />)
    expect(screen.getByTestId("counter")).toHaveAttribute("aria-label", "Carousel Counter")
    unmount()
    renderWithCarouselContext(<CarouselCounter customCounterProps={{ "aria-label": "", ariaLabel: "Inner alias" }} />)
    expect(screen.getByTestId("counter")).toHaveAttribute("aria-label", "")
  })

  it("retains independent wrapper/Counter style owners and replacement before final inner style", () => {
    renderWithCarouselContext(
      <CarouselCounter
        customStyles={{ color: "red", width: 120 }}
        style={{ color: "blue", width: 0 }}
        customCounterStyles={{ color: "orange", padding: 11 }}
        customCounterClassName="outer-counter-class"
        customCounterProps={{
          customStyles: { color: "purple" },
          customClassName: "inner-counter-class",
          style: { color: "green" },
        }}
      />,
    )
    expect(screen.getByTestId("carousel-counter")).toHaveStyle({ color: "rgb(0, 0, 255)", width: "0px" })
    const counter = screen.getByTestId("counter")
    expect(counter).toHaveStyle({ color: "rgb(0, 128, 0)" })
    expect(counter.style.padding).toBe("")
    expect(counter).toHaveClass("inner-counter-class")
    expect(counter).not.toHaveClass("outer-counter-class")
  })

  it("keeps the count text owner separate from the trailing label owner", () => {
    renderWithCarouselContext(
      <CarouselCounter
        counterText="Entries"
        customCounterProps={{ customTextStyles: { textTransform: "uppercase", color: "orange" } }}
        customTextStyles={{ color: "purple", fontStyle: "italic" }}
      />,
    )
    const counter = screen.getByTestId("counter")
    expect(counter.querySelector("[data-countervalue]")).toHaveStyle({
      color: "rgb(255, 165, 0)",
      textTransform: "uppercase",
    })
    expect(within(counter).getByText("Entries")).toHaveStyle({ color: "rgb(128, 0, 128)", fontStyle: "italic" })
  })

  it("lets late Text props replace wrapper text styles/classes while retaining the resolved string", () => {
    renderWithCarouselContext(
      <CarouselCounter
        counterText="Entries"
        customTextClassName="outer-text"
        customCounterTextClassName="outer-alias"
        customTextStyles={{ color: "orange", fontStyle: "italic" }}
        customTextProps={{
          customClassName: "inner-text",
          customStyles: { color: "purple" },
          style: { color: "green" },
          children: "Discarded text",
        }}
      />,
    )
    const label = screen.getByText("Entries")
    expect(label).toHaveClass("inner-text")
    expect(label).not.toHaveClass("outer-text", "outer-alias")
    expect(label).toHaveStyle({ color: "rgb(0, 128, 0)" })
    expect(label.style.fontStyle).toBe("")
    expect(screen.queryByText("Discarded text")).not.toBeInTheDocument()
  })
})
