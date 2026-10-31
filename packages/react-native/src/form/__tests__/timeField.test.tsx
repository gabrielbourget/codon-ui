import { CalendarDateTime, Time, parseZonedDateTime } from "@internationalized/date"
import { act, renderHook } from "@testing-library/react-native"

import { useTimeFieldState } from "../../date/state/useTimeFieldState"
import { nativeTimeFieldData } from "../timeField"

it.each([
  new Time(13, 45, 7),
  new CalendarDateTime(2024, 10, 1, 13, 45, 7),
  parseZonedDateTime("2024-10-01T13:45:07[America/New_York]"),
])("serializes the source time field control independently of its %s owner class", async (value) => {
  const { result } = await renderHook(() => useTimeFieldState({ locale: "en-GB", value }))
  expect(nativeTimeFieldData({ name: "clock" }, result.current).entries).toEqual([["clock", "13:45:07"]])
})
it.each([false, true])(
  "keeps required null validation on the source form control when visible readonly is %s",
  async (isReadOnly) => {
    const { result } = await renderHook(() =>
      useTimeFieldState({ locale: "en-GB", value: null, isRequired: true, isReadOnly }),
    )
    expect(nativeTimeFieldData({ name: "clock" }, result.current)).toMatchObject({
      entries: [["clock", ""]],
      isReadOnly: false,
      validation: { isInvalid: true, validationDetails: { valueMissing: true, valid: false } },
    })
  },
)
it("retains disabled exclusion and aria behavior without changing readonly interaction state", async () => {
  const { result } = await renderHook(() =>
    useTimeFieldState({ locale: "en-GB", value: null, isDisabled: true, isReadOnly: true, isRequired: true }),
  )
  const data = nativeTimeFieldData({ name: "clock" }, result.current)
  expect(data).toMatchObject({
    isDisabled: true,
    isReadOnly: false,
    validation: { isInvalid: false, validationDetails: { valueMissing: false } },
  })
  expect(result.current.isReadOnly).toBe(true)
  expect(
    nativeTimeFieldData({ name: "clock", validationBehavior: "aria" }, { ...result.current, isDisabled: false })
      .validation.isInvalid,
  ).toBe(false)
})
it("submits the authoritative value while incomplete displayed segments await an owner request", async () => {
  const value = new Time(13, 45, 7),
    request = jest.fn()
  const { result } = await renderHook(() =>
    useTimeFieldState({ locale: "en-GB", value, onChange: request, granularity: "second" }),
  )
  await act(() => result.current.clearSegment("hour"))
  expect(result.current.segments.find((segment) => segment.type === "hour")?.isPlaceholder).toBe(true)
  expect(nativeTimeFieldData({ name: "clock" }, result.current).entries).toEqual([["clock", "13:45:07"]])
  expect(request).not.toHaveBeenCalled()
})
it("preserves custom validation precedence while retaining missing-value flags", async () => {
  const { result } = await renderHook(() => useTimeFieldState({ locale: "en-GB", value: null, isRequired: true }))
  const data = nativeTimeFieldData({ requiredErrorMessage: "Choose a time" }, result.current)
  expect(data.entries).toEqual([])
  expect(data.validation.validationErrors).toEqual(["Choose a time"])
  const validation = {
    ...data.validation,
    validationDetails: { ...data.validation.validationDetails, customError: true },
    validationErrors: ["Server time error"],
  }
  const updated = nativeTimeFieldData(
    { name: "clock" },
    { ...result.current, realtimeValidation: { ...validation, validationErrors: [...validation.validationErrors] } },
  )
  expect(updated.validation.validationErrors).toEqual(["Server time error"])
  expect(updated.validation.validationDetails).toMatchObject({ customError: true, valueMissing: true, valid: false })
})
