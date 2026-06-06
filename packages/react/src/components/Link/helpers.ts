import classNames from "classnames"
import type { AnchorHTMLAttributes, CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from "react"

import type { TAriaLabelingProps } from "../../tokens/a11y"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"

import styles from "./LinkStyles.module.css"

type TLinkNativeProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "children" | "className" | "color" | "href" | "onClick" | "onKeyDown" | "style"
>

export type TLinkProps = TLinkNativeProps &
  TAriaLabelingProps & {
    "data-testid"?: string
    href: string
    color?: string
    order?: TThemingOrderCode
    textDecoration?: string
    enableFocusStyle?: boolean
    offsetFocusRing?: boolean
    isDisabled?: boolean
    children?: ReactNode
    className?: string
    style?: CSSProperties
    onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
    onKeyDown?: (e: KeyboardEvent<HTMLAnchorElement>) => void
    customClassName?: string
    customStyles?: CSSProperties
  }

const computeColorStyle = (props: TLinkProps) => {
  const { order, color } = props

  let backgroundColorStyle = ""

  if (color) return

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      backgroundColorStyle = styles["link--primary"]
      break
    case THEME_ORDER_CODE__SECONDARY:
      backgroundColorStyle = styles["link--secondary"]
      break
    case THEME_ORDER_CODE__TERTIARY:
      backgroundColorStyle = styles["link--tertiary"]
      break
    case THEME_ORDER_CODE__QUATERNARY:
      backgroundColorStyle = styles["link--quaternary"]
      break
    case THEME_ORDER_CODE__QUINTENARY:
      backgroundColorStyle = styles["link--quintenary"]
      break
    default:
      break
  }

  return backgroundColorStyle
}

export const calibrateComponent = (props: TLinkProps) => {
  const { link } = styles
  const {
    className,
    textDecoration = "underline",
    color,
    customStyles: customStyles_props,
    customClassName,
    enableFocusStyle = true,
    offsetFocusRing: offsetFocusRing_props = true,
    style,
  } = props

  const colorStyle = computeColorStyle(props)
  const underlineStyle = textDecoration === "underline" ? styles["link--underline"] : undefined
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false
      ? styles["link--noFocusStyle"]
      : styles["link--applyFocusStyle"]
  const offsetFocusRingStyle = offsetFocusRing_props === true ? styles["link--offsetFocusRing"] : undefined

  const linkStyles = classNames(
    link,
    colorStyle,
    underlineStyle,
    focusStyle,
    offsetFocusRingStyle,
    customClassName,
    className,
  )
  const customStyles: CSSProperties = Object.assign({ color }, { ...customStyles_props }, { ...style })

  return { linkStyles, customStyles }
}
