import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import textStyles from "../../../TextStyles.module.css"
import PlaceholderText from "../PlaceholderText"
import styles from "../PlaceholderTextStyles.module.css"

describe("<PlaceholderText />", () => {
  it("renders with the sealed placeholder text treatment.", () => {
    render(<PlaceholderText>No matching artists found.</PlaceholderText>)

    const placeholderText = screen.getByTestId("placeholder-text")

    expect(placeholderText).toHaveTextContent("No matching artists found.")
    expect(placeholderText).toHaveClass(textStyles.b11)
    expect(placeholderText).toHaveClass(textStyles["fs-italic"])
    expect(placeholderText).toHaveClass(styles.placeholderText)
    expect(placeholderText).toHaveClass(styles["placeholderText--alignLeft"])
  })

  it("supports alignment, element type, custom class, and custom styles.", () => {
    render(
      <PlaceholderText
        align="center"
        elementType="span"
        customClassName="custom-placeholder"
        customStyles={{ maxWidth: 320 }}
      >
        No saved views.
      </PlaceholderText>,
    )

    const placeholderText = screen.getByTestId("placeholder-text")

    expect(placeholderText.tagName).toBe("SPAN")
    expect(placeholderText).toHaveClass(styles["placeholderText--alignCenter"])
    expect(placeholderText).toHaveClass("custom-placeholder")
    expect(placeholderText).toHaveStyle({ maxWidth: "320px" })
  })
})
