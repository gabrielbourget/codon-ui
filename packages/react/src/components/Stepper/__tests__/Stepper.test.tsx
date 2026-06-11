import { readFileSync } from "node:fs"

import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import buttonStyles from "../../Button/ButtonStyles.module.css"
import textStyles from "../../Text/TextStyles.module.css"
import {
  COLOR_MODE__FILL,
  COLOR_MODE__OUTLINE,
  ORIENTATION__HORIZONTAL,
  ORIENTATION__VERTICAL,
  STEPPER_SIZE__LG,
  STEPPER_SIZE__MD,
  STEPPER_SIZE__SM,
  STEPPER_TYPE__COHESIVE,
} from "../helpers"
import Stepper from "../Stepper"
import styles from "../StepperStyles.module.css"

import {
  getStepperButtons,
  stepperColorModeTestData,
  stepperThemingOrderTestData,
  type TStepperTestInfo,
} from "./helpers"

const stepperStylesSource = readFileSync("src/components/Stepper/StepperStyles.module.css", "utf8")
const stepperHelpersSource = readFileSync("src/components/Stepper/helpers.tsx", "utf8")

describe("<Stepper />", () => {
  it("renders.", () => {
    render(<Stepper aria-label="stepper" />)

    expect(screen.getByTestId("stepper")).toBeInTheDocument()
  })

  describe("props API surface", () => {
    it("responds to height and width props.", () => {
      render(<Stepper height={50} width={150} aria-label="stepper" />)
      const stepper = screen.getByTestId("stepper")

      expect(stepper).toHaveStyle({ height: "50px", width: "150px" })
    })

    it("responds to text size props.", () => {
      const { rerender } = render(<Stepper textSize={STEPPER_SIZE__SM} aria-label="stepper" />)
      const stepperInput = screen.getByTestId("stepper-input")

      expect(stepperInput).toHaveClass(textStyles.b11)

      rerender(<Stepper textSize={STEPPER_SIZE__MD} aria-label="stepper" />)
      expect(stepperInput).toHaveClass(textStyles.b10)

      rerender(<Stepper textSize={STEPPER_SIZE__LG} aria-label="stepper" />)
      expect(stepperInput).toHaveClass(textStyles.b9)
    })

    it("responds to color props in segmented default usage.", () => {
      render(<Stepper color="red" aria-label="stepper" />)
      const stepperGroup = screen.getByTestId("stepper-group")
      const stepperButtons = screen.getAllByTestId("button")

      expect(stepperGroup).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" })
      stepperButtons.forEach((button) => expect(button).toHaveStyle({ color: "rgb(255, 0, 0)" }))
    })

    it("applies custom color to cohesive outline input text.", () => {
      render(
        <Stepper color="#ff0000" colorMode={COLOR_MODE__OUTLINE} type={STEPPER_TYPE__COHESIVE} aria-label="stepper" />,
      )

      const stepperGroup = screen.getByTestId("stepper-group")
      const stepperInput = screen.getByTestId("stepper-input")

      expect(stepperGroup).toHaveStyle({ borderColor: "rgb(255, 0, 0)" })
      expect(stepperInput).toHaveStyle({ color: "rgb(255, 0, 0)" })
    })

    it("auto-contrasts cohesive fill input text for light custom backgrounds.", () => {
      render(
        <Stepper color="#ffffff" colorMode={COLOR_MODE__FILL} type={STEPPER_TYPE__COHESIVE} aria-label="stepper" />,
      )

      const stepperGroup = screen.getByTestId("stepper-group")
      const stepperInput = screen.getByTestId("stepper-input")

      expect(stepperGroup).toHaveStyle({ backgroundColor: "rgb(255, 255, 255)" })
      expect(stepperInput).toHaveStyle({ color: "rgb(0, 0, 0)" })
    })

    it("auto-contrasts cohesive fill input text for dark custom backgrounds.", () => {
      render(
        <Stepper color="#000000" colorMode={COLOR_MODE__FILL} type={STEPPER_TYPE__COHESIVE} aria-label="stepper" />,
      )

      const stepperGroup = screen.getByTestId("stepper-group")
      const stepperInput = screen.getByTestId("stepper-input")

      expect(stepperGroup).toHaveStyle({ backgroundColor: "rgb(0, 0, 0)" })
      expect(stepperInput).toHaveStyle({ color: "rgb(255, 255, 255)" })
    })

    it("customInputStyles color overrides computed input color.", () => {
      render(
        <Stepper
          color="#000000"
          colorMode={COLOR_MODE__FILL}
          type={STEPPER_TYPE__COHESIVE}
          customInputStyles={{ color: "lime" }}
          aria-label="stepper"
        />,
      )

      expect(screen.getByTestId("stepper-input")).toHaveStyle({ color: "rgb(0, 255, 0)" })
    })

    it("responds to color mode props.", () => {
      const { rerender } = render(<Stepper colorMode="fill" type="cohesive" aria-label="stepper" />)
      const stepperGroup = screen.getByTestId("stepper-group")

      expect(stepperGroup).toHaveClass(styles["stepper__group--cohesive--fill"])

      stepperColorModeTestData.forEach((testInfo: TStepperTestInfo) => {
        const { colorMode, stepperType, themingOrder } = testInfo
        let computedStyleName = `stepper__group--${stepperType}--${colorMode}`

        if (themingOrder) {
          computedStyleName += `--${themingOrder}`
        }

        rerender(<Stepper colorMode={colorMode} type={stepperType} order={themingOrder} aria-label="stepper" />)
        expect(stepperGroup).toHaveClass(styles[computedStyleName])
      })
    })

    it("responds to theming order props.", () => {
      const { rerender } = render(<Stepper type="cohesive" colorMode="fill" order="primary" aria-label="stepper" />)
      const stepperGroup = screen.getByTestId("stepper-group")

      expect(stepperGroup).toHaveClass(styles["stepper__group--cohesive--fill--primary"])

      stepperThemingOrderTestData.forEach((testInfo: TStepperTestInfo) => {
        const { colorMode, stepperType, themingOrder } = testInfo

        rerender(<Stepper colorMode={colorMode} type={stepperType} order={themingOrder} aria-label="stepper" />)

        if (stepperType === STEPPER_TYPE__COHESIVE) {
          const computedGroupStyleName = `stepper__group--${stepperType}--${colorMode}--${themingOrder}`

          expect(stepperGroup).toHaveClass(styles[computedGroupStyleName])
          return
        }

        const computedButtonStyleName = `button--${themingOrder}--${colorMode}`
        const stepperButtons = getStepperButtons()
        stepperButtons.forEach((button) => expect(button).toHaveClass(buttonStyles[computedButtonStyleName]))
      })
    })

    it("cohesive fill order styles use action color pairs.", () => {
      const actionFamilies = ["primary", "secondary", "tertiary", "quaternary", "quintenary"]

      expect(stepperStylesSource).toContain("background-color: var(--cui-action-primary-background)")
      expect(stepperStylesSource).toContain("color: var(--cui-action-primary-foreground)")
      expect(stepperStylesSource).toContain("background-color: var(--cui-action-secondary-background)")
      expect(stepperStylesSource).toContain("color: var(--cui-action-secondary-foreground)")
      expect(stepperStylesSource).toContain("background-color: var(--cui-action-tertiary-background)")
      expect(stepperStylesSource).toContain("color: var(--cui-action-tertiary-foreground)")
      expect(stepperStylesSource).toContain("background-color: var(--cui-action-quaternary-background)")
      expect(stepperStylesSource).toContain("color: var(--cui-action-quaternary-foreground)")
      expect(stepperStylesSource).toContain("background-color: var(--cui-action-quintenary-background)")
      expect(stepperStylesSource).toContain("color: var(--cui-action-quintenary-foreground)")
      expect(stepperStylesSource).not.toMatch(
        /var\(--(?:primary|secondary|tertiary|quaternary|quintenary)(?:_[pm][0-9])?\)/u,
      )
      actionFamilies.forEach((family) => {
        expect(stepperStylesSource).not.toContain(
          `.stepper__group--cohesive--fill--${family} {\n  background-color: var(--cui-color-${family}-500);`,
        )
      })
    })

    it("resolves cohesive order input colors through action foreground aliases.", () => {
      render(
        <Stepper colorMode={COLOR_MODE__FILL} order="quintenary" type={STEPPER_TYPE__COHESIVE} aria-label="stepper" />,
      )

      const stepperInput = screen.getByTestId("stepper-input")
      const stepperButtons = getStepperButtons()

      expect(stepperInput.getAttribute("style")).toContain("color: var(--cui-action-quintenary-foreground)")
      expect(stepperInput.getAttribute("style")).toContain("border-color: var(--cui-action-quintenary-foreground)")
      stepperButtons.forEach((button) => {
        expect(button.getAttribute("style")).toContain("color: var(--cui-action-quintenary-foreground)")
      })
    })

    it("keeps readable custom-color helpers local to the installed source.", () => {
      expect(stepperHelpersSource).not.toContain("@/src/utils/serverSideStyles")
      expect(stepperHelpersSource).not.toContain("@/src/utils/theme")
      expect(stepperHelpersSource).not.toContain("@/src/utils/color")
      expect(stepperHelpersSource).toContain("const determineReadableTextColor")
    })

    it("responds to stepper type props.", () => {
      const { rerender } = render(<Stepper aria-label="stepper" type="cohesive" />)
      const stepperGroup = screen.getByTestId("stepper-group")

      expect(stepperGroup).toHaveClass(styles["stepper__group--cohesive--fill"])

      rerender(<Stepper aria-label="stepper" type="segmented" />)
      expect(stepperGroup).toHaveClass(styles["stepper__group--segmented"])
      expect(stepperGroup).not.toHaveClass(styles["stepper__group--cohesive--fill"])
    })

    it("responds to orientation props.", () => {
      const { rerender } = render(<Stepper orientation={ORIENTATION__HORIZONTAL} aria-label="stepper" />)
      const stepperGroup = screen.getByTestId("stepper-group")

      expect(stepperGroup).toHaveClass(styles["stepper__group--horizontal"])

      rerender(<Stepper aria-label="stepper" orientation={ORIENTATION__VERTICAL} />)
      expect(stepperGroup).toHaveClass(styles["stepper__group--vertical"])
    })

    it("responds to focus props.", () => {
      const { rerender } = render(<Stepper aria-label="stepper" />)
      const stepperGroup = screen.getByTestId("stepper-group")

      expect(stepperGroup).toHaveClass(styles["stepper--applyFocusStyle"])
      expect(stepperGroup).toHaveClass(styles["stepper--offsetFocusRing"])

      rerender(<Stepper enableFocusStyle={false} offsetFocusRing={false} aria-label="stepper" />)
      expect(stepperGroup).not.toHaveClass(styles["stepper--applyFocusStyle"])
      expect(stepperGroup).not.toHaveClass(styles["stepper--offsetFocusRing"])
    })

    it("responds to canonical disabled prop.", () => {
      render(<Stepper isDisabled aria-label="stepper" />)

      expect(screen.getByTestId("stepper")).toHaveAttribute("data-disabled", "true")
    })

    it("responds to canonical readonly prop.", async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()

      render(<Stepper isReadOnly defaultValue={5} onChange={onChange} aria-label="stepper" />)

      await user.click(getStepperButtons()[1])

      expect(onChange).not.toHaveBeenCalled()
    })

    it("responds to form element status props.", () => {
      const { rerender } = render(<Stepper errorState aria-label="stepper" />)
      const stepperGroup = screen.getByTestId("stepper-group")

      expect(stepperGroup).toHaveClass(styles["stepper--errorState"])

      rerender(<Stepper warningState aria-label="stepper" />)
      expect(stepperGroup).toHaveClass(styles["stepper--warningState"])

      rerender(<Stepper successState aria-label="stepper" />)
      expect(stepperGroup).toHaveClass(styles["stepper--successState"])
    })

    it("gives error validation state precedence over warning and success states.", () => {
      render(<Stepper errorState warningState successState aria-label="stepper" />)
      const stepperGroup = screen.getByTestId("stepper-group")

      expect(stepperGroup).toHaveClass(styles["stepper--errorState"])
      expect(stepperGroup).not.toHaveClass(styles["stepper--warningState"])
      expect(stepperGroup).not.toHaveClass(styles["stepper--successState"])
    })

    it("responds to custom styles props.", () => {
      render(
        <Stepper
          customStyles={{ color: "turquoise", borderRadius: 0 }}
          customGroupStyles={{ backgroundColor: "orange" }}
          customButtonStyles={{ borderRadius: 6 }}
          customInputStyles={{ backgroundColor: "green" }}
          aria-label="stepper"
        />,
      )

      const stepper = screen.getByTestId("stepper")
      const stepperGroup = screen.getByTestId("stepper-group")
      const stepperButtons = getStepperButtons()
      const input = screen.getByTestId("stepper-input")

      expect(stepper).toHaveStyle({ color: "rgb(64, 224, 208)", borderRadius: 0 })
      expect(stepperGroup).toHaveStyle({ backgroundColor: "rgb(255, 165, 0)" })
      stepperButtons.forEach((button) => expect(button).toHaveStyle({ borderRadius: "6px" }))
      expect(input).toHaveStyle({ backgroundColor: "rgb(0, 128, 0)" })
    })

    it("accepts custom labels for its internal control group.", () => {
      render(<Stepper aria-label="stepper" labels={{ inputButtonGroupAriaLabel: "Localized stepper controls" }} />)

      expect(screen.getByRole("group", { name: "Localized stepper controls" })).toBeInTheDocument()
    })

    it("merges native className and style without losing computed root styles.", () => {
      render(
        <Stepper
          height={50}
          width={150}
          customStyles={{ color: "turquoise", marginTop: 5 }}
          className="native-stepper-class"
          style={{ color: "tomato", width: 175, marginBottom: 10 }}
          aria-label="stepper"
        />,
      )

      const stepper = screen.getByTestId("stepper")

      expect(stepper).toHaveClass(styles.stepper)
      expect(stepper).toHaveClass(styles["stepper__group--round"])
      expect(stepper).toHaveClass("native-stepper-class")
      expect(stepper).toHaveStyle({
        height: "50px",
        width: "175px",
        color: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("does not leak wrapper props onto the root element.", () => {
      render(
        <Stepper
          height={50}
          width={150}
          textSize={STEPPER_SIZE__SM}
          type="cohesive"
          orientation={ORIENTATION__HORIZONTAL}
          color="red"
          colorMode={COLOR_MODE__OUTLINE}
          order="primary"
          geometry="round"
          enableFocusStyle={false}
          offsetFocusRing={false}
          errorState
          warningState
          successState
          PlusIcon={<span>Plus</span>}
          MinusIcon={<span>Minus</span>}
          customStyles={{ marginTop: 5 }}
          customGroupStyles={{ backgroundColor: "orange" }}
          customButtonStyles={{ borderRadius: 6 }}
          customInputStyles={{ backgroundColor: "green" }}
          labels={{ inputButtonGroupAriaLabel: "Stepper controls" }}
          aria-label="stepper"
        />,
      )

      const stepper = screen.getByTestId("stepper")

      expect(stepper).not.toHaveAttribute("height")
      expect(stepper).not.toHaveAttribute("width")
      expect(stepper).not.toHaveAttribute("textsize")
      expect(stepper).not.toHaveAttribute("type")
      expect(stepper).not.toHaveAttribute("orientation")
      expect(stepper).not.toHaveAttribute("color")
      expect(stepper).not.toHaveAttribute("colormode")
      expect(stepper).not.toHaveAttribute("order")
      expect(stepper).not.toHaveAttribute("geometry")
      expect(stepper).not.toHaveAttribute("enablefocusstyle")
      expect(stepper).not.toHaveAttribute("offsetfocusring")
      expect(stepper).not.toHaveAttribute("errorstate")
      expect(stepper).not.toHaveAttribute("warningstate")
      expect(stepper).not.toHaveAttribute("successstate")
      expect(stepper).not.toHaveAttribute("plusicon")
      expect(stepper).not.toHaveAttribute("minusicon")
      expect(stepper).not.toHaveAttribute("customstyles")
      expect(stepper).not.toHaveAttribute("customgroupstyles")
      expect(stepper).not.toHaveAttribute("custombuttonstyles")
      expect(stepper).not.toHaveAttribute("custominputstyles")
      expect(stepper).not.toHaveAttribute("labels")
    })
  })
})
