import type { TNativeCircularProgressProps } from "./types"

export const getNativeCircularGeometry = (props: TNativeCircularProgressProps) => {
  const { value, minValue = 0, maxValue = 100, circleRatio = 1, counterClockwise = false } = props
  const radius = 50 - (props.strokeWidth ?? 8) / 2 - (props.backgroundColor ? (props.backgroundPadding ?? 0) : 0)
  const span = maxValue - minValue
  const bounded = Math.min(Math.max(value, minValue), maxValue)
  const ratio = span <= 0 ? 0 : Math.min((bounded - minValue) / span, 1)
  const circumference = 2 * Math.PI * radius
  const direction = counterClockwise ? -1 : 1
  const trackOffset = direction * (1 - circleRatio) * circumference
  const pathOffset = direction * (1 - ratio * circleRatio) * circumference
  const rotation = counterClockwise ? 1 : 0
  return {
    radius,
    ratio,
    bounded,
    percentage: ((bounded - minValue) / span) * 100,
    circumference,
    trackOffset,
    pathOffset,
    description: `M 50,50 m 0,-${radius} a ${radius},${radius} ${rotation} 1 1 0,${2 * radius} a ${radius},${radius} ${rotation} 1 1 0,-${2 * radius}`,
    canDrawTrack: radius >= 0 && [radius, circumference, trackOffset].every(Number.isFinite),
    canDrawPath: radius >= 0 && [radius, circumference, pathOffset].every(Number.isFinite),
    hasNativeRange: [minValue, maxValue, bounded].every(Number.isFinite) && maxValue > minValue,
  }
}
