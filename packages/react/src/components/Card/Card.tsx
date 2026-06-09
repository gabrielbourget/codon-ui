import { motion } from "motion/react"
import type { CSSProperties, FC, PropsWithChildren } from "react"

import { type TCardProps, calibrateComponent } from "./helpers"

const normalizeDimension = (dimension?: string) => {
  if (!dimension) return undefined

  return /^-?\d+(\.\d+)?$/.test(dimension) ? `${dimension}px` : dimension
}

const Card: FC<PropsWithChildren<TCardProps>> = (props) => {
  const {
    height,
    width,
    borderRadius = "10",
    layoutMode,
    customClassName,
    customStyles,
    children,
    className,
    raised,
    style,
    ...rest
  } = props
  const { cardStyles } = calibrateComponent({ ...props, className, customClassName, raised })
  const normalizedHeight = normalizeDimension(height)
  const normalizedWidth = normalizeDimension(width)
  const normalizedBorderRadius = normalizeDimension(borderRadius)

  return (
    <motion.div
      {...rest}
      layout={layoutMode}
      className={cardStyles}
      style={
        {
          ...(normalizedHeight ? { "--height": normalizedHeight } : {}),
          ...(normalizedWidth ? { "--width": normalizedWidth } : {}),
          ...(normalizedBorderRadius ? { "--borderRadius": normalizedBorderRadius } : {}),
          ...customStyles,
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </motion.div>
  )
}

export default Card
