import { readFileSync } from "node:fs"

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  METER_DIRECTION__DOWN,
  METER_DIRECTION__LEFT,
  METER_DIRECTION__RIGHT,
  METER_DIRECTION__UP,
  METER_ORIENTATION__HORIZONTAL,
  METER_ORIENTATION__VERTICAL,
} from "../helpers"
import Meter from "../Meter"
import styles from "../MeterStyles.module.css"

const meterStylesSource = readFileSync("src/components/Meter/MeterStyles.module.css", "utf8")

describe("<Meter />", () => {
  it("renders.", () => {
    render(<Meter aria-label="meter" value={82} />)

    expect(screen.getByTestId("meter")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("uses the semantic base bar style when no order is provided.", () => {
      render(<Meter value={18} aria-label="meter" />)

      expect(screen.getByTestId("meter-bar")).not.toHaveClass(styles["meter__bar--primary"])
    })

    it("responds to height and width props.", () => {
      render(<Meter value={64} height={50} width={150} aria-label="meter" />)

      expect(screen.getByTestId("meter-track")).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("responds to color props.", () => {
      render(<Meter value={27} barColor="green" trackColor="orange" aria-label="meter" />)

      expect(screen.getByTestId("meter-track")).toHaveStyle({ backgroundColor: "rgb(255, 165, 0)" })
      expect(screen.getByTestId("meter-bar")).toHaveStyle({ backgroundColor: "rgb(0, 128, 0)" })
    })

    it("responds to corner geometry props.", () => {
      const { rerender } = render(<Meter barGeometry="rounded" trackGeometry="rounded" value={55} aria-label="meter" />)
      const track = screen.getByTestId("meter-track")
      const bar = screen.getByTestId("meter-bar")
      expect(track).toHaveClass(styles["meter__track--rounded"])
      expect(bar).toHaveClass(styles["meter__bar--rounded"])

      rerender(<Meter barGeometry="round" trackGeometry="round" value={55} aria-label="meter" />)
      expect(track).toHaveClass(styles["meter__track--round"])
      expect(bar).toHaveClass(styles["meter__bar--round"])

      rerender(<Meter barGeometry="orthogonal" trackGeometry="orthogonal" value={55} aria-label="meter" />)
      expect(track).not.toHaveClass(styles["meter__track--rounded"])
      expect(track).not.toHaveClass(styles["meter__track--round"])
      expect(bar).not.toHaveClass(styles["meter__bar--rounded"])
      expect(bar).not.toHaveClass(styles["meter__bar--round"])
    })

    it("responds to theming order props.", () => {
      const { rerender } = render(<Meter value={18} order="primary" aria-label="meter" />)
      const bar = screen.getByTestId("meter-bar")
      expect(bar).toHaveClass(styles["meter__bar--primary"])

      rerender(<Meter value={18} order="secondary" aria-label="meter" />)
      expect(bar).toHaveClass(styles["meter__bar--secondary"])

      rerender(<Meter value={18} order="tertiary" aria-label="meter" />)
      expect(bar).toHaveClass(styles["meter__bar--tertiary"])

      rerender(<Meter value={18} order="quaternary" aria-label="meter" />)
      expect(bar).toHaveClass(styles["meter__bar--quaternary"])

      rerender(<Meter value={18} order="quintenary" aria-label="meter" />)
      expect(bar).toHaveClass(styles["meter__bar--quintenary"])
    })

    it("keeps order styles on numbered palette tokens.", () => {
      expect(meterStylesSource).toContain("var(--cui-color-primary-500)")
      expect(meterStylesSource).toContain("var(--cui-color-secondary-500)")
      expect(meterStylesSource).toContain("var(--cui-color-tertiary-500)")
      expect(meterStylesSource).toContain("var(--cui-color-quaternary-500)")
      expect(meterStylesSource).toContain("var(--cui-color-quintenary-500)")
      expect(meterStylesSource).not.toMatch(
        /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
      )
    })

    it("responds to box-shadow props.", () => {
      const { rerender } = render(<Meter raised aria-label="meter" value={30} />)
      const track = screen.getByTestId("meter-track")
      expect(track).toHaveClass(styles["meter__track--raised"])

      rerender(<Meter aria-label="meter" value={30} />)
      expect(track).not.toHaveClass(styles["meter__track--raised"])
    })

    it("responds to direction props.", () => {
      const { rerender } = render(<Meter value={58} direction={METER_DIRECTION__LEFT} aria-label="meter" />)
      const meter = screen.getByTestId("meter")
      expect(meter).toHaveClass(styles["meter--dirLeft"])

      rerender(
        <Meter
          value={72}
          direction={METER_DIRECTION__DOWN}
          orientation={METER_ORIENTATION__VERTICAL}
          aria-label="meter"
        />,
      )
      expect(meter).toHaveClass(styles["meter--dirDown"])

      rerender(<Meter value={72} direction={METER_DIRECTION__RIGHT} aria-label="meter" />)
      expect(meter).toHaveClass(styles.meter)
      expect(meter).not.toHaveClass(styles["meter--dirLeft"])

      rerender(<Meter value={72} direction={METER_DIRECTION__UP} aria-label="meter" />)
      expect(meter).toHaveClass(styles.meter)
      expect(meter).not.toHaveClass(styles["meter--dirDown"])
    })

    it("responds to orientation props.", () => {
      const { rerender } = render(<Meter value={81} orientation={METER_ORIENTATION__HORIZONTAL} aria-label="meter" />)
      const meter = screen.getByTestId("meter")
      expect(meter).toHaveClass(styles["meter--horizontal"])

      rerender(<Meter value={81} orientation={METER_ORIENTATION__VERTICAL} aria-label="meter" />)
      expect(meter).toHaveClass(styles["meter--vertical"])
    })

    it("responds to custom style props.", () => {
      render(
        <Meter
          value={28}
          aria-label="meter"
          customStyles={{ height: 40, width: 1000 }}
          customBarStyles={{ backgroundColor: "blue" }}
          customTrackStyles={{ backgroundColor: "red" }}
        />,
      )

      expect(screen.getByTestId("meter")).toHaveStyle({ height: "40px", width: "1000px" })
      expect(screen.getByTestId("meter-bar")).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
      expect(screen.getByTestId("meter-track")).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" })
    })

    it("merges native root class and style props.", () => {
      render(
        <Meter
          value={28}
          aria-label="meter"
          className="custom-meter"
          customStyles={{ backgroundColor: "red" }}
          style={{ backgroundColor: "blue" }}
        />,
      )

      const meter = screen.getByTestId("meter")

      expect(meter).toHaveClass(styles.meter)
      expect(meter).toHaveClass("custom-meter")
      expect(meter).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
    })

    it("does not leak wrapper props to the React Aria root.", () => {
      render(
        <Meter
          value={28}
          aria-label="meter"
          height={30}
          width={300}
          barColor="blue"
          trackColor="red"
          raised
          direction={METER_DIRECTION__LEFT}
          orientation={METER_ORIENTATION__HORIZONTAL}
          trackGeometry="round"
          barGeometry="round"
          order="secondary"
          customStyles={{ backgroundColor: "white" }}
          customBarStyles={{ backgroundColor: "blue" }}
          customTrackStyles={{ backgroundColor: "red" }}
        />,
      )

      const meter = screen.getByTestId("meter")

      expect(meter).not.toHaveAttribute("height")
      expect(meter).not.toHaveAttribute("width")
      expect(meter).not.toHaveAttribute("barcolor")
      expect(meter).not.toHaveAttribute("trackcolor")
      expect(meter).not.toHaveAttribute("raised")
      expect(meter).not.toHaveAttribute("direction")
      expect(meter).not.toHaveAttribute("orientation")
      expect(meter).not.toHaveAttribute("trackgeometry")
      expect(meter).not.toHaveAttribute("bargeometry")
      expect(meter).not.toHaveAttribute("order")
      expect(meter).not.toHaveAttribute("customstyles")
      expect(meter).not.toHaveAttribute("custombarstyles")
      expect(meter).not.toHaveAttribute("customtrackstyles")
    })
  })
})
