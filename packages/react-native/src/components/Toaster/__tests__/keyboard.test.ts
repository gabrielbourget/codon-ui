import type { TNativeObservedKeyData } from "../../../input/keyboardObservation"
import { matchesNativeToastObservedHotkey } from "../keyboard"

it.each([
  { target: 17, present: true },
  { target: -2147483647, present: true },
  { target: 0, present: false },
  { target: -1, present: false },
])("maps actual target presence without treating a signed resource ID as missing: $target", ({ target, present }) => {
  const data = { target, code: "KeyE" } as TNativeObservedKeyData
  for (const property of ["target", "currentTarget", "srcElement"])
    expect(matchesNativeToastObservedHotkey(data, [property])).toBe(present)
})
