"use client"

import type { CSSProperties, FC } from "react"

import styles from "./CircleLoaderStyles.module.css"

export type TCircleLoaderProps = {
  spinnerColor?: string
  spinnerTrackWidth?: string | number
  spinnerTrackColor?: string
  spinnerTrackIsTransparent?: boolean
  duration?: string | number
  size?: string | number
  customStyles?: CSSProperties
  testID?: string
  ariaLabel?: string
}

const formatDimension = (value: string | number | undefined, fallback: string) => {
  if (value === undefined) return fallback
  if (typeof value === "number") return `${value}px`

  return value
}

const CircleLoader: FC<TCircleLoaderProps> = ({
  spinnerColor = "currentColor",
  spinnerTrackWidth = 3,
  spinnerTrackColor,
  spinnerTrackIsTransparent = false,
  duration = "0.85s",
  size = 25,
  customStyles,
  testID,
  ariaLabel = "Loading",
}) => {
  const resolvedTrackColor = spinnerTrackIsTransparent
    ? "transparent"
    : (spinnerTrackColor ?? "rgba(127, 127, 127, 0.22)")

  return (
    <div className={styles.loader} style={customStyles} data-testid={testID} aria-label={ariaLabel} role="status">
      <div
        className={styles.spinner}
        style={
          {
            "--size": formatDimension(size, "24px"),
            "--track-width": formatDimension(spinnerTrackWidth, "3px"),
            "--spinner-color": spinnerColor,
            "--track-color": resolvedTrackColor,
            "--duration": typeof duration === "number" ? `${duration}ms` : duration,
          } as CSSProperties
        }
      />
    </div>
  )
}

export default CircleLoader
