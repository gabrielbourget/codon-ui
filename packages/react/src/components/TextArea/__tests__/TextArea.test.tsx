import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import textStyles from "../../Text/TextStyles.module.css"
import type { TTextAreaProps } from "../helpers"
import {
  TEXTAREA_RESIZE__BOTH,
  TEXTAREA_RESIZE__HORIZONTAL,
  TEXTAREA_RESIZE__NONE,
  TEXTAREA_RESIZE__VERTICAL,
  TEXTAREA_SIZE__LG,
  TEXTAREA_SIZE__MD,
  TEXTAREA_SIZE__SM,
} from "../helpers"
import TextArea from "../TextArea"
import styles from "../TextAreaStyles.module.css"

const renderTextArea = (props: Partial<TTextAreaProps> = {}) => render(<TextArea {...props} />)
const getTextArea = () => screen.getByTestId("textarea")

const textSizeStyleBySize: Record<NonNullable<TTextAreaProps["textSize"]>, string> = {
  [TEXTAREA_SIZE__SM]: "b11",
  [TEXTAREA_SIZE__MD]: "b10",
  [TEXTAREA_SIZE__LG]: "b9",
}

const resizeStyleByResize: Record<NonNullable<TTextAreaProps["resize"]>, string> = {
  [TEXTAREA_RESIZE__NONE]: "textArea--resizeNone",
  [TEXTAREA_RESIZE__VERTICAL]: "textArea--resizeVertical",
  [TEXTAREA_RESIZE__HORIZONTAL]: "textArea--resizeHorizontal",
  [TEXTAREA_RESIZE__BOTH]: "textArea--resizeBoth",
}

describe("<TextArea />", () => {
  it("renders.", () => {
    renderTextArea()

    const textArea = getTextArea()

    expect(textArea).toBeInTheDocument()
    expect(textArea).toHaveClass(styles.textArea)
    expect(textArea).toHaveClass(textStyles.b10)
    expect(textArea).toHaveClass(textStyles["fw-regular"])
    expect(textArea).toHaveClass(styles["textArea--rounded"])
    expect(textArea).toHaveClass(styles["textArea--resizeVertical"])
    expect(textArea).toHaveClass(styles["textArea--applyFocusStyle"])
    expect(textArea).toHaveClass(styles["textArea--offsetFocusRing"])
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      renderTextArea({ height: 50, width: 150 })

      expect(getTextArea()).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("responds to text size props.", () => {
      const { rerender } = renderTextArea()

      for (const [textSize, textSizeStyle] of Object.entries(textSizeStyleBySize)) {
        rerender(<TextArea textSize={textSize as NonNullable<TTextAreaProps["textSize"]>} />)

        expect(getTextArea()).toHaveClass(textStyles[textSizeStyle])
      }
    })

    it("responds to corner geometry props.", () => {
      const { rerender } = renderTextArea({ geometry: "rounded" })
      const textArea = getTextArea()

      expect(textArea).toHaveClass(styles["textArea--rounded"])

      rerender(<TextArea geometry="round" />)
      expect(textArea).toHaveClass(styles["textArea--round"])

      rerender(<TextArea geometry="orthogonal" />)
      expect(textArea).not.toHaveClass(styles["textArea--rounded"])
      expect(textArea).not.toHaveClass(styles["textArea--round"])
    })

    it("responds to focus props.", () => {
      const { rerender } = renderTextArea()
      const textArea = getTextArea()

      expect(textArea).toHaveClass(styles["textArea--applyFocusStyle"])
      expect(textArea).toHaveClass(styles["textArea--offsetFocusRing"])

      rerender(<TextArea enableFocusStyle={false} offsetFocusRing={false} />)
      expect(textArea).not.toHaveClass(styles["textArea--applyFocusStyle"])
      expect(textArea).not.toHaveClass(styles["textArea--offsetFocusRing"])
    })

    it("responds to canonical disabled prop.", () => {
      renderTextArea({ isDisabled: true })

      const textArea = getTextArea()
      expect(textArea).toBeDisabled()
      expect(textArea).toHaveAttribute("data-disabled", "true")
      expect(textArea).not.toHaveAttribute("isdisabled")
    })

    it("can opt out of disabled state with the canonical prop.", () => {
      renderTextArea({ isDisabled: false })

      const textArea = getTextArea()
      expect(textArea).not.toBeDisabled()
      expect(textArea).not.toHaveAttribute("data-disabled")
    })

    it("responds to form element status props.", () => {
      const { rerender } = renderTextArea({ errorState: true })
      const textArea = getTextArea()

      expect(textArea).toHaveClass(styles["textArea--errorState"])

      rerender(<TextArea warningState />)
      expect(textArea).toHaveClass(styles["textArea--warningState"])

      rerender(<TextArea successState />)
      expect(textArea).toHaveClass(styles["textArea--successState"])
    })

    it("gives error validation state precedence over warning and success states.", () => {
      renderTextArea({ errorState: true, warningState: true, successState: true })

      const textArea = getTextArea()
      expect(textArea).toHaveClass(styles["textArea--errorState"])
      expect(textArea).not.toHaveClass(styles["textArea--warningState"])
      expect(textArea).not.toHaveClass(styles["textArea--successState"])
    })

    it("responds to resize props.", () => {
      const { rerender } = renderTextArea()

      for (const [resize, resizeStyle] of Object.entries(resizeStyleByResize)) {
        rerender(<TextArea resize={resize as NonNullable<TTextAreaProps["resize"]>} />)

        expect(getTextArea()).toHaveClass(styles[resizeStyle])
      }
    })

    it("responds to custom styles prop.", () => {
      renderTextArea({ customStyles: { color: "turquoise", borderRadius: 0 } })

      expect(getTextArea()).toHaveStyle({ color: "rgb(64, 224, 208)", borderRadius: 0 })
    })

    it("merges native className and style without losing computed root styles.", () => {
      renderTextArea({
        height: 50,
        width: 150,
        customStyles: { color: "turquoise", marginTop: 5 },
        className: "native-textarea-class",
        style: { color: "tomato", width: 175, marginBottom: 10 },
      })

      const textArea = getTextArea()
      expect(textArea).toHaveClass(styles.textArea)
      expect(textArea).toHaveClass("native-textarea-class")
      expect(textArea).toHaveStyle({
        height: "50px",
        width: "175px",
        color: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("does not leak wrapper props onto the root element.", () => {
      renderTextArea({
        height: 50,
        width: 150,
        textSize: TEXTAREA_SIZE__SM,
        resize: TEXTAREA_RESIZE__BOTH,
        geometry: "round",
        enableFocusStyle: false,
        offsetFocusRing: false,
        errorState: true,
        warningState: true,
        successState: true,
        isDisabled: false,
        customStyles: { marginTop: 5 },
      })

      const textArea = getTextArea()

      expect(textArea).not.toHaveAttribute("height")
      expect(textArea).not.toHaveAttribute("width")
      expect(textArea).not.toHaveAttribute("textsize")
      expect(textArea).not.toHaveAttribute("resize")
      expect(textArea).not.toHaveAttribute("geometry")
      expect(textArea).not.toHaveAttribute("enablefocusstyle")
      expect(textArea).not.toHaveAttribute("offsetfocusring")
      expect(textArea).not.toHaveAttribute("errorstate")
      expect(textArea).not.toHaveAttribute("warningstate")
      expect(textArea).not.toHaveAttribute("successstate")
      expect(textArea).not.toHaveAttribute("isdisabled")
      expect(textArea).not.toHaveAttribute("customstyles")
    })
  })
})
