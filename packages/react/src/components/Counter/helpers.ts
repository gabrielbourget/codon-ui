import classNames from "classnames"
import type { CSSProperties, HTMLAttributes, ReactNode } from "react"

import { type TAriaLabelingProps } from "../../tokens/a11y"

import styles from "./CounterStyles.module.css"

type TCounterNativeProps = Omit<HTMLAttributes<HTMLDivElement>, "children" | "className" | "color" | "style">

export type TCounterProps = TCounterNativeProps &
  TAriaLabelingProps & {
    "data-testid"?: string
    className?: string
    style?: CSSProperties
    height?: string | number
    width?: string | number
    value: string | number
    color?: string
    showMaxValue?: boolean
    maxValue?: string | number
    showProgressIndicator?: boolean
    warningPercentageThreshold?: number
    errorOrDangerPercentageThreshold?: number
    children?: ReactNode
    customProgressIndicatorStyles?: CSSProperties
    customStyles?: CSSProperties
    customTextStyles?: CSSProperties
    customClassName?: string
  }

type TCounterCalibration = {
  counterStyles: string
  textRowStyles: string
  counterStyle: CSSProperties
  customStyles: CSSProperties
  customProgressIndicatorStyles: CSSProperties
  customTextStyles: CSSProperties
  statusColor: string | undefined
}

const STATUS_COLOR_WARNING = "var(--cui-status-warning, var(--cui-state-warning))"
const STATUS_COLOR_DANGER = "var(--cui-status-danger, var(--cui-state-danger))"

const computeStatusColor = (props: TCounterProps) => {
  const { value, maxValue, warningPercentageThreshold, errorOrDangerPercentageThreshold } = props
  let color: string | undefined = undefined

  if (!maxValue) return color

  const numericValue = Number(value)
  const numericMaxValue = Number(maxValue)

  if (!Number.isFinite(numericValue) || !Number.isFinite(numericMaxValue) || numericMaxValue === 0) return color

  const currentPercentage = Math.round((numericValue / numericMaxValue) * 100)

  if (errorOrDangerPercentageThreshold !== undefined && currentPercentage >= errorOrDangerPercentageThreshold) {
    color = STATUS_COLOR_DANGER
    return color
  }

  if (warningPercentageThreshold !== undefined && currentPercentage >= warningPercentageThreshold) {
    color = STATUS_COLOR_WARNING
  }

  return color
}

export const calibrateComponent = (props: TCounterProps): TCounterCalibration => {
  const { counter, counter__textRow } = styles
  const {
    height,
    width,
    color,
    customStyles: customStyles__props,
    customProgressIndicatorStyles: customProgressIndicatorStyles__props,
    customTextStyles: customTextStyles_props,
    customClassName,
    className,
    style,
  } = props

  const statusColor = computeStatusColor(props)

  const counterStyles = classNames(counter, customClassName, className)
  const textRowStyles = classNames(counter__textRow)

  const customStyles = Object.assign({ height, width, color }, { ...customStyles__props })
  const counterStyle = Object.assign({}, customStyles, { ...style })
  const customProgressIndicatorStyles = Object.assign({ color }, { ...customProgressIndicatorStyles__props })
  const customTextStyles = Object.assign({ color: statusColor ? statusColor : color }, { ...customTextStyles_props })

  return {
    counterStyles,
    textRowStyles,
    counterStyle,
    customStyles,
    customProgressIndicatorStyles,
    customTextStyles,
    statusColor,
  }
}
