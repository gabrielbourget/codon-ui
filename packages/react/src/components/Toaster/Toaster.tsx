"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FC,
  type FocusEvent,
  type PointerEvent,
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
  type TExternalToast,
  type TToastToDismiss,
  type TToasterProps,
} from "./helpers"
import { ToasterObserver, toast } from "./stateManagement"
import type { TToast, TToastHeightInfo } from "./Toast/helpers"
import Toast from "./Toast/Toast"

const Toaster: FC<TToasterProps> = (props) => {
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
    position = DEFAULT_TOAST_POSITION,
    expandToggleHotkey = ["altKey", "KeyE"],
    dismissalHotkey = ["Escape"],
    expandByDefault = false,
    offset = DEFAULT_VIEWPORT_OFFSET,
    duration,
    customClassName: _customClassName,
    customRootStyles: _customRootStyles,
    customStyles,
    customStackClassName: _customStackClassName,
    customStackStyles,
    customToastBridgeClassName: _customToastBridgeClassName,
    customToastBridgeStyles,
    maxVisibleToasts = DEFAULT_MAX_VISIBLE_TOASTS,
    toastGap,
    toastLabels,
    pauseWhenPageIsHidden = true,
    style: _style,
    ...rest
  } = props

  const { toasterRootStyles, toasterRootStyle, toasterStyles, toastBridgeStyles } = calibrateComponent(props)

  const [toasts, setToasts] = useState<TToast[]>([])
  const [heights, setHeights] = useState<TToastHeightInfo[]>([])
  const [toasterExpanded, setExpanded] = useState(false)
  const [interacting, setInteracting] = useState(false)

  const toasterListRef = useRef<HTMLOListElement>(null)
  const hotkeyLabel = expandToggleHotkey.join("+").replace(/Key/g, "").replace(/Digit/g, "")
  const rootAriaLabel = ariaLabel ?? ariaLabelAlias ?? "Notifications Toaster"
  const lastFocusedElementRef = useRef<HTMLElement | null>(null)
  const focuseWithinToasterRef = useRef(false)

  // -> Group toasts by their assigned render position on the screen.
  const toastGroups = useMemo(() => {
    const positionToastsMap = new Map<string, TToast[]>()
    const defaultPos = position

    toasts.forEach((t) => {
      const pos = t.position ?? defaultPos
      if (!positionToastsMap.has(pos)) positionToastsMap.set(pos, [])
      positionToastsMap.get(pos)!.push(t)
    })

    return Array.from(positionToastsMap.entries()) // -> [ [position, toastsForThisPosition], ... ]
  }, [toasts, position])

  // -> Remove toast
  const removeToast = useCallback(
    (toast: TToast) => setToasts((toasts) => toasts.filter(({ id }) => id !== toast.id)),
    [],
  )

  // -> State management
  useEffect(() => {
    return ToasterObserver.subscribe((toast) => {
      if ((toast as TToastToDismiss).dismiss) {
        setToasts((toasts) => toasts.map((t) => (t.id === toast.id ? { ...t, deletingToast: true } : t)))
        return
      }

      // -> Defer publish handling so consecutive observer events settle into distinct toast transitions.
      setTimeout(() => {
        ReactDOM.flushSync(() => {
          setToasts((toasts) => {
            const indexOfExistingToast = toasts.findIndex((t) => t.id === toast.id)

            // Update the toast if it already exists
            if (indexOfExistingToast !== -1) {
              return [
                ...toasts.slice(0, indexOfExistingToast),
                { ...toasts[indexOfExistingToast], ...toast },
                ...toasts.slice(indexOfExistingToast + 1),
              ]
            }

            return [toast, ...toasts]
          })
        })
      })
    })
  }, [])

  // -> Control expanded status
  useEffect(() => {
    if (toasts.length <= 1) setExpanded(false)
  }, [toasts])

  // -> Register provided hot keys for expanding and collapsing the toaster
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const hotKeyPressed = isHotkeyPressed(event, expandToggleHotkey)

      if (hotKeyPressed) {
        if (toasterExpanded) setExpanded(false)
        else {
          setExpanded(true)
          toasterListRef.current?.focus()
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [expandToggleHotkey, toasterExpanded])

  // -> Element focus management
  useEffect(() => {
    if (toasterListRef.current) {
      return () => {
        if (lastFocusedElementRef.current) {
          lastFocusedElementRef.current.focus({ preventScroll: true })
          lastFocusedElementRef.current = null
          focuseWithinToasterRef.current = false
        }
      }
    }
  }, [])

  // -> On Focus
  const onFocus = (event: FocusEvent) => {
    const notDismissible = event.target instanceof HTMLElement && event.target.dataset.dismissable === "false"

    if (notDismissible) return

    if (!focuseWithinToasterRef.current) {
      focuseWithinToasterRef.current = true
      lastFocusedElementRef.current = event.relatedTarget as HTMLElement
    }
  }

  // -> On Blur
  const onBlur = (event: FocusEvent) => {
    if (focuseWithinToasterRef.current && !event.currentTarget.contains(event.relatedTarget)) {
      focuseWithinToasterRef.current = false
      if (lastFocusedElementRef.current) {
        lastFocusedElementRef.current.focus({ preventScroll: true })
        lastFocusedElementRef.current = null
      }
    }
  }

  // -> On Pointer Down
  const onPointerDown = (event: PointerEvent) => {
    const notDismissible = event.target instanceof HTMLElement && event.target.dataset.dismissable === "false"

    if (notDismissible) return
    setInteracting(true)
  }

  const collapseTimer = useRef<number | null>(null)

  const requestExpand = useCallback(() => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current)
      collapseTimer.current = null
    }
    setExpanded(true)
  }, [])

  const requestCollapse = useCallback(() => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current)
    collapseTimer.current = window.setTimeout(() => {
      setExpanded(false)
      collapseTimer.current = null
    }, 120)
  }, [])

  useEffect(
    () => () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current)
    },
    [],
  )

  if (!toasts.length) return null

  return (
    <section
      {...rest}
      aria-label={`${rootAriaLabel} - ${hotkeyLabel}`}
      aria-labelledby={ariaLabelledBy ?? ariaLabelledByAlias}
      aria-describedby={ariaDescribedBy ?? ariaDescribedByAlias}
      aria-details={ariaDetails ?? ariaDetailsAlias}
      tabIndex={-1}
      className={toasterRootStyles}
      style={toasterRootStyle}
      data-testid={dataTestID ?? "toaster"}
    >
      {toastGroups.map(([position, toastsForThisPosition]) => {
        const [y, x] = position.split("-")
        const heightsForThisPosition = heights.filter((h) => h.position === position)
        const gap = toastGap ?? DEFAULT_TOAST_GAP
        const visibleToastsSubset = toastsForThisPosition.slice(0, maxVisibleToasts)
        const offsets = computeOffsets(visibleToastsSubset, heightsForThisPosition, gap)
        const bridgeDivInfo = computeBridgeDivInfo(offsets, visibleToastsSubset, gap, position)
        const toastStackHeight = computeToastStackHeight(offsets, visibleToastsSubset, heightsForThisPosition)
        const firstID = visibleToastsSubset[0]?.id
        const firstHeight =
          firstID == null
            ? 0
            : (heightsForThisPosition.find((h) => h.id === firstID)?.height ?? heightsForThisPosition[0]?.height ?? 0)

        return (
          <ol
            key={position}
            tabIndex={-1}
            ref={toasterListRef}
            data-y-position={y}
            data-x-position={x}
            data-expanded={toasterExpanded}
            onFocus={onFocus}
            onBlur={onBlur}
            onMouseEnter={requestExpand}
            onMouseMove={requestExpand}
            onMouseLeave={() => {
              if (!interacting) requestCollapse()
            }}
            onPointerDown={onPointerDown}
            onPointerUp={() => setInteracting(false)}
            style={
              {
                "--firstToastHeight": `${firstHeight}px`,
                "--offset": typeof offset === "number" ? `${offset}px` : offset,
                "--width": `${DEFAULT_TOAST_WIDTH}px`,
                "--toastGap": `${gap}px`,
                "--toastStackHeight": `${toastStackHeight}px`,
                ...customStyles,
                ...customStackStyles,
              } as CSSProperties
            }
            className={toasterStyles}
          >
            {toastsForThisPosition.map((toast, index) => (
              <Toast
                key={toast.id}
                index={index}
                duration={duration}
                dismissalHotkey={dismissalHotkey}
                toast={toast}
                toastLabels={toastLabels}
                maxVisibleToasts={maxVisibleToasts}
                position={position}
                toastGap={toastGap}
                toasterExpanded={toasterExpanded}
                expandByDefault={expandByDefault}
                interacting={interacting}
                heights={heightsForThisPosition}
                setHeights={setHeights}
                numToasts={toastsForThisPosition.length}
                removeToast={removeToast}
                pauseWhenPageIsHidden={pauseWhenPageIsHidden}
              />
            ))}

            {/* Ghost hover bridges to maintain expanded toaster state when moving cursor between toasts. */}
            {bridgeDivInfo.map((bridgeDiv) => (
              <div
                key={bridgeDiv.key}
                className={toastBridgeStyles}
                aria-hidden
                style={
                  {
                    "--bridgeOffset": `${bridgeDiv.offset}px`,
                    "--toastGap": `${gap}px`,
                    ...customToastBridgeStyles,
                  } as React.CSSProperties
                }
                onMouseEnter={requestExpand}
                onMouseMove={requestExpand}
              />
            ))}
          </ol>
        )
      })}
    </section>
  )
}

export { Toaster, toast, type TExternalToast, type TToast }
export default Toaster
