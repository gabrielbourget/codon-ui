import type { DimensionValue } from "react-native"

export type TNativeDisplayDimension = Extract<DimensionValue, number | string>

export const validateNativeDisplayDimension = (value: unknown, component: string, field: string) => {
  if (value === undefined || value === "auto") return
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return
  if (
    typeof value === "string" &&
    /^(?:\d+(?:\.\d*)?|\.\d+)%$/.test(value) &&
    Number.isFinite(Number(value.slice(0, -1)))
  )
    return
  throw new TypeError(component + ": " + field + " must be a finite nonnegative native dimension, percentage or auto")
}
