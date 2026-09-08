import classNames from "classnames"
import { format } from "date-fns"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type Dispatch,
  type PointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react"

import { ORTHOGONAL, ROUNDED, type TCornerGeometry } from "../../../tokens/geometry"
import type { TButtonProps } from "../../Button/helpers"
import type { TTextProps } from "../../Text/helpers"
import textStyles from "../../Text/TextStyles.module.css"
import {
  DEFAULT_TOAST_DURATION,
  DEFAULT_TOAST_GAP,
  DURATION_BEFORE_UNMOUNT,
  TOAST_CLICK_DRAG_START_THRESHOLD,
  TOAST_DISMISSAL_DRAG_THRESHOLD,
  TOAST_DISMISSAL_DRAG_VELOCITY_THRESHOLD,
  TOAST_TOUCH_DRAG_START_THRESHOLD,
  isHotkeyPressed,
  type TAvailableToastPositions,
  type TToastHeight,
} from "../helpers"

import {
  ToastDefaultCheckmarkIcon,
  ToastDefaultCircleInfoIcon,
  ToastDefaultDeleteIcon,
  ToastDefaultErrorIcon,
  ToastDefaultOctagonExclamationIcon,
  ToastDefaultTriangleExclamationIcon,
} from "./DefaultToastIcons"
import { resolveToastLabels, type TPartialToastLabels } from "./labels"
import styles from "./ToastStyles.module.css"

const {
  ["toast__topRibbon--errorOrDanger"]: toast__topRibbonErrorOrDanger,
  ["toast__topRibbon--info"]: toast__topRibbonInfo,
  ["toast__topRibbon--success"]: toast__topRibbonSuccess,
  ["toast__topRibbon--warning"]: toast__topRibbonWarning,
  ["toast--raised"]: toastRaised,
  ["toast--rounded"]: toastRounded,
} = styles

export const TOAST_TYPE__INFO = "info"
export const TOAST_TYPE__WARNING = "warning"
export const TOAST_TYPE__ERROR = "error"
export const TOAST_TYPE__DANGER = "danger"
export const TOAST_TYPE__DELETE = "delete"
export const TOAST_TYPE__SUCCESS = "success"
export const AVAILABLE_TOAST_TYPES = [
  TOAST_TYPE__INFO,
  TOAST_TYPE__WARNING,
  TOAST_TYPE__ERROR,
  TOAST_TYPE__DANGER,
  TOAST_TYPE__DELETE,
  TOAST_TYPE__SUCCESS,
]
export type TAvailableToastTypes = (typeof AVAILABLE_TOAST_TYPES)[number]

export type TToast = {
  id: number | string
  height?: number | string
  width?: number | string
  className?: string
  style?: CSSProperties
  position?: TAvailableToastPositions
  type?: TAvailableToastTypes
  geometry?: Exclude<TCornerGeometry, "round">
  raised?: boolean
  dismissable?: boolean
  duration?: number | "persistent"
  deletingToast?: boolean
  important?: boolean
  cancelAction?(): unknown
  cancelActionBtnText?: string
  showCancelAction?: boolean
  confirmAction?(): unknown
  confirmActionBtnText?: string
  labels?: TPartialToastLabels
  showButtons?: boolean
  titleText?: string
  bodyText?: string
  ToastIcon?: ReactNode
  CloseIcon?: ReactNode
  onDismiss?: (toast: TToast) => void
  onAutoClose?: (toast: TToast) => void
  customClassName?: string
  customStyles?: CSSProperties
  customTopRibbonClassName?: string
  customTopRibbonStyles?: CSSProperties
  customTopRibbonLeftContentClassName?: string
  customTopRibbonLeftContentStyles?: CSSProperties
  customTitleClassName?: string
  customTitleStyles?: CSSProperties
  customContentClassName?: string
  customContentStyles?: CSSProperties
  customBodyTextClassName?: string
  customBodyTextStyles?: CSSProperties
  customBodyTextProps?: Partial<TTextProps>
  customBottomRowClassName?: string
  customBottomRowStyles?: CSSProperties
  customTimestampClassName?: string
  customTimestampStyles?: CSSProperties
  customTimestampTextProps?: Partial<TTextProps>
  customButtonRowClassName?: string
  customButtonRowStyles?: CSSProperties
  customCloseButtonClassName?: string
  customCloseButtonStyles?: CSSProperties
  customCloseButtonProps?: Partial<TButtonProps>
  customCancelButtonClassName?: string
  customCancelButtonStyles?: CSSProperties
  customCancelButtonProps?: Partial<TButtonProps>
  customConfirmButtonClassName?: string
  customConfirmButtonStyles?: CSSProperties
  customConfirmButtonProps?: Partial<TButtonProps>
}

