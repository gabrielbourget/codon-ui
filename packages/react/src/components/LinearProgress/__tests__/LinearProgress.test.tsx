import { readFileSync } from "node:fs"

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  LINEAR_PROGRESS_DIRECTION__DOWN,
  LINEAR_PROGRESS_DIRECTION__LEFT,
  LINEAR_PROGRESS_DIRECTION__RIGHT,
  LINEAR_PROGRESS_DIRECTION__UP,
  LINEAR_PROGRESS_ORIENTATION__HORIZONTAL,
  LINEAR_PROGRESS_ORIENTATION__VERTICAL,
} from "../helpers"
import LinearProgress from "../LinearProgress"
import styles from "../LinearProgressStyles.module.css"

const linearProgressStylesSource = readFileSync("src/components/LinearProgress/LinearProgressStyles.module.css", "utf8")

describe("<LinearProgress />", () => {
  it("renders.", () => {
    render(<LinearProgress aria-label="linear progress" value={36} />)

    expect(screen.getByTestId("linear-progress")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("uses the semantic base bar style when no order is provided.", () => {
      render(<LinearProgress value={18} aria-label="linear progress" />)

      expect(screen.getByTestId("linear-progress-bar")).not.toHaveClass(styles["linearProgress__bar--primary"])
    })

    it("responds to height and width props.", () => {
      render(<LinearProgress value={64} height={50} width={150} aria-label="linear progress" />)

      expect(screen.getByTestId("linear-progress-track")).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("responds to color props.", () => {
      render(<LinearProgress value={27} barColor="green" trackColor="orange" aria-label="linear progress" />)

      expect(screen.getByTestId("linear-progress-track")).toHaveStyle({ backgroundColor: "rgb(255, 165, 0)" })
      expect(screen.getByTestId("linear-progress-bar")).toHaveStyle({ backgroundColor: "rgb(0, 128, 0)" })
    })

    it("responds to corner geometry props.", () => {
      const { rerender } = render(
        <LinearProgress barGeometry="rounded" trackGeometry="rounded" value={55} aria-label="linear progress" />,
      )
      const track = screen.getByTestId("linear-progress-track")
      const bar = screen.getByTestId("linear-progress-bar")
      expect(track).toHaveClass(styles["linearProgress__track--rounded"])
      expect(bar).toHaveClass(styles["linearProgress__bar--rounded"])

      rerender(<LinearProgress barGeometry="round" trackGeometry="round" value={55} aria-label="linear progress" />)
      expect(track).toHaveClass(styles["linearProgress__track--round"])
      expect(bar).toHaveClass(styles["linearProgress__bar--round"])

      rerender(
        <LinearProgress barGeometry="orthogonal" trackGeometry="orthogonal" value={55} aria-label="linear progress" />,
      )
      expect(track).not.toHaveClass(styles["linearProgress__track--rounded"])
      expect(track).not.toHaveClass(styles["linearProgress__track--round"])
      expect(bar).not.toHaveClass(styles["linearProgress__bar--rounded"])
      expect(bar).not.toHaveClass(styles["linearProgress__bar--round"])
    })

    it("responds to theming order props.", () => {
      const { rerender } = render(<LinearProgress value={18} order="primary" aria-label="linear progress" />)
      const bar = screen.getByTestId("linear-progress-bar")
      expect(bar).toHaveClass(styles["linearProgress__bar--primary"])

      rerender(<LinearProgress value={18} order="secondary" aria-label="linear progress" />)
      expect(bar).toHaveClass(styles["linearProgress__bar--secondary"])

      rerender(<LinearProgress value={18} order="tertiary" aria-label="linear progress" />)
      expect(bar).toHaveClass(styles["linearProgress__bar--tertiary"])

      rerender(<LinearProgress value={18} order="quaternary" aria-label="linear progress" />)
      expect(bar).toHaveClass(styles["linearProgress__bar--quaternary"])

      rerender(<LinearProgress value={18} order="quintenary" aria-label="linear progress" />)
      expect(bar).toHaveClass(styles["linearProgress__bar--quintenary"])
    })

    it("keeps order styles on numbered palette tokens.", () => {
      expect(linearProgressStylesSource).toContain("var(--cui-color-primary-500)")
      expect(linearProgressStylesSource).toContain("var(--cui-color-secondary-500)")
      expect(linearProgressStylesSource).toContain("var(--cui-color-tertiary-500)")
      expect(linearProgressStylesSource).toContain("var(--cui-color-quaternary-500)")
      expect(linearProgressStylesSource).toContain("var(--cui-color-quintenary-500)")
      expect(linearProgressStylesSource).not.toMatch(
        /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
      )
    })

    it("responds to box-shadow props.", () => {
      const { rerender } = render(<LinearProgress raised aria-label="linear progress" value={30} />)
      const track = screen.getByTestId("linear-progress-track")
      expect(track).toHaveClass(styles["linearProgress__track--raised"])

      rerender(<LinearProgress aria-label="linear progress" value={30} />)
      expect(track).not.toHaveClass(styles["linearProgress__track--raised"])
    })

    it("responds to direction props.", () => {
      const { rerender } = render(
        <LinearProgress value={58} direction={LINEAR_PROGRESS_DIRECTION__LEFT} aria-label="linear progress" />,
      )
      const linearProgress = screen.getByTestId("linear-progress")
      expect(linearProgress).toHaveClass(styles["linearProgress--dirLeft"])

      rerender(
        <LinearProgress
          value={72}
          direction={LINEAR_PROGRESS_DIRECTION__DOWN}
          orientation={LINEAR_PROGRESS_ORIENTATION__VERTICAL}
          aria-label="linear progress"
        />,
      )
      expect(linearProgress).toHaveClass(styles["linearProgress--dirDown"])

      rerender(<LinearProgress value={72} direction={LINEAR_PROGRESS_DIRECTION__RIGHT} aria-label="linear progress" />)
      expect(linearProgress).toHaveClass(styles.linearProgress)
      expect(linearProgress).not.toHaveClass(styles["linearProgress--dirLeft"])

      rerender(<LinearProgress value={72} direction={LINEAR_PROGRESS_DIRECTION__UP} aria-label="linear progress" />)
      expect(linearProgress).toHaveClass(styles.linearProgress)
      expect(linearProgress).not.toHaveClass(styles["linearProgress--dirDown"])
    })

    it("responds to orientation props.", () => {
      const { rerender } = render(
        <LinearProgress
          value={81}
          orientation={LINEAR_PROGRESS_ORIENTATION__HORIZONTAL}
          aria-label="linear progress"
        />,
      )
      const linearProgress = screen.getByTestId("linear-progress")
      expect(linearProgress).toHaveClass(styles["linearProgress--horizontal"])

      rerender(
        <LinearProgress value={81} orientation={LINEAR_PROGRESS_ORIENTATION__VERTICAL} aria-label="linear progress" />,
      )
      expect(linearProgress).toHaveClass(styles["linearProgress--vertical"])
    })

    it("responds to custom style props.", () => {
      render(
        <LinearProgress
          value={28}
          aria-label="linear progress"
          customStyles={{ height: 40, width: 1000 }}
          customBarStyles={{ backgroundColor: "blue" }}
          customTrackStyles={{ backgroundColor: "red" }}
        />,
      )

      expect(screen.getByTestId("linear-progress")).toHaveStyle({ height: "40px", width: "1000px" })
      expect(screen.getByTestId("linear-progress-bar")).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
      expect(screen.getByTestId("linear-progress-track")).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" })
    })

    it("merges native root class and style props.", () => {
      render(
        <LinearProgress
          value={28}
          aria-label="linear progress"
          className="custom-linear-progress"
          customStyles={{ backgroundColor: "red" }}
          style={{ backgroundColor: "blue" }}
        />,
      )

      const linearProgress = screen.getByTestId("linear-progress")

      expect(linearProgress).toHaveClass(styles.linearProgress)
      expect(linearProgress).toHaveClass("custom-linear-progress")
      expect(linearProgress).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
    })

    it("does not leak wrapper props to the React Aria root.", () => {
      render(
        <LinearProgress
          value={28}
          aria-label="linear progress"
          height={30}
          width={300}
          barColor="blue"
          trackColor="red"
          raised
          direction={LINEAR_PROGRESS_DIRECTION__LEFT}
          orientation={LINEAR_PROGRESS_ORIENTATION__HORIZONTAL}
          trackGeometry="round"
          barGeometry="round"
          order="secondary"
          customStyles={{ backgroundColor: "white" }}
          customBarStyles={{ backgroundColor: "blue" }}
          customTrackStyles={{ backgroundColor: "red" }}
        />,
      )

      const linearProgress = screen.getByTestId("linear-progress")

      expect(linearProgress).not.toHaveAttribute("height")
      expect(linearProgress).not.toHaveAttribute("width")
      expect(linearProgress).not.toHaveAttribute("barcolor")
      expect(linearProgress).not.toHaveAttribute("trackcolor")
      expect(linearProgress).not.toHaveAttribute("raised")
      expect(linearProgress).not.toHaveAttribute("direction")
      expect(linearProgress).not.toHaveAttribute("orientation")
      expect(linearProgress).not.toHaveAttribute("trackgeometry")
      expect(linearProgress).not.toHaveAttribute("bargeometry")
      expect(linearProgress).not.toHaveAttribute("order")
      expect(linearProgress).not.toHaveAttribute("customstyles")
      expect(linearProgress).not.toHaveAttribute("custombarstyles")
      expect(linearProgress).not.toHaveAttribute("customtrackstyles")
    })
  })
})
