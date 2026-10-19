import { NATIVE_MOTION_TRANSFORM_ORDER } from "../visual/types"

export const transformProps = new Set<string>([...NATIVE_MOTION_TRANSFORM_ORDER, "pathRotation"])
export const positionalKeys = new Set<string>([
  "width",
  "height",
  "top",
  "left",
  "right",
  "bottom",
  ...NATIVE_MOTION_TRANSFORM_ORDER,
])
