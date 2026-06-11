import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  AVAILABLE_ELEM_TYPES,
  AVAILABLE_FONT_VARIANTS,
  AVAILABLE_FONT_WEIGHTS,
  ELEM_TYPE__LABEL,
  ELEM_TYPE__P,
  FONT_STYLE__ITALIC,
  FONT_VARIANT__BODY_10,
  FONT_WEIGHT__BOLD,
  FONT_WEIGHT__EXTRABOLD,
  FONT_WEIGHT__LIGHT,
  FONT_WEIGHT__MEDIUM,
  FONT_WEIGHT__REGULAR,
  FONT_WEIGHT__SEMIBOLD,
} from "../constants"
import type { TTextProps } from "../helpers"
import Text from "../Text"
import textStyles from "../TextStyles.module.css"
import type { TAvailableFontWeights } from "../types"

const renderText = (props: Partial<TTextProps> = {}) => render(<Text {...props}>Test Text</Text>)

const getText = () => screen.getByTestId("text")

const fontWeightStyleByWeight: Record<TAvailableFontWeights, string> = {
  [FONT_WEIGHT__LIGHT]: "fw-light",
  [FONT_WEIGHT__REGULAR]: "fw-regular",
  [FONT_WEIGHT__SEMIBOLD]: "fw-semibold",
  [FONT_WEIGHT__MEDIUM]: "fw-medium",
  [FONT_WEIGHT__BOLD]: "fw-bold",
  [FONT_WEIGHT__EXTRABOLD]: "fw-extrabold",
}

describe("<Text />", () => {
  it("renders with default typography.", () => {
    renderText()

    const text = getText()

    expect(text).toBeInTheDocument()
    expect(text).toHaveTextContent("Test Text")
    expect(text.tagName).toBe(ELEM_TYPE__P.toUpperCase())
    expect(text).toHaveClass(textStyles.base)
    expect(text).toHaveClass(textStyles[FONT_VARIANT__BODY_10])
    expect(text).toHaveClass(textStyles["fw-regular"])
    expect(text).not.toHaveClass("undefined")
  })

  describe("props API surface", () => {
    it("responds to variant props.", () => {
      const { rerender } = renderText()

      for (const variant of AVAILABLE_FONT_VARIANTS) {
        rerender(<Text variant={variant}>Test Text</Text>)

        const text = getText()
        expect(text).toHaveClass(textStyles[variant])
      }
    })

    it("responds to font weight props.", () => {
      const { rerender } = renderText()

      for (const fontWeight of AVAILABLE_FONT_WEIGHTS) {
        rerender(<Text fontWeight={fontWeight}>Test Text</Text>)

        const text = getText()
        expect(text).toHaveClass(textStyles[fontWeightStyleByWeight[fontWeight]])
      }
    })

    it("responds to font style props.", () => {
      renderText({ fontStyle: FONT_STYLE__ITALIC })

      const text = getText()
      expect(text).toHaveClass(textStyles["fs-italic"])
    })

    it("responds to element type props.", () => {
      const { rerender } = renderText()

      for (const elementType of AVAILABLE_ELEM_TYPES) {
        rerender(<Text elementType={elementType}>Test Text</Text>)

        const text = getText()
        expect(text.tagName).toBe(elementType.toUpperCase())
      }
    })

    it("responds to custom styling props.", () => {
      renderText({
        color: "turquoise",
        customStyles: { borderRadius: 0 },
        customClassName: "custom-text-class",
        composedInLink: true,
        elementType: ELEM_TYPE__LABEL,
      })

      const text = getText()

      expect(text).toHaveClass(textStyles.composedInLink)
      expect(text).toHaveClass(textStyles["base--unselectable"])
      expect(text).toHaveClass("custom-text-class")
      expect(text).toHaveStyle({ color: "rgb(64, 224, 208)", borderRadius: 0 })
    })

    it("merges native className and style without losing computed classes.", () => {
      renderText({
        color: "turquoise",
        customStyles: { marginTop: 5 },
        customClassName: "custom-text-class",
        className: "native-text-class",
        style: { color: "tomato", marginBottom: 10 },
      })

      const text = getText()

      expect(text).toHaveClass(textStyles.base)
      expect(text).toHaveClass(textStyles[FONT_VARIANT__BODY_10])
      expect(text).toHaveClass("custom-text-class")
      expect(text).toHaveClass("native-text-class")
      expect(text).toHaveStyle({
        color: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("forwards safe native props without replacing computed root props.", () => {
      const onClick = vi.fn()

      renderText({
        id: "native-text-id",
        role: "status",
        "aria-label": "Native text label",
        elementType: ELEM_TYPE__LABEL,
        htmlFor: "native-input-id",
        className: "native-text-class",
        style: { color: "tomato" },
        onClick,
      })

      const text = getText()
      text.click()

      expect(text).toHaveAttribute("id", "native-text-id")
      expect(text).toHaveAttribute("role", "status")
      expect(text).toHaveAttribute("aria-label", "Native text label")
      expect(text).toHaveAttribute("for", "native-input-id")
      expect(text).toHaveClass(textStyles.base)
      expect(text).toHaveClass("native-text-class")
      expect(text).toHaveStyle({ color: "rgb(255, 99, 71)" })
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it("does not leak typography props onto the DOM element.", () => {
      renderText({
        variant: FONT_VARIANT__BODY_10,
        fontWeight: FONT_WEIGHT__BOLD,
        fontStyle: FONT_STYLE__ITALIC,
        composedInLink: true,
        customClassName: "custom-text-class",
      })

      const text = getText()

      expect(text).not.toHaveAttribute("variant")
      expect(text).not.toHaveAttribute("fontWeight")
      expect(text).not.toHaveAttribute("fontStyle")
      expect(text).not.toHaveAttribute("composedInLink")
      expect(text).not.toHaveAttribute("customClassName")
    })
  })
})
