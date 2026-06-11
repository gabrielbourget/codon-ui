import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import styles from "../CarouselStyles.module.css"
import {
  CAROUSEL_ALIGNMENT_AXIS__Y,
  CAROUSEL_SLIDE_ALIGNMENT__END,
  calibrateComponent,
  computeEmblaOptions,
  useCarouselContext,
} from "../helpers"

describe("Carousel helper tests", () => {
  it("Computes Embla options with the default values.", () => {
    expect(computeEmblaOptions({ items: [], renderCarouselItem: vi.fn() })).toEqual({
      loop: true,
      axis: "x",
      align: "center",
      dragFree: false,
      skipSnaps: false,
    })
  })

  it("Computes Embla options with explicit overrides.", () => {
    expect(
      computeEmblaOptions({
        items: [],
        renderCarouselItem: vi.fn(),
        loopEnabled: false,
        axis: CAROUSEL_ALIGNMENT_AXIS__Y,
        align: CAROUSEL_SLIDE_ALIGNMENT__END,
      }),
    ).toEqual({
      loop: false,
      axis: "y",
      align: "end",
      dragFree: false,
      skipSnaps: false,
    })
  })

  it("Throws when the carousel context is consumed outside a provider.", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const TestComponent = () => {
      useCarouselContext()
      return null
    }

    expect(() => render(<TestComponent />)).toThrow(
      "A problem was encountered while trying to use the carousel context. useCarouselContext must be used within <Carousel>",
    )

    errorSpy.mockRestore()
  })

  it("Combines the base carousel classes with custom classes.", () => {
    const result = calibrateComponent({
      items: [],
      renderCarouselItem: vi.fn(),
      className: "native-carousel",
      customClassName: "custom-carousel",
      customStyles: { color: "turquoise" },
      style: { backgroundColor: "blue" },
      customViewportClassName: "custom-viewport",
      customViewportStyles: { backgroundColor: "red" },
      customContainerClassName: "custom-container",
      customContainerStyles: { opacity: 0.8 },
      customItemClassName: "custom-item",
      customItemStyles: { padding: 5 },
      customChromeClassName: "custom-chrome",
      customChromeStyles: { transform: "translateY(5px)" },
    })

    expect(result.carouselStyles).toContain(styles.carousel)
    expect(result.carouselStyles).toContain("native-carousel")
    expect(result.carouselStyles).toContain("custom-carousel")
    expect(result.carouselStyle).toEqual({ color: "turquoise", backgroundColor: "blue" })
    expect(result.viewportStyles).toContain(styles.carousel__viewport)
    expect(result.viewportStyles).toContain("custom-viewport")
    expect(result.viewportStyle).toEqual({ backgroundColor: "red" })
    expect(result.containerStyles).toContain(styles.carousel__container)
    expect(result.containerStyles).toContain("custom-container")
    expect(result.containerStyle).toEqual({ opacity: 0.8 })
    expect(result.itemStyles).toContain(styles.carousel__item)
    expect(result.itemStyles).toContain("custom-item")
    expect(result.itemStyle).toEqual({ padding: 5 })
    expect(result.chromeStyles).toContain(styles.carousel__chrome)
    expect(result.chromeStyles).toContain("custom-chrome")
    expect(result.chromeStyle).toEqual({ transform: "translateY(5px)" })
  })
})
