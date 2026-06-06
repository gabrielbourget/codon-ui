import classNames from "classnames"
import type { CSSProperties } from "react"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import { POPOVER_PLACEMENT__LEFT as LEFT, POPOVER_PLACEMENT__RIGHT as RIGHT } from "../../tokens/placement"

import styles from "./PanelStyles.module.css"

type TPanelPosition = typeof LEFT | typeof RIGHT

export type TPanelProps = {
  "data-testid"?: string
  className?: string
  style?: CSSProperties
  height?: string | number
  width?: string | number
  horizontalGap?: number
  position?: TPanelPosition
  panelGeometry?: TCornerGeometry
  backgroundColor?: string
  overlayBlur?: boolean
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  raised?: boolean
  isDismissable?: boolean
  isKeyboardDismissDisabled?: boolean
  customStyles?: CSSProperties
  customOverlayStyles?: CSSProperties
  customClassName?: string
  customOverlayClassName?: string
}

type TPanelCalibration = {
  customStyles: CSSProperties
  panelAnimationX: "100%" | "-100%"
  panelStyles: string
  overlayStyles: string
}

const computePanelGeometryStyle = (props: TPanelProps) => {
  const { panelGeometry } = props

  switch (panelGeometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["panel--rounded"]
    case ROUND:
      return styles["panel--round"]
    default:
      return undefined
  }
}

const computeHorizontalGapStyle = (props: TPanelProps): CSSProperties | undefined => {
  const { horizontalGap, position = LEFT } = props

  if (!horizontalGap) return undefined
  if (position === LEFT) return { left: horizontalGap }
  if (position === RIGHT) return { right: horizontalGap }

  return undefined
}

export const calibrateComponent = (props: TPanelProps): TPanelCalibration => {
  const {
    backgroundColor,
    className,
    customClassName,
    customOverlayClassName,
    customStyles: customStyles__props,
    height,
    isOpen,
    position = LEFT,
    raised,
    overlayBlur = false,
    style,
    width,
  } = props
  const resolvedPanelOpen = isOpen ?? false

  const panelGeometryStyle = computePanelGeometryStyle(props)
  const horizontalGapStyle = computeHorizontalGapStyle(props)
  const panelOpenStyle = resolvedPanelOpen ? styles["panel--open"] : undefined
  const panelRaisedStyle = raised ? styles["panel--raised"] : undefined
  const overlayBlurStyle = overlayBlur ? styles["panel__overlay--blur"] : undefined
  const panelPositionStyle = position === RIGHT ? styles["panel--right"] : styles["panel--left"]
  const panelAnimationX = position === RIGHT ? "100%" : "-100%"

  const panelStyles = classNames(
    styles.panel,
    panelGeometryStyle,
    panelOpenStyle,
    panelPositionStyle,
    panelRaisedStyle,
    customClassName,
    className,
  )
  const overlayStyles = classNames(styles.panel__overlay, overlayBlurStyle, customOverlayClassName)
  const customStyles = Object.assign(
    { backgroundColor, height, width },
    horizontalGapStyle,
    { ...customStyles__props },
    { ...style },
  )

  return { customStyles, panelAnimationX, panelStyles, overlayStyles }
}
