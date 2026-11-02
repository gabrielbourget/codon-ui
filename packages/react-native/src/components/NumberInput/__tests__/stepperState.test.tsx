import { act, render } from "@testing-library/react-native"
import { View } from "react-native"
import { useNumberFieldState } from "react-stately/useNumberFieldState"

import { NativeFormBehaviorContext } from "../../../form/context"
import { FormValidationContext } from "../../ComboBox/state/useFormValidationState"
import { createStepperNumberModel, nativeStepperValidity, stepperValueText } from "../stepperNumber"
import { useNativeStepperNumberFieldState } from "../stepperState"
import type { TNativeStepperNumberFieldProps } from "../stepperTypes"

const names = { accessibilityLabel: "Quantity", incrementLabel: "Add", decrementLabel: "Reduce" }
let state: ReturnType<typeof useNativeStepperNumberFieldState>
const Harness = (props: TNativeStepperNumberFieldProps) => {
  state = useNativeStepperNumberFieldState(props)
  return <View />
}
const show = (props: Partial<TNativeStepperNumberFieldProps> = {}) => render(<Harness {...names} {...props} />)

it.each([
  ["en-US", { style: "currency", currency: "USD", currencySign: "accounting" }, -12.5],
  ["fr-FR", { style: "currency", currency: "EUR" }, 1234.5],
  ["en-US", { style: "percent" }, 0.12],
  ["en-US", { style: "unit", unit: "liter", unitDisplay: "long" }, 12.5],
  ["en-US", { maximumSignificantDigits: 3 }, 1234],
  ["en-US-u-nu-arab", { maximumFractionDigits: 8 }, 0.12345678],
] as const)(
  "roundtrips actual %s formatter options %j through the installed parser",
  async (locale, options, value) => {
    const props = { ...names, locale, formatOptions: options }
    const model = createStepperNumberModel(props)
    const text = model.format(value)
    expect(text).toBe(new Intl.NumberFormat(locale, options).format(value))
    expect(model.commit(text)?.value).toBe(model.parse(text))
    await show({ ...props, defaultValue: value })
    expect(state.inputValue).toBe(text)
    expect(state.formValue).toBe(model.parse(text))
  },
)

it.each([
  { step: 0.25, defaultValue: -0.125 },
  { minValue: 0.1, maxValue: 1.1, step: 0.3, defaultValue: 0.5 },
  { minValue: 0, maxValue: 1.1, step: 0.25, defaultValue: 1.1 },
  { formatOptions: { style: "percent" as const }, defaultValue: 0.12 },
])("matches the pinned headless snap/step oracle for %j", async (props) => {
  let oracle: ReturnType<typeof useNumberFieldState>
  const Oracle = () => {
    oracle = useNumberFieldState({ ...props, locale: "en-US" })
    return <View />
  }
  await render(<Oracle />)
  const model = createStepperNumberModel({ ...names, ...props })
  const before = oracle!.inputValue
  const expected = model.step(before, 1)
  if (expected === undefined) expect(oracle!.canIncrement).toBe(false)
  await act(() => oracle!.increment())
  expect(oracle!.numberValue).toBe(expected ?? model.parse(before))
})

it("separates committed value from permissive raw/IME input and serializable parsed form value", async () => {
  const changed = jest.fn(),
    raw = jest.fn()
  await show({ value: 2, onChange: changed, onChangeText: raw })
  await act(() => state.change("١٢٫٥"))
  expect(state.value).toBe(2)
  expect(state.formValue).toBe(12.5)
  expect(state.inputValue).toBe("١٢٫٥")
  await act(() => state.change("uncommitted IME text"))
  expect(state.formValue).toBeNull()
  expect(state.inputValue).toBe("uncommitted IME text")
  expect(changed).not.toHaveBeenCalled()
  expect(raw.mock.calls).toEqual([["١٢٫٥"], ["uncommitted IME text"]])
  await act(() => state.commit())
  expect(state.inputValue).toBe("2")
  expect(changed).not.toHaveBeenCalled()
})

it.each(["snap", "validate"] as const)(
  "retains final override/one-shot behavior in %s mode",
  async (commitBehavior) => {
    const changed = jest.fn()
    await show({ value: 0.4, step: 0.25, minValue: 0, maxValue: 1, commitBehavior, onChange: changed })
    await act(() => {
      state.change("0.6")
      state.commit("1.2")
      state.commit("0.9")
    })
    expect(changed.mock.calls).toEqual([[commitBehavior === "snap" ? 1 : 1.2]])
    expect(state.value).toBe(0.4)
    expect(state.inputValue).toBe("0.4")
  },
)

