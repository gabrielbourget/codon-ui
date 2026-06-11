import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { renderWithCarouselContext } from "../../../__tests__/emblaTestHarness"
import { DEFAULT_CAROUSEL_LABELS } from "../../../helpers"
import CarouselNextButton from "../CarouselNextButton"

describe("<CarouselNextButton /> Tests", () => {
  it("Uses the carousel context to disable and trigger next navigation.", async () => {
    const user = userEvent.setup()
    const scrollNext = vi.fn()

    const { unmount } = renderWithCarouselContext(<CarouselNextButton />, {
      canScrollNext: false,
      scrollNext,
    })

    const button = screen.getByRole("button", { name: "Next Item" })
    expect(button).toHaveAttribute("data-disabled", "true")

    unmount()

    renderWithCarouselContext(<CarouselNextButton />, {
      canScrollNext: true,
      scrollNext,
    })

    const enabledButton = screen.getByRole("button", { name: "Next Item" })
    await user.click(enabledButton)

    expect(enabledButton).not.toHaveAttribute("data-disabled", "true")
    expect(scrollNext).toHaveBeenCalledTimes(1)
  })

  it("Renders custom children when provided.", () => {
    renderWithCarouselContext(<CarouselNextButton>Go forward</CarouselNextButton>)

    expect(screen.getByRole("button", { name: "Next Item" })).toHaveTextContent("Go forward")
  })

  it("Merges native and custom class props through the Button root channel.", () => {
    renderWithCarouselContext(
      <CarouselNextButton
        className="native-next-button"
        customClassName="custom-next-button"
        customStyles={{ color: "turquoise" }}
        customButtonProps={{
          className: "native-custom-button-prop-class",
          customClassName: "custom-button-prop-class",
          customStyles: { backgroundColor: "blue" },
        }}
      />,
      {
        canScrollNext: true,
      },
    )

    const button = screen.getByRole("button", { name: "Next Item" })

    expect(button).toHaveClass("native-next-button")
    expect(button).toHaveClass("custom-next-button")
    expect(button).toHaveClass("native-custom-button-prop-class")
    expect(button).toHaveClass("custom-button-prop-class")
    expect(button).toHaveStyle({ padding: "5px" })
    expect(button).toHaveStyle({ color: "rgb(64, 224, 208)" })
    expect(button).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
  })

  it("Uses grouped labels from carousel context.", () => {
    renderWithCarouselContext(<CarouselNextButton />, {
      labels: {
        ...DEFAULT_CAROUSEL_LABELS,
        controls: {
          ...DEFAULT_CAROUSEL_LABELS.controls,
          nextItemButtonAriaLabel: "Localized next item",
        },
      },
    })

    expect(screen.getByRole("button", { name: "Localized next item" })).toBeInTheDocument()
  })
})
