import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import CircleLoader from "../CircleLoader"
import styles from "../CircleLoaderStyles.module.css"

describe("<CircleLoader />", () => {
  it("renders an accessible loading status with default spinner styling.", () => {
    render(<CircleLoader />)

    const loader = screen.getByRole("status", { name: "Loading" })
    const spinner = loader.firstElementChild as HTMLElement

    expect(loader).toHaveClass(styles.loader)
    expect(spinner).toHaveClass(styles.spinner)
    expect(spinner.style.getPropertyValue("--size")).toBe("25px")
    expect(spinner.style.getPropertyValue("--track-width")).toBe("3px")
    expect(spinner.style.getPropertyValue("--spinner-color")).toBe("currentColor")
    expect(spinner.style.getPropertyValue("--track-color")).toBe("rgba(127, 127, 127, 0.22)")
    expect(spinner.style.getPropertyValue("--duration")).toBe("0.85s")
  })

  it("applies custom dimensions, colors, duration, and root styles.", () => {
    render(
      <CircleLoader
        ariaLabel="Saving"
        customStyles={{ marginTop: 5 }}
        duration={450}
        size="2rem"
        spinnerColor="purple"
        spinnerTrackColor="silver"
        spinnerTrackWidth="0.25rem"
        testID="saving-loader"
      />,
    )

    const loader = screen.getByTestId("saving-loader")
    const spinner = loader.firstElementChild as HTMLElement

    expect(loader).toHaveAttribute("aria-label", "Saving")
    expect(loader).toHaveStyle({ marginTop: "5px" })
    expect(spinner.style.getPropertyValue("--size")).toBe("2rem")
    expect(spinner.style.getPropertyValue("--track-width")).toBe("0.25rem")
    expect(spinner.style.getPropertyValue("--spinner-color")).toBe("purple")
    expect(spinner.style.getPropertyValue("--track-color")).toBe("silver")
    expect(spinner.style.getPropertyValue("--duration")).toBe("450ms")
  })

  it("uses a transparent spinner track when requested.", () => {
    render(<CircleLoader spinnerTrackColor="silver" spinnerTrackIsTransparent />)

    const spinner = screen.getByRole("status").firstElementChild as HTMLElement

    expect(spinner.style.getPropertyValue("--track-color")).toBe("transparent")
  })
})
