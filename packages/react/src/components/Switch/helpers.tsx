import classNames from "classnames"
import type { CSSProperties, ReactNode } from "react"
import type { SwitchProps, SwitchRenderProps } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"

import styles from "./SwitchStyles.module.css"

const {
  ["_switch__indicator--applyFocusStyle"]: switch__indicatorApplyFocusStyle,
  ["_switch__indicator--invertColorsOnToggle"]: switch__indicatorInvertColorsOnToggle,
  ["_switch__indicator--noFocusStyle"]: switch__indicatorNoFocusStyle,
  ["_switch__indicator--offsetFocusRing"]: switch__indicatorOffsetFocusRing,
  ["_switch__indicator--raised"]: switch__indicatorRaised,
  ["_switch__indicator--round"]: switch__indicatorRound,
  ["_switch__indicator--rounded"]: switch__indicatorRounded,
  ["_switch__track--fallback"]: switch__trackFallback,
  ["_switch__track--primary"]: switch__trackPrimary,
  ["_switch__track--quaternary"]: switch__trackQuaternary,
  ["_switch__track--quintenary"]: switch__trackQuintenary,
  ["_switch__track--round"]: switch__trackRound,
  ["_switch__track--rounded"]: switch__trackRounded,
  ["_switch__track--secondary"]: switch__trackSecondary,
  ["_switch__track--showBorder"]: switch__trackShowBorder,
  ["_switch__track--showBorder--invertColorsOnToggle--fallback"]: switch__trackShowBorderInvertColorsOnToggleFallback,
  ["_switch__track--showBorder--invertColorsOnToggle--primary"]: switch__trackShowBorderInvertColorsOnTogglePrimary,
  ["_switch__track--showBorder--invertColorsOnToggle--quaternary"]:
    switch__trackShowBorderInvertColorsOnToggleQuaternary,
  ["_switch__track--showBorder--invertColorsOnToggle--quintenary"]:
    switch__trackShowBorderInvertColorsOnToggleQuintenary,
  ["_switch__track--showBorder--invertColorsOnToggle--secondary"]: switch__trackShowBorderInvertColorsOnToggleSecondary,
  ["_switch__track--showBorder--invertColorsOnToggle--tertiary"]: switch__trackShowBorderInvertColorsOnToggleTertiary,
  ["_switch__track--tertiary"]: switch__trackTertiary,
} = styles

export type TSwitchProps = SwitchProps & {
  "data-testid"?: string
  height?: string | number
  width?: string | number
  trackColor?: string
  indicatorColor?: string
  invertColorsOnToggle?: boolean
  showBorder?: boolean
  geometry?: TCornerGeometry
  order?: TThemingOrderCode
  raised?: boolean
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  iconOn?: ReactNode
  iconOff?: ReactNode
  showOnOffIcons?: boolean
  leftContent?: ReactNode
  rightContent?: ReactNode
  customStyles?: CSSProperties
  customTrackStyles?: CSSProperties
  customIndicatorStyles?: CSSProperties
}

const DEFAULT_ICON_SIZE = 10

const SwitchDefaultOnIcon = () => (
  <svg width={DEFAULT_ICON_SIZE} height={DEFAULT_ICON_SIZE} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="currentColor"
      d="M362.6 192.9L345 174.8c-.7-.8-1.8-1.2-2.8-1.2-1.1 0-2.1.4-2.8 1.2l-122 122.9-44.4-44.4c-.8-.8-1.8-1.2-2.8-1.2-1 0-2 .4-2.8 1.2l-17.8 17.8c-1.6 1.6-1.6 4.1 0 5.7l56 56c3.6 3.6 8 5.7 11.7 5.7 5.3 0 9.9-3.9 11.6-5.5h.1l133.7-134.4c1.4-1.7 1.4-4.2-.1-5.7z"
    />
  </svg>
)

const SwitchDefaultOffIcon = () => (
  <svg width={DEFAULT_ICON_SIZE} height={DEFAULT_ICON_SIZE} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="currentColor"
      d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
    />
  </svg>
)

export const DEFAULT_ON_ICON = <SwitchDefaultOnIcon />
export const DEFAULT_OFF_ICON = <SwitchDefaultOffIcon />

type TSwitchClassNameRenderProps = SwitchRenderProps & {
  defaultClassName: string | undefined
}

