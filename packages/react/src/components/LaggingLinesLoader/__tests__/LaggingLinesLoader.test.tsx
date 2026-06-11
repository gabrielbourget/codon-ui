import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import LaggingLinesLoader from "../LaggingLinesLoader"
import styles from "../LaggingLinesLoaderStyles.module.css"

const getLoaderParts = (container: HTMLElement) => {
  const loader = container.firstElementChild as HTMLElement
  const loadingSlide = loader.firstElementChild as HTMLElement
  const slides = Array.from(loadingSlide.children) as HTMLElement[]

  return { loader, loadingSlide, slides }
}

describe("<LaggingLinesLoader />", () => {
  it("renders the default three-line loading animation.", () => {
    const { container } = render(<LaggingLinesLoader />)
    const { loader, loadingSlide, slides } = getLoaderParts(container)

    expect(loader).toHaveClass(styles.loader)
    expect(loader.style.getPropertyValue("--width")).toBe("150px")
    expect(loadingSlide).toHaveClass(styles.loadingSlide)
    expect(slides).toHaveLength(3)
    expect(slides[0]).toHaveClass(styles.slide)
    expect(slides[1]).toHaveClass(styles.slide)
    expect(slides[2]).toHaveClass(styles.slide)
  })

  it("applies custom width, color, duration, and slide styles.", () => {
    const { container } = render(
      <LaggingLinesLoader color="purple" customStyles={{ borderRadius: 5 }} duration={500} width="12rem" />,
    )
    const { loader, slides } = getLoaderParts(container)

    expect(loader.style.getPropertyValue("--width")).toBe("12rem")
    slides.forEach((slide) => {
      expect(slide).toHaveStyle({ animationDuration: "500ms", background: "purple", borderRadius: "5px" })
    })
  })
})
