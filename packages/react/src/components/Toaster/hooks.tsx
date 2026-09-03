"use client"

import {
  type CSSProperties,
  type FocusEventHandler,
  type HTMLAttributes,
  type PointerEventHandler,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import ReactDOM from "react-dom"

import {
  DEFAULT_MAX_VISIBLE_TOASTS,
  DEFAULT_TOAST_GAP,
  DEFAULT_TOAST_POSITION,
  DEFAULT_TOAST_WIDTH,
  DEFAULT_VIEWPORT_OFFSET,
  calibrateComponent,
  computeBridgeDivInfo,
  computeOffsets,
  computeToastStackHeight,
  isHotkeyPressed,
  type TAvailableToastPositions,
  type TToastToDismiss,
  type TToasterProps,
} from "./helpers"
import { ToasterObserver } from "./stateManagement"
import type { TToast, TToastHeightInfo, TToastProps } from "./Toast/helpers"

type TCalibratedToasterBridge = {
  className: string
  key: string
  onMouseEnter: () => void
  onMouseMove: () => void
  style: CSSProperties
}

type TCalibratedToasterStack = {
  bridges: TCalibratedToasterBridge[]
  key: TAvailableToastPositions
  list: {
    className: string
    dataExpanded: boolean
    dataXPosition: string
    dataYPosition: string
    onBlur: FocusEventHandler<HTMLOListElement>
    onFocus: FocusEventHandler<HTMLOListElement>
    onMouseEnter: () => void
    onMouseLeave: () => void
    onMouseMove: () => void
    onPointerDown: PointerEventHandler<HTMLOListElement>
    onPointerUp: () => void
    ref: RefObject<HTMLOListElement | null>
    style: CSSProperties
  }
  toastItems: Array<{
    key: number | string
    props: TToastProps
  }>
}

type TCalibratedToasterComponent = {
  isVisible: boolean
  root: {
    ariaDescribedBy: string | undefined
    ariaDetails: string | undefined
    ariaLabel: string
    ariaLabelledBy: string | undefined
    className: string
    dataTestID: string
    nativeProps: HTMLAttributes<HTMLElement>
    style: CSSProperties
  }
  stacks: TCalibratedToasterStack[]
}

/**
 * Owns Toaster observer state, stack preparation, hotkeys, focus restoration, and hover interaction while the renderer
 * remains a declarative projection of prepared root, stack, Toast, and bridge resources.
 */
export const useCalibratedComponent = (props: TToasterProps): TCalibratedToasterComponent => {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-details": ariaDetails,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "data-testid": dataTestID,
    ariaDescribedBy: ariaDescribedByAlias,
    ariaDetails: ariaDetailsAlias,
    ariaLabel: ariaLabelAlias,
    ariaLabelledBy: ariaLabelledByAlias,
    className: _className,
    customClassName: _customClassName,
    customRootStyles: _customRootStyles,
    customStackClassName: _customStackClassName,
    customStackStyles,
    customStyles,
    customToastBridgeClassName: _customToastBridgeClassName,
    customToastBridgeStyles,
    dismissalHotkey = ["Escape"],
    duration,
    expandByDefault = false,
    expandToggleHotkey = ["altKey", "KeyE"],
    maxVisibleToasts = DEFAULT_MAX_VISIBLE_TOASTS,
    offset = DEFAULT_VIEWPORT_OFFSET,
    pauseWhenPageIsHidden = true,
    position = DEFAULT_TOAST_POSITION,
    style: _style,
    toastGap,
    toastLabels,
    ...nativeProps
  } = props
  const { toasterRootStyles, toasterRootStyle, toasterStyles, toastBridgeStyles } = calibrateComponent(props)
  const [toasts, setToasts] = useState<TToast[]>([])
  const [heights, setHeights] = useState<TToastHeightInfo[]>([])
  const [toasterExpanded, setExpanded] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const toasterListRef = useRef<HTMLOListElement>(null)
  const lastFocusedElementRef = useRef<HTMLElement | null>(null)
  const focusWithinToasterRef = useRef(false)
  const collapseTimerRef = useRef<number | null>(null)
  const hotkeyLabel = expandToggleHotkey.join("+").replace(/Key/g, "").replace(/Digit/g, "")
  const rootAriaLabel = ariaLabel ?? ariaLabelAlias ?? "Notifications Toaster"

  const toastGroups = useMemo(() => {
    const positionToastsMap = new Map<TAvailableToastPositions, TToast[]>()

    toasts.forEach((currentToast) => {
      const toastPosition = currentToast.position ?? position
      const positionedToasts = positionToastsMap.get(toastPosition) ?? []

      positionToastsMap.set(toastPosition, [...positionedToasts, currentToast])
    })

    return Array.from(positionToastsMap.entries())
  }, [position, toasts])
  const removeToast = useCallback(
    (toastToRemove: TToast) => setToasts((currentToasts) => currentToasts.filter(({ id }) => id !== toastToRemove.id)),
    [],
  )
  const handleFocus = useCallback<FocusEventHandler<HTMLOListElement>>((event) => {
    const notDismissible = event.target instanceof HTMLElement && event.target.dataset.dismissable === "false"

    if (notDismissible) return

    if (!focusWithinToasterRef.current) {
      focusWithinToasterRef.current = true
      lastFocusedElementRef.current = event.relatedTarget as HTMLElement
    }
  }, [])
  const handleBlur = useCallback<FocusEventHandler<HTMLOListElement>>((event) => {
    if (focusWithinToasterRef.current && !event.currentTarget.contains(event.relatedTarget)) {
      focusWithinToasterRef.current = false
      if (lastFocusedElementRef.current) {
        lastFocusedElementRef.current.focus({ preventScroll: true })
        lastFocusedElementRef.current = null
      }
    }
  }, [])
  const handlePointerDown = useCallback<PointerEventHandler<HTMLOListElement>>((event) => {
    const notDismissible = event.target instanceof HTMLElement && event.target.dataset.dismissable === "false"

    if (notDismissible) return
    setInteracting(true)
  }, [])
  const handlePointerUp = useCallback(() => setInteracting(false), [])
  const requestExpand = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = null
    }
    setExpanded(true)
  }, [])
  const requestCollapse = useCallback(() => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
    collapseTimerRef.current = window.setTimeout(() => {
      setExpanded(false)
      collapseTimerRef.current = null
    }, 120)
  }, [])
  const handleMouseLeave = useCallback(() => {
    if (!interacting) requestCollapse()
  }, [interacting, requestCollapse])

  useEffect(
    () =>
      ToasterObserver.subscribe((publishedToast) => {
        if ((publishedToast as TToastToDismiss).dismiss) {
          setToasts((currentToasts) =>
            currentToasts.map((currentToast) =>
              currentToast.id === publishedToast.id ? { ...currentToast, deletingToast: true } : currentToast,
            ),
          )
          return
        }

        // -> Defer publish handling so consecutive observer events settle into distinct toast transitions.
        setTimeout(() => {
          ReactDOM.flushSync(() => {
            setToasts((currentToasts) => {
              const existingToastIndex = currentToasts.findIndex(
                (currentToast) => currentToast.id === publishedToast.id,
              )

              if (existingToastIndex !== -1) {
                return [
                  ...currentToasts.slice(0, existingToastIndex),
                  { ...currentToasts[existingToastIndex], ...publishedToast },
                  ...currentToasts.slice(existingToastIndex + 1),
                ]
              }

              return [publishedToast, ...currentToasts]
            })
          })
        })
      }),
    [],
  )
  useEffect(() => {
    if (toasts.length <= 1) setExpanded(false)
  }, [toasts])
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isHotkeyPressed(event, expandToggleHotkey)) return

      if (toasterExpanded) setExpanded(false)
      else {
        setExpanded(true)
        toasterListRef.current?.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [expandToggleHotkey, toasterExpanded])
  useEffect(() => {
    if (toasterListRef.current) {
      return () => {
        if (lastFocusedElementRef.current) {
          lastFocusedElementRef.current.focus({ preventScroll: true })
          lastFocusedElementRef.current = null
          focusWithinToasterRef.current = false
        }
      }
    }
  }, [])
  useEffect(
    () => () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
    },
    [],
  )

  const stacks = toastGroups.map(([toastPosition, positionedToasts]): TCalibratedToasterStack => {
    const [yPosition, xPosition] = toastPosition.split("-")
    const positionedHeights = heights.filter((height) => height.position === toastPosition)
    const gap = toastGap ?? DEFAULT_TOAST_GAP
    const visibleToasts = positionedToasts.slice(0, maxVisibleToasts)
    const offsets = computeOffsets(visibleToasts, positionedHeights, gap)
    const bridgeInfo = computeBridgeDivInfo(offsets, visibleToasts, gap, toastPosition)
    const toastStackHeight = computeToastStackHeight(offsets, visibleToasts, positionedHeights)
    const firstToastID = visibleToasts[0]?.id
    const firstToastHeight =
      firstToastID == null
        ? 0
        : (positionedHeights.find(({ id }) => id === firstToastID)?.height ?? positionedHeights[0]?.height ?? 0)

    return {
      bridges: bridgeInfo.map((bridge) => ({
        className: toastBridgeStyles,
        key: bridge.key,
        onMouseEnter: requestExpand,
        onMouseMove: requestExpand,
        style: {
          "--bridgeOffset": `${bridge.offset}px`,
          "--toastGap": `${gap}px`,
          ...customToastBridgeStyles,
        } as CSSProperties,
      })),
      key: toastPosition,
      list: {
        className: toasterStyles,
        dataExpanded: toasterExpanded,
        dataXPosition: xPosition,
        dataYPosition: yPosition,
        onBlur: handleBlur,
        onFocus: handleFocus,
        onMouseEnter: requestExpand,
        onMouseLeave: handleMouseLeave,
        onMouseMove: requestExpand,
        onPointerDown: handlePointerDown,
        onPointerUp: handlePointerUp,
        ref: toasterListRef,
        style: {
          "--firstToastHeight": `${firstToastHeight}px`,
          "--offset": typeof offset === "number" ? `${offset}px` : offset,
          "--width": `${DEFAULT_TOAST_WIDTH}px`,
          "--toastGap": `${gap}px`,
          "--toastStackHeight": `${toastStackHeight}px`,
          ...customStyles,
          ...customStackStyles,
        } as CSSProperties,
      },
      toastItems: positionedToasts.map((currentToast, index) => ({
        key: currentToast.id,
        props: {
          dismissalHotkey,
          duration,
          expandByDefault,
          heights: positionedHeights,
          index,
          interacting,
          maxVisibleToasts,
          numToasts: positionedToasts.length,
          pauseWhenPageIsHidden,
          position: toastPosition,
          removeToast,
          setHeights,
          toast: currentToast,
          toastGap,
          toasterExpanded,
          toastLabels,
        },
      })),
    }
  })

  return {
    isVisible: toasts.length > 0,
    root: {
      ariaDescribedBy: ariaDescribedBy ?? ariaDescribedByAlias,
      ariaDetails: ariaDetails ?? ariaDetailsAlias,
      ariaLabel: `${rootAriaLabel} - ${hotkeyLabel}`,
      ariaLabelledBy: ariaLabelledBy ?? ariaLabelledByAlias,
      className: toasterRootStyles,
      dataTestID: dataTestID ?? "toaster",
      nativeProps: nativeProps as HTMLAttributes<HTMLElement>,
      style: toasterRootStyle,
    },
    stacks,
  }
}
