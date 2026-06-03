import type { AvatarProps } from "@radix-ui/react-avatar"
import classNames from "classnames"
import type { CSSProperties, MouseEvent } from "react"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import type { TTextProps } from "../Text/helpers"

import styles from "./AvatarStyles.module.css"

type TAvatarNativeProps = Omit<AvatarProps, "className" | "color" | "onClick" | "style">

export type TAvatarProps = TAvatarNativeProps & {
  "data-testid"?: string
  className?: string
  style?: CSSProperties
  size?: string | number
  color?: string
  foreground?: string
  background?: string
  imageURL?: string
  name1?: string
  name2?: string
  geometry?: TCornerGeometry
  raised?: boolean
  clickable?: boolean
  onClick?: (event: MouseEvent<HTMLElement>) => void
  fallbackDelay?: number
  labels?: TPartialAvatarLabels
  customStyles?: CSSProperties
  customImageStyles?: CSSProperties
  customFallbackStyles?: CSSProperties
  customTextStyles?: CSSProperties
  customTextProps?: Partial<TTextProps>
}

export type TAvatarLabels = {
  placeholderFirstName: string
  placeholderLastName: string
}

export type TPartialAvatarLabels = Partial<TAvatarLabels>

export const DEFAULT_AVATAR_LABELS: TAvatarLabels = {
  placeholderFirstName: "Name",
  placeholderLastName: "Unknown",
}

type TAvatarCSSVariables = CSSProperties & {
  "--foreground"?: string
  "--background"?: string
  "--size"?: string
}

type TAvatarCalibration = {
  avatarStyles: string
  avatarImageStyles: string
  avatarFallbackStyles: string
  customStyles: TAvatarCSSVariables
}

export const resolveAvatarLabels = (labels?: TPartialAvatarLabels): TAvatarLabels => ({
  ...DEFAULT_AVATAR_LABELS,
  ...labels,
})

export const generateInitials = (name1?: string, name2?: string, labels?: TPartialAvatarLabels) => {
  const { placeholderFirstName, placeholderLastName } = resolveAvatarLabels(labels)
  let initials = ""
  let altTextName = ""

  if (!name1 && !name2) {
    const firstInitial = placeholderFirstName.charAt(0).toUpperCase()
    const lastInitial = placeholderLastName.charAt(0).toUpperCase()

    initials = `${firstInitial}${lastInitial}`
    altTextName = `${placeholderFirstName} ${placeholderLastName}`
  } else if (name1 && !name2) {
    const initial = name1.charAt(0).toUpperCase()
    initials = initial
    altTextName = `${name1}`
  } else if (!name1 && name2) {
    const initial = name2.charAt(0).toUpperCase()
    initials = initial
    altTextName = `${name2}`
  } else {
    const firstInitial = name1!.charAt(0).toUpperCase()
    const lastInitial = name2!.charAt(0).toUpperCase()

    initials = `${firstInitial}${lastInitial}`
    altTextName = `${name1} ${name2}`
  }

  return { initials, altTextName }
}

export const toCSSSize = (value?: string | number): string | undefined => {
  if (value === undefined || value === "") return undefined
  if (typeof value === "number") return `${value}px`

  const trimmedValue = value.trim()
  if (/^-?\d+(\.\d+)?$/.test(trimmedValue)) return `${trimmedValue}px`

  return trimmedValue
}

const determineGeometryStyles = (props: TAvatarProps): string | undefined => {
  const { geometry = ROUND } = props
  let geometryStyle: string | undefined

  switch (geometry) {
    case ORTHOGONAL:
      break
    case ROUNDED:
      geometryStyle = styles["avatar--rounded"]
      break
    case ROUND:
      geometryStyle = styles["avatar--round"]
      break
    default:
      break
  }

  return geometryStyle
}

export const calibrateComponent = (props: TAvatarProps): TAvatarCalibration => {
  const { avatar, avatar__image, avatar__fallback } = styles
  const {
    clickable,
    onClick,
    raised,
    customStyles: customStyles__props,
    color,
    foreground,
    background,
    className,
    style,
    size = 30,
  } = props

  const geometryStyle = determineGeometryStyles(props)
  const clickableStyle = clickable && onClick ? styles["avatar--clickable"] : undefined
  const raisedStyle = raised ? styles["avatar--raised"] : undefined

  const avatarStyles = classNames(avatar, geometryStyle, clickableStyle, raisedStyle, className)
  const avatarImageStyles = classNames(avatar__image)
  const avatarFallbackStyles = classNames(avatar__fallback)

  const resolvedForeground = foreground ?? color
  const resolvedBackground = background

  const customStyles: TAvatarCSSVariables = {
    "--size": toCSSSize(size),
    ...(resolvedForeground ? { "--foreground": resolvedForeground } : null),
    ...(resolvedBackground ? { "--background": resolvedBackground } : null),
    ...customStyles__props,
    ...style,
  }

  return { avatarStyles, avatarImageStyles, avatarFallbackStyles, customStyles }
}
