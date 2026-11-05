import { DEFAULT_VALIDATION_RESULT } from "../../components/ComboBox/state/useFormValidationState"
import { nativeNumberFieldData } from "../numberField"

it.each([
  [0, "0"],
  [0.12, "0.12"],
  [-12.5, "-12.5"],
  [null, ""],
] as const)("serializes parsed numeric %s without localized display text", (formValue, serialized) => {
  const data = nativeNumberFieldData(
    { name: "quantity" },
    {
      formValue,
      isDisabled: false,
      isReadOnly: false,
      formValidation: DEFAULT_VALIDATION_RESULT,
      validationBehavior: "native",
    },
  )
  expect(data.entries).toEqual([["quantity", serialized]])
  expect(data.isReadOnly).toBe(false)
})
it("keeps disabled/validation/unnamed identity in the existing Form policy", () => {
  const data = nativeNumberFieldData(
    {},
    {
      formValue: 5,
      isDisabled: true,
      isReadOnly: true,
      formValidation: DEFAULT_VALIDATION_RESULT,
      validationBehavior: "aria",
    },
  )
  expect(data.entries).toEqual([])
  expect(data.isDisabled).toBe(true)
  expect(data.isReadOnly).toBe(true)
  expect(data.validationBehavior).toBe("aria")
  expect(data.validation).toBe(DEFAULT_VALIDATION_RESULT)
})
