import {
  useCallback,
  useEffect,
  useMemo,
  type CSSProperties,
  type Dispatch,
  type FocusEventHandler,
  type HTMLAttributes,
  type PointerEventHandler,
  type RefObject,
  type SetStateAction,
} from "react"
import ReactDOM from "react-dom"

import type { TAriaLabelingProps } from "../../tokens/a11y"

import { ToasterObserver } from "./stateManagement"
import type { TToast, TToastHeightInfo } from "./Toast/helpers"
import type { TPartialToastLabels } from "./Toast/labels"

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

export type TToasterInteractionState = {
  toasterExpanded: boolean
  interacting: boolean
}

type TCalibrateToasterArgs = {
  props: TToasterProps
  toasts: TToast[]
  setToasts: Dispatch<SetStateAction<TToast[]>>
  heights: TToastHeightInfo[]
  interactionState: TToasterInteractionState
  setInteractionState: Dispatch<SetStateAction<TToasterInteractionState>>
  toasterListRef: RefObject<HTMLOListElement | null>
  lastFocusedElementRef: RefObject<HTMLElement | null>
  focusWithinToasterRef: RefObject<boolean>
  collapseTimerRef: RefObject<number | null>
}

/** Coordinates observer publication, focus, hotkeys and hover lifecycles, and derives each positioned stack from component-owned state. */
export const useCalibratedComponent = ({
  props,
  toasts,
  setToasts,
  heights,
  interactionState,
  setInteractionState,
  toasterListRef,
  lastFocusedElementRef,
  focusWithinToasterRef,
  collapseTimerRef,
}: TCalibrateToasterArgs) => {
  const {
    expandToggleHotkey = ["altKey", "KeyE"],
    maxVisibleToasts = DEFAULT_MAX_VISIBLE_TOASTS,
    position = DEFAULT_TOAST_POSITION,
    toastGap,
  } = props
  const { toasterExpanded, interacting } = interactionState
  // -> Keep repeated hover events from replacing an unchanged interaction state.
  const setExpanded = useCallback(
    (toasterExpanded: boolean) =>
      setInteractionState((previousState) =>
        previousState.toasterExpanded === toasterExpanded ? previousState : { ...previousState, toasterExpanded },
      ),
    [setInteractionState],
  )
  const setInteracting = useCallback(
    (interacting: boolean) =>
      setInteractionState((previousState) =>
        previousState.interacting === interacting ? previousState : { ...previousState, interacting },
      ),
    [setInteractionState],
  )
  const toastGroups = useMemo(() => {
    const positionToastsMap = new Map<TAvailableToastPositions, TToast[]>()

    toasts.forEach((currentToast) => {
      const toastPosition = currentToast.position ?? position
      const positionedToasts = positionToastsMap.get(toastPosition) ?? []

      positionToastsMap.set(toastPosition, [...positionedToasts, currentToast])
    })

    return Array.from(positionToastsMap.entries())
  }, [position, toasts])
  const handleFocus = useCallback<FocusEventHandler<HTMLOListElement>>(
    (event) => {
      const notDismissible = event.target instanceof HTMLElement && event.target.dataset.dismissable === "false"

      if (notDismissible) return

      if (!focusWithinToasterRef.current) {
        focusWithinToasterRef.current = true
        lastFocusedElementRef.current = event.relatedTarget as HTMLElement
      }
    },
    [focusWithinToasterRef, lastFocusedElementRef],
  )
  const handleBlur = useCallback<FocusEventHandler<HTMLOListElement>>(
    (event) => {
      if (focusWithinToasterRef.current && !event.currentTarget.contains(event.relatedTarget)) {
        focusWithinToasterRef.current = false
        if (lastFocusedElementRef.current) {
          lastFocusedElementRef.current.focus({ preventScroll: true })
          lastFocusedElementRef.current = null
        }
      }
    },
    [focusWithinToasterRef, lastFocusedElementRef],
  )
  const handlePointerDown = useCallback<PointerEventHandler<HTMLOListElement>>(
    (event) => {
      const notDismissible = event.target instanceof HTMLElement && event.target.dataset.dismissable === "false"

      if (notDismissible) return
      setInteracting(true)
    },
    [setInteracting],
  )
  const handlePointerUp = useCallback(() => setInteracting(false), [setInteracting])
  const requestExpand = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = null
    }
    setExpanded(true)
  }, [collapseTimerRef, setExpanded])
  const requestCollapse = useCallback(() => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
    collapseTimerRef.current = window.setTimeout(() => {
      setExpanded(false)
      collapseTimerRef.current = null
    }, 120)
  }, [collapseTimerRef, setExpanded])
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
    [setToasts],
  )
  useEffect(() => {
    if (toasts.length <= 1) setExpanded(false)
  }, [setExpanded, toasts])
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
  }, [expandToggleHotkey, setExpanded, toasterExpanded, toasterListRef])
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
  }, [focusWithinToasterRef, lastFocusedElementRef, toasterListRef])
  useEffect(
    () => () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
    },
    [collapseTimerRef],
  )

  const stacks = toastGroups.map(([toastPosition, positionedToasts]) => {
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
      toastPosition,
      positionedToasts,
      positionedHeights,
      yPosition,
      xPosition,
      gap,
      bridgeInfo,
      toastStackHeight,
      firstToastHeight,
    }
  })

  return { stacks, handleFocus, handleBlur, handlePointerDown, handlePointerUp, requestExpand, handleMouseLeave }
}
