import { DEFAULT_VALIDATION_RESULT, VALID_VALIDITY_STATE } from "../../components/ComboBox/state/useFormValidationState"
import { nativeSimpleComboBoxFieldData, nativeSimpleComboBoxValidity } from "../simpleComboBox"

const state = {
  selectedKey: 0,
  query: "held query",
  validationBehavior: "native" as const,
  formValidation: DEFAULT_VALIDATION_RESULT,
}
it.each([0, "0", "", null])("keeps typed selected key %p distinct from the current query source", (selectedKey) => {
  expect(nativeSimpleComboBoxFieldData({ name: "choice" }, { ...state, selectedKey }).entries).toEqual([
    ["choice", String(selectedKey ?? "")],
  ])
  expect(
    nativeSimpleComboBoxFieldData({ name: "choice", formValue: "text" }, { ...state, selectedKey }).entries,
  ).toEqual([["choice", "held query"]])
})
it("keeps readonly inclusion, disabled exclusion metadata and native required validation separate", () => {
  expect(nativeSimpleComboBoxFieldData({ name: "choice", isReadOnly: true }, state)).toMatchObject({
    entries: [["choice", "0"]],
    isReadOnly: true,
    isDisabled: false,
  })
  expect(nativeSimpleComboBoxFieldData({ name: "choice", isDisabled: true }, state).isDisabled).toBe(true)
  expect(nativeSimpleComboBoxValidity({ isRequired: true }, "")).toEqual({
    isInvalid: true,
    validationDetails: { ...VALID_VALIDITY_STATE, valueMissing: true, valid: false },
    validationErrors: ["Required"],
  })
  for (const guard of [{ isReadOnly: true }, { isDisabled: true }, { validationBehavior: "aria" as const }])
    expect(nativeSimpleComboBoxValidity({ isRequired: true, ...guard }, "").isInvalid).toBe(false)
})
it("retains exact custom/server validity and authored required messages", () => {
  const validation = {
    isInvalid: true,
    validationDetails: { ...VALID_VALIDITY_STATE, customError: true, valid: false },
    validationErrors: ["Owner says no"],
  }
  expect(nativeSimpleComboBoxFieldData({}, { ...state, formValidation: validation }).validation).toEqual(validation)
  expect(nativeSimpleComboBoxValidity({ isRequired: true, requiredErrorMessage: "" }, "").validationErrors).toEqual([
    "",
  ])
})