export type TToastProps = {
  index: number
  toast: TToast
  toastLabels?: TPartialToastLabels
  numToasts: number
  duration?: number | "persistent" // -> Passed in from global Toaster duration prop
  maxVisibleToasts: number
  toastGap?: number
  toasterExpanded: boolean
  expandByDefault?: boolean
  dismissalHotkey?: string[]
  interacting: boolean
  heights: TToastHeight[]
  // setToasterState: React.Dispatch<React.SetStateAction<TToasterState>>;
  removeToast: (toast: TToast) => void
  setHeights: React.Dispatch<React.SetStateAction<TToastHeightInfo[]>>
  pauseWhenPageIsHidden: boolean
  position: TAvailableToastPositions
}

export type TToastHeightInfo = {
  height: number
  id: number | string
  position?: TAvailableToastPositions
}

export type TToastState = {
  mounted: boolean
  removed: boolean
  dragging: boolean
  draggingOut: boolean
  offsetBeforeRemove: number
  initialHeight: number
  isFocused: boolean
  toastStyles: string
  topRibbonStyles: string
  topRibbonLeftContentStyles: string
  headerStyles: string
  toastContentStyles: string
  bottomRowStyles: string
  buttonRowStyles: string
  customStyles: CSSProperties
  color_white: string
}

export const initState: TToastState = {
  mounted: false,
  removed: false,
  dragging: false,
  draggingOut: false,
  offsetBeforeRemove: 0,
  initialHeight: 0,
  isFocused: false,
  toastStyles: "",
  topRibbonStyles: "",
  topRibbonLeftContentStyles: "",
  headerStyles: "",
  toastContentStyles: "",
  bottomRowStyles: "",
  buttonRowStyles: "",
  customStyles: {},
  color_white: "",
}

const mergeButtonSlotProps = (args: {
  buttonProps?: Partial<TButtonProps>
  customClassName?: string
  customStyles?: CSSProperties
  defaultStyles?: CSSProperties
}): Partial<TButtonProps> => {
  const { className, customClassName, customStyles, ...rest } = args.buttonProps ?? {}
  const nativeClassName = typeof className === "string" ? className : undefined

  return {
    ...rest,
    customClassName: classNames(customClassName, nativeClassName, args.customClassName),
    customStyles: {
      ...args.defaultStyles,
      ...customStyles,
      ...args.customStyles,
    },
  }
}

const mergeTextSlotProps = (args: {
  textProps?: Partial<TTextProps>
  customClassName?: string
  customStyles?: CSSProperties
}): Partial<TTextProps> => {
  const { customClassName, customStyles, ...rest } = args.textProps ?? {}

  return {
    ...rest,
    customClassName: classNames(customClassName, args.customClassName),
    customStyles: {
      ...customStyles,
      ...args.customStyles,
    },
  }
}

const computeColorStyles = (props: TToastProps) => {
  const {
    toast: { type = "info" },
  } = props

  let colorStyle: string | undefined = undefined

  if (!type) return {}

  switch (type) {
    case TOAST_TYPE__INFO:
      colorStyle = toast__topRibbonInfo
      break
    case TOAST_TYPE__WARNING:
      colorStyle = toast__topRibbonWarning
      break
    case TOAST_TYPE__ERROR:
      colorStyle = toast__topRibbonErrorOrDanger
      break
    case TOAST_TYPE__DANGER:
      colorStyle = toast__topRibbonErrorOrDanger
      break
    case TOAST_TYPE__DELETE:
      colorStyle = toast__topRibbonErrorOrDanger
      break
    case TOAST_TYPE__SUCCESS:
      colorStyle = toast__topRibbonSuccess
      break
    default:
      colorStyle = toast__topRibbonInfo
      break
  }

  return colorStyle
}

const computeGeometryStyle = (props: TToastProps) => {
  const {
    toast: { geometry = ROUNDED },
  } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return toastRounded
    default:
      return undefined
  }
}

