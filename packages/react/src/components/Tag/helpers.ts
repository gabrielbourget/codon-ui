import classNames from "classnames"
import type { AriaAttributes, CSSProperties, HTMLAttributes } from "react"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"

import styles from "./TagStyles.module.css"

type TTagNativeProps = Omit<HTMLAttributes<HTMLElement>, "children" | "className" | "color" | "id" | "style">

type TTagCSSVariables = CSSProperties & {
  "--activeBGColor"?: string
  "--inactiveBGColor"?: string
  "--activeBorder"?: string
  "--inactiveBorder"?: string
  "--hoverCursor"?: string
  "--bgColorTransition"?: string
  "--focusOutline"?: string
  "--outlineOffset"?: string
}

type TTagCalibration = {
  tagStyles: string
  CSSVars: TTagCSSVariables
  customStyles: CSSProperties
  tagStyle: TTagCSSVariables
}

const DEFAULT_ACTIVE_BACKGROUND_COLOR = "var(--aui-control-selected-background)"
const DEFAULT_INACTIVE_BACKGROUND_COLOR = "var(--aui-control-background)"

export type TCommonTagProps = TTagNativeProps & {
  height?: string | number
  width?: string | number
  id?: string | number
  "aria-label"?: string
  raised?: boolean
  raisedOnHover?: boolean
  geometry?: TCornerGeometry
  hoverCursor?: string
  backgroundColorTransition?: string
  focusOutline?: string
  outlineOffset?: string
  className?: string
  style?: CSSProperties
  customStyles?: CSSProperties
  customClassName?: string
}

export type TStaticTagProps = TCommonTagProps & {
  pressable?: false
  color?: string
  border?: string
}

export type TPressableTagProps = TCommonTagProps & {
  isDisabled?: boolean
  pressable: true
  isPressed: boolean
  "aria-pressed"?: AriaAttributes["aria-pressed"]
  onPress: (id?: string | number) => void
  activeColor?: string
  activeBorder?: string
  inactiveColor?: string
  inactiveBorder?: string
}

export type TTagProps = TStaticTagProps | TPressableTagProps

export const isPressable = (p: TTagProps): p is TPressableTagProps => p.pressable === true

const determineTagGeometryStyle = (props: TTagProps) => {
  const { geometry = ROUNDED } = props
  let geometryStyle: string | undefined

  switch (geometry) {
    case ORTHOGONAL:
      break
    case ROUNDED:
      geometryStyle = styles["tag--rounded"]
      break
    case ROUND:
      geometryStyle = styles["tag--round"]
      break
    default:
      break
  }

  return geometryStyle
}

export const calibrateComponent = (props: TTagProps): TTagCalibration => {
  const {
    height,
    width,
    raised = false,
    raisedOnHover = false,
    pressable = false,
    hoverCursor,
    backgroundColorTransition,
    focusOutline,
    outlineOffset,
    className,
    style,
    customClassName,
    customStyles: customStyles__props,
  } = props

  let computedActiveBGColor = DEFAULT_ACTIVE_BACKGROUND_COLOR
  let computedInactiveBGColor = DEFAULT_INACTIVE_BACKGROUND_COLOR
  let computedActiveBorder: string | undefined = "none"
  let computedInactiveBorder: string | undefined

  const geometryStyle = determineTagGeometryStyle(props)
  const pressableStyle = pressable ? styles["tag--pressable"] : undefined
  const raisedStyle = raised ? styles["tag--raised"] : undefined
  const raisedOnHoverStyle = raisedOnHover ? styles["tag--raisedOnHover"] : undefined

  let statusStyle = styles["tag--active"]
  let disabledStyle: string | undefined = undefined

  if (isPressable(props)) {
    const { isPressed, activeColor, inactiveColor, activeBorder, inactiveBorder, isDisabled = false } = props

    computedActiveBGColor = activeColor ?? DEFAULT_ACTIVE_BACKGROUND_COLOR
    computedInactiveBGColor = inactiveColor ?? DEFAULT_INACTIVE_BACKGROUND_COLOR
    computedActiveBorder = activeBorder ?? "none"
    computedInactiveBorder = inactiveBorder ?? undefined
    statusStyle = isPressed ? styles["tag--active"] : styles["tag--inactive"]
    disabledStyle = isDisabled ? styles["tag--disabled"] : undefined
  } else {
    const { color, border } = props

    if (color) computedActiveBGColor = color
    if (border) computedActiveBorder = border
    // -> Make inactive values mirror active so CSS vars are always defined.
    computedInactiveBGColor = computedActiveBGColor
    computedInactiveBorder = computedActiveBorder
    // -> Use active styles path as basis for static tag styling.
    statusStyle = styles["tag--active"]
  }

  const CSSVars: TTagCSSVariables = {
    "--activeBGColor": computedActiveBGColor,
    "--inactiveBGColor": computedInactiveBGColor,
    "--activeBorder": computedActiveBorder,
    "--inactiveBorder": computedInactiveBorder,
    "--hoverCursor": hoverCursor,
    "--bgColorTransition": backgroundColorTransition,
    "--focusOutline": focusOutline,
    "--outlineOffset": outlineOffset,
  } as TTagCSSVariables

  const tagStyles = classNames(
    styles["tag"],
    statusStyle,
    disabledStyle,
    geometryStyle,
    raisedStyle,
    raisedOnHoverStyle,
    pressableStyle,
    customClassName,
    className,
  )

  const customStyles: CSSProperties = Object.assign({ height, width }, { ...customStyles__props })
  const tagStyle: TTagCSSVariables = Object.assign({}, CSSVars, customStyles, { ...style })

  return {
    tagStyles,
    CSSVars,
    customStyles,
    tagStyle,
  }
}
