import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"

import FormField from "../../../../packages/react/src/components/FormField/FormField"

it("preserves FormField root typography with independent label and child overrides", () => {
  render(
    <FormField
      label="Label"
      description="Description"
      errorMessages={["Error"]}
      customStyles={{ fontStyle: "italic", letterSpacing: 1 }}
      style={{ letterSpacing: 3 }}
      customLabelStyles={{ fontStyle: "normal" }}
    >
      <span data-testid="authored-child" style={{ fontStyle: "normal", letterSpacing: 7 }}>
        Child
      </span>
    </FormField>,
  )
  expect(screen.getByTestId("form-field")).toHaveStyle({ fontStyle: "italic", letterSpacing: "3px" })
  expect(screen.getByTestId("form-field-label")).toHaveStyle({ fontStyle: "normal" })
  const message = screen.getByTestId("form-field-error-messages")
  expect(message.closest('[data-testid="form-field"]')).toBe(screen.getByTestId("form-field"))
  expect(message.style.fontStyle).toBe("")
  expect(message.style.letterSpacing).toBe("")
  expect(screen.getByTestId("authored-child")).toHaveStyle({ fontStyle: "normal", letterSpacing: "7px" })
})
