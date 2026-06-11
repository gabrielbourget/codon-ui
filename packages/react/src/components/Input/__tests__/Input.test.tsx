import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import textStyles from "../../Text/TextStyles.module.css"
import { INPUT_SIZE__LG, INPUT_SIZE__MD, INPUT_SIZE__SM } from "../helpers"
import Input from "../Input"
import styles from "../InputStyles.module.css"

describe("<Input />", () => {
  it("renders.", () => {
    render(<Input />)

    expect(screen.getByTestId("input")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      render(<Input height={50} width={150} />)
      const input = screen.getByTestId("input")

      expect(input).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("responds to text size props.", () => {
      const { rerender } = render(<Input textSize={INPUT_SIZE__SM} />)
      const input = screen.getByTestId("input")

      expect(input).toHaveClass(textStyles.b11)

      rerender(<Input textSize={INPUT_SIZE__MD} />)
      expect(input).toHaveClass(textStyles.b10)

      rerender(<Input textSize={INPUT_SIZE__LG} />)
      expect(input).toHaveClass(textStyles.b9)
    })

    it("responds to corner geometry props.", () => {
      const { rerender } = render(<Input geometry="rounded" />)
      const input = screen.getByTestId("input")

      expect(input).toHaveClass(styles["input--rounded"])

      rerender(<Input geometry="round" />)
      expect(input).toHaveClass(styles["input--round"])

      rerender(<Input geometry="orthogonal" />)
      expect(input).not.toHaveClass(styles["input--rounded"])
      expect(input).not.toHaveClass(styles["input--round"])
    })

    it("responds to focus props.", () => {
      const { rerender } = render(<Input />)
      const input = screen.getByTestId("input")

      expect(input).toHaveClass(styles["input--applyFocusStyle"])
      expect(input).toHaveClass(styles["input--offsetFocusRing"])

      rerender(<Input enableFocusStyle={false} offsetFocusRing={false} />)
      expect(input).not.toHaveClass(styles["input--applyFocusStyle"])
      expect(input).not.toHaveClass(styles["input--offsetFocusRing"])
    })

    it("responds to canonical disabled prop.", () => {
      render(<Input isDisabled />)
      const input = screen.getByTestId("input")

      expect(input).toBeDisabled()
      expect(input).toHaveAttribute("data-disabled", "true")
      expect(input).not.toHaveAttribute("isdisabled")
    })

    it("can opt out of disabled state with the canonical prop.", () => {
      render(<Input isDisabled={false} />)
      const input = screen.getByTestId("input")

      expect(input).not.toBeDisabled()
      expect(input).not.toHaveAttribute("data-disabled")
    })

    it("responds to form element status props.", () => {
      const { rerender } = render(<Input errorState />)
      const input = screen.getByTestId("input")

      expect(input).toHaveClass(styles["input--errorState"])

      rerender(<Input warningState />)
      expect(input).toHaveClass(styles["input--warningState"])

      rerender(<Input successState />)
      expect(input).toHaveClass(styles["input--successState"])
    })

    it("gives error validation state precedence over warning and success states.", () => {
      render(<Input errorState warningState successState />)
      const input = screen.getByTestId("input")

      expect(input).toHaveClass(styles["input--errorState"])
      expect(input).not.toHaveClass(styles["input--warningState"])
      expect(input).not.toHaveClass(styles["input--successState"])
    })

    it("responds to custom styles prop.", () => {
      render(<Input customStyles={{ color: "turquoise", borderRadius: 0 }} />)
      const input = screen.getByTestId("input")

      expect(input).toHaveStyle({ color: "rgb(64, 224, 208)", borderRadius: 0 })
    })

    it("merges native className and style without losing computed root styles.", () => {
      render(
        <Input
          height={50}
          width={150}
          customStyles={{ color: "turquoise", marginTop: 5 }}
          className="native-input-class"
          style={{ color: "tomato", width: 175, marginBottom: 10 }}
        />,
      )
      const input = screen.getByTestId("input")

      expect(input).toHaveClass(styles.input)
      expect(input).toHaveClass("native-input-class")
      expect(input).toHaveStyle({
        height: "50px",
        width: "175px",
        color: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <Input
          height={50}
          width={150}
          textSize={INPUT_SIZE__SM}
          geometry="round"
          enableFocusStyle={false}
          offsetFocusRing={false}
          errorState
          warningState
          successState
          isDisabled={false}
          customStyles={{ marginTop: 5 }}
        />,
      )
      const input = screen.getByTestId("input")

      expect(input).not.toHaveAttribute("height")
      expect(input).not.toHaveAttribute("width")
      expect(input).not.toHaveAttribute("textsize")
      expect(input).not.toHaveAttribute("geometry")
      expect(input).not.toHaveAttribute("enablefocusstyle")
      expect(input).not.toHaveAttribute("offsetfocusring")
      expect(input).not.toHaveAttribute("errorstate")
      expect(input).not.toHaveAttribute("warningstate")
      expect(input).not.toHaveAttribute("successstate")
      expect(input).not.toHaveAttribute("isdisabled")
      expect(input).not.toHaveAttribute("customstyles")
    })
  })
})
