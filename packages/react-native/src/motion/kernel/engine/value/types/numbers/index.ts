// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
import { clamp } from "../../../../utils/index"

export const number = {
  test: (v: number) => typeof v === "number",
  parse: parseFloat,
  transform: (v: number) => v,
}

export const alpha = {
  ...number,
  transform: (v: number) => clamp(0, 1, v),
}

export const scale = {
  ...number,
  default: 1,
}
