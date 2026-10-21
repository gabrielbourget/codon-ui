import { DEFAULT_VALIDATION_RESULT, VALID_VALIDITY_STATE } from "../../components/ComboBox/state/useFormValidationState"
import { nativeComboBoxFieldData } from "../comboBox"

const state = { value: null, inputValue: "held", realtimeValidation: DEFAULT_VALIDATION_RESULT }

it.each([
  [0, "0"],
  ["", ""],
  [null, ""],
  ["tail", "tail"],
] as const)("serializes the inner key %s without interpreting truthiness", (value, expected) => {
  expect(nativeComboBoxFieldData({ name: "entry" }, { ...state, value }).entries).toEqual([["entry", expected]])
})

it.each([{ formValue: "text" as const }, { formValue: "key" as const, allowsCustomValue: true }])(
  "serializes authoritative query text for %j",
  (props) => {
    expect(nativeComboBoxFieldData({ ...props, name: "entry" }, { ...state, value: 0 }).entries).toEqual([
      ["entry", "held"],
    ])
  },
)

it("keeps disabled exclusion and readonly inclusion as separate submission policies", () => {
  expect(nativeComboBoxFieldData({ isDisabled: true, name: "entry" }, state)).toMatchObject({
    entries: [["entry", ""]],
    isDisabled: true,
    isReadOnly: false,
  })
  expect(nativeComboBoxFieldData({ isReadOnly: true, name: "entry" }, state)).toMatchObject({
    entries: [["entry", ""]],
    isDisabled: false,
    isReadOnly: true,
  })
  expect(nativeComboBoxFieldData({ name: "" }, state).entries).toEqual([])
})

it("validates the original query even when the serialized key is empty", () => {
  const emptyKey = nativeComboBoxFieldData({ name: "entry", isRequired: true }, state)
  expect(emptyKey.entries).toEqual([["entry", ""]])
  expect(emptyKey.validation.validationDetails.valid).toBe(true)
  const emptyQuery = nativeComboBoxFieldData({ isRequired: true }, { ...state, value: 0, inputValue: "" })
  expect(emptyQuery.validation.validationDetails).toEqual({ ...VALID_VALIDITY_STATE, valueMissing: true, valid: false })
  expect(
    nativeComboBoxFieldData({ isRequired: true, validationBehavior: "aria" }, { ...state, inputValue: "" }).validation
      .validationDetails.valid,
  ).toBe(true)
})

it("retains every validation flag and server/custom message in the owned field snapshot", () => {
  const details = { ...VALID_VALIDITY_STATE, badInput: true, customError: true, tooLong: true, valid: false }
  const field = nativeComboBoxFieldData(
    {},
    {
      ...state,
      realtimeValidation: { isInvalid: true, validationErrors: ["Server says no"], validationDetails: details },
    },
  )
  expect(field.validation).toEqual({
    isInvalid: true,
    validationErrors: ["Server says no"],
    validationDetails: details,
  })
  expect(Object.keys(field.validation.validationDetails)).toHaveLength(11)
})
