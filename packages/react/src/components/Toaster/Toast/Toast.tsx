"use client"

import { useRef, useState, type FC } from "react"
import { Heading } from "react-aria-components"

import Button from "../../Button/Button"
import Text from "../../Text/Text"

import { ToastDefaultCloseIcon } from "./DefaultToastIcons"
import {
  computeToastDateTimeString,
  initState,
  useCalibratedComponent,
  type TToastProps,
  type TToastState,
} from "./helpers"
import styles from "./ToastStyles.module.css"

const { "toast__icon--white": whiteIconStyles } = styles

const Toast: FC<TToastProps> = (props: TToastProps) => {
  const {
    index,
    toasterExpanded,
    expandByDefault = false,
    toast: {
      dismissable = true,
      type = "info",
      titleText = "Placeholder Title Text",
      bodyText = "Placeholder body text",
      CloseIcon,
      showButtons = true,
      showCancelAction = true,
      customTopRibbonStyles,
      customTopRibbonLeftContentStyles,
      customTitleStyles,
      customContentStyles,
      customBottomRowStyles,
      customButtonRowStyles,
    },
  } = props
  const [state, setState] = useState<TToastState>(initState)
  const { mounted, removed, dragging, draggingOut, color_white } = state
  const [isDocumentHidden, setIsDocumentHidden] = useState(false)
  const internalToastRef = useRef<HTMLLIElement>(null)
  const dragStartTimeRef = useRef<Date | null>(null)
  const closeTimerStartTimeRef = useRef(0)
  const lastCloseTimerStartTimeRef = useRef(0)
  const offsetRef = useRef(0)
  const pointerStartCoordsRef = useRef<{ x: number; y: number } | null>(null)
  const {
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
    toastIcon,
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
  } = useCalibratedComponent({
    props,
    state,
    setState,
    isDocumentHidden,
    setIsDocumentHidden,
    internalToastRef,
    dragStartTimeRef,
    closeTimerStartTimeRef,
    lastCloseTimerStartTimeRef,
    offsetRef,
    pointerStartCoordsRef,
  })

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
      style={rootStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className={topRibbonStyles} style={customTopRibbonStyles}>
        <div className={topRibbonLeftContentStyles} style={customTopRibbonLeftContentStyles}>
          {toastIcon}
          <Heading slot="title" style={{ color: color_white, ...customTitleStyles }} className={headerStyles}>
            {titleText}
          </Heading>
        </div>
        {dismissable ? (
          <Button
            {...closeButtonProps}
            aria-label={resolvedLabels.closeButtonAriaLabel}
            raised={false}
            onPress={handleClose}
          >
            {CloseIcon ?? (
              <ToastDefaultCloseIcon
                customClassName={whiteIconStyles}
                size={15}
                data-testid="toast-default-close-icon"
              />
            )}
          </Button>
        ) : undefined}
      </div>
      <div className={toastContentStyles} style={customContentStyles}>
        <Text variant="b11" {...bodyTextProps}>
          {bodyText}
        </Text>
        <div className={bottomRowStyles} style={customBottomRowStyles}>
          <Text variant="b13" color={color__neutral_4} {...timestampTextProps}>
            {computeToastDateTimeString()}
          </Text>
          <div className={buttonRowStyles} style={customButtonRowStyles}>
            {showButtons ? (
              <>
                {showCancelAction ? (
                  <Button
                    {...cancelButtonProps}
                    order="primary"
                    aria-label={resolvedLabels.cancelActionButtonAriaLabel}
                    onPress={handleCancel}
                    transparent
                    raised={false}
                  >
                    <Text fontWeight="bold" color={toastColor} customStyles={{ textDecoration: "underline" }}>
                      {resolvedLabels.cancelActionButton}
                    </Text>
                  </Button>
                ) : null}
                <Button
                  {...confirmButtonProps}
                  raised={false}
                  aria-label={resolvedLabels.confirmActionButtonAriaLabel}
                  color={toastColor}
                  onPress={handleConfirm}
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
