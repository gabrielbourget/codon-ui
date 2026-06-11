import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import Card from "../Card"
import styles from "../CardStyles.module.css"

describe("<Card />", () => {
  it("merges native root className and style with custom root styling aliases.", () => {
    render(
      <Card
        aria-label="Card root"
        className="native-card"
        customClassName="custom-card"
        customStyles={{ backgroundColor: "turquoise", marginTop: 5 }}
        data-testid="custom-card"
        role="group"
        style={{ backgroundColor: "tomato", marginBottom: 10 }}
      >
        Card content
      </Card>,
    )

    const card = screen.getByRole("group", { name: "Card root" })

    expect(card).toHaveClass(styles.card)
    expect(card).toHaveClass("custom-card")
    expect(card).toHaveClass("native-card")
    expect(card).toHaveStyle({
      backgroundColor: "rgb(255, 99, 71)",
      marginTop: "5px",
      marginBottom: "10px",
    })
    expect(screen.getByTestId("custom-card")).toBe(card)
  })

  it("preserves numeric dimension normalization and CSS dimension strings.", () => {
    render(
      <Card
        borderRadius="2rem"
        data-testid="sized-card"
        height="50%"
        style={{ width: "calc(100% - 10px)" }}
        width="320"
      >
        Card content
      </Card>,
    )

    const card = screen.getByTestId("sized-card")

    expect(card).toHaveStyle({
      "--borderRadius": "2rem",
      "--height": "50%",
      "--width": "320px",
      width: "calc(100% - 10px)",
    })
  })

  it("does not leak wrapper-only props onto the root element.", () => {
    render(
      <Card
        borderRadius="15"
        customClassName="custom-card"
        customStyles={{ marginTop: 5 }}
        data-testid="card"
        height="200"
        layoutMode="position"
        raised={false}
        width="300"
      >
        Card content
      </Card>,
    )

    const card = screen.getByTestId("card")

    expect(card).not.toHaveAttribute("borderradius")
    expect(card).not.toHaveAttribute("customclassname")
    expect(card).not.toHaveAttribute("customstyles")
    expect(card).not.toHaveAttribute("height")
    expect(card).not.toHaveAttribute("layoutmode")
    expect(card).not.toHaveAttribute("raised")
    expect(card).not.toHaveAttribute("width")
  })
})