it("uses latest final text during pending press and preserves short-release action ordering", async () => {
  const changed = jest.fn()
  await show({ defaultValue: 2, onChange: changed })
  await act(() => {
    state.change("3")
    state.pressStart()
    state.commit("7.5")
  })
  expect(changed).not.toHaveBeenCalled()
  await act(() => state.step(1, true))
  expect(changed.mock.calls).toEqual([[8]])
})

it("keeps empty/null distinct from zero and rounds beyond the bounded NumberInput precision", async () => {
  const changed = jest.fn()
  await show({ defaultValue: 0, onChange: changed, formatOptions: { maximumFractionDigits: 8 } })
  await act(() => {
    state.change("0.12345678")
    state.commit()
  })
  expect(state.value).toBe(0.12345678)
  await act(() => {
    state.change("")
    state.commit()
  })
  expect(state.value).toBeNull()
  await act(() => {
    state.change("-0")
    state.commit()
  })
  expect(state.value).toBe(0)
  expect(Object.is(state.value, -0)).toBe(false)
  expect(changed.mock.calls).toEqual([[0.12345678], [null], [0]])
})

it("keeps controlled callback/value echoes stable while model/reset changes retire old work", async () => {
  const first = jest.fn(),
    latest = jest.fn()
  const view = await show({ value: 2, defaultValue: 1, onChange: first })
  const key = state.configurationKey
  await view.rerender(<Harness {...names} value={3} defaultValue={1} onChange={latest} />)
  expect(state.configurationKey).toBe(key)
  await act(() => state.step(1))
  expect(latest.mock.calls).toEqual([[4]])
  expect(first).not.toHaveBeenCalled()
  await act(() => {
    state.change("8")
    state.pressStart()
  })
  const final = state.commit,
    press = state.step
  await act(() => state.resetValue())
  expect(state.configurationKey).not.toBe(key)
  expect(state.value).toBe(3)
  expect(state.inputValue).toBe("3")
  expect(latest.mock.calls).toEqual([[4], [1]])
  await act(() => {
    final("9")
    press(1, true)
  })
  expect(latest.mock.calls).toEqual([[4], [1]])
})

it("uses the current explicit default on reset without reinitializing uncontrolled current value", async () => {
  const view = await show({ defaultValue: 2 })
  await act(() => state.step(1))
  await view.rerender(<Harness {...names} defaultValue={8.1} step={0.5} />)
  expect(state.value).toBe(3)
  expect(state.defaultValue).toBe(8)
  await act(() => state.resetValue())
  expect(state.value).toBe(8)
  const key = state.configurationKey
  await act(() => state.resetValue())
  expect(state.configurationKey).not.toBe(key)
})

it.each(["isDisabled", "isReadOnly"] as const)(
  "guards user changes under %s while Form reset remains possible",
  async (guard) => {
    const view = await show({ defaultValue: 2 })
    await act(() => state.step(1))
    await view.rerender(<Harness {...names} defaultValue={2} {...{ [guard]: true }} />)
    await act(() => {
      state.change("5")
      state.commit("5")
      state.step(1)
      state.endpoint(1)
    })
    expect(state.value).toBe(3)
    await act(() => state.resetValue())
    expect(state.value).toBe(2)
  },
)

it("uses native/aria validation timing and the existing Form error context", async () => {
  const content = (behavior: "native" | "aria", errors = {}) => (
    <NativeFormBehaviorContext.Provider value={behavior}>
      <FormValidationContext.Provider value={errors}>
        <Harness
          {...names}
          name="quantity"
          defaultValue={2}
          validate={(value) => (value === 2 ? "Two refused" : true)}
        />
      </FormValidationContext.Provider>
    </NativeFormBehaviorContext.Provider>
  )
  const view = await render(content("native"))
  expect(state.realtimeValidation.validationErrors).toEqual(["Two refused"])
  expect(state.displayValidation.isInvalid).toBe(false)
  await act(() => state.commitValidation())
  expect(state.displayValidation.validationErrors).toEqual(["Two refused"])
  await act(() => state.resetValidation())
  expect(state.displayValidation.isInvalid).toBe(false)
  await view.rerender(content("aria"))
  expect(state.displayValidation.validationErrors).toEqual(["Two refused"])
  await view.rerender(content("native", { quantity: "Server refused" }))
  expect(state.displayValidation.validationErrors).toEqual(["Server refused"])
  await act(() => state.resetValue())
  expect(state.displayValidation.validationErrors).toEqual(["Server refused"])
  await act(() => state.resetValidation())
  expect(state.displayValidation.validationErrors).toEqual([])
})

