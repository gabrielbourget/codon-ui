import type { TNativeCounterProps } from "./types"

export const getNativeCounterStatus = (props: TNativeCounterProps) => {
  const { value, maxValue, warningPercentageThreshold, errorOrDangerPercentageThreshold } = props
  if (!maxValue) return undefined
  const numericValue = Number(value)
  const numericMax = Number(maxValue)
  if (!Number.isFinite(numericValue) || !Number.isFinite(numericMax) || numericMax === 0) return undefined
  const percentage = Math.round((numericValue / numericMax) * 100)
  if (errorOrDangerPercentageThreshold !== undefined && percentage >= errorOrDangerPercentageThreshold) return "danger"
  if (warningPercentageThreshold !== undefined && percentage >= warningPercentageThreshold) return "warning"
  return undefined
}
