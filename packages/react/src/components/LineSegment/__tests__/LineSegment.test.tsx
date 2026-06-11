import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import LineSegment, { LINE_SEGMENT_DIRECTION__HORIZONTAL, LINE_SEGMENT_DIRECTION__VERTICAL } from "../LineSegment"

describe("<LineSegment />", () => {
  it("renders.", () => {
    render(<LineSegment data-testid="line-segment" />)

    expect(screen.getByTestId("line-segment")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    describe("horizontal direction", () => {
      it("renders with default styles when no props are provided.", () => {
        const { container } = render(<LineSegment />)
        const element = container.firstChild as HTMLElement

        expect(element).toHaveStyle({
          backgroundColor: "var(--cui-border)",
          height: "50px",
          width: "2.5px",
        })
      })

      it("uses height and size props for a horizontal segment.", () => {
        const { container } = render(
          <LineSegment direction={LINE_SEGMENT_DIRECTION__HORIZONTAL} height={80} size={4} color="red" />,
        )
        const element = container.firstChild as HTMLElement

        expect(element).toHaveStyle({
          backgroundColor: "rgb(255, 0, 0)",
          height: "80px",
          width: "4px",
        })
      })
    })

    describe("vertical direction", () => {
      it("renders with correct styles for a vertical segment.", () => {
        const { container } = render(<LineSegment direction={LINE_SEGMENT_DIRECTION__VERTICAL} />)
        const element = container.firstChild as HTMLElement

        expect(element).toHaveStyle({
          backgroundColor: "var(--cui-border)",
          width: "50px",
          height: "2.5px",
        })
      })

      it("uses width and size props for a vertical segment.", () => {
        const { container } = render(
          <LineSegment direction={LINE_SEGMENT_DIRECTION__VERTICAL} width={100} size={5} color="blue" />,
        )
        const element = container.firstChild as HTMLElement

        expect(element).toHaveStyle({
          backgroundColor: "rgb(0, 0, 255)",
          width: "100px",
          height: "5px",
        })
      })
    })

    it("applies customClassName to the element.", () => {
      const { container } = render(<LineSegment customClassName="my-custom-class" />)
      const element = container.firstChild as HTMLElement

      expect(element).toHaveClass("my-custom-class")
    })

    it("merges native className and style without losing computed styles.", () => {
      render(
        <LineSegment
          data-testid="line-segment"
          color="green"
          customClassName="custom-line-segment"
          className="native-line-segment"
          customStyles={{ backgroundColor: "purple", opacity: 0.5 }}
          style={{ backgroundColor: "tomato", marginTop: 5 }}
        />,
      )

      const element = screen.getByTestId("line-segment")

      expect(element).toHaveClass("custom-line-segment")
      expect(element).toHaveClass("native-line-segment")
      expect(element).toHaveStyle({
        backgroundColor: "rgb(255, 99, 71)",
        height: "50px",
        marginTop: "5px",
        opacity: "0.5",
        width: "2.5px",
      })
    })

    it("merges customStyles with computed styles.", () => {
      const { container } = render(<LineSegment customStyles={{ opacity: 0.5, borderRadius: "4px" }} />)
      const element = container.firstChild as HTMLElement

      expect(element).toHaveStyle({ opacity: "0.5", borderRadius: "4px" })
    })

    it("customStyles can override computed styles.", () => {
      const { container } = render(<LineSegment color="green" customStyles={{ backgroundColor: "purple" }} />)
      const element = container.firstChild as HTMLElement

      expect(element).toHaveStyle({ backgroundColor: "rgb(128, 0, 128)" })
    })

    it("accepts string values for height, width, and size.", () => {
      const { container } = render(
        <LineSegment direction={LINE_SEGMENT_DIRECTION__HORIZONTAL} height="100px" size="3px" />,
      )
      const element = container.firstChild as HTMLElement

      expect(element).toHaveStyle({ height: "100px", width: "3px" })
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <LineSegment
          data-testid="line-segment"
          color="green"
          direction={LINE_SEGMENT_DIRECTION__VERTICAL}
          height={50}
          width={100}
          size={5}
          customClassName="custom-line-segment"
          customStyles={{ opacity: 0.5 }}
        />,
      )

      const element = screen.getByTestId("line-segment")

      expect(element).not.toHaveAttribute("color")
      expect(element).not.toHaveAttribute("direction")
      expect(element).not.toHaveAttribute("height")
      expect(element).not.toHaveAttribute("width")
      expect(element).not.toHaveAttribute("size")
      expect(element).not.toHaveAttribute("customclassname")
      expect(element).not.toHaveAttribute("customstyles")
    })
  })
})