type TSwitchStyleRenderProps = SwitchRenderProps & {
  defaultStyle: CSSProperties
}

type TSwitchCalibration = {
  switchStyles: TSwitchProps["className"]
  switchStyle: TSwitchProps["style"]
  trackStyles: string
  indicatorStyles: string
  customStyles: CSSProperties
  customTrackStyles: CSSProperties
  customIndicatorStyles: CSSProperties
  shouldRenderOnOffIconSlots: boolean
  computedIconOn: ReactNode
  computedIconOff: ReactNode
}

type TSwitchCSSVariables = CSSProperties & Record<`--switch-${string}`, string | undefined>

const mergeSwitchClassNames = (
  computedClassName: string,
  classNameProp: SwitchProps["className"],
): SwitchProps["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TSwitchClassNameRenderProps) => classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeSwitchStyles = (computedStyles: CSSProperties, styleProp: CSSProperties | undefined): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeSwitchStyle = (computedStyles: CSSProperties, styleProp: SwitchProps["style"]): SwitchProps["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TSwitchStyleRenderProps) => mergeSwitchStyles(computedStyles, styleProp(styleProps))
  }

  return mergeSwitchStyles(computedStyles, styleProp)
}

const computeGeometryStyles = (props: TSwitchProps) => {
  const { geometry = ROUND } = props
  let trackGeometryStyle: string | undefined = undefined
  let indicatorGeometryStyle: string | undefined = undefined

  switch (geometry) {
    case ORTHOGONAL:
      break
    case ROUNDED:
      trackGeometryStyle = switch__trackRounded
      indicatorGeometryStyle = switch__indicatorRounded
      break
    case ROUND:
      trackGeometryStyle = switch__trackRound
      indicatorGeometryStyle = switch__indicatorRound
      break
    default:
      trackGeometryStyle = switch__trackRound
      indicatorGeometryStyle = switch__indicatorRound
      break
  }

  return { trackGeometryStyle, indicatorGeometryStyle }
}

const computeTrackStyles = (props: TSwitchProps) => {
  const { order, showBorder = false, invertColorsOnToggle = false } = props

  let trackColorStyle: string | undefined = undefined
  let trackBorderStyle: string | undefined = undefined
  let trackBorderColorInversionStyle: string | undefined = undefined

  if (showBorder) trackBorderStyle = switch__trackShowBorder

  if (!order) {
    trackColorStyle = switch__trackFallback

    if (showBorder && invertColorsOnToggle) {
      trackBorderColorInversionStyle = switch__trackShowBorderInvertColorsOnToggleFallback
    }
    return { trackColorStyle, trackBorderStyle, trackBorderColorInversionStyle }
  }

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      trackColorStyle = switch__trackPrimary

      if (showBorder && invertColorsOnToggle) {
        trackBorderColorInversionStyle = switch__trackShowBorderInvertColorsOnTogglePrimary
      }

      break
    case THEME_ORDER_CODE__SECONDARY:
      trackColorStyle = switch__trackSecondary

      if (showBorder && invertColorsOnToggle) {
        trackBorderColorInversionStyle = switch__trackShowBorderInvertColorsOnToggleSecondary
      }

      break
    case THEME_ORDER_CODE__TERTIARY:
      trackColorStyle = switch__trackTertiary

      if (showBorder && invertColorsOnToggle) {
        trackBorderColorInversionStyle = switch__trackShowBorderInvertColorsOnToggleTertiary
      }

      break
    case THEME_ORDER_CODE__QUATERNARY:
      trackColorStyle = switch__trackQuaternary

      if (showBorder && invertColorsOnToggle) {
        trackBorderColorInversionStyle = switch__trackShowBorderInvertColorsOnToggleQuaternary
      }

      break
    case THEME_ORDER_CODE__QUINTENARY:
      trackColorStyle = switch__trackQuintenary

      if (showBorder && invertColorsOnToggle) {
        trackBorderColorInversionStyle = switch__trackShowBorderInvertColorsOnToggleQuintenary
      }

      break
    default:
      trackColorStyle = switch__trackPrimary

      if (showBorder && invertColorsOnToggle) {
        trackBorderColorInversionStyle = switch__trackShowBorderInvertColorsOnTogglePrimary
      }

      break
  }

  return { trackColorStyle, trackBorderStyle, trackBorderColorInversionStyle }
}

