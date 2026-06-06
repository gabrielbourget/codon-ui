"use client"

import classNames from "classnames"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FC,
  type PointerEvent,
} from "react"
import { Heading } from "react-aria-components"

import Button from "../../Button/Button"
import type { TButtonProps } from "../../Button/helpers"
import type { TTextProps } from "../../Text/helpers"
import Text from "../../Text/Text"
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

import { ToastDefaultCloseIcon } from "./DefaultToastIcons"
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
import styles from "./ToastStyles.module.css"

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

const useIsDocumentHidden = () => {
  const [isDocumentHidden, setIsDocumentHidden] = useState(false)

  useEffect(() => {
    const handleVisibilityChange = () => setIsDocumentHidden(document.hidden)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  return isDocumentHidden
}

const mergeButtonSlotProps = (args: {
  buttonProps?: Partial<TButtonProps>
  customClassName?: string
  customStyles?: CSSProperties
  defaultStyles?: CSSProperties
}) => {
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
}) => {
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

const Toast: FC<TToastProps> = (props: TToastProps) => {
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
      customBodyTextClassName,
      customBodyTextProps,
      customBodyTextStyles,
      customCancelButtonClassName,
      customCancelButtonProps,
      customCancelButtonStyles,
      customCloseButtonClassName,
      customCloseButtonProps,
      customCloseButtonStyles,
      customConfirmButtonClassName,
      customConfirmButtonProps,
      customConfirmButtonStyles,
      customTimestampClassName,
      customTimestampTextProps,
      customTimestampStyles,
      confirmAction,
      confirmActionBtnText,
      labels,
      showButtons = true,
      showCancelAction = true,
    },
  } = props

  const [state, setState] = useState<TToastState>(initState)

  const isDocumentHidden = useIsDocumentHidden()
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

  // -> Ensure the first paint happens with the off-screen transform,
  //    then flip `mounted` on the next frame so transform/opacity animate.
  useIsomorphicLayoutEffect(() => {
    let raf1 = 0
    let raf2 = 0
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setState((prev) => ({ ...prev, mounted: true }))
      })
    })

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [])

  // -> Compute component styles, compute color and icon settings
  const {
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
  } = calibrateComponent(props)

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

  useIsomorphicLayoutEffect(() => {
    const internalToastRefValue = internalToastRef.current

    if (document.activeElement === internalToastRefValue || internalToastRefValue!.contains(document.activeElement))
      setState((prevState) => ({ ...prevState, isFocused: true }))
    else setState((prevState) => ({ ...prevState, isFocused: false }))
  }, [props, type])

  // -> Compute memoized properties for use in component
  const { visible, isFirstToast, duration, important } = useMemo(() => {
    const visible = index + 1 <= maxVisibleToasts
    const isFirstToast = index === 0
    const duration = duration__props || duration__props__toaster || DEFAULT_TOAST_DURATION
    const currentHeightsIndexRaw = heights.findIndex((h) => h.id === id)
    const currentHeightsIndex = currentHeightsIndexRaw < 0 ? 0 : currentHeightsIndexRaw
    const important =
      important__props !== undefined
        ? important__props
        : type === TOAST_TYPE__DANGER || type === TOAST_TYPE__DELETE || type === TOAST_TYPE__ERROR

    // -> Compute offset until current toast
    const toastsHeightBefore = heights.slice(0, currentHeightsIndex).reduce((sum, h) => sum + h.height, 0)

    offsetRef.current = currentHeightsIndex * toastGap + toastsHeightBefore

    return {
      visible,
      isFirstToast,
      duration,
      important,
      currentHeightsIndex,
      toastsHeightBefore,
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

  // -> Toast heights computations and management
  useIsomorphicLayoutEffect(() => {
    if (!state.mounted) return

    const toastElement = internalToastRef.current
    const originalToastHeight = toastElement!.style.height
    toastElement!.style.height = "auto"
    const updatedToastHeight = toastElement!.getBoundingClientRect().height
    toastElement!.style.height = originalToastHeight

    // setInitialHeight(updatedToastHeight);
    setState((prevState) => ({ ...prevState, initialHeight: updatedToastHeight }))

    setHeights((heights: TToastHeightInfo[]) => {
      const alreadyExists = heights.find((height: TToastHeightInfo) => height.id === toast.id)
      if (!alreadyExists) {
        return [{ id: toast.id, height: updatedToastHeight, position }, ...heights]
      } else {
        return heights.map((height: TToastHeightInfo) =>
          height.id === toast.id ? { ...height, height: updatedToastHeight } : height,
        )
      }
    })

    return () => setHeights((h) => h.filter((height) => height.id !== toast.id))
  }, [setHeights, toast.id, state.mounted, toast.position, position])

  // -> Delete Toast
  const deleteToast = useCallback(() => {
    // Save the offsetRef for the exit swipe animation
    setState((prevState) => ({
      ...prevState,
      removed: true,
      offsetBeforeRemove: offsetRef.current,
    }))
    setHeights((h) => h.filter((height) => height.id !== toast.id))

    setTimeout(() => removeToast(toast), DURATION_BEFORE_UNMOUNT)
  }, [toast, removeToast, setHeights, offsetRef])

  // -> On Pointer Down
  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      if (!dismissable) return
      dragStartTimeRef.current = new Date()
      setState((prevState) => ({ ...prevState, offsetBeforeRemove: offsetRef.current }))

      // Ensure we maintain correct pointer capture even when going outside of the toast (e.g. when dragging)
      const eventTarget = event.target as HTMLElement
      if (typeof eventTarget.setPointerCapture === "function") {
        eventTarget.setPointerCapture(event.pointerId)
      }
      if (eventTarget.tagName.toLowerCase() === "button") return
      setState((prevState) => ({ ...prevState, dragging: true }))
      pointerStartCoordsRef.current = { x: event.clientX, y: event.clientY }
    },
    [dismissable],
  )

  // -> Register provided hot keys for expanding and collapsing the toaster
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

  // -> On Pointer Move
  const onPointerMove = useCallback(
    (event: PointerEvent) => {
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
        // -> User is dragging away from closest edge of viewport.
        //    Disable swipe gesture for the current pointer down interaction.
        pointerStartCoordsRef.current = null
      }
    },
    [dismissable, y],
  )

  // -> On Pointer Up
  const onPointerUp = useCallback(
    (_: PointerEvent) => {
      if (state.draggingOut || !dismissable) return

      pointerStartCoordsRef.current = null
      const dragAmount = Number(internalToastRef.current?.style.getPropertyValue("--dragAmount").replace("px", "") || 0)
      const timeDelta = dragStartTimeRef.current && new Date().getTime() - dragStartTimeRef.current?.getTime()
      const velocity = Math.abs(dragAmount) / timeDelta!

      // Remove only if threshold is met
      if (
        Math.abs(dragAmount) >= TOAST_DISMISSAL_DRAG_THRESHOLD ||
        velocity > TOAST_DISMISSAL_DRAG_VELOCITY_THRESHOLD
      ) {
        setState((prevState) => ({ ...prevState, offsetBeforeRemove: offsetRef.current }))
        if (onDismiss) onDismiss(toast)
        deleteToast()
        setState((prevState) => ({ ...prevState, draggingOut: true }))
        return
      }
      internalToastRef.current?.style.setProperty("--dragAmount", "0px")

      setState((prevState) => ({ ...prevState, dragging: false }))
    },
    [deleteToast, dismissable, onDismiss, state.draggingOut, toast],
  )

  // -> Manage toast dismissal timer
  useEffect(() => {
    if (duration === "persistent") return
    let timeoutId: ReturnType<typeof setTimeout>
    let remainingTime = duration

    // Pause the timer on each hover
    const pauseTimer = () => {
      if (lastCloseTimerStartTimeRef.current < closeTimerStartTimeRef.current) {
        const elapsedTime = new Date().getTime() - closeTimerStartTimeRef.current
        remainingTime -= elapsedTime
      }

      lastCloseTimerStartTimeRef.current = new Date().getTime()
    }

    const startTimer = () => {
      closeTimerStartTimeRef.current = new Date().getTime()

      // Let the toast know it has started
      timeoutId = setTimeout(() => {
        if (onAutoClose) onAutoClose(toast)
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

  const cancelButton = showCancelAction ? (
    <Button
      {...cancelButtonProps}
      order="primary"
      aria-label={resolvedLabels.cancelActionButtonAriaLabel}
      onPress={() => {
        cancelAction?.()
        deleteToast()
        if (onDismiss) onDismiss(toast)
      }}
      transparent
      raised={false}
    >
      <Text fontWeight="bold" color={toastColor} customStyles={{ textDecoration: "underline" }}>
        {resolvedLabels.cancelActionButton}
      </Text>
    </Button>
  ) : null

  // -> Delete toast if provided to do so by props
  useEffect(() => {
    if (deletingToast) deleteToast()
  }, [deleteToast, deletingToast])

  const { mounted, removed, dragging, draggingOut, offsetBeforeRemove, initialHeight, color_white } = state

  return (
    <li
      aria-live={important ? "assertive" : "polite"}
      aria-atomic="true"
      role={important ? "alertdialog" : "dialog"}
      ref={internalToastRef}
      tabIndex={0}
      className={toastStyles}
      data-testid="toast"
      data-mounted={mounted ? "true" : "false"}
      data-removed={removed}
      data-visible={visible}
      data-y-position={y}
      data-x-position={x}
      data-index={index}
      data-front={isFirstToast}
      data-dismissable={dismissable}
      data-type={type}
      data-dragging={dragging}
      data-dragging-out={draggingOut}
      data-expanded={Boolean(toasterExpanded || (expandByDefault && mounted))}
      style={
        {
          // -> Component-level CSS variables are referenced by component styles
          "--index": index,
          "--toastsBefore": index,
          "--z-index": numToasts - index,
          "--offset": `${removed ? offsetBeforeRemove : offsetRef.current}px`,
          "--initial-height": expandByDefault ? "auto" : `${initialHeight}px`,
          ...(toastGap != null ? { "--toastGap": `${toastGap}px` } : {}),
          ...customStyles,
        } as CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className={topRibbonStyles} style={topRibbonStyle}>
        <div className={topRibbonLeftContentStyles} style={topRibbonLeftContentStyle}>
          {toastIcon}
          <Heading slot="title" style={{ color: color_white, ...headerStyle }} className={headerStyles}>
            {titleText}
          </Heading>
        </div>
        {dismissable ? (
          <Button
            {...closeButtonProps}
            aria-label={resolvedLabels.closeButtonAriaLabel}
            raised={false}
            onPress={() => {
              deleteToast()
              if (onDismiss) onDismiss(toast)
            }}
          >
            {CloseIcon ?? (
              <ToastDefaultCloseIcon
                customClassName={styles["toast__icon--white"]}
                size={15}
                data-testid="toast-default-close-icon"
              />
            )}
          </Button>
        ) : undefined}
      </div>
      <div className={toastContentStyles} style={toastContentStyle}>
        <Text variant="b11" {...bodyTextProps}>
          {bodyText}
        </Text>
        <div className={bottomRowStyles} style={bottomRowStyle}>
          <Text variant="b13" color={color__neutral_4} {...timestampTextProps}>
            {computeToastDateTimeString()}
          </Text>
          <div className={buttonRowStyles} style={buttonRowStyle}>
            {showButtons ? (
              <>
                {cancelButton}
                <Button
                  {...confirmButtonProps}
                  raised={false}
                  aria-label={resolvedLabels.confirmActionButtonAriaLabel}
                  color={toastColor}
                  onPress={() => {
                    confirmAction?.()
                    deleteToast()
                    if (onDismiss) onDismiss(toast)
                  }}
                >
                  <Text fontWeight="bold" color={color_white}>
                    {resolvedLabels.confirmActionButton}
                  </Text>
                </Button>
              </>
            ) : undefined}
          </div>
        </div>
      </div>
    </li>
  )
}

export default Toast