it.each([
  [{ commitBehavior: "validate", step: 0.1 }, "0.30000000000000004", 0.1 + 0.2, {}],
  [{ commitBehavior: "validate", step: 0.1 }, "0.3000001", 0.3000001, { stepMismatch: true }],
  [{ commitBehavior: "validate" }, "0.5", 0.5, { stepMismatch: true }],
  [{ commitBehavior: "validate", formatOptions: { style: "percent" } }, "12%", 0.12, { stepMismatch: true }],
  [{ commitBehavior: "validate", minValue: -0.2, step: 0.1 }, "0.1", 0.1, {}],
  [{ commitBehavior: "validate", minValue: 1, maxValue: 3, isReadOnly: true }, "4", 4, { rangeOverflow: true }],
  [{ commitBehavior: "validate", minValue: 1 }, "0", 0, { rangeUnderflow: true }],
  [{ commitBehavior: "validate", minValue: 1, isDisabled: true }, "0", 0, {}],
  [{ isRequired: true }, "", null, { valueMissing: true }],
  [{ isRequired: true, isReadOnly: true }, "", null, {}],
  [{ isRequired: true, isDisabled: true }, "", null, {}],
  [{ commitBehavior: "snap", minValue: 1, step: 2 }, "0", 0, {}],
] as const)("matches canonical visible-text/temporary-number validity roles %j", (props, raw, value, flags) => {
  const result = nativeStepperValidity({ ...names, ...props }, raw, value)
  const actualFlags = Object.fromEntries(
    Object.entries(result.validationDetails).filter(([key, value]) => key !== "valid" && value),
  )
  expect(actualFlags).toEqual(flags)
  expect(result.isInvalid).toBe(Object.keys(flags).length > 0)
  expect(result.validationDetails.valid).toBe(!result.isInvalid)
})

it("lets custom/server/controlled validation retain precedence over numeric constraint flags", async () => {
  const view = await show({ value: 2.5, commitBehavior: "validate", step: 1, validate: () => "Owner error" })
  expect(state.realtimeValidation.validationErrors).toEqual(["Owner error"])
  expect(state.realtimeValidation.validationDetails.customError).toBe(true)
  await view.rerender(<Harness {...names} value={2.5} commitBehavior="validate" step={1} isInvalid />)
  expect(state.realtimeValidation.isInvalid).toBe(true)
  expect(state.realtimeValidation.validationDetails.customError).toBe(true)
})

it("ports localized empty and minus-sign text without changing business values", () => {
  expect(stepperValueText("fr-CA", "")).toBe("Vide")
  expect(stepperValueText("ja-JP", "")).toBe("空")
  expect(stepperValueText("en-US", "-$12.00")).toBe("−$12.00")
})

it("uses the initial upstream snapshot for a NaN/omitted default and detects invalid config types on update", async () => {
  const changed = jest.fn()
  const view = await show({ value: 2, defaultValue: NaN, onChange: changed })
  await view.rerender(<Harness {...names} value={3} defaultValue={NaN} onChange={changed} />)
  await act(() => state.resetValue())
  expect(changed.mock.calls).toEqual([[2]])
  expect(state.value).toBe(3)
  expect(() => createStepperNumberModel({ ...names, minValue: Infinity })).toThrow(TypeError)
  expect(() => createStepperNumberModel({ ...names, formatOptions: [] as never })).toThrow(TypeError)
})

it("preserves controlled aria-invalid=false without removing independent native numeric constraints", async () => {
  const view = await show({ value: 2, isInvalid: false })
  expect(state.realtimeValidation.isInvalid).toBe(false)
  expect(state.formValidation.validationDetails.valid).toBe(true)
  await view.rerender(<Harness {...names} value={2.5} isInvalid={false} commitBehavior="validate" />)
  expect(state.realtimeValidation.isInvalid).toBe(false)
  expect(state.formValidation.validationDetails.stepMismatch).toBe(true)
  expect(state.formValidation.validationDetails.valid).toBe(false)
})
