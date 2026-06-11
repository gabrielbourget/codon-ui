import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import Counter from "../Counter"

describe("<Counter />", () => {
  it("renders.", () => {
    render(<Counter value={49} aria-label="counter" />)

    const counter = screen.getByTestId("counter")
    expect(counter).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      render(<Counter height={50} width={150} value={59} aria-label="counter" />)

      const counter = screen.getByTestId("counter")
      expect(counter).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("responds to color prop.", () => {
      render(<Counter color="turquoise" value={69} maxValue={100} showMaxValue aria-label="counter" />)

      const counterTextElements = screen.getAllByTestId("text")
      counterTextElements.forEach((textElement) => expect(textElement).toHaveStyle({ color: "rgb(64, 224, 208)" }))
    })

    it("responds to maxValue props.", () => {
      render(<Counter value={18} showMaxValue maxValue={48} aria-label="counter" />)

      const maxValueText = screen.getByText("/48")
      expect(maxValueText).toBeInTheDocument()
    })

    it("responds to conditional showMaxValue prop.", () => {
      const { rerender } = render(<Counter value={18} maxValue={48} aria-label="counter" />)
      let maxValueText = screen.queryByText("/48")
      expect(maxValueText).toBeNull()

      rerender(<Counter value={18} showMaxValue maxValue={48} aria-label="counter" />)
      maxValueText = screen.queryByText("/48")
      expect(maxValueText).toBeInTheDocument()
    })

    it("responds to conditional showProgressIndicator prop.", () => {
      const { rerender } = render(<Counter value={48} maxValue={89} aria-label="counter" />)
      let progressIndicator = screen.queryByTestId("circular-progress")
      expect(progressIndicator).toBeNull()

      rerender(<Counter value={48} maxValue={89} showProgressIndicator aria-label="counter" />)
      progressIndicator = screen.queryByTestId("circular-progress")
      expect(progressIndicator).toBeInTheDocument()
    })

    it("responds to custom style props.", () => {
      render(
        <Counter
          value={75}
          maxValue={100}
          showMaxValue
          showProgressIndicator
          customStyles={{ backgroundColor: "turquoise", borderRadius: 0 }}
          customProgressIndicatorStyles={{ height: 30, width: 30 }}
          customTextStyles={{ color: "blue" }}
          aria-label="counter"
        />,
      )

      const counter = screen.getByTestId("counter")
      const progressIndicator = screen.getByTestId("circular-progress")
      const textElements = screen.queryAllByTestId("text")

      expect(counter).toHaveStyle({ backgroundColor: "rgb(64, 224, 208)", borderRadius: 0 })
      expect(progressIndicator).toHaveStyle({ height: "30px", width: "30px" })
      textElements.forEach((textElement) => expect(textElement).toHaveStyle({ color: "rgb(0, 0, 255)" }))
    })

    it("merges native root class and style props.", () => {
      render(
        <Counter
          value={75}
          aria-label="counter"
          className="native-counter-class"
          customClassName="custom-counter-class"
          customStyles={{ backgroundColor: "red" }}
          style={{ backgroundColor: "blue" }}
        />,
      )

      const counter = screen.getByTestId("counter")

      expect(counter).toHaveClass("native-counter-class")
      expect(counter).toHaveClass("custom-counter-class")
      expect(counter).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
    })

    it("computes threshold status color from percentages.", () => {
      const { rerender } = render(
        <Counter
          value={70}
          maxValue={200}
          warningPercentageThreshold={30}
          errorOrDangerPercentageThreshold={40}
          aria-label="counter"
        />,
      )

      expect(screen.getByText("70")).toHaveStyle({ color: "var(--cui-status-warning, var(--cui-state-warning))" })

      rerender(
        <Counter
          value="90"
          maxValue="200"
          warningPercentageThreshold={30}
          errorOrDangerPercentageThreshold={40}
          aria-label="counter"
        />,
      )

      expect(screen.getByText("90")).toHaveStyle({ color: "var(--cui-status-danger, var(--cui-state-danger))" })
    })

    it("does not leak wrapper props to the root element.", () => {
      render(
        <Counter
          value={75}
          maxValue={100}
          showMaxValue
          showProgressIndicator
          warningPercentageThreshold={60}
          errorOrDangerPercentageThreshold={90}
          customStyles={{ backgroundColor: "red" }}
          customProgressIndicatorStyles={{ backgroundColor: "blue" }}
          customTextStyles={{ color: "green" }}
          customClassName="custom-counter-class"
          ariaLabel="counter"
        />,
      )

      const counter = screen.getByTestId("counter")

      expect(counter).not.toHaveAttribute("showmaxvalue")
      expect(counter).not.toHaveAttribute("showprogressindicator")
      expect(counter).not.toHaveAttribute("warningpercentagethreshold")
      expect(counter).not.toHaveAttribute("errorordangerpercentagethreshold")
      expect(counter).not.toHaveAttribute("customstyles")
      expect(counter).not.toHaveAttribute("customprogressindicatorstyles")
      expect(counter).not.toHaveAttribute("customtextstyles")
      expect(counter).not.toHaveAttribute("customclassname")
      expect(counter).not.toHaveAttribute("arialabel")
    })
  })
})
