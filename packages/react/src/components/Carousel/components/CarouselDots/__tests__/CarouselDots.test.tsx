import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { createCarouselContextValue, renderWithCarouselContext } from "../../../__tests__/emblaTestHarness"
import { CarouselContext } from "../../../helpers"
import CarouselDots from "../CarouselDots"
import styles from "../CarouselDotsStyles.module.css"
import { CAROUSEL_DOTS_ACTIVATION_MODE__AUTO, CAROUSEL_DOTS_ACTIVATION_MODE__MANUAL } from "../helpers"

describe("<CarouselDots /> Tests", () => {
  it("Renders nothing when there are fewer than two items.", () => {
    const { container } = renderWithCarouselContext(<CarouselDots />, {
      itemCount: 1,
    })

    expect(container).toBeEmptyDOMElement()
  })

  it("Renders an interactive radiogroup and scrolls when a dot is clicked.", async () => {
    const user = userEvent.setup()
    const scrollTo = vi.fn()

    renderWithCarouselContext(
      <CarouselDots
        className="native-carousel-dots"
        customClassName="custom-carousel-dots"
        customStyles={{ color: "turquoise" }}
        style={{ backgroundColor: "blue" }}
      />,
      {
        itemCount: 4,
        selectedIndex: 1,
        scrollTo,
      },
    )

    const radiogroup = screen.getByRole("radiogroup", { name: "Slide Navigation" })
    const radios = within(radiogroup).getAllByRole("radio")

    expect(radiogroup).toHaveClass("native-carousel-dots")
    expect(radiogroup).toHaveClass("custom-carousel-dots")
    expect(radiogroup).toHaveStyle({ color: "rgb(64, 224, 208)" })
    expect(radiogroup).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
    expect(radios).toHaveLength(4)
    expect(radios[1]).toHaveAttribute("aria-checked", "true")

    await user.click(radios[2])

    expect(scrollTo).toHaveBeenCalledWith(2)
  })

  it("Applies grouped labels to the radiogroup and dot buttons.", () => {
    renderWithCarouselContext(
      <CarouselDots
        labels={{
          navigationAriaLabel: "Localized slide picker",
          dotButtonLabel: ({ itemNumber, itemCount }) => `Choose localized item ${itemNumber} of ${itemCount}`,
        }}
      />,
      {
        itemCount: 3,
        selectedIndex: 0,
      },
    )

    const radiogroup = screen.getByRole("radiogroup", { name: "Localized slide picker" })
    const radios = within(radiogroup).getAllByRole("radio")

    expect(radios[0]).toHaveAccessibleName("Choose localized item 1 of 3")
  })

  it("Keeps roving focus manual until Enter or Space is pressed.", () => {
    const scrollTo = vi.fn()

    renderWithCarouselContext(<CarouselDots activationMode={CAROUSEL_DOTS_ACTIVATION_MODE__MANUAL} />, {
      itemCount: 4,
      selectedIndex: 0,
      scrollTo,
    })

    const radios = screen.getAllByRole("radio")
    radios[0].focus()

    fireEvent.keyDown(radios[0], { key: "ArrowRight" })
    expect(scrollTo).not.toHaveBeenCalled()
    expect(radios[1]).toHaveFocus()

    fireEvent.keyDown(radios[1], { key: "End" })
    expect(radios[3]).toHaveFocus()
    expect(scrollTo).not.toHaveBeenCalled()

    fireEvent.keyDown(radios[3], { key: "Enter" })
    expect(scrollTo).toHaveBeenCalledWith(3)
  })

  it("Auto-activates scroll changes on arrow and home/end keys.", () => {
    const scrollTo = vi.fn()

    renderWithCarouselContext(<CarouselDots activationMode={CAROUSEL_DOTS_ACTIVATION_MODE__AUTO} />, {
      itemCount: 5,
      selectedIndex: 0,
      scrollTo,
    })

    const radios = screen.getAllByRole("radio")
    radios[0].focus()

    fireEvent.keyDown(radios[0], { key: "ArrowRight" })
    expect(scrollTo).toHaveBeenLastCalledWith(1)

    fireEvent.keyDown(radios[1], { key: "End" })
    expect(scrollTo).toHaveBeenLastCalledWith(4)
  })

  it("Renders visual-only dots when interactivity is disabled.", () => {
    const { container } = renderWithCarouselContext(<CarouselDots interactive={false} />, {
      itemCount: 4,
      selectedIndex: 1,
    })

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument()
    expect(container.querySelectorAll("button")).toHaveLength(0)
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true")
  })

  it("Renders overflow sentinels only when the current window overflows.", () => {
    const { container, unmount } = renderWithCarouselContext(<CarouselDots showOverflowSentinels />, {
      itemCount: 10,
      selectedIndex: 5,
    })

    expect(container.querySelectorAll(`.${styles["carouselDots__dot--sentinel"]}`)).toHaveLength(2)

    unmount()

    const { container: edgeContainer } = renderWithCarouselContext(<CarouselDots showOverflowSentinels />, {
      itemCount: 10,
      selectedIndex: 0,
    })

    expect(edgeContainer.querySelectorAll(`.${styles["carouselDots__dot--sentinel"]}`)).toHaveLength(1)
  })

  it("Realigns DOM focus when selection changes externally in manual mode.", async () => {
    const initialContext = createCarouselContextValue({
      itemCount: 5,
      selectedIndex: 1,
      scrollTo: vi.fn(),
    })

    const { rerender } = render(
      <CarouselContext.Provider value={initialContext}>
        <CarouselDots activationMode={CAROUSEL_DOTS_ACTIVATION_MODE__MANUAL} />
      </CarouselContext.Provider>,
    )

    const updatedContext = createCarouselContextValue({
      ...initialContext,
      selectedIndex: 3,
    })

    rerender(
      <CarouselContext.Provider value={updatedContext}>
        <CarouselDots activationMode={CAROUSEL_DOTS_ACTIVATION_MODE__MANUAL} />
      </CarouselContext.Provider>,
    )

    await waitFor(() => {
      expect(screen.getAllByRole("radio")[3]).toHaveFocus()
    })
  })
})
