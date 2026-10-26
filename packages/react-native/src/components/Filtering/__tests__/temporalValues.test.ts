import { parseFilterDateArgument, parseFilterDateTimeArgument, parseFilterTimeArgument } from "../temporalValues"

it.each([
  [parseFilterDateArgument, "2026-10-25"],
  [parseFilterDateTimeArgument, "2026-10-25T13:45:07"],
  [parseFilterTimeArgument, "00:00:00"],
] as const)("preserves the ISO type and controlled blanks for %s", (parse, text) => {
  expect(parse(text)?.toString()).toBe(text)
  for (const blank of [undefined, null, ""]) expect(parse(blank)).toBeNull()
  for (const invalid of [false, 0, [], "invalid", "2026-99-99"]) expect(() => parse(invalid)).toThrow()
})
