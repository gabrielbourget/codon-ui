"use client"

import classNames from "classnames"
import { useCallback, useState, type CSSProperties, type FC } from "react"

import {
  DEFAULT_MAX_VISIBLE_TOASTS,
  DEFAULT_TOAST_WIDTH,
  DEFAULT_VIEWPORT_OFFSET,
  useCalibratedComponent,
  type TExternalToast,
  type TToasterInteractionState,
  type TToasterProps,
} from "./helpers"
import { toast } from "./stateManagement"
import type { TToast, TToastHeightInfo } from "./Toast/helpers"
import Toast from "./Toast/Toast"
import styles from "./ToasterStyles.module.css"

const { toasterRoot, toaster, toaster__toastBridgeDiv } = styles

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
    className,
    customClassName,
    customRootStyles,
    customStackClassName,
    customStackStyles,
    customStyles,
    customToastBridgeClassName,
    customToastBridgeStyles,
    dismissalHotkey = ["Escape"],
    duration,
    expandByDefault = false,
    expandToggleHotkey = ["altKey", "KeyE"],
    maxVisibleToasts = DEFAULT_MAX_VISIBLE_TOASTS,
    offset = DEFAULT_VIEWPORT_OFFSET,
    pauseWhenPageIsHidden = true,
    position: _position,
    style,
    toastGap,
    toastLabels,
    ...nativeProps
  } = props
  const [toasts, setToasts] = useState<TToast[]>([])
  const [heights, setHeights] = useState<TToastHeightInfo[]>([])
  const [interactionState, setInteractionState] = useState<TToasterInteractionState>({
    toasterExpanded: false,
    interacting: false,
  })
  const { toasterExpanded, interacting } = interactionState
  const removeToast = useCallback(
    (toastToRemove: TToast) => setToasts((currentToasts) => currentToasts.filter(({ id }) => id !== toastToRemove.id)),
    [],
  )
  const {
    toasterListRef,
    stacks,
    handleFocus,
    handleBlur,
    handlePointerDown,
    handlePointerUp,
    requestExpand,
    handleMouseLeave,
  } = useCalibratedComponent({
    props,
    toasts,
    setToasts,
    heights,
    interactionState,
    setInteractionState,
  })
  const hotkeyLabel = expandToggleHotkey.join("+").replace(/Key/g, "").replace(/Digit/g, "")
  const rootAriaLabel = ariaLabel ?? ariaLabelAlias ?? "Notifications Toaster"
  const toasterRootStyles = classNames(toasterRoot, customClassName, className)
  const toasterStyles = classNames(toaster, customStackClassName)
  const toastBridgeStyles = classNames(toaster__toastBridgeDiv, customToastBridgeClassName)

  if (!toasts.length) return null

  return (
    <section
      {...nativeProps}
      aria-label={`${rootAriaLabel} - ${hotkeyLabel}`}
      aria-labelledby={ariaLabelledBy ?? ariaLabelledByAlias}
      aria-describedby={ariaDescribedBy ?? ariaDescribedByAlias}
      aria-details={ariaDetails ?? ariaDetailsAlias}
      tabIndex={-1}
      className={toasterRootStyles}
      style={{ ...customRootStyles, ...style }}
      data-testid={dataTestID ?? "toaster"}
    >
      {stacks.map(
        ({
          toastPosition,
          positionedToasts,
          positionedHeights,
          yPosition,
          xPosition,
          gap,
          bridgeInfo,
          toastStackHeight,
          firstToastHeight,
        }) => (
          <ol
            key={toastPosition}
            tabIndex={-1}
            ref={toasterListRef}
            data-y-position={yPosition}
            data-x-position={xPosition}
            data-expanded={toasterExpanded}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onMouseEnter={requestExpand}
            onMouseMove={requestExpand}
            onMouseLeave={handleMouseLeave}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            style={
              {
                "--firstToastHeight": `${firstToastHeight}px`,
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
            {positionedToasts.map((currentToast, index) => (
              <Toast
                key={currentToast.id}
                dismissalHotkey={dismissalHotkey}
                duration={duration}
                expandByDefault={expandByDefault}
                heights={positionedHeights}
                index={index}
                interacting={interacting}
                maxVisibleToasts={maxVisibleToasts}
                numToasts={positionedToasts.length}
                pauseWhenPageIsHidden={pauseWhenPageIsHidden}
                position={toastPosition}
                removeToast={removeToast}
                setHeights={setHeights}
                toast={currentToast}
                toastGap={toastGap}
                toasterExpanded={toasterExpanded}
                toastLabels={toastLabels}
              />
            ))}

            {/* Ghost hover bridges to maintain expanded toaster state when moving cursor between toasts. */}
            {bridgeInfo.map(({ key, offset: bridgeOffset }) => (
              <div
                key={key}
                className={toastBridgeStyles}
                aria-hidden
                style={
                  {
                    "--bridgeOffset": `${bridgeOffset}px`,
                    "--toastGap": `${gap}px`,
                    ...customToastBridgeStyles,
                  } as CSSProperties
                }
                onMouseEnter={requestExpand}
                onMouseMove={requestExpand}
              />
            ))}
          </ol>
        ),
      )}
    </section>
  )
}

export { Toaster, toast, type TExternalToast, type TToast }
export default Toaster
