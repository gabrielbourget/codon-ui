import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import CarouselCloseButton from "../CarouselCloseButton"

describe("<CarouselCloseButton /> Tests", () => {
  it("Uses the default accessible name and forwards onPress.", async () => {
    const user = userEvent.setup()
    const onPress = vi.fn()

    render(<CarouselCloseButton onPress={onPress} />)

    const button = screen.getByRole("button", { name: "Close Carousel" })
    await user.click(button)

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("Uses grouped labels when provided.", () => {
    render(<CarouselCloseButton labels={{ closeButtonAriaLabel: "Dismiss carousel" }} />)

    expect(screen.getByRole("button", { name: "Dismiss carousel" })).toBeInTheDocument()
  })

  it("Renders custom children when provided.", () => {
    render(<CarouselCloseButton>Dismiss</CarouselCloseButton>)

    expect(screen.getByRole("button", { name: "Close Carousel" })).toHaveTextContent("Dismiss")
  })

  it("Merges native and custom class props through the Button root channel.", () => {
    render(
      <CarouselCloseButton
        className="native-close-button"
        customClassName="custom-close-button"
        customStyles={{ color: "turquoise" }}
        customButtonProps={{
          className: "native-custom-button-prop-class",
          customClassName: "custom-button-prop-class",
          customStyles: { backgroundColor: "blue" },
        }}
      />,
    )

    const button = screen.getByRole("button", { name: "Close Carousel" })

    expect(button).toHaveClass("native-close-button")
    expect(button).toHaveClass("custom-close-button")
    expect(button).toHaveClass("native-custom-button-prop-class")
    expect(button).toHaveClass("custom-button-prop-class")
    expect(button).toHaveStyle({ padding: "5px" })
    expect(button).toHaveStyle({ color: "rgb(64, 224, 208)" })
    expect(button).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
  })
})
