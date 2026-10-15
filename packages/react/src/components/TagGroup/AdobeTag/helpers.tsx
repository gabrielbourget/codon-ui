import classNames from "classnames"
import type { CSSProperties, ReactNode } from "react"
import type { TagProps, TagRenderProps } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../../tokens/theme-order"

import styles from "./AdobeTagStyles.module.css"
import TagDefaultCloseIcon from "./DefaultCloseIcon"

const {
  ["tag--applyFocusStyle"]: tagApplyFocusStyle,
  ["tag--default"]: tagDefault,
  ["tag--noFocusStyle"]: tagNoFocusStyle,
  ["tag--offsetFocusRing"]: tagOffsetFocusRing,
  ["tag--primary"]: tagPrimary,
  ["tag--quaternary"]: tagQuaternary,
  ["tag--quintenary"]: tagQuintenary,
  ["tag--raised"]: tagRaised,
  ["tag--round"]: tagRound,
  ["tag--rounded"]: tagRounded,
  ["tag--secondary"]: tagSecondary,
  ["tag--tertiary"]: tagTertiary,
  ["tag--transparent"]: tagTransparent,
} = styles

type TTagRootProps = Omit<TagProps, "children">

export type TTagProps = TTagRootProps & {
  "data-testid"?: string
  height?: number | string
  width?: number | string
  geometry?: TCornerGeometry
  order?: TThemingOrderCode
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  color?: string
  transparent?: boolean
  raised?: boolean
  autoFocus?: boolean
  closeIcon?: ReactNode
  children: ReactNode | ((values: TagRenderProps) => ReactNode)
  customClassName?: string
  customStyles?: CSSProperties
}

type TTagStyleRenderProps = TagRenderProps & {
  defaultStyle: CSSProperties
}

type TTagClassNameRenderProps = TagRenderProps & {
  defaultClassName: string | undefined
}

type TTagCalibration = {
  tagStyles: TTagProps["className"]
  tagStyle: TTagProps["style"]
  customStyles: CSSProperties
  closeIcon: ReactNode
}

const mergeTagClassNames = (
  computedClassName: string,
  classNameProp: TTagProps["className"],
): TTagProps["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TTagClassNameRenderProps) => classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeTagStyles = (computedStyles: CSSProperties, styleProp: TTagProps["style"]): TTagProps["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TTagStyleRenderProps) => ({
      ...computedStyles,
      ...styleProp(styleProps),
    })
  }

  return {
    ...computedStyles,
    ...styleProp,
  }
}

const computeTagColorStyle = (props: TTagProps) => {
  const { transparent = false } = props
  let { color } = props
  const { order } = props
  if (color) color = color.toLowerCase().trim()

  let backgroundColorStyle: string | undefined = undefined

  if (transparent) {
    backgroundColorStyle = tagTransparent
    return backgroundColorStyle
  }

  if (color) return

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      backgroundColorStyle = tagPrimary
      break
    case THEME_ORDER_CODE__SECONDARY:
      backgroundColorStyle = tagSecondary
      break
    case THEME_ORDER_CODE__TERTIARY:
      backgroundColorStyle = tagTertiary
      break
    case THEME_ORDER_CODE__QUATERNARY:
      backgroundColorStyle = tagQuaternary
      break
    case THEME_ORDER_CODE__QUINTENARY:
      backgroundColorStyle = tagQuintenary
      break
    default:
      backgroundColorStyle = tagDefault
      break
  }

  return backgroundColorStyle
}

const computeTagGeometryStyle = (props: TTagProps) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return tagRounded
    case ROUND:
      return tagRound
    default:
      return undefined
  }
}

export const calibrateComponent = (props: TTagProps): TTagCalibration => {
  const {
    customStyles: customStyles__props,
    customClassName,
    raised,
    color,
    enableFocusStyle,
    offsetFocusRing: offsetFocusRing__props = true,
    height,
    width,
    className,
    style,
  } = props
  let { closeIcon } = props
  const { tag, tag__icon } = styles

  if (!closeIcon) {
    closeIcon = (
      <TagDefaultCloseIcon size={15} customClassName={tag__icon} aria-hidden data-testid="tag-default-close-icon" />
    )
  }

  const colorStyle = computeTagColorStyle(props)
  const tagGeometryStyle = computeTagGeometryStyle(props)
  const raisedStyle = raised !== undefined && raised === true ? tagRaised : undefined
  const focusStyle = enableFocusStyle !== undefined && enableFocusStyle === false ? tagNoFocusStyle : tagApplyFocusStyle
  const offsetFocusRingStyle = offsetFocusRing__props === true ? tagOffsetFocusRing : undefined

  const computedTagStyles = classNames(
    tag,
    tagGeometryStyle,
    colorStyle,
    raisedStyle,
    focusStyle,
    offsetFocusRingStyle,
    customClassName,
  )
  const tagStyles = mergeTagClassNames(computedTagStyles, className)

  const customStyles = Object.assign({ height, width, backgroundColor: color }, { ...customStyles__props })
  const tagStyle = mergeTagStyles(customStyles, style)

  return { tagStyles, tagStyle, customStyles, closeIcon }
}
