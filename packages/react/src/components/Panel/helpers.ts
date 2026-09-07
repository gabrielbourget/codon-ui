import classNames from "classnames"
import type { CSSProperties } from "react"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import {
  POPOVER_PLACEMENT__LEFT as PANEL_POSITION__LEFT,
  POPOVER_PLACEMENT__RIGHT as PANEL_POSITION__RIGHT,
} from "../../tokens/placement"

import styles from "./PanelStyles.module.css"

const {
  panel,
  panel__overlay,
  ["panel__overlay--blur"]: panel__overlayBlur,
  ["panel--left"]: panelLeft,
  ["panel--open"]: panelOpen,
  ["panel--raised"]: panelRaised,
  ["panel--right"]: panelRight,
  ["panel--round"]: panelRound,
  ["panel--rounded"]: panelRounded,
} = styles

type TPanelPosition = typeof PANEL_POSITION__LEFT | typeof PANEL_POSITION__RIGHT

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
      return panelRounded
    case ROUND:
      return panelRound
    default:
      return undefined
  }
}

const computeHorizontalGapStyle = (props: TPanelProps): CSSProperties | undefined => {
  const { horizontalGap, position = PANEL_POSITION__LEFT } = props

  if (!horizontalGap) return undefined
  if (position === PANEL_POSITION__LEFT) return { left: horizontalGap }
  if (position === PANEL_POSITION__RIGHT) return { right: horizontalGap }

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
    position = PANEL_POSITION__LEFT,
    raised,
    overlayBlur = false,
    style,
    width,
  } = props
  const resolvedPanelOpen = isOpen ?? false

  const panelGeometryStyle = computePanelGeometryStyle(props)
  const horizontalGapStyle = computeHorizontalGapStyle(props)
  const panelOpenStyle = resolvedPanelOpen ? panelOpen : undefined
  const panelRaisedStyle = raised ? panelRaised : undefined
  const overlayBlurStyle = overlayBlur ? panel__overlayBlur : undefined
  const panelPositionStyle = position === PANEL_POSITION__RIGHT ? panelRight : panelLeft
  const panelAnimationX = position === PANEL_POSITION__RIGHT ? "100%" : "-100%"

  const panelStyles = classNames(
    panel,
    panelGeometryStyle,
    panelOpenStyle,
    panelPositionStyle,
    panelRaisedStyle,
    customClassName,
    className,
  )
  const overlayStyles = classNames(panel__overlay, overlayBlurStyle, customOverlayClassName)
  const customStyles = Object.assign(
    { backgroundColor, height, width },
    horizontalGapStyle,
    { ...customStyles__props },
    { ...style },
  )

  return { customStyles, panelAnimationX, panelStyles, overlayStyles }
}
