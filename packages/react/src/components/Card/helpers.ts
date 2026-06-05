import classnames from "classnames"
import type { HTMLMotionProps } from "motion/react"
import type { CSSProperties } from "react"

import styles from "./CardStyles.module.css"

type TCardNativeProps = Omit<HTMLMotionProps<"div">, "children" | "className" | "style">

export type TCardProps = TCardNativeProps & {
  height?: string
  width?: string
  borderRadius?: string
  layoutMode?: "size" | "position"
  raised?: boolean
  className?: string
  style?: CSSProperties
  customClassName?: string
  customStyles?: CSSProperties
}

export const calibrateComponent = (props: TCardProps) => {
  const { className, customClassName, raised = true } = props

  const raisedStyle = raised ? styles["card--raised"] : undefined
  const cardStyles = classnames(styles.card, raisedStyle, customClassName, className)

  return { cardStyles }
}
