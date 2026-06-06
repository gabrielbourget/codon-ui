import classnames from "classnames"
import type { CSSProperties } from "react"

import styles from "./LaggingLinesLoaderStyles.module.css"

export type TLaggingLinesLoaderProps = {
  width?: string | number
  color?: string
  duration?: string | number
  customStyles?: CSSProperties
}

type TLaggingLinesLoaderCalibration = {
  loaderStyles: string
  loadingSlideStyles: string
  slideStyles: string
  customStyles: CSSProperties
}

export const formatDimension = (value: string | number) => {
  if (typeof value === "number") return `${value}px`

  return value
}

const formatDuration = (value: string | number | undefined) => {
  if (value === undefined) return undefined
  if (typeof value === "number") return `${value}ms`

  return value
}

export const calibrateComponent = (props: TLaggingLinesLoaderProps): TLaggingLinesLoaderCalibration => {
  const { color, duration, customStyles: customStyles__props } = props
  const { loader, loadingSlide, slide } = styles

  const loaderStyles = classnames(loader)
  const loadingSlideStyles = classnames(loadingSlide)
  const slideStyles = classnames(slide)

  const customStyles = Object.assign(
    { background: color, animationDuration: formatDuration(duration) },
    { ...customStyles__props },
  )

  return { loaderStyles, loadingSlideStyles, slideStyles, customStyles }
}
