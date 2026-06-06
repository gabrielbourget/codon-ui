import classNames from "classnames"
import type { CSSProperties, HTMLAttributes } from "react"

import type { TAriaLabelingProps } from "../../tokens/a11y"

import type { TToast } from "./Toast/helpers"
import type { TPartialToastLabels } from "./Toast/labels"
import styles from "./ToasterStyles.module.css"

export const TOAST_POSITION__TOP_LEFT = "top-left"
export const TOAST_POSITION__TOP_CENTER = "top-center"
export const TOAST_POSITION__TOP_RIGHT = "top-right"
export const TOAST_POSITION__BOTTOM_RIGHT = "bottom-right"
export const TOAST_POSITION__BOTTOM_CENTER = "bottom-center"
export const TOAST_POSITION__BOTTOM_LEFT = "bottom-left"
export const AVAILABLE_TOAST_POSITIONS = [
  TOAST_POSITION__TOP_LEFT,
  TOAST_POSITION__TOP_CENTER,
  TOAST_POSITION__TOP_RIGHT,
  TOAST_POSITION__BOTTOM_RIGHT,
  TOAST_POSITION__BOTTOM_CENTER,
  TOAST_POSITION__BOTTOM_LEFT,
]
export type TAvailableToastPositions = (typeof AVAILABLE_TOAST_POSITIONS)[number]

export const DURATION_BEFORE_UNMOUNT = 250
export const DEFAULT_TOAST_DURATION = 4000
export const DEFAULT_TOAST_WIDTH = 325
export const TOAST_DISMISSAL_DRAG_THRESHOLD = 30
export const TOAST_DISMISSAL_DRAG_VELOCITY_THRESHOLD = 0.11 // => pixels/millisecond
export const DEFAULT_VIEWPORT_OFFSET = "15px"
export const DEFAULT_MAX_VISIBLE_TOASTS = 5
export const DEFAULT_TOAST_GAP = 15
export const DEFAULT_TOAST_POSITION = TOAST_POSITION__TOP_RIGHT
export const TOAST_TOUCH_DRAG_START_THRESHOLD = 15
export const TOAST_CLICK_DRAG_START_THRESHOLD = 2

export const isHotkeyPressed = (event: KeyboardEvent, hotkey: string[]) =>
  hotkey.every((key) => Boolean(event[key as keyof KeyboardEvent]) || event.code === key)

export type TToastHeight = {
  height: number
  id: number | string
}

type TToasterNativeProps = Omit<HTMLAttributes<HTMLElement>, "children" | "className" | "style">

export type TToasterProps = TToasterNativeProps &
  TAriaLabelingProps & {
    "data-testid"?: string
    duration?: number | "persistent"
    pauseWhenPageIsHidden?: boolean
    expandToggleHotkey?: string[]
    dismissalHotkey?: string[]
    position?: TAvailableToastPositions
    toastGap?: number
    offset?: string | number
    expandByDefault?: boolean
    maxVisibleToasts?: number
    toastLabels?: TPartialToastLabels
    className?: string
    style?: CSSProperties
    customClassName?: string
    customRootStyles?: CSSProperties
    customStyles?: CSSProperties
    customStackClassName?: string
    customStackStyles?: CSSProperties
    customToastBridgeClassName?: string
    customToastBridgeStyles?: CSSProperties
  }

export type TToastToDismiss = {
  id: number | string
  dismiss: boolean
}

export type TExternalToast = Omit<TToast, "id" | "title"> & {
  id?: number | string
}

type TCalibratedToasterComponent = {
  toasterRootStyles: string
  toasterRootStyle: CSSProperties
  toasterStyles: string
  toastBridgeStyles: string
}

// -> Compute per-toast visual offset used during expanded state
export const computeOffsets = (
  toastsForThisPosition: Array<{ id: string | number }>,
  heightsForThisPosition: Array<{ id: string | number; height: number }>,
  gap: number,
) => {
  let sum = 0
  return toastsForThisPosition.map((t, i) => {
    const offsets = sum + i * gap
    const h = heightsForThisPosition.find((x) => x.id === t.id)?.height ?? 0
    sum += h
    return offsets
  })
}

// -> Compute bridge div info: one bridge div for each gap between toasts (between i-1 and i).
export const computeBridgeDivInfo = (
  offsets: number[],
  toastsForThisPosition: Array<{ id: string | number }>,
  gap: number,
  position: string,
) => {
  // For toast at index i, the gap above it starts at offsets[i] - gap
  return offsets.slice(1).map((off, i) => ({
    key: `bridge-${position}-${toastsForThisPosition[i + 1].id}`,
    offset: Math.max(0, off - gap),
  }))
}

// -> Compute total height of expanded toast stack.
export const computeToastStackHeight = (
  offsets: number[],
  toastsForThisPosition: Array<{ id: string | number }>,
  heightsForThisPosition: Array<{ id: string | number; height: number }>,
) => {
  if (!toastsForThisPosition.length) return 0
  return toastsForThisPosition.reduce((max, t, i) => {
    const h = heightsForThisPosition.find((x) => x.id === t.id)?.height ?? 0
    return Math.max(max, offsets[i] + h)
  }, 0)
}

export const calibrateComponent = (props: TToasterProps): TCalibratedToasterComponent => {
  const { className, customClassName, customRootStyles, customStackClassName, customToastBridgeClassName, style } =
    props
  const { toasterRoot, toaster, toaster__toastBridgeDiv } = styles
  const toasterRootStyles = classNames(toasterRoot, customClassName, className)
  const toasterRootStyle: CSSProperties = { ...customRootStyles, ...style }
  const toasterStyles = classNames(toaster, customStackClassName)
  const toastBridgeStyles = classNames(toaster__toastBridgeDiv, customToastBridgeClassName)

  return { toasterRootStyles, toasterRootStyle, toasterStyles, toastBridgeStyles }
}
