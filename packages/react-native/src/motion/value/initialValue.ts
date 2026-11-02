import { NATIVE_MOTION_TRANSFORM_ORDER } from "../visual/types"

const transforms = new Set<string>(NATIVE_MOTION_TRANSFORM_ORDER)

// Only identity defaults are inferred. Authored transforms require an explicit
// scalar initial value instead of decomposing the committed native matrix.
export const nativeMotionInitialValue = (name: string, authored: Readonly<Record<string, unknown>>): unknown => {
  if (authored[name] !== undefined && authored[name] !== null) return authored[name]
  if (name === "opacity") return 1
  if (transforms.has(name) && authored.transform == null) return name.startsWith("scale") ? 1 : 0
  if (authored.transformOrigin == null) {
    if (name === "originX" || name === "originY") return 0.5
    if (name === "originZ") return 0
  }
  throw new Error(`Native motion: ${name} requires an explicit initial value in initial, values or authored style`)
}
