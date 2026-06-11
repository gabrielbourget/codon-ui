import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { INDICATOR_SHAPE__ROUNDED, INDICATOR_SHAPE__SQUARE, type TIndicatorProps } from "../helpers"
import Indicator from "../Indicator"
import styles from "../IndicatorStyles.module.css"

const renderIndicator = (props: Partial<TIndicatorProps> = {}) =>
  render(<Indicator data-testid="indicator" {...props} />)

describe("<Indicator />", () => {
  it("renders a circular active indicator by default.", () => {
    renderIndicator()

    const indicator = screen.getByTestId("indicator")

    expect(indicator).toHaveClass(styles.indicator)
    expect(indicator).toHaveClass(styles["indicator--circle"])
    expect(indicator.style.getPropertyValue("--indicator-size")).toBe("10px")
    expect(indicator.style.getPropertyValue("--indicator-color")).toBe("currentColor")
    expect(indicator.style.getPropertyValue("--indicator-border-width")).toBe("0px")
  })

  it("uses inactive color when isActive is false.", () => {
    renderIndicator({
      color: "lime",
      inactiveColor: "gray",
      isActive: false,
    })

    const indicator = screen.getByTestId("indicator")

    expect(indicator.style.getPropertyValue("--indicator-color")).toBe("gray")
    expect(indicator.style.getPropertyValue("--indicator-border-color")).toBe("lime")
  })

  it("merges native root className and style with custom root styling aliases.", () => {
    renderIndicator({
      borderColor: "black",
      borderWidth: 2,
      className: "native-indicator",
      color: "green",
      customClassName: "custom-indicator",
      customStyles: { backgroundColor: "purple", marginTop: 5 },
      shape: INDICATOR_SHAPE__ROUNDED,
      size: 14,
      style: { backgroundColor: "tomato", marginBottom: 10 },
    })

    const indicator = screen.getByTestId("indicator")

    expect(indicator).toHaveClass(styles.indicator)
    expect(indicator).toHaveClass(styles["indicator--rounded"])
    expect(indicator).toHaveClass("custom-indicator")
    expect(indicator).toHaveClass("native-indicator")
    expect(indicator.style.getPropertyValue("--indicator-size")).toBe("14px")
    expect(indicator.style.getPropertyValue("--indicator-border-color")).toBe("black")
    expect(indicator.style.getPropertyValue("--indicator-border-width")).toBe("2px")
    expect(indicator).toHaveStyle({
      backgroundColor: "rgb(255, 99, 71)",
      marginTop: "5px",
      marginBottom: "10px",
    })
  })

  it("preserves CSS string sizes and square shape.", () => {
    renderIndicator({
      borderWidth: "2px",
      shape: INDICATOR_SHAPE__SQUARE,
      size: "1rem",
    })

    const indicator = screen.getByTestId("indicator")

    expect(indicator).toHaveClass(styles["indicator--square"])
    expect(indicator.style.getPropertyValue("--indicator-size")).toBe("1rem")
    expect(indicator.style.getPropertyValue("--indicator-border-width")).toBe("2px")
  })

  it("does not leak wrapper props onto the root element.", () => {
    renderIndicator({
      borderColor: "black",
      borderWidth: 2,
      color: "green",
      customClassName: "custom-indicator",
      customStyles: { marginTop: 5 },
      inactiveColor: "gray",
      isActive: false,
      shape: INDICATOR_SHAPE__ROUNDED,
      size: 14,
    })

    const indicator = screen.getByTestId("indicator")

    expect(indicator).not.toHaveAttribute("bordercolor")
    expect(indicator).not.toHaveAttribute("borderwidth")
    expect(indicator).not.toHaveAttribute("color")
    expect(indicator).not.toHaveAttribute("customclassname")
    expect(indicator).not.toHaveAttribute("customstyles")
    expect(indicator).not.toHaveAttribute("inactivecolor")
    expect(indicator).not.toHaveAttribute("isactive")
    expect(indicator).not.toHaveAttribute("shape")
    expect(indicator).not.toHaveAttribute("size")
  })
})
