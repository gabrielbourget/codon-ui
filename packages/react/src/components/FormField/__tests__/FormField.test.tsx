import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import Input from "../../Input/Input"
import Text from "../../Text/Text"
import FormField from "../FormField"
import styles from "../FormFieldStyles.module.css"
import type { TFormFieldProps } from "../helpers"

const FormFieldExample = (props: Partial<TFormFieldProps>) => (
  <FormField label="Input" labelID="input-label-id" {...props}>
    <Input aria-labelledby="input-label-id" />
  </FormField>
)

describe("<FormField /> Tests", () => {
  it("FormField can render", () => {
    render(<FormFieldExample />)
    const formField = screen.getByTestId("form-field")
    expect(formField).toBeInTheDocument()
  })

  describe("Props API Surface Area", () => {
    it("FormField responds correctly to label props.", () => {
      render(<FormFieldExample label="Email" labelID="email-label-id" labelFor="email-input-id" required />)

      const label = screen.getByTestId("form-field-label")
      expect(label).toHaveAttribute("id", "email-label-id")
      expect(label).toHaveAttribute("for", "email-input-id")
      expect(label).toHaveTextContent(/email/iu)
      expect(label).toHaveTextContent("*")
    })

    it("FormField responds to top and bottom right content props.", () => {
      render(
        <FormFieldExample
          topRightContent={<Text data-toprightcontent>Top Right Content</Text>}
          bottomRightContent={<Text data-bottomrightcontent>Bottom Right Content</Text>}
        />,
      )

      const topRightContent = screen.getByTestId("form-field-top-right-content")
      const bottomRightContent = screen.getByTestId("form-field-bottom-right-content")
      expect(topRightContent).toHaveTextContent(/top right content/iu)
      expect(bottomRightContent).toHaveTextContent(/bottom right content/iu)
    })

    it("FormField responds correctly to warningMessages, errorMessages, and successMessages props.", () => {
      render(
        <FormFieldExample
          warningMessages={["Warning 1", "Warning 2"]}
          errorMessages={["Error 1", "Error 2"]}
          successMessages={["Success Info 1", "Success Info 2"]}
        />,
      )

      const warningMessages = screen.getAllByTestId("form-field-warning-messages")
      const errorMessages = screen.getAllByTestId("form-field-error-messages")
      const successMessages = screen.getAllByTestId("form-field-success-messages")

      expect(warningMessages.length).toBe(2)
      expect(warningMessages[0]).toHaveTextContent(/warning 1/iu)
      expect(errorMessages.length).toBe(2)
      expect(errorMessages[0]).toHaveTextContent(/error 1/iu)
      expect(successMessages.length).toBe(2)
      expect(successMessages[0]).toHaveTextContent(/success info 1/iu)
    })

    it("FormField responds correctly to description prop.", () => {
      render(<FormFieldExample description="Form Field Description" />)

      const description = screen.getByTestId("form-field-description")
      expect(description).toHaveTextContent(/description/iu)
    })

    it("FormField responds correctly to custom style props.", () => {
      render(
        <FormFieldExample
          errorMessages={["Error 1", "Error 2"]}
          description="Form Field Description"
          customStyles={{ backgroundColor: "turquoise", borderRadius: 0 }}
          customTopRowClassName="custom-top-row"
          customTopRowStyles={{ backgroundColor: "red" }}
          customLabelClassName="custom-label"
          customLabelStyles={{ backgroundColor: "green" }}
          customTopRightClassName="custom-top-right"
          customTopRightStyles={{ backgroundColor: "purple" }}
          customBottomRowClassName="custom-bottom-row"
          customBottomRowStyles={{ backgroundColor: "indigo" }}
          customBottomRightClassName="custom-bottom-right"
          customBottomRightStyles={{ backgroundColor: "brown" }}
          customValidationMessageClassName="custom-validation-message"
          customValidationMessageStyles={{ backgroundColor: "yellow" }}
          customDescriptionClassName="custom-description"
          customDescriptionStyles={{ backgroundColor: "blue" }}
        />,
      )

      const formField = screen.getByTestId("form-field")
      const topRow = screen.getByTestId("form-field-top-row")
      const label = screen.getByTestId("form-field-label")
      const topRight = screen.getByTestId("form-field-top-right-content")
      const bottomRow = screen.getByTestId("form-field-bottom-row")
      const bottomRight = screen.getByTestId("form-field-bottom-right-content")
      const validationMessage = screen.getByTestId("form-field-validation-messages")
      const description = screen.getByTestId("form-field-description")

      expect(formField).toHaveStyle({ backgroundColor: "rgb(64, 224, 208)", borderRadius: 0 })
      expect(topRow).toHaveClass("custom-top-row")
      expect(topRow).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" })
      expect(label).toHaveClass("custom-label")
      expect(label).toHaveStyle({ backgroundColor: "rgb(0, 128, 0)" })
      expect(topRight).toHaveClass("custom-top-right")
      expect(topRight).toHaveStyle({ backgroundColor: "rgb(128, 0, 128)" })
      expect(bottomRow).toHaveClass("custom-bottom-row")
      expect(bottomRow).toHaveStyle({ backgroundColor: "rgb(75, 0, 130)" })
      expect(bottomRight).toHaveClass("custom-bottom-right")
      expect(bottomRight).toHaveStyle({ backgroundColor: "rgb(165, 42, 42)" })
      expect(validationMessage).toHaveClass("custom-validation-message")
      expect(validationMessage).toHaveStyle({ backgroundColor: "rgb(255, 255, 0)" })
      expect(description).toHaveClass("custom-description")
      expect(description).toHaveStyle({ backgroundColor: "rgb(0, 0, 255)" })
    })

    it("FormField merges native root className and style without losing computed styles.", () => {
      render(
        <FormFieldExample
          customClassName="custom-form-field"
          className="native-form-field"
          customStyles={{ backgroundColor: "turquoise", marginTop: 5 }}
          style={{ backgroundColor: "tomato", marginBottom: 10 }}
          data-testid="custom-form-field-testid"
        />,
      )

      const formField = screen.getByTestId("custom-form-field-testid")

      expect(formField).toHaveClass(styles.formField)
      expect(formField).toHaveClass("custom-form-field")
      expect(formField).toHaveClass("native-form-field")
      expect(formField).toHaveStyle({
        backgroundColor: "rgb(255, 99, 71)",
        marginTop: "5px",
        marginBottom: "10px",
      })
    })

    it("FormField maps aria labeling aliases onto root aria attributes.", () => {
      render(
        <FormFieldExample
          ariaLabel="Alias label"
          ariaLabelledBy="alias-label-id"
          ariaDescribedBy="alias-description-id"
          ariaDetails="alias-details-id"
        />,
      )

      const formField = screen.getByTestId("form-field")

      expect(formField).toHaveAttribute("aria-label", "Alias label")
      expect(formField).toHaveAttribute("aria-labelledby", "alias-label-id")
      expect(formField).toHaveAttribute("aria-describedby", "alias-description-id")
      expect(formField).toHaveAttribute("aria-details", "alias-details-id")
    })

    it("FormField gives native aria attributes precedence over alias props.", () => {
      render(
        <FormFieldExample
          aria-label="Native label"
          aria-labelledby="native-label-id"
          aria-describedby="native-description-id"
          aria-details="native-details-id"
          ariaLabel="Alias label"
          ariaLabelledBy="alias-label-id"
          ariaDescribedBy="alias-description-id"
          ariaDetails="alias-details-id"
        />,
      )

      const formField = screen.getByTestId("form-field")

      expect(formField).toHaveAttribute("aria-label", "Native label")
      expect(formField).toHaveAttribute("aria-labelledby", "native-label-id")
      expect(formField).toHaveAttribute("aria-describedby", "native-description-id")
      expect(formField).toHaveAttribute("aria-details", "native-details-id")
    })

    it("FormField does not leak wrapper props onto the root element.", () => {
      render(
        <FormFieldExample
          required
          raised
          labelFor="input-id"
          topRightContent={<Text>Top</Text>}
          bottomRightContent={<Text>Bottom</Text>}
          errorMessages={["Error"]}
          warningMessages={["Warning"]}
          successMessages={["Success"]}
          customClassName="custom-form-field"
          customStyles={{ marginTop: 5 }}
          customTopRowClassName="custom-top-row"
          customTopRowStyles={{ backgroundColor: "red" }}
          customLabelClassName="custom-label"
          customLabelStyles={{ backgroundColor: "green" }}
          customTopRightClassName="custom-top-right"
          customTopRightStyles={{ backgroundColor: "purple" }}
          customBottomRowClassName="custom-bottom-row"
          customBottomRowStyles={{ backgroundColor: "indigo" }}
          customBottomRightClassName="custom-bottom-right"
          customBottomRightStyles={{ backgroundColor: "brown" }}
          customValidationMessageClassName="custom-validation-message"
          customValidationMessageStyles={{ backgroundColor: "yellow" }}
          customDescriptionClassName="custom-description"
          customDescriptionStyles={{ backgroundColor: "blue" }}
        />,
      )

      const formField = screen.getByTestId("form-field")

      expect(formField).not.toHaveAttribute("label")
      expect(formField).not.toHaveAttribute("labelid")
      expect(formField).not.toHaveAttribute("labelfor")
      expect(formField).not.toHaveAttribute("required")
      expect(formField).not.toHaveAttribute("raised")
      expect(formField).not.toHaveAttribute("customclassname")
      expect(formField).not.toHaveAttribute("customstyles")
      expect(formField).not.toHaveAttribute("customtoprowclassname")
      expect(formField).not.toHaveAttribute("customtoprowstyles")
      expect(formField).not.toHaveAttribute("customlabelclassname")
      expect(formField).not.toHaveAttribute("customlabelstyles")
      expect(formField).not.toHaveAttribute("customtoprightclassname")
      expect(formField).not.toHaveAttribute("customtoprightstyles")
      expect(formField).not.toHaveAttribute("custombottomrowclassname")
      expect(formField).not.toHaveAttribute("custombottomrowstyles")
      expect(formField).not.toHaveAttribute("custombottomrightclassname")
      expect(formField).not.toHaveAttribute("custombottomrightstyles")
      expect(formField).not.toHaveAttribute("customvalidationmessageclassname")
      expect(formField).not.toHaveAttribute("customvalidationmessagestyles")
      expect(formField).not.toHaveAttribute("customdescriptionclassname")
      expect(formField).not.toHaveAttribute("customdescriptionstyles")
    })
  })
})
