import { decodeNativeRangeThumbBinding } from "../rangeThumb"

it.each([
  null,
  [],
  {},
  { kind: "date-field", rootTarget: 4 },
  { kind: "range-thumb", rootTarget: 0 },
  { kind: "range-thumb", rootTarget: true },
  { kind: "range-thumb", rootTarget: "4" },
  { kind: "range-thumb", rootTarget: 1.5 },
  { kind: "range-thumb", rootTarget: 2147483648 },
  { kind: "range-thumb", rootTarget: 4, value: "private" },
])("rejects a malformed control binding %p", (value) => {
  expect(() => decodeNativeRangeThumbBinding(JSON.stringify(value))).toThrow()
})
