import { screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithCarouselContext } from "../../../__tests__/emblaTestHarness"
import CarouselCounter from "../CarouselCounter"
import styles from "../CarouselCounterStyles.module.css"

describe("<CarouselCounter /> Tests", () => {
  it("Renders the selected index, max value, and default label text.", () => {
    renderWithCarouselContext(<CarouselCounter />, {
      selectedIndex: 2,
      itemCount: 8,
    })

    const counterWrapper = screen.getByTestId("carousel-counter")
    const counter = within(counterWrapper).getByTestId("counter")

    expect(counterWrapper).toHaveClass(styles.carouselCounter)
    expect(within(counter).getByText("3")).toBeInTheDocument()
    expect(within(counter).getByText("/8")).toBeInTheDocument()
    expect(within(counterWrapper).getByText("Items")).toBeInTheDocument()
  })

  it("Applies grouped label text.", () => {
    renderWithCarouselContext(
      <CarouselCounter
        labels={{ counterText: "Localized items" }}
        className="native-counter-wrapper"
        customClassName="counter-wrapper"
        customStyles={{ color: "turquoise" }}
        style={{ backgroundColor: "blue" }}
        customTextClassName="counter-text"
        customCounterTextClassName="counter-text-alias"
      />,
      {
        selectedIndex: 1,
        itemCount: 4,
      },
    )

    const counterWrapper = screen.getByTestId("carousel-counter")
    const counterText = within(counterWrapper).getByText("Localized items")

    expect(counterWrapper).toHaveClass("native-counter-wrapper")
    expect(counterWrapper).toHaveClass("counter-wrapper")
    expect(counterWrapper).toHaveStyle({ color: "rgb(64, 224, 208)" })
    expect(counterWrapper).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
    expect(counterText).toHaveClass("counter-text")
    expect(counterText).toHaveClass("counter-text-alias")
    expect(within(counterWrapper).getByText("Localized items")).toBeInTheDocument()
  })

  it("Suppresses the label text when counterText is empty and applies custom classes/styles.", () => {
    renderWithCarouselContext(
      <CarouselCounter
        counterText=""
        customClassName="counter-wrapper"
        customStyles={{ backgroundColor: "black" }}
        customCounterClassName="inner-counter"
        customCounterStyles={{ color: "white" }}
        customCounterProps={{ customTextStyles: { textTransform: "uppercase" } }}
      />,
      {
        selectedIndex: 0,
        itemCount: 2,
      },
    )

    const counterWrapper = screen.getByTestId("carousel-counter")
    const counter = within(counterWrapper).getByTestId("counter")
    const valueText = counter.querySelector("[data-countervalue]")

    expect(counterWrapper).toHaveClass("counter-wrapper")
    expect(counterWrapper).toHaveStyle({ backgroundColor: "rgb(0, 0, 0)" })
    expect(counter).toHaveClass("inner-counter")
    expect(counter).toHaveStyle({ color: "rgb(255, 255, 255)" })
    expect(valueText).toHaveStyle({ textTransform: "uppercase" })
    expect(screen.queryByText("Items")).not.toBeInTheDocument()
  })
})
