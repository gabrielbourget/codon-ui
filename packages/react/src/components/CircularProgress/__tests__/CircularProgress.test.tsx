import { readFileSync } from "node:fs"

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { STROKE_LINECAP__BUTT, STROKE_LINECAP__ROUND, STROKE_LINECAP__SQUARE } from "../../../tokens/svg"
import CircularProgress from "../CircularProgress"
import styles from "../CircularProgressStyles.module.css"
import { computePathRatio, computePathRadius } from "../helpers"
import { computeDashStyle } from "../Path/helpers"

const circularProgressStylesSource = readFileSync(
  "src/components/CircularProgress/CircularProgressStyles.module.css",
  "utf8",
)

describe("<CircularProgress />", () => {
  it("renders.", () => {
    render(<CircularProgress aria-label="circular progress" value={36} />)

    expect(screen.getByTestId("circular-progress")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("uses the semantic base path style when no order is provided.", () => {
      render(<CircularProgress value={18} aria-label="circular progress" />)

      expect(screen.getByTestId("circular-progress-path")).not.toHaveClass(styles["circularProgress__path--primary"])
    })

    it("responds to height and width props.", () => {
      render(<CircularProgress value={64} height={150} width={150} aria-label="circular progress" />)

      const circularProgressStyles = getComputedStyle(screen.getByTestId("circular-progress"))
      expect(circularProgressStyles.height).toBe("150px")
      expect(circularProgressStyles.width).toBe("150px")
    })

    it("responds to color props.", () => {
      render(
        <CircularProgress
          value={27}
          backgroundColor="cyan"
          pathColor="green"
          trackColor="orange"
          aria-label="circular progress"
        />,
      )

      expect(screen.getByTestId("circular-progress-circle")).toHaveStyle({ backgroundColor: "rgb(0, 255, 255)" })
      expect(screen.getByTestId("circular-progress-track")).toHaveStyle({ color: "rgb(255, 165, 0)" })
      expect(screen.getByTestId("circular-progress-path")).toHaveStyle({ color: "rgb(0, 128, 0)" })
    })

    it("responds to backgroundPadding prop.", () => {
      render(
        <CircularProgress
          value={27}
          backgroundColor="cyan"
          backgroundPadding={10}
          strokeWidth={6}
          aria-label="circular progress"
        />,
      )

      const expectedRadius = computePathRadius({
        value: 27,
        backgroundColor: "cyan",
        backgroundPadding: 10,
        strokeWidth: 6,
        "aria-label": "circular progress",
      })

      expect(screen.getByTestId("circular-progress-track")).toHaveAttribute(
        "d",
        expect.stringContaining(`m 0,-${expectedRadius}`),
      )
      expect(screen.getByTestId("circular-progress-path")).toHaveAttribute(
        "d",
        expect.stringContaining(`m 0,-${expectedRadius}`),
      )
    })

    it("responds to theming order props.", () => {
      const { rerender } = render(<CircularProgress value={83} order="primary" aria-label="circular progress" />)
      const circularProgressPath = screen.getByTestId("circular-progress-path")
      expect(circularProgressPath).toHaveClass(styles["circularProgress__path--primary"])

      rerender(<CircularProgress value={83} order="secondary" aria-label="circular progress" />)
      expect(circularProgressPath).toHaveClass(styles["circularProgress__path--secondary"])

      rerender(<CircularProgress value={83} order="tertiary" aria-label="circular progress" />)
      expect(circularProgressPath).toHaveClass(styles["circularProgress__path--tertiary"])

      rerender(<CircularProgress value={83} order="quaternary" aria-label="circular progress" />)
      expect(circularProgressPath).toHaveClass(styles["circularProgress__path--quaternary"])

      rerender(<CircularProgress value={83} order="quintenary" aria-label="circular progress" />)
      expect(circularProgressPath).toHaveClass(styles["circularProgress__path--quintenary"])
    })

    it("keeps order styles on numbered palette tokens.", () => {
      expect(circularProgressStylesSource).toContain("var(--cui-color-primary-500)")
      expect(circularProgressStylesSource).toContain("var(--cui-color-secondary-500)")
      expect(circularProgressStylesSource).toContain("var(--cui-color-tertiary-500)")
      expect(circularProgressStylesSource).toContain("var(--cui-color-quaternary-500)")
      expect(circularProgressStylesSource).toContain("var(--cui-color-quintenary-500)")
      expect(circularProgressStylesSource).not.toMatch(
        /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
      )
    })

    it("responds to circleRatio prop.", () => {
      render(<CircularProgress value={50} circleRatio={0.5} aria-label="circular progress" />)

      const pathRadius = computePathRadius({
        value: 50,
        circleRatio: 0.5,
        "aria-label": "circular progress",
      })
      const expectedTrackDashStyle = computeDashStyle({
        counterClockwise: false,
        dashRatio: 0.5,
        pathRadius,
      })
      const expectedPathDashStyle = computeDashStyle({
        counterClockwise: false,
        dashRatio: 0.25,
        pathRadius,
      })
      const track = screen.getByTestId("circular-progress-track")
      const path = screen.getByTestId("circular-progress-path")

      expect(track.style.strokeDasharray).toBe(expectedTrackDashStyle.strokeDasharray)
      expect(track.style.strokeDashoffset).toBe(expectedTrackDashStyle.strokeDashoffset)
      expect(path.style.strokeDasharray).toBe(expectedPathDashStyle.strokeDasharray)
      expect(path.style.strokeDashoffset).toBe(expectedPathDashStyle.strokeDashoffset)
    })

    it("responds to strokeWidth prop.", () => {
      render(<CircularProgress value={77} strokeWidth={6} aria-label="circular progress" />)

      expect(screen.getByTestId("circular-progress-track")).toHaveAttribute("stroke-width", "6")
      expect(screen.getByTestId("circular-progress-path")).toHaveAttribute("stroke-width", "6")
    })

    it("responds to strokeLineCap prop.", () => {
      const { rerender } = render(
        <CircularProgress value={77} aria-label="circular progress" strokeLineCap={STROKE_LINECAP__BUTT} />,
      )

      const path = screen.getByTestId("circular-progress-path")
      const track = screen.getByTestId("circular-progress-track")
      expect(path).toHaveClass(styles["circularProgress__path--lineCapButt"])
      expect(track).toHaveClass(styles["circularProgress__track--lineCapButt"])

      rerender(<CircularProgress value={77} aria-label="circular progress" strokeLineCap={STROKE_LINECAP__ROUND} />)
      expect(path).toHaveClass(styles["circularProgress__path--lineCapRound"])
      expect(track).toHaveClass(styles["circularProgress__track--lineCapRound"])

      rerender(<CircularProgress value={77} aria-label="circular progress" strokeLineCap={STROKE_LINECAP__SQUARE} />)
      expect(path).toHaveClass(styles["circularProgress__path--lineCapSquare"])
      expect(track).toHaveClass(styles["circularProgress__track--lineCapSquare"])
    })

    it("responds to custom style props.", () => {
      render(
        <CircularProgress
          value={49}
          aria-label="circular-progress"
          text="49%"
          backgroundColor="red"
          customStyles={{ height: 150, width: 150 }}
          customBackgroundStyles={{ backgroundColor: "red" }}
          customSVGStyles={{ color: "blue" }}
          customTrackStyles={{ color: "pink" }}
          customPathStyles={{ color: "green" }}
          customTextStyles={{ color: "yellow" }}
        />,
      )

      expect(screen.getByTestId("circular-progress")).toHaveStyle({ height: "150px", width: "150px" })
      expect(screen.getByTestId("circular-progress-circle")).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" })
      expect(screen.getByTestId("circular-progress-svg-el")).toHaveStyle({ color: "rgb(0, 0, 255)" })
      expect(screen.getByTestId("circular-progress-track")).toHaveStyle({ color: "rgb(255, 192, 203)" })
      expect(screen.getByTestId("circular-progress-path")).toHaveStyle({ color: "rgb(0, 128, 0)" })
      expect(screen.getByTestId("circular-progress-text")).toHaveStyle({ color: "rgb(255, 255, 0)" })
    })

    it("merges native root class and style props.", () => {
      render(
        <CircularProgress
          value={49}
          aria-label="circular progress"
          className="custom-circular-progress"
          customStyles={{ backgroundColor: "red" }}
          style={{ backgroundColor: "blue" }}
        />,
      )

      const circularProgress = screen.getByTestId("circular-progress")

      expect(circularProgress).toHaveClass(styles.circularProgress)
      expect(circularProgress).toHaveClass("custom-circular-progress")
      expect(circularProgress).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
    })

    it("does not leak wrapper props to the React Aria root.", () => {
      render(
        <CircularProgress
          value={49}
          aria-label="circular progress"
          height={150}
          width={150}
          backgroundColor="red"
          pathColor="blue"
          trackColor="green"
          order="secondary"
          circleRatio={0.75}
          backgroundPadding={5}
          strokeWidth={6}
          strokeLineCap={STROKE_LINECAP__ROUND}
          counterClockwise
          text="49%"
          customStyles={{ backgroundColor: "white" }}
          customSVGStyles={{ color: "black" }}
          customTrackStyles={{ color: "green" }}
          customPathStyles={{ color: "blue" }}
          customTextStyles={{ color: "yellow" }}
          customBackgroundStyles={{ backgroundColor: "red" }}
        />,
      )

      const circularProgress = screen.getByTestId("circular-progress")

      expect(circularProgress).not.toHaveAttribute("height")
      expect(circularProgress).not.toHaveAttribute("width")
      expect(circularProgress).not.toHaveAttribute("backgroundcolor")
      expect(circularProgress).not.toHaveAttribute("pathcolor")
      expect(circularProgress).not.toHaveAttribute("trackcolor")
      expect(circularProgress).not.toHaveAttribute("order")
      expect(circularProgress).not.toHaveAttribute("circleratio")
      expect(circularProgress).not.toHaveAttribute("backgroundpadding")
      expect(circularProgress).not.toHaveAttribute("strokewidth")
      expect(circularProgress).not.toHaveAttribute("strokelinecap")
      expect(circularProgress).not.toHaveAttribute("counterclockwise")
      expect(circularProgress).not.toHaveAttribute("text")
      expect(circularProgress).not.toHaveAttribute("customstyles")
      expect(circularProgress).not.toHaveAttribute("customsvgstyles")
      expect(circularProgress).not.toHaveAttribute("customtrackstyles")
      expect(circularProgress).not.toHaveAttribute("custompathstyles")
      expect(circularProgress).not.toHaveAttribute("customtextstyles")
      expect(circularProgress).not.toHaveAttribute("custombackgroundstyles")
    })
  })

  describe("helpers", () => {
    it("returns an empty path ratio when the value range is invalid.", () => {
      expect(computePathRatio({ value: 10, minValue: 10, maxValue: 10, "aria-label": "circular progress" })).toBe(0)
      expect(computePathRatio({ value: 10, minValue: 20, maxValue: 10, "aria-label": "circular progress" })).toBe(0)
    })
  })
})
