import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import textStyles from "../../Text/TextStyles.module.css"
import { INPUT_SIZE__LG, INPUT_SIZE__MD, INPUT_SIZE__SM } from "../helpers"
import NumberInput from "../NumberInput"
import styles from "../NumberInputStyles.module.css"

describe("<NumberInput />", () => {
  it("renders.", () => {
    render(<NumberInput aria-label="number input" />)

    expect(screen.getByTestId("number-input")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      render(<NumberInput height={50} width={150} aria-label="number input" />)
      const numberInput = screen.getByTestId("number-input")

      expect(numberInput).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("responds to text size props.", () => {
      const { rerender } = render(<NumberInput textSize={INPUT_SIZE__SM} aria-label="number input" />)
      const numberInput = screen.getByTestId("number-input-input")

      expect(numberInput).toHaveClass(textStyles.b11)

      rerender(<NumberInput textSize={INPUT_SIZE__MD} aria-label="number input" />)
      expect(numberInput).toHaveClass(textStyles.b10)

      rerender(<NumberInput textSize={INPUT_SIZE__LG} aria-label="number input" />)
      expect(numberInput).toHaveClass(textStyles.b9)
    })

    it("responds to corner geometry props.", () => {
      const { rerender } = render(<NumberInput geometry="rounded" aria-label="number input" />)
      const numberInput = screen.getByTestId("number-input")

      expect(numberInput).toHaveClass(styles["numberInput--rounded"])

      rerender(<NumberInput geometry="round" aria-label="number input" />)
      expect(numberInput).toHaveClass(styles["numberInput--round"])

      rerender(<NumberInput geometry="orthogonal" aria-label="number input" />)
      expect(numberInput).not.toHaveClass(styles["numberInput--rounded"])
      expect(numberInput).not.toHaveClass(styles["numberInput--round"])
    })

    it("responds to focus props.", () => {
      const { rerender } = render(<NumberInput aria-label="number input" />)
      const inputButtonGroup = screen.getByRole("group", { name: "NumberInput Input Button Group" })

      expect(inputButtonGroup).toHaveClass(styles["numberInput--applyFocusStyle"])
      expect(inputButtonGroup).toHaveClass(styles["numberInput--offsetFocusRing"])

      rerender(<NumberInput enableFocusStyle={false} offsetFocusRing={false} aria-label="number input" />)
      expect(inputButtonGroup).not.toHaveClass(styles["numberInput--applyFocusStyle"])
      expect(inputButtonGroup).not.toHaveClass(styles["numberInput--offsetFocusRing"])
    })

    it("responds to canonical disabled prop.", () => {
      render(<NumberInput isDisabled aria-label="number input" />)
      const numberInput = screen.getByTestId("number-input")

      expect(numberInput).toHaveAttribute("data-disabled", "true")
    })

    it("responds to canonical readonly prop.", async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()

      render(<NumberInput isReadOnly defaultValue={5} onChange={onChange} aria-label="number input" />)

      await user.click(screen.getAllByTestId("button")[0])

      expect(onChange).not.toHaveBeenCalled()
    })

    it("responds to form element status props.", () => {
      const { rerender } = render(<NumberInput errorState aria-label="number input" />)
      const numberInputGroup = screen.getByRole("group", { name: "NumberInput Input Button Group" })

      expect(numberInputGroup).toHaveClass(styles["numberInput--errorState"])

      rerender(<NumberInput warningState aria-label="number input" />)
      expect(numberInputGroup).toHaveClass(styles["numberInput--warningState"])

      rerender(<NumberInput successState aria-label="number input" />)
      expect(numberInputGroup).toHaveClass(styles["numberInput--successState"])
    })

    it("gives error validation state precedence over warning and success states.", () => {
      render(<NumberInput errorState warningState successState aria-label="number input" />)
      const numberInputGroup = screen.getByRole("group", { name: "NumberInput Input Button Group" })

      expect(numberInputGroup).toHaveClass(styles["numberInput--errorState"])
      expect(numberInputGroup).not.toHaveClass(styles["numberInput--warningState"])
      expect(numberInputGroup).not.toHaveClass(styles["numberInput--successState"])
    })

    it("responds to custom styles props.", () => {
      render(
        <NumberInput
          customStyles={{ color: "turquoise", borderRadius: 0 }}
          customGroupStyles={{ backgroundColor: "orange" }}
          customButtonStyles={{ borderRadius: 6 }}
          customInputStyles={{ backgroundColor: "green" }}
          aria-label="number input"
        />,
      )

      const numberInput = screen.getByTestId("number-input")
      const numberInputGroup = screen.getByRole("group", { name: "NumberInput Input Button Group" })
      const input = screen.getByTestId("number-input-input")
      const buttons = screen.getAllByTestId("button")

      expect(numberInput).toHaveStyle({ color: "rgb(64, 224, 208)", borderRadius: 0 })
      expect(numberInputGroup).toHaveStyle({ backgroundColor: "rgb(255, 165, 0)" })
      expect(input).toHaveStyle({ backgroundColor: "rgb(0, 128, 0)" })
      buttons.forEach((button) => expect(button).toHaveStyle({ borderRadius: "6px" }))
    })

    it("accepts custom labels for its internal control group.", () => {
      render(
        <NumberInput
          aria-label="number input"
          labels={{ inputButtonGroupAriaLabel: "Localized number input controls" }}
        />,
      )

      expect(screen.getByRole("group", { name: "Localized number input controls" })).toBeInTheDocument()
    })

    it("renders default icons and custom icon overrides.", () => {
      const { rerender } = render(<NumberInput aria-label="number input" />)
      const defaultButtons = screen.getAllByTestId("button")

      expect(defaultButtons[0].querySelector("svg")).toBeInTheDocument()
      expect(defaultButtons[1].querySelector("svg")).toBeInTheDocument()

      rerender(
        <NumberInput
          aria-label="number input"
          IncrementIcon={<span data-testid="custom-increment-icon">Plus</span>}
          DecrementIcon={<span data-testid="custom-decrement-icon">Minus</span>}
        />,
      )

      expect(screen.getByTestId("custom-increment-icon")).toBeInTheDocument()
      expect(screen.getByTestId("custom-decrement-icon")).toBeInTheDocument()
    })

    it("merges native className and style without losing computed root styles.", () => {
      render(
        <NumberInput
          height={50}
          width={150}
          customStyles={{ color: "turquoise", marginTop: 5 }}
          className="native-number-input-class"
          style={{ color: "tomato", width: 175, marginBottom: 10 }}
          aria-label="number input"
        />,
      )

      const numberInput = screen.getByTestId("number-input")

      expect(numberInput).toHaveClass(styles.numberInput)
      expect(numberInput).toHaveClass("native-number-input-class")
      expect(numberInput).toHaveStyle({
        height: "50px",
        width: "175px",
        color: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <NumberInput
          height={50}
          width={150}
          textSize={INPUT_SIZE__SM}
          geometry="round"
          enableFocusStyle={false}
          offsetFocusRing={false}
          errorState
          warningState
          successState
          placeholder="Number"
          IncrementIcon={<span>Plus</span>}
          DecrementIcon={<span>Minus</span>}
          customStyles={{ marginTop: 5 }}
          customGroupStyles={{ backgroundColor: "orange" }}
          customButtonStyles={{ borderRadius: 6 }}
          customInputStyles={{ backgroundColor: "green" }}
          labels={{ inputButtonGroupAriaLabel: "Number controls" }}
          aria-label="number input"
        />,
      )

      const numberInput = screen.getByTestId("number-input")

      expect(numberInput).not.toHaveAttribute("height")
      expect(numberInput).not.toHaveAttribute("width")
      expect(numberInput).not.toHaveAttribute("textsize")
      expect(numberInput).not.toHaveAttribute("geometry")
      expect(numberInput).not.toHaveAttribute("enablefocusstyle")
      expect(numberInput).not.toHaveAttribute("offsetfocusring")
      expect(numberInput).not.toHaveAttribute("errorstate")
      expect(numberInput).not.toHaveAttribute("warningstate")
      expect(numberInput).not.toHaveAttribute("successstate")
      expect(numberInput).not.toHaveAttribute("placeholder")
      expect(numberInput).not.toHaveAttribute("incrementicon")
      expect(numberInput).not.toHaveAttribute("decrementicon")
      expect(numberInput).not.toHaveAttribute("customstyles")
      expect(numberInput).not.toHaveAttribute("customgroupstyles")
      expect(numberInput).not.toHaveAttribute("custombuttonstyles")
      expect(numberInput).not.toHaveAttribute("custominputstyles")
      expect(numberInput).not.toHaveAttribute("labels")
    })
  })
})
