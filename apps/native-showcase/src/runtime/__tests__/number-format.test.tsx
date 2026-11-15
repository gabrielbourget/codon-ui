import { fireEvent, render, screen } from "@testing-library/react-native"

import { NumberInput } from "@codon-ui/react-native"

const mockAppEvaluations: string[] = []
const mockPluralAppEvaluations: string[] = []
jest.mock("expo", () => ({ registerRootComponent: jest.fn() }))
jest.mock("../../../App", () => {
  mockAppEvaluations.push(typeof new Intl.NumberFormat("en-US").formatToParts)
  mockPluralAppEvaluations.push(typeof Intl.PluralRules)
  return { __esModule: true, default: () => null }
})

const originalNumberFormat = Intl.NumberFormat
const originalPluralRules = Intl.PluralRules
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
  expect(Intl.PluralRules).toBe(originalPluralRules)
  expect(Number.prototype.toLocaleString).toBe(numberLocaleString.value)
  expect(BigInt.prototype.toLocaleString).toBe(bigintLocaleString.value)
})

it("prepares exact Egyptian Arabic data when otherwise adequate native support omits that locale", () => {
  class MissingArabicNumberFormat extends originalNumberFormat {
    static supportedLocalesOf(...args: Parameters<typeof originalNumberFormat.supportedLocalesOf>) {
      return originalNumberFormat.supportedLocalesOf(...args).filter((locale) => locale !== "ar-EG")
    }
  }
  Intl.NumberFormat = MissingArabicNumberFormat as typeof Intl.NumberFormat
  jest.isolateModules(() => {
    expect(jest.requireActual("../number-format").NUMBER_INTL_PREPARATION).toBe("polyfilled")
  })
  expect(Intl.NumberFormat.supportedLocalesOf(["en-US", "fr-CA", "fr-FR", "ar-EG"])).toEqual([
    "en-US",
    "fr-CA",
    "fr-FR",
    "ar-EG",
  ])
  expect(new Intl.NumberFormat("ar-EG").resolvedOptions().numberingSystem).toBe("arab")
  expect(new Intl.NumberFormat("ar-EG").format(12.5)).toBe("١٢٫٥")
})

it("prepares regional data when reported Egyptian Arabic support falls back to generic Arabic digits", () => {
  class RegionalFallbackNumberFormat extends originalNumberFormat {
    constructor(...[locales, options]: ConstructorParameters<typeof originalNumberFormat>) {
      super(locales === "ar-EG" ? "ar" : locales, options)
    }
  }
  Intl.NumberFormat = RegionalFallbackNumberFormat as typeof Intl.NumberFormat
  expect(Intl.NumberFormat.supportedLocalesOf(["ar-EG"])).toEqual(["ar-EG"])
  expect(new Intl.NumberFormat("ar-EG").resolvedOptions().numberingSystem).toBe("latn")
  jest.isolateModules(() => {
    expect(jest.requireActual("../number-format").NUMBER_INTL_PREPARATION).toBe("polyfilled")
  })
  expect(new Intl.NumberFormat("ar-EG").resolvedOptions().numberingSystem).toBe("arab")
  expect(new Intl.NumberFormat("ar-EG").format(12.5)).toBe("١٢٫٥")
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

it("prepares missing Intl prerequisites in order with selected regional data", () => {
  for (const name of ["NumberFormat", "getCanonicalLocales", "Locale", "PluralRules"] as const)
    Reflect.deleteProperty(Intl, name)
  jest.isolateModules(() => {
    expect(jest.requireActual("../number-format").NUMBER_INTL_PREPARATION).toBe("polyfilled")
  })
  expect(typeof Intl.getCanonicalLocales).toBe("function")
  expect(typeof Intl.Locale).toBe("function")
  expect(typeof Intl.PluralRules).toBe("function")
  expect(new Intl.NumberFormat("fr-CA").format(1234.5)).toBe("1\u00a0234,5")
  expect(new Intl.NumberFormat("en-US-u-nu-arab").format(12.5)).toBe("١٢٫٥")
})

it("prepares missing plural rules before App while preserving adequate number support and all drag locales", () => {
  const messagesPath = "../../../../../packages/react-native/src/collection/dragAndDrop/messages"
  const stringsPath = "../../../../../packages/react-native/src/collection/dragAndDrop/strings"
  const expected = new Map<string, string[]>()
  const counts = [0, 1, 2, 3, 5, 11, 21, 101]
  jest.isolateModules(() => {
    const { nativeDragFormatter } = jest.requireActual(messagesPath)
    const { nativeDragMessages } = jest.requireActual(stringsPath)
    for (const locale of Object.keys(nativeDragMessages))
      expected.set(
        locale,
        counts.map((count) => nativeDragFormatter(locale).format("dragSelectedItems", { count })),
      )
  })
  Reflect.deleteProperty(Intl, "PluralRules")
  mockAppEvaluations.length = 0
  mockPluralAppEvaluations.length = 0
  jest.isolateModules(() => {
    jest.requireActual("../../../index")
    const { nativeDragFormatter } = jest.requireActual(messagesPath)
    expect(nativeDragFormatter("en-US").format("dragSelectedItems", { count: 3 })).toBe("Drag 3 selected items")
    expect(Intl.PluralRules.supportedLocalesOf([...expected.keys()])).toEqual([...expected.keys()])
    for (const [locale, messages] of expected)
      expect(counts.map((count) => nativeDragFormatter(locale).format("dragSelectedItems", { count }))).toEqual(
        messages,
      )
    const runtime = jest.requireActual("../number-format")
    expect(runtime.NUMBER_INTL_PREPARATION).toBe("existing")
    expect(runtime.PLURAL_INTL_PREPARATION).toBe("polyfilled")
  })
  expect(mockAppEvaluations).toEqual(["function"])
  expect(mockPluralAppEvaluations).toEqual(["function"])
  expect(Intl.NumberFormat).toBe(originalNumberFormat)
  expect(Number.prototype.toLocaleString).toBe(numberLocaleString.value)
  expect(BigInt.prototype.toLocaleString).toBe(bigintLocaleString.value)
})
