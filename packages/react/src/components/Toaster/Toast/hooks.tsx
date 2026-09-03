"use client"

import {
  type CSSProperties,
  type PointerEvent,
  type PointerEventHandler,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import type { TButtonProps } from "../../Button/helpers"
import type { TTextProps } from "../../Text/helpers"
import {
  DEFAULT_TOAST_DURATION,
  DEFAULT_TOAST_GAP,
  DURATION_BEFORE_UNMOUNT,
  TOAST_CLICK_DRAG_START_THRESHOLD,
  TOAST_DISMISSAL_DRAG_THRESHOLD,
  TOAST_DISMISSAL_DRAG_VELOCITY_THRESHOLD,
  TOAST_TOUCH_DRAG_START_THRESHOLD,
  isHotkeyPressed,
} from "../helpers"

import {
  calibrateComponent,
  computeToastDateTimeString,
  initState,
  TOAST_TYPE__DANGER,
  TOAST_TYPE__DELETE,
  TOAST_TYPE__ERROR,
  type TToastHeightInfo,
  type TToastProps,
  type TToastState,
} from "./helpers"
import { resolveToastLabels } from "./labels"

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

type TCalibratedToastButtonAction = {
  ariaLabel: string
  onPress: () => void
  props: Partial<TButtonProps>
}

type TCalibratedToastComponent = {
  content: {
    body: {
      props: Partial<TTextProps>
      text: string
    }
    bottomRow: {
      actions: {
        cancel: (TCalibratedToastButtonAction & { text: string }) | null
        className: string
        confirm: TCalibratedToastButtonAction & {
          color: string
          text: string
          textColor: string
        }
        isVisible: boolean
        style?: CSSProperties
      }
      className: string
      style?: CSSProperties
      timestamp: {
        color: string
        props: Partial<TTextProps>
        text: string
      }
    }
    className: string
    style?: CSSProperties
  }
  root: {
    ariaLive: "assertive" | "polite"
    className: string
    dataDismissable: boolean
    dataDragging: boolean
    dataDraggingOut: boolean
    dataExpanded: boolean
    dataFront: boolean
    dataIndex: number
    dataMounted: boolean
    dataRemoved: boolean
    dataType: string
    dataVisible: boolean
    dataXPosition: string
    dataYPosition: string
    onPointerDown: PointerEventHandler<HTMLLIElement>
    onPointerMove: PointerEventHandler<HTMLLIElement>
    onPointerUp: PointerEventHandler<HTMLLIElement>
    ref: RefObject<HTMLLIElement | null>
    role: "alertdialog" | "dialog"
    style: CSSProperties
  }
  topRibbon: {
    className: string
    closeAction: (TCalibratedToastButtonAction & { icon?: ReactNode }) | null
    leftContent: {
      className: string
      icon: ReactNode
      style?: CSSProperties
    }
    style?: CSSProperties
    title: {
      className: string
      color: string
      style?: CSSProperties
      text: string
    }
  }
}

/**
 * Owns Toast state, timer, measurement, gesture, and action coordination while the renderer remains a declarative
 * projection of prepared root, ribbon, content, and action resources.
 */
export const useCalibratedComponent = (props: TToastProps): TCalibratedToastComponent => {
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
      titleText = "Placeholder Title Text",
      bodyText = "Placeholder body text",
      CloseIcon,
      confirmAction,
      confirmActionBtnText,
      labels,
      showButtons = true,
      showCancelAction = true,
    },
  } = props
  const {
    bodyTextProps,
    toastStyles,
    topRibbonStyles,
    topRibbonLeftContentStyles,
    headerStyles,
    toastContentStyles,
    bottomRowStyles,
    buttonRowStyles,
    customStyles,
    topRibbonStyle,
    topRibbonLeftContentStyle,
    headerStyle,
    toastContentStyle,
    bottomRowStyle,
    buttonRowStyle,
    color__neutral_4,
    toastColor,
    toastIcon,
    timestampTextProps,
    closeButtonProps,
    cancelButtonProps,
    confirmButtonProps,
  } = calibrateComponent(props)
  const [state, setState] = useState<TToastState>(initState)
  const [isDocumentHidden, setIsDocumentHidden] = useState(false)
  const internalToastRef = useRef<HTMLLIElement>(null)
  const dragStartTimeRef = useRef<Date | null>(null)
  const closeTimerStartTimeRef = useRef(0)
  const lastCloseTimerStartTimeRef = useRef(0)
  const offsetRef = useRef(0)
  const pointerStartCoordsRef = useRef<{ x: number; y: number } | null>(null)
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
  }, [])

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
  }, [])

  useIsomorphicLayoutEffect(() => {
    const internalToast = internalToastRef.current

    if (document.activeElement === internalToast || internalToast!.contains(document.activeElement)) {
      setState((previousState) => ({ ...previousState, isFocused: true }))
    } else {
      setState((previousState) => ({ ...previousState, isFocused: false }))
    }
  }, [props, type])

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
  }, [setHeights, toast.id, state.mounted, toast.position, position])

  const deleteToast = useCallback(() => {
    setState((previousState) => ({
      ...previousState,
      removed: true,
      offsetBeforeRemove: offsetRef.current,
    }))
    setHeights((currentHeights) => currentHeights.filter((height) => height.id !== toast.id))
    setTimeout(() => removeToast(toast), DURATION_BEFORE_UNMOUNT)
  }, [toast, removeToast, setHeights, offsetRef])

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
    [dismissable],
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
  }, [deleteToast, dismissalHotkey])

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
    [dismissable, y],
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
    [deleteToast, dismissable, onDismiss, state.draggingOut, toast],
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
  const { mounted, removed, dragging, draggingOut, offsetBeforeRemove, initialHeight, color_white } = state

  return {
    content: {
      body: {
        props: bodyTextProps,
        text: bodyText,
      },
      bottomRow: {
        actions: {
          cancel: showCancelAction
            ? {
                ariaLabel: resolvedLabels.cancelActionButtonAriaLabel,
                onPress: handleCancel,
                props: cancelButtonProps,
                text: resolvedLabels.cancelActionButton,
              }
            : null,
          className: buttonRowStyles,
          confirm: {
            ariaLabel: resolvedLabels.confirmActionButtonAriaLabel,
            color: toastColor,
            onPress: handleConfirm,
            props: confirmButtonProps,
            text: resolvedLabels.confirmActionButton,
            textColor: color_white,
          },
          isVisible: showButtons,
          style: buttonRowStyle,
        },
        className: bottomRowStyles,
        style: bottomRowStyle,
        timestamp: {
          color: color__neutral_4,
          props: timestampTextProps,
          text: computeToastDateTimeString(),
        },
      },
      className: toastContentStyles,
      style: toastContentStyle,
    },
    root: {
      ariaLive: important ? "assertive" : "polite",
      className: toastStyles,
      dataDismissable: dismissable,
      dataDragging: dragging,
      dataDraggingOut: draggingOut,
      dataExpanded: Boolean(toasterExpanded || (expandByDefault && mounted)),
      dataFront: isFirstToast,
      dataIndex: index,
      dataMounted: mounted,
      dataRemoved: removed,
      dataType: type,
      dataVisible: visible,
      dataXPosition: x,
      dataYPosition: y,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      ref: internalToastRef,
      role: important ? "alertdialog" : "dialog",
      style: {
        "--index": index,
        "--toastsBefore": index,
        "--z-index": numToasts - index,
        "--offset": `${removed ? offsetBeforeRemove : offsetRef.current}px`,
        "--initial-height": expandByDefault ? "auto" : `${initialHeight}px`,
        ...(toastGap != null ? { "--toastGap": `${toastGap}px` } : {}),
        ...customStyles,
      } as CSSProperties,
    },
    topRibbon: {
      className: topRibbonStyles,
      closeAction: dismissable
        ? {
            ariaLabel: resolvedLabels.closeButtonAriaLabel,
            icon: CloseIcon,
            onPress: handleClose,
            props: closeButtonProps,
          }
        : null,
      leftContent: {
        className: topRibbonLeftContentStyles,
        icon: toastIcon,
        style: topRibbonLeftContentStyle,
      },
      style: topRibbonStyle,
      title: {
        className: headerStyles,
        color: color_white,
        style: headerStyle,
        text: titleText,
      },
    },
  }
}
