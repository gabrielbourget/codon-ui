// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
import type { Color, HSLA, RGBA } from "../types"

import { hex } from "./hex"
import { hsla } from "./hsla"
import { rgba } from "./rgba"

export const color = {
  test: (v: unknown) => rgba.test(v) || hex.test(v) || hsla.test(v),
  parse: (v: string | Color): RGBA | HSLA => {
    if (rgba.test(v)) {
      return rgba.parse(v)
    } else if (hsla.test(v)) {
      return hsla.parse(v)
    } else {
      return hex.parse(v as string)
    }
  },
  transform: (v: HSLA | RGBA | string) => {
    if (typeof v === "string") return v
    const hasOwnProperty = v.hasOwnProperty
    return hasOwnProperty.call(v, "red") ? rgba.transform(v as RGBA) : hsla.transform(v as HSLA)
  },
  getAnimatableNone: (v: string) => {
    const parsed = color.parse(v)
    parsed.alpha = 0
    return color.transform(parsed)
  },
}
