import type { CSSProperties } from "react"

import loadingStyles from "./DefaultLoadingIndicator.module.css"
import styles from "./TypeaheadSearchStyles.module.css"

type TTypeaheadSearchDefaultLoadingIndicatorProps = {
  size?: number | string
  spinnerColor?: string
  spinnerTrackWidth?: number | string
  spinnerTrackColor?: string
  spinnerTrackIsTransparent?: boolean
  duration?: number | string
  testID?: string
  ariaLabel?: string
}

const formatDimension = (value: string | number | undefined, fallback: string) => {
  if (value === undefined) return fallback
  if (typeof value === "number") return `${value}px`

  return value
}

const TypeaheadSearchDefaultLoadingIndicator = (props: TTypeaheadSearchDefaultLoadingIndicatorProps) => {
  const {
    size = 18,
    spinnerColor = "currentColor",
    spinnerTrackWidth = 2.5,
    spinnerTrackColor,
    spinnerTrackIsTransparent = true,
    duration = "0.85s",
    testID,
    ariaLabel = "Loading",
  } = props
  const resolvedTrackColor = spinnerTrackIsTransparent
    ? "transparent"
    : (spinnerTrackColor ?? "rgba(127, 127, 127, 0.22)")

  return (
    <div className={styles.typeaheadSearch__loadingIndicator} data-testid={testID} aria-label={ariaLabel} role="status">
      <div
        className={loadingStyles.spinner}
        style={
          {
            "--size": formatDimension(size, "18px"),
            "--track-width": formatDimension(spinnerTrackWidth, "2.5px"),
            "--spinner-color": spinnerColor,
            "--track-color": resolvedTrackColor,
            "--duration": typeof duration === "number" ? `${duration}ms` : duration,
          } as CSSProperties
        }
      />
    </div>
  )
}

export default TypeaheadSearchDefaultLoadingIndicator
