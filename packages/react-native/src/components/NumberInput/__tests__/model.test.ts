import { createNumberModel, decimalUnits } from "../model"

describe("NumberInput decimal model", () => {
  test.each([
    ["", null],
    ["  ", null],
    ["0", 0],
    ["-0", 0],
    ["1.125", 1.125],
    ["1,234.50", 1234.5],
    ["1,,2", 12],
    ["١٢٫٥", 12.5],
    ["١٢.٥", 125],
    ["0.0005", 0.001],
    ["-0.0005", -0.001],
  ])("commits %s as %s", (raw, value) => {
    expect(createNumberModel({}).commit(raw as string)).toEqual({ value })
  })
  test.each([
    "-",
    ".",
    "NaN",
    "Infinity",
    "1e3",
    "0x10",
    "+1",
    "bad paste",
    "9007199254740991",
    "999999999999999999999999",
  ])("rejects %s", (raw) => {
    expect(createNumberModel({}).commit(raw)).toBeUndefined()
  })
  test.each([
    ["fr-CA", "1\u00a0234,50"],
    ["fr-FR", "1\u202f234,50"],
  ])("supports %s input and declared output", (locale, raw) => {
    const model = createNumberModel({ locale })
    expect(model.commit(raw)).toEqual({ value: 1234.5 })
    expect(model.format(1234.5)).toBe(raw.slice(0, -1))
  })
  test("keeps the output numbering system explicit", () => {
    expect(createNumberModel({}).format(12.5)).toBe("12.5")
    expect(createNumberModel({ locale: "en-US-u-nu-arab" }).format(12.5)).toBe("١٢٫٥")
    expect(createNumberModel({ locale: "fr-CA" }).commit("1,")).toEqual({ value: 1 })
    const canonical = createNumberModel({ locale: "EN-us-U-NU-ARAB" })
    expect(canonical.format(12.5)).toBe("١٢٫٥")
    expect(canonical.commit("invalid paste")).toBeUndefined()
  })
  test("explains the observed missing native number-parts capability", () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl.NumberFormat.prototype, "formatToParts")!
    try {
      Object.defineProperty(Intl.NumberFormat.prototype, "formatToParts", { configurable: true, value: undefined })
      expect(() => createNumberModel({})).toThrow("Intl.NumberFormat.formatToParts is required")
    } finally {
      Object.defineProperty(Intl.NumberFormat.prototype, "formatToParts", descriptor)
    }
  })
  test("precision zero rejects fractional syntax; precision six rounds half away from zero", () => {
    expect(createNumberModel({ formatOptions: { maximumFractionDigits: 0 } }).commit("1.2")).toBeUndefined()
    expect(createNumberModel({ formatOptions: { maximumFractionDigits: 6 } }).commit("-1.2345675")).toEqual({
      value: -1.234568,
    })
    expect(decimalUnits(1e-6, 6)).toBe(1)
    expect(decimalUnits(1e-7, 6)).toBeUndefined()
    expect(decimalUnits(0.29, 2)).toBe(29)
    expect(decimalUnits(Number.MAX_SAFE_INTEGER, 0)).toBe(Number.MAX_SAFE_INTEGER)
    expect(decimalUnits(Number.MAX_SAFE_INTEGER, 1)).toBeUndefined()
  })
  test.each([
    { minValue: NaN },
    { maxValue: Infinity },
    { step: 0 },
    { step: -1 },
    { step: 0.0001 },
    { minValue: 2, maxValue: 1 },
    { minValue: Number.MAX_SAFE_INTEGER },
    { formatOptions: { maximumFractionDigits: 7 } },
    { formatOptions: { maximumFractionDigits: 1.5 } },
    { formatOptions: { minimumFractionDigits: 3, maximumFractionDigits: 2 } },
    { locale: "not_a_locale" },
    { locale: "zz-ZZ" },
  ])("rejects invalid configuration %j", (config) => {
    expect(() => createNumberModel(config)).toThrow(TypeError)
  })
  test("rejects unsupported formats and nonrepresentable props", () => {
    expect(() => createNumberModel({ formatOptions: { maximumFractionDigits: null } as never })).toThrow(TypeError)
    expect(() => createNumberModel({ formatOptions: [] as never })).toThrow(TypeError)
    expect(() => createNumberModel({ locale: "en-US-u-nu-foobar" })).toThrow(TypeError)
    expect(() => createNumberModel({ formatOptions: { style: "currency" } as never })).toThrow(TypeError)
    expect(() => createNumberModel({ formatOptions: { notation: "compact" } as never })).toThrow(TypeError)
    expect(() => createNumberModel({ formatOptions: { useGrouping: "yes" } as never })).toThrow(TypeError)
    for (const value of [NaN, Infinity, 0.0001, Number.MAX_SAFE_INTEGER])
      expect(() => createNumberModel({}).validateValue(value, "value")).toThrow("value")
    expect(() => createNumberModel({ minValue: 1 }).validateValue(0.25, "value")).not.toThrow()
  })
  test("snaps min-anchored ties, negative ties and off-grid maxima", () => {
    expect(createNumberModel({ minValue: 0.1, maxValue: 1, step: 0.25 }).commit("0.475")).toEqual({ value: 0.6 })
    expect(createNumberModel({ step: 0.25 }).commit("-0.125")).toEqual({ value: -0.25 })
    const capped = createNumberModel({ minValue: 0, maxValue: 1.1, step: 0.25 })
    expect(capped.commit("1.1")).toEqual({ value: 1 })
    expect(capped.step("1", 1)).toBeUndefined()
    expect(capped.step("8", -1)).toBe(1)
    expect(capped.step("-4", 1)).toBe(0)
    expect(capped.step("8", 1)).toBeUndefined()
    expect(capped.step("-4", -1)).toBeUndefined()
  })
  test("omitted step preserves decimals while arrows select strictly adjacent integer grid points", () => {
    const model = createNumberModel({})
    expect(model.commit("1.125")).toEqual({ value: 1.125 })
    expect(model.step("1.125", 1)).toBe(2)
    expect(model.step("1.125", -1)).toBe(1)
    expect(model.step("1", -1)).toBe(0)
  })
  test("seeds empty/invalid drafts once and steps without binary tails", () => {
    const model = createNumberModel({ minValue: 1, maxValue: 10 })
    expect(model.step("", 1)).toBe(1)
    expect(model.step("invalid", -1)).toBe(10)
    const fractional = createNumberModel({ step: 0.1 })
    let value = 0
    for (let index = 1; index <= 10; index++) {
      value = fractional.step(String(value), 1)!
      expect(value).toBe(index / 10)
    }
  })
  test("refuses unsafe arithmetic and never crosses the safe unit boundary", () => {
    const nearLimit = createNumberModel({ step: 0.001 })
    expect(nearLimit.step("9007199254740.99", 1)).toBeUndefined()
    expect(createNumberModel({}).step("999999999999999999999999", 1)).toBeUndefined()
    const model = createNumberModel({ formatOptions: { maximumFractionDigits: 0 } })
    expect(model.step(String(Number.MAX_SAFE_INTEGER), 1)).toBeUndefined()
    expect(model.step(String(-Number.MAX_SAFE_INTEGER), -1)).toBeUndefined()
    const wide = createNumberModel({ minValue: -Number.MAX_SAFE_INTEGER, formatOptions: { maximumFractionDigits: 0 } })
    expect(wide.step(String(Number.MAX_SAFE_INTEGER), -1)).toBeUndefined()
  })
})