export const computeToastDateTimeString = () => format(new Date(), "MMMM d, yyyy | HH:mm:ss")

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

type TCalibrateToastArgs = {
  props: TToastProps
  state: TToastState
  setState: Dispatch<SetStateAction<TToastState>>
  isDocumentHidden: boolean
  setIsDocumentHidden: Dispatch<SetStateAction<boolean>>
}

/** Derives toast visuals and coordinates timer, measurement, gesture and action lifecycles using the component's visible state and refs. */
export const useCalibratedComponent = ({
  props,
  state,
  setState,
  isDocumentHidden,
  setIsDocumentHidden,
}: TCalibrateToastArgs) => {
  const internalToastRef = useRef<HTMLLIElement>(null)
  const dragStartTimeRef = useRef<Date | null>(null)
  const closeTimerStartTimeRef = useRef(0)
  const lastCloseTimerStartTimeRef = useRef(0)
  const pointerStartCoordsRef = useRef<{ x: number; y: number } | null>(null)
  // -> Keep mutable lifecycle refs inside their coordinating hook.
  const offsetRef = useRef(0)
  const {
    interacting,
    setHeights,
    maxVisibleToasts,
    heights,
    index,
    numToasts,
    toasterExpanded,
    dismissalHotkey = ["Escape"],
    removeToast,
    position,
    toastGap = DEFAULT_TOAST_GAP,
    expandByDefault = false,
    pauseWhenPageIsHidden = true,
    duration: duration__props__toaster,
    toast,
    toastLabels,
    toast: {
      dismissable = true,
      id,
      important: important__props,
      type = "info",
      deletingToast,
      duration: duration__props,
      onDismiss,
      onAutoClose,
      cancelAction,
      cancelActionBtnText,
      confirmAction,
      confirmActionBtnText,
      labels,
    },
  } = props

  const {
    toast: {
      className,
      height,
      width,
      ToastIcon: ToastIcon__props,
      raised = true,
      customClassName,
      customStyles: customStyles__props,
      customTopRibbonClassName,
      customTopRibbonLeftContentClassName,
      customTitleClassName,
      customContentClassName,
      customBodyTextClassName,
      customBodyTextProps,
      customBodyTextStyles,
      customBottomRowClassName,
      customTimestampClassName,
      customTimestampTextProps,
      customTimestampStyles,
      customButtonRowClassName,
      customCloseButtonClassName,
      customCloseButtonProps,
      customCloseButtonStyles,
      customCancelButtonClassName,
      customCancelButtonProps,
      customCancelButtonStyles,
      customConfirmButtonClassName,
      customConfirmButtonProps,
      customConfirmButtonStyles,
      style,
    },
  } = props
  const { b10, "fw-bold": boldTextStyles } = textStyles
  const {
    toast: toastRootStyles,
    toast__topRibbon,
    toast__topRibbon__leftContent,
    toast__bodyContent,
    toast__bottomRow,
    toast__buttonRow,
  } = styles

  const colorStyle = computeColorStyles(props)
  const geometryStyle = computeGeometryStyle(props)
  const raisedStyle = raised ? toastRaised : undefined

  const toastStyles = classNames(toastRootStyles, geometryStyle, raisedStyle, customClassName, className)
  const topRibbonStyles = classNames(toast__topRibbon, colorStyle, customTopRibbonClassName)
  const topRibbonLeftContentStyles = classNames(toast__topRibbon__leftContent, customTopRibbonLeftContentClassName)
  const headerStyles = classNames(b10, boldTextStyles, customTitleClassName)
  const toastContentStyles = classNames(toast__bodyContent, customContentClassName)
  const bottomRowStyles = classNames(toast__bottomRow, customBottomRowClassName)
  const buttonRowStyles = classNames(toast__buttonRow, customButtonRowClassName)
  const bodyTextProps = mergeTextSlotProps({
    textProps: customBodyTextProps,
    customClassName: customBodyTextClassName,
    customStyles: customBodyTextStyles,
  })
  const timestampTextProps = mergeTextSlotProps({
    textProps: customTimestampTextProps,
    customClassName: customTimestampClassName,
    customStyles: customTimestampStyles,
  })
  const closeButtonProps = mergeButtonSlotProps({
    buttonProps: customCloseButtonProps,
    customClassName: customCloseButtonClassName,
    customStyles: customCloseButtonStyles,
    defaultStyles: { padding: 0 },
  })
  const cancelButtonProps = mergeButtonSlotProps({
    buttonProps: customCancelButtonProps,
    customClassName: customCancelButtonClassName,
    customStyles: customCancelButtonStyles,
  })
  const confirmButtonProps = mergeButtonSlotProps({
    buttonProps: customConfirmButtonProps,
    customClassName: customConfirmButtonClassName,
    customStyles: customConfirmButtonStyles,
  })

  const customStyles: CSSProperties = Object.assign({ height, width }, { ...customStyles__props }, { ...style })

  const color__white = "var(--cui-control-selected-foreground)"
  const color__neutral_4 = "var(--cui-control-placeholder)"
  let toastColor = ""
  let defaultToastIcon: ReactNode

  switch (type) {
    case TOAST_TYPE__INFO:
      toastColor = "var(--cui-control-selected-background)"
      defaultToastIcon = (
        <ToastDefaultCircleInfoIcon size={15} color={color__white} data-testid="toast-default-info-icon" />
      )
      break
    case TOAST_TYPE__WARNING:
      toastColor = "var(--cui-status-warning)"
      defaultToastIcon = (
        <ToastDefaultTriangleExclamationIcon size={15} color={color__white} data-testid="toast-default-warning-icon" />
      )
      break
    case TOAST_TYPE__ERROR:
      toastColor = "var(--cui-status-danger)"
      defaultToastIcon = <ToastDefaultErrorIcon size={15} color={color__white} data-testid="toast-default-error-icon" />
      break
    case TOAST_TYPE__DANGER:
      toastColor = "var(--cui-status-danger)"
      defaultToastIcon = (
        <ToastDefaultOctagonExclamationIcon size={15} color={color__white} data-testid="toast-default-danger-icon" />
      )
      break
    case TOAST_TYPE__DELETE:
      toastColor = "var(--cui-status-danger)"
      defaultToastIcon = (
        <ToastDefaultDeleteIcon size={15} color={color__white} data-testid="toast-default-delete-icon" />
      )
      break
    case TOAST_TYPE__SUCCESS:
      toastColor = "var(--cui-status-success)"
      defaultToastIcon = (
        <ToastDefaultCheckmarkIcon size={25} color={color__white} data-testid="toast-default-success-icon" />
      )
      break
    default:
      toastColor = "var(--cui-control-selected-background)"
      defaultToastIcon = (
        <ToastDefaultCircleInfoIcon size={15} color={color__white} data-testid="toast-default-info-icon" />
      )
      break
  }

  const [y, x] = position.split("-")
  const resolvedLabels = useMemo(
    () =>
      resolveToastLabels({
        labels: {
          ...toastLabels,
          ...labels,
        },
        cancelActionBtnText,
        confirmActionBtnText,
      }),
    [cancelActionBtnText, confirmActionBtnText, labels, toastLabels],
  )

  useEffect(() => {
    const handleVisibilityChange = () => setIsDocumentHidden(document.hidden)

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [setIsDocumentHidden])

  // -> Ensure the first paint happens with the off-screen transform,
  //    then flip `mounted` on the next frame so transform/opacity animate.
  useIsomorphicLayoutEffect(() => {
    let firstAnimationFrame = 0
    let secondAnimationFrame = 0

    firstAnimationFrame = requestAnimationFrame(() => {
      secondAnimationFrame = requestAnimationFrame(() => {
        setState((previousState) => ({ ...previousState, mounted: true }))
      })
    })

    return () => {
      cancelAnimationFrame(firstAnimationFrame)
      cancelAnimationFrame(secondAnimationFrame)
    }
  }, [setState])

  useIsomorphicLayoutEffect(() => {
    const internalToast = internalToastRef.current

    if (document.activeElement === internalToast || internalToast!.contains(document.activeElement)) {
      setState((previousState) => ({ ...previousState, isFocused: true }))
    } else {
      setState((previousState) => ({ ...previousState, isFocused: false }))
    }
  }, [internalToastRef, props, setState, type])

  const { visible, isFirstToast, duration, important } = useMemo(() => {
    const isVisible = index + 1 <= maxVisibleToasts
    const isFirst = index === 0
    const resolvedDuration = duration__props || duration__props__toaster || DEFAULT_TOAST_DURATION
    const currentHeightsIndexRaw = heights.findIndex((height) => height.id === id)
    const currentHeightsIndex = currentHeightsIndexRaw < 0 ? 0 : currentHeightsIndexRaw
    const isImportant =
      important__props !== undefined
        ? important__props
        : type === TOAST_TYPE__DANGER || type === TOAST_TYPE__DELETE || type === TOAST_TYPE__ERROR
    const toastsHeightBefore = heights
      .slice(0, currentHeightsIndex)
      .reduce((heightSum, height) => heightSum + height.height, 0)

    offsetRef.current = currentHeightsIndex * toastGap + toastsHeightBefore

    return {
      visible: isVisible,
      isFirstToast: isFirst,
      duration: resolvedDuration,
      important: isImportant,
    }
  }, [
    duration__props,
    duration__props__toaster,
    heights,
    id,
    important__props,
    index,
    maxVisibleToasts,
    offsetRef,
    toastGap,
    type,
  ])

  // -> Keep the shared stack height model synchronized with the rendered toast.
  useIsomorphicLayoutEffect(() => {
    if (!state.mounted) return

    const toastElement = internalToastRef.current
    const originalToastHeight = toastElement!.style.height

    toastElement!.style.height = "auto"
    const updatedToastHeight = toastElement!.getBoundingClientRect().height
    toastElement!.style.height = originalToastHeight
    setState((previousState) => ({ ...previousState, initialHeight: updatedToastHeight }))

    setHeights((currentHeights: TToastHeightInfo[]) => {
      const alreadyExists = currentHeights.find((height: TToastHeightInfo) => height.id === toast.id)

      if (!alreadyExists) {
        return [{ id: toast.id, height: updatedToastHeight, position }, ...currentHeights]
      }

      return currentHeights.map((height: TToastHeightInfo) =>
        height.id === toast.id ? { ...height, height: updatedToastHeight } : height,
      )
    })

    return () => setHeights((currentHeights) => currentHeights.filter((height) => height.id !== toast.id))
  }, [internalToastRef, setHeights, setState, toast.id, state.mounted, toast.position, position])

  const deleteToast = useCallback(() => {
    setState((previousState) => ({
      ...previousState,
      removed: true,
      offsetBeforeRemove: offsetRef.current,
    }))
    setHeights((currentHeights) => currentHeights.filter((height) => height.id !== toast.id))
    setTimeout(() => removeToast(toast), DURATION_BEFORE_UNMOUNT)
  }, [toast, removeToast, setHeights, setState, offsetRef])

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLLIElement>) => {
      if (!dismissable) return

      dragStartTimeRef.current = new Date()
      setState((previousState) => ({ ...previousState, offsetBeforeRemove: offsetRef.current }))

      const eventTarget = event.target as HTMLElement
      if (typeof eventTarget.setPointerCapture === "function") {
        eventTarget.setPointerCapture(event.pointerId)
      }
      if (eventTarget.tagName.toLowerCase() === "button") return

      setState((previousState) => ({ ...previousState, dragging: true }))
      pointerStartCoordsRef.current = { x: event.clientX, y: event.clientY }
    },
    [dismissable, dragStartTimeRef, offsetRef, pointerStartCoordsRef, setState],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const hotKeyPressed = isHotkeyPressed(event, dismissalHotkey)

      if (
        hotKeyPressed &&
        (document.activeElement === internalToastRef.current ||
          internalToastRef.current?.contains(document.activeElement))
      ) {
        deleteToast()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [deleteToast, dismissalHotkey, internalToastRef])

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLLIElement>) => {
      if (!pointerStartCoordsRef.current || !dismissable) return

      const yPosition = event.clientY - pointerStartCoordsRef.current.y
      const xPosition = event.clientX - pointerStartCoordsRef.current.x
      const computedClampOperation = y === "top" ? Math.min : Math.max
      const clampedY = computedClampOperation(0, yPosition)
      const dragStartThreshold =
        event.pointerType === "touch" ? TOAST_TOUCH_DRAG_START_THRESHOLD : TOAST_CLICK_DRAG_START_THRESHOLD
      const allowDrag = Math.abs(clampedY) > dragStartThreshold

      if (allowDrag) {
        internalToastRef.current?.style.setProperty("--dragAmount", `${yPosition}px`)
      } else if (Math.abs(xPosition) > dragStartThreshold) {
        pointerStartCoordsRef.current = null
      }
    },
    [dismissable, internalToastRef, pointerStartCoordsRef, y],
  )

  const onPointerUp = useCallback(
    (_event: PointerEvent<HTMLLIElement>) => {
      if (state.draggingOut || !dismissable) return

      pointerStartCoordsRef.current = null
      const dragAmount = Number(internalToastRef.current?.style.getPropertyValue("--dragAmount").replace("px", "") || 0)
      const timeDelta = dragStartTimeRef.current && new Date().getTime() - dragStartTimeRef.current.getTime()
      const velocity = Math.abs(dragAmount) / timeDelta!

      if (
        Math.abs(dragAmount) >= TOAST_DISMISSAL_DRAG_THRESHOLD ||
        velocity > TOAST_DISMISSAL_DRAG_VELOCITY_THRESHOLD
      ) {
        setState((previousState) => ({ ...previousState, offsetBeforeRemove: offsetRef.current }))
        onDismiss?.(toast)
        deleteToast()
        setState((previousState) => ({ ...previousState, draggingOut: true }))
        return
      }

      internalToastRef.current?.style.setProperty("--dragAmount", "0px")
      setState((previousState) => ({ ...previousState, dragging: false }))
    },
    [
      deleteToast,
      dismissable,
      dragStartTimeRef,
      internalToastRef,
      offsetRef,
      onDismiss,
      pointerStartCoordsRef,
      setState,
      state.draggingOut,
      toast,
    ],
  )

  useEffect(() => {
    if (duration === "persistent") return

    let timeoutId: ReturnType<typeof setTimeout>
    let remainingTime = duration

    const pauseTimer = () => {
      if (lastCloseTimerStartTimeRef.current < closeTimerStartTimeRef.current) {
        const elapsedTime = new Date().getTime() - closeTimerStartTimeRef.current
        remainingTime -= elapsedTime
      }

      lastCloseTimerStartTimeRef.current = new Date().getTime()
    }

    const startTimer = () => {
      closeTimerStartTimeRef.current = new Date().getTime()
      timeoutId = setTimeout(() => {
        onAutoClose?.(toast)
        deleteToast()
      }, remainingTime)
    }

    if (toasterExpanded || interacting || (pauseWhenPageIsHidden && isDocumentHidden)) {
      pauseTimer()
    } else {
      startTimer()
    }

    return () => clearTimeout(timeoutId)
  }, [
    toasterExpanded,
    interacting,
    expandByDefault,
    toast,
    duration,
    deleteToast,
    type,
    pauseWhenPageIsHidden,
    isDocumentHidden,
    onAutoClose,
    closeTimerStartTimeRef,
    lastCloseTimerStartTimeRef,
  ])

  useEffect(() => {
    if (deletingToast) deleteToast()
  }, [deleteToast, deletingToast])

  const handleClose = useCallback(() => {
    deleteToast()
    onDismiss?.(toast)
  }, [deleteToast, onDismiss, toast])
  const handleCancel = useCallback(() => {
    cancelAction?.()
    deleteToast()
    onDismiss?.(toast)
  }, [cancelAction, deleteToast, onDismiss, toast])
  const handleConfirm = useCallback(() => {
    confirmAction?.()
    deleteToast()
    onDismiss?.(toast)
  }, [confirmAction, deleteToast, onDismiss, toast])

  const { removed, offsetBeforeRemove, initialHeight } = state
  const rootStyle = {
    "--index": index,
    "--toastsBefore": index,
    "--z-index": numToasts - index,
    "--offset": `${removed ? offsetBeforeRemove : offsetRef.current}px`,
    "--initial-height": expandByDefault ? "auto" : `${initialHeight}px`,
    ...(toastGap != null ? { "--toastGap": `${toastGap}px` } : {}),
    ...customStyles,
  } as CSSProperties

  return {
    internalToastRef,
    bodyTextProps,
    toastStyles,
    topRibbonStyles,
    topRibbonLeftContentStyles,
    headerStyles,
    toastContentStyles,
    bottomRowStyles,
    buttonRowStyles,
    rootStyle,
    color__neutral_4,
    toastColor,
    toastIcon: ToastIcon__props ?? defaultToastIcon,
    timestampTextProps,
    closeButtonProps,
    cancelButtonProps,
    confirmButtonProps,
    resolvedLabels,
    visible,
    isFirstToast,
    important,
    x,
    y,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    handleClose,
    handleCancel,
    handleConfirm,
  }
}
