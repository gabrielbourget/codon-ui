import { fireEvent, render, screen } from "@testing-library/react-native"

import { NumberInput } from "@codon-ui/react-native"

const mockAppEvaluations: string[] = []
jest.mock("expo", () => ({ registerRootComponent: jest.fn() }))
jest.mock("../../../App", () => {
  mockAppEvaluations.push(typeof new Intl.NumberFormat("en-US").formatToParts)
  return { __esModule: true, default: () => null }
})

const originalNumberFormat = Intl.NumberFormat
const intlDescriptors = Object.getOwnPropertyDescriptors(Intl)
const numberLocaleString = Object.getOwnPropertyDescriptor(Number.prototype, "toLocaleString")!
const bigintLocaleString = Object.getOwnPropertyDescriptor(BigInt.prototype, "toLocaleString")!

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  Object.defineProperties(Intl, intlDescriptors)
  Object.defineProperty(Number.prototype, "toLocaleString", numberLocaleString)
  Object.defineProperty(BigInt.prototype, "toLocaleString", bigintLocaleString)
  jest.useRealTimers()
})

it("preserves an adequate formatter and existing number prototype methods", () => {
  jest.isolateModules(() => {
    const runtime = jest.requireActual("../number-format")
    expect(runtime.NUMBER_INTL_PREPARATION).toBe("existing")
  })
  expect(Intl.NumberFormat).toBe(originalNumberFormat)
  expect(Number.prototype.toLocaleString).toBe(numberLocaleString.value)
  expect(BigInt.prototype.toLocaleString).toBe(bigintLocaleString.value)
})

it("prepares the observed missing-instance operation before App evaluation and supports public numeric commits", async () => {
  class IncompleteNumberFormat extends originalNumberFormat {
    constructor(...args: ConstructorParameters<typeof Intl.NumberFormat>) {
      super(...args)
      Object.defineProperty(this, "formatToParts", { value: undefined })
    }
  }
  Intl.NumberFormat = IncompleteNumberFormat as unknown as typeof Intl.NumberFormat
  expect(typeof new Intl.NumberFormat("en-US").formatToParts).toBe("undefined")
  jest.isolateModules(() => jest.requireActual("../../../index"))
  expect(mockAppEvaluations).toEqual(["function"])
  expect(Intl.NumberFormat).not.toBe(originalNumberFormat)
  expect(Number.prototype.toLocaleString).not.toBe(numberLocaleString.value)
  expect(BigInt.prototype.toLocaleString).not.toBe(bigintLocaleString.value)
  expect(Intl.NumberFormat.supportedLocalesOf(["en-US", "fr-CA", "fr-FR"])).toEqual(["en-US", "fr-CA", "fr-FR"])
  expect(new Intl.NumberFormat("en-US").format(1234.5)).toBe("1,234.5")
  expect(new Intl.NumberFormat("fr-FR").format(1234.5)).toBe("1\u202f234,5")
  expect(new Intl.NumberFormat("en-US-u-nu-arab").format(12.5)).toBe("١٢٫٥")
  const onChange = jest.fn()
  await render(
    <NumberInput
      accessibilityLabel="Quantity"
      incrementLabel="Increase quantity"
      decrementLabel="Decrease quantity"
      locale="fr-CA"
      defaultValue={1234.5}
      onChange={onChange}
    />,
  )
  const input = screen.getByTestId("number-input-input")
  expect(input).toHaveDisplayValue("1\u00a0234,5")
  await fireEvent.changeText(input, "2\u00a0345,75")
  await fireEvent(input, "endEditing", { nativeEvent: { text: "2\u00a0345,75" } })
  expect(input).toHaveDisplayValue("2\u00a0345,75")
  expect(onChange.mock.calls).toEqual([[2345.75]])
  const prepared = Intl.NumberFormat
  jest.isolateModules(() => jest.requireActual("../number-format"))
  expect(Intl.NumberFormat).toBe(prepared)
}, 15000)
