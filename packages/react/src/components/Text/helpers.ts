import classNames from "classnames"
import type {
  CSSProperties,
  ElementType as ReactElementType,
  HTMLAttributes,
  LabelHTMLAttributes,
  PropsWithChildren,
} from "react"

import {
  ELEM_TYPE__LABEL,
  ELEM_TYPE__P,
  FONT_STYLE__ITALIC,
  FONT_VARIANT__BODY_1,
  FONT_VARIANT__BODY_2,
  FONT_VARIANT__BODY_3,
  FONT_VARIANT__BODY_4,
  FONT_VARIANT__BODY_5,
  FONT_VARIANT__BODY_6,
  FONT_VARIANT__BODY_7,
  FONT_VARIANT__BODY_8,
  FONT_VARIANT__BODY_9,
  FONT_VARIANT__BODY_10,
  FONT_VARIANT__BODY_11,
  FONT_VARIANT__BODY_12,
  FONT_VARIANT__BODY_13,
  FONT_VARIANT__DISPLAY_1,
  FONT_VARIANT__DISPLAY_2,
  FONT_VARIANT__DISPLAY_3,
  FONT_VARIANT__DISPLAY_4,
  FONT_VARIANT__DISPLAY_5,
  FONT_VARIANT__DISPLAY_6,
  FONT_VARIANT__HEADING_1,
  FONT_VARIANT__HEADING_2,
  FONT_VARIANT__HEADING_3,
  FONT_VARIANT__HEADING_4,
  FONT_VARIANT__HEADING_5,
  FONT_VARIANT__HEADING_6,
  FONT_VARIANT__HEADING_SM_1,
  FONT_VARIANT__HEADING_SM_2,
  FONT_VARIANT__HEADING_SM_3,
  FONT_VARIANT__HEADING_SM_4,
  FONT_VARIANT__HEADING_SM_5,
  FONT_VARIANT__HEADING_SM_6,
  FONT_WEIGHT__BOLD,
  FONT_WEIGHT__EXTRABOLD,
  FONT_WEIGHT__LIGHT,
  FONT_WEIGHT__MEDIUM,
  FONT_WEIGHT__REGULAR,
  FONT_WEIGHT__SEMIBOLD,
} from "./constants"
import styles from "./TextStyles.module.css"
import type {
  TAvailableElementTypes,
  TAvailableFontStyles,
  TAvailableFontVariants,
  TAvailableFontWeights,
} from "./types"

type TTextNativeProps = Omit<HTMLAttributes<HTMLElement>, "className" | "color" | "style"> &
  Pick<LabelHTMLAttributes<HTMLLabelElement>, "htmlFor">

export type TTextProps = PropsWithChildren<
  TTextNativeProps & {
    "data-testid"?: string
    className?: string
    style?: CSSProperties
    variant?: TAvailableFontVariants
    fontWeight?: TAvailableFontWeights
    fontStyle?: TAvailableFontStyles
    elementType?: TAvailableElementTypes
    composedInLink?: boolean
    color?: CSSProperties["color"]
    customStyles?: CSSProperties
    customClassName?: string
  }
>

type TTextCalibration = {
  textStyles: string
  ElementType: ReactElementType
  textStyle: CSSProperties
}

const computeFontVariantStyle = (variant?: TAvailableFontVariants): string => {
  const { d1, d2, d3, d4, d5, d6, h1, h2, h3, h4, h5, h6, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13 } =
    styles

  switch (variant) {
    case FONT_VARIANT__DISPLAY_1:
      return d1
    case FONT_VARIANT__DISPLAY_2:
      return d2
    case FONT_VARIANT__DISPLAY_3:
      return d3
    case FONT_VARIANT__DISPLAY_4:
      return d4
    case FONT_VARIANT__DISPLAY_5:
      return d5
    case FONT_VARIANT__DISPLAY_6:
      return d6
    case FONT_VARIANT__HEADING_1:
      return h1
    case FONT_VARIANT__HEADING_2:
      return h2
    case FONT_VARIANT__HEADING_3:
      return h3
    case FONT_VARIANT__HEADING_4:
      return h4
    case FONT_VARIANT__HEADING_5:
      return h5
    case FONT_VARIANT__HEADING_6:
      return h6
    case FONT_VARIANT__HEADING_SM_1:
      return styles["h1-sm"]
    case FONT_VARIANT__HEADING_SM_2:
      return styles["h2-sm"]
    case FONT_VARIANT__HEADING_SM_3:
      return styles["h3-sm"]
    case FONT_VARIANT__HEADING_SM_4:
      return styles["h4-sm"]
    case FONT_VARIANT__HEADING_SM_5:
      return styles["h5-sm"]
    case FONT_VARIANT__HEADING_SM_6:
      return styles["h6-sm"]
    case FONT_VARIANT__BODY_1:
      return b1
    case FONT_VARIANT__BODY_2:
      return b2
    case FONT_VARIANT__BODY_3:
      return b3
    case FONT_VARIANT__BODY_4:
      return b4
    case FONT_VARIANT__BODY_5:
      return b5
    case FONT_VARIANT__BODY_6:
      return b6
    case FONT_VARIANT__BODY_7:
      return b7
    case FONT_VARIANT__BODY_8:
      return b8
    case FONT_VARIANT__BODY_9:
      return b9
    case FONT_VARIANT__BODY_10:
      return b10
    case FONT_VARIANT__BODY_11:
      return b11
    case FONT_VARIANT__BODY_12:
      return b12
    case FONT_VARIANT__BODY_13:
      return b13
    default:
      return b10
  }
}

const computeFontWeightStyle = (weight?: TAvailableFontWeights): string => {
  switch (weight) {
    case FONT_WEIGHT__LIGHT:
      return styles["fw-light"]
    case FONT_WEIGHT__REGULAR:
      return styles["fw-regular"]
    case FONT_WEIGHT__SEMIBOLD:
      return styles["fw-semibold"]
    case FONT_WEIGHT__MEDIUM:
      return styles["fw-medium"]
    case FONT_WEIGHT__BOLD:
      return styles["fw-bold"]
    case FONT_WEIGHT__EXTRABOLD:
      return styles["fw-extrabold"]
    default:
      return styles["fw-regular"]
  }
}

const computeFontStyleStyle = (style?: TAvailableFontStyles): string | undefined => {
  if (style === FONT_STYLE__ITALIC) return styles["fs-italic"]

  return undefined
}

export const calibrateComponent = (props: TTextProps): TTextCalibration => {
  const {
    variant = FONT_VARIANT__BODY_10,
    fontWeight,
    fontStyle,
    elementType: elType,
    customStyles,
    color,
    composedInLink,
    customClassName,
    className,
    style,
  } = props
  const { base } = styles

  const fontVariantStyle = computeFontVariantStyle(variant)
  const fontWeightStyle = computeFontWeightStyle(fontWeight)
  const fontStyleStyle = computeFontStyleStyle(fontStyle)
  const composedInLinkStyle = composedInLink ? styles.composedInLink : undefined
  const textSelectionStyle = elType === ELEM_TYPE__LABEL ? styles["base--unselectable"] : undefined

  const textStyles = classNames(
    base,
    composedInLinkStyle,
    textSelectionStyle,
    fontVariantStyle,
    fontWeightStyle,
    fontStyleStyle,
    customClassName,
    className,
  )

  const ElementType = (elType ? elType : ELEM_TYPE__P) as ReactElementType
  const textStyle: CSSProperties = { color, ...customStyles, ...style }

  return {
    textStyles,
    ElementType,
    textStyle,
  }
}
