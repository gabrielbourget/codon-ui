import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { renderWithCarouselContext } from "../../../__tests__/emblaTestHarness"
import { DEFAULT_CAROUSEL_LABELS } from "../../../helpers"
import CarouselPrevButton from "../CarouselPrevButton"

describe("<CarouselPrevButton /> Tests", () => {
  it("Uses the carousel context to disable and trigger previous navigation.", async () => {
    const user = userEvent.setup()
    const scrollPrev = vi.fn()

    const { unmount } = renderWithCarouselContext(<CarouselPrevButton />, {
      canScrollPrev: false,
      scrollPrev,
    })

    const button = screen.getByRole("button", { name: "Previous Item" })
    expect(button).toHaveAttribute("data-disabled", "true")

    unmount()

    renderWithCarouselContext(<CarouselPrevButton />, {
      canScrollPrev: true,
      scrollPrev,
    })

    const enabledButton = screen.getByRole("button", { name: "Previous Item" })
    await user.click(enabledButton)

    expect(enabledButton).not.toHaveAttribute("data-disabled", "true")
    expect(scrollPrev).toHaveBeenCalledTimes(1)
  })

  it("Renders custom children when provided.", () => {
    renderWithCarouselContext(<CarouselPrevButton>Go back</CarouselPrevButton>)

    expect(screen.getByRole("button", { name: "Previous Item" })).toHaveTextContent("Go back")
  })

  it("Merges native and custom class props through the Button root channel.", () => {
    renderWithCarouselContext(
      <CarouselPrevButton
        className="native-prev-button"
        customClassName="custom-prev-button"
        customStyles={{ color: "turquoise" }}
        customButtonProps={{
          className: "native-custom-button-prop-class",
          customClassName: "custom-button-prop-class",
          customStyles: { backgroundColor: "blue" },
        }}
      />,
      {
        canScrollPrev: true,
      },
    )

    const button = screen.getByRole("button", { name: "Previous Item" })

    expect(button).toHaveClass("native-prev-button")
    expect(button).toHaveClass("custom-prev-button")
    expect(button).toHaveClass("native-custom-button-prop-class")
    expect(button).toHaveClass("custom-button-prop-class")
    expect(button).toHaveStyle({ padding: "5px" })
    expect(button).toHaveStyle({ color: "rgb(64, 224, 208)" })
    expect(button).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
  })

  it("Uses grouped labels from carousel context.", () => {
    renderWithCarouselContext(<CarouselPrevButton />, {
      labels: {
        ...DEFAULT_CAROUSEL_LABELS,
        controls: {
          ...DEFAULT_CAROUSEL_LABELS.controls,
          previousItemButtonAriaLabel: "Localized previous item",
        },
      },
    })

    expect(screen.getByRole("button", { name: "Localized previous item" })).toBeInTheDocument()
  })
})