const computeIndicatorColorStyle = (props: TSwitchProps) => {
  const { invertColorsOnToggle } = props
  let indicatorColorStyle: string | undefined = undefined

  if (!invertColorsOnToggle) return

  indicatorColorStyle = switch__indicatorInvertColorsOnToggle
  return indicatorColorStyle
}

const computeOnOffIcons = (props: TSwitchProps) => {
  const { showOnOffIcons = false, iconOn, iconOff } = props
  const shouldRenderOnOffIconSlots = showOnOffIcons || iconOn !== undefined || iconOff !== undefined

  if (!shouldRenderOnOffIconSlots) {
    return {
      shouldRenderOnOffIconSlots,
      computedIconOn: undefined,
      computedIconOff: undefined,
    }
  }

  const computedIconOn = iconOn === undefined ? DEFAULT_ON_ICON : iconOn
  const computedIconOff = iconOff === undefined ? DEFAULT_OFF_ICON : iconOff

  return {
    shouldRenderOnOffIconSlots,
    computedIconOn,
    computedIconOff,
  }
}

export const calibrateComponent = (props: TSwitchProps): TSwitchCalibration => {
  const {
    _switch: switchRootStyle,
    _switch__track: switchTrackStyle,
    _switch__indicator: switchIndicatorStyle,
  } = styles
  const {
    customStyles: customStyles__props,
    customTrackStyles: customTrackStyles_props,
    enableFocusStyle,
    customIndicatorStyles: customIndicatorStyles_props,
    raised = true,
    offsetFocusRing: offsetFocusRing__props = true,
    height = 15,
    width,
    trackColor,
    indicatorColor,
    className,
    style,
  } = props

  const { trackColorStyle, trackBorderStyle, trackBorderColorInversionStyle } = computeTrackStyles(props)
  const indicatorColorStyle = computeIndicatorColorStyle(props)
  const { shouldRenderOnOffIconSlots, computedIconOn, computedIconOff } = computeOnOffIcons(props)
  const { trackGeometryStyle, indicatorGeometryStyle } = computeGeometryStyles(props)
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false
      ? switch__indicatorNoFocusStyle
      : switch__indicatorApplyFocusStyle
  const offsetFocusRingStyle = offsetFocusRing__props === true ? switch__indicatorOffsetFocusRing : undefined
  const raisedStyle = raised !== undefined && raised === true ? switch__indicatorRaised : undefined

  const computedSwitchStyles = classNames(switchRootStyle)
  const switchStyles = mergeSwitchClassNames(computedSwitchStyles, className)
  const trackStyles = classNames(
    switchTrackStyle,
    trackColorStyle,
    trackGeometryStyle,
    trackBorderStyle,
    trackBorderColorInversionStyle,
  )
  const indicatorStyles = classNames(
    switchIndicatorStyle,
    indicatorColorStyle,
    indicatorGeometryStyle,
    raisedStyle,
    focusStyle,
    offsetFocusRingStyle,
  )

  const switchColorStyles: TSwitchCSSVariables = {
    ...(trackColor !== undefined
      ? {
          "--switch-track-color": trackColor,
          "--switch-track-selected-color-fallback": trackColor,
          "--switch-track-selected-color-primary": trackColor,
          "--switch-track-selected-color-secondary": trackColor,
          "--switch-track-selected-color-tertiary": trackColor,
          "--switch-track-selected-color-quaternary": trackColor,
          "--switch-track-selected-color-quintenary": trackColor,
          "--switch-track-selected-invert-background-color-fallback": trackColor,
        }
      : {}),
    ...(indicatorColor !== undefined
      ? {
          "--switch-indicator-color": indicatorColor,
          "--switch-indicator-selected-color": indicatorColor,
        }
      : {}),
  }

  const customStyles = Object.assign({ height, width }, switchColorStyles, { ...customStyles__props })
  const switchStyle = computeSwitchStyle(customStyles, style)
  const customTrackStyles = Object.assign({ height, width }, { ...customTrackStyles_props })
  const customIndicatorStyles = Object.assign({}, { ...customIndicatorStyles_props })

  return {
    switchStyles,
    switchStyle,
    trackStyles,
    indicatorStyles,
    customStyles,
    customTrackStyles,
    customIndicatorStyles,
    shouldRenderOnOffIconSlots,
    computedIconOn,
    computedIconOff,
  }
}
