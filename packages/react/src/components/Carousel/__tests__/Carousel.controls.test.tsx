import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { TButtonProps } from "../../Button/helpers"
import CarouselCloseButton from "../components/CarouselCloseButton/CarouselCloseButton"
import CarouselNextButton from "../components/CarouselNextButton/CarouselNextButton"
import CarouselPrevButton from "../components/CarouselPrevButton/CarouselPrevButton"

import { renderWithCarouselContext } from "./emblaTestHarness"

type TButtonClassName = Exclude<TButtonProps["className"], string | undefined>

describe.each([
  { Control: CarouselCloseButton, name: "Close Carousel" },
  { Control: CarouselNextButton, name: "Next Item" },
  { Control: CarouselPrevButton, name: "Previous Item" },
])("$name render-prop classes", ({ Control, name }) => {
  it("composes both callbacks with the same live Button state and preserves static classes", async () => {
    const user = userEvent.setup()
    const rootClassName = vi.fn<TButtonClassName>(({ isPressed }) => (isPressed ? "root-pressed" : "root-idle"))
    const nestedClassName = vi.fn<TButtonClassName>(({ isDisabled }) =>
      isDisabled ? "nested-disabled" : "nested-enabled",
    )

    renderWithCarouselContext(
      <Control
        className={rootClassName}
        customClassName="root-static"
        customButtonProps={{ className: nestedClassName, customClassName: "nested-static" }}
      />,
      { canScrollNext: true, canScrollPrev: true },
    )
    const button = screen.getByRole("button", { name })
    expect(button).toHaveClass("root-idle", "nested-enabled", "root-static", "nested-static")
    expect(rootClassName).toHaveBeenCalledWith(expect.objectContaining({ isPressed: false, isDisabled: false }))
    expect(rootClassName.mock.lastCall?.[0]).toBe(nestedClassName.mock.lastCall?.[0])

    await user.pointer({ target: button, keys: "[MouseLeft>]" })
    expect(button).toHaveClass("root-pressed", "nested-enabled", "root-static", "nested-static")
    expect(button).not.toHaveClass("root-idle")
    expect(rootClassName.mock.lastCall?.[0]).toBe(nestedClassName.mock.lastCall?.[0])

    await user.pointer({ target: button, keys: "[/MouseLeft]" })
    expect(button).toHaveClass("root-idle")
    expect(button).not.toHaveClass("root-pressed")
  })

  it("passes the disabled render state to both callbacks", () => {
    const rootClassName = vi.fn<TButtonClassName>(({ isDisabled }) => (isDisabled ? "root-disabled" : "root-enabled"))
    const nestedClassName = vi.fn<TButtonClassName>(({ isDisabled }) =>
      isDisabled ? "nested-disabled" : "nested-enabled",
    )

    renderWithCarouselContext(
      <Control isDisabled className={rootClassName} customButtonProps={{ className: nestedClassName }} />,
      { canScrollNext: true, canScrollPrev: true },
    )
    const button = screen.getByRole("button", { name })
    expect(button).toBeDisabled()
    expect(button).toHaveClass("root-disabled", "nested-disabled")
    expect(rootClassName).toHaveBeenCalledWith(expect.objectContaining({ isDisabled: true }))
    expect(rootClassName.mock.lastCall?.[0]).toBe(nestedClassName.mock.lastCall?.[0])
  })
})
