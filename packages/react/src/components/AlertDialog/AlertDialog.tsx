"use client"

import {
  forwardRef,
  type ForwardRefExoticComponent,
  type PropsWithChildren,
  type PropsWithoutRef,
  type RefAttributes,
} from "react"
import { Modal as AdobeModal, Dialog, Header, ModalOverlay } from "react-aria-components"

import Button from "../Button/Button"
import Text from "../Text/Text"

import type { TAlertDialogProps } from "./helpers"
import { calibrateComponent } from "./helpers"
import { resolveAlertDialogLabels } from "./labels"

type TAlertDialogComponent = ForwardRefExoticComponent<
  PropsWithoutRef<PropsWithChildren<TAlertDialogProps>> & RefAttributes<HTMLDivElement>
>

const AlertDialog: TAlertDialogComponent = forwardRef<HTMLDivElement, PropsWithChildren<TAlertDialogProps>>(
  (props, forwardedRef) => {
    const {
      "aria-describedby": ariaDescribedByProp,
      "aria-details": ariaDetailsProp,
      "aria-label": ariaLabelProp,
      "aria-labelledby": ariaLabelledByProp,
      "data-testid": dataTestID,
      isDismissable = true,
      isKeyboardDismissDisabled = false,
      className,
      customClassName,
      customDialogClassName,
      customOverlayStyles,
      customDialogStyles,
      customStyles: customStyles__props,
      customOverlayClassName,
      showCancelAction = true,
      AlertIcon: AlertIcon__props,
      cancelAction,
      cancelActionBtnText,
      confirmAction,
      confirmActionBtnText,
      labels,
      titleText,
      bodyText,
      children,
      geometry,
      height,
      overlayBlur,
      raised,
      style,
      type,
      width,
      ariaDescribedBy,
      ariaDetails,
      ariaLabel,
      ariaLabelledBy,
      ...rest
    } = props

    const {
      overlayStyles,
      modalStyles,
      topRibbonStyles,
      dialogStyles,
      iconCircleStyles,
      headerStyles,
      buttonRowStyles,
      customStyles,
      alertColor,
      AlertIcon,
    } = calibrateComponent(props)
    const resolvedLabels = resolveAlertDialogLabels({ labels, cancelActionBtnText, confirmActionBtnText })
    const resolvedAriaLabel = ariaLabelProp ?? ariaLabel
    const resolvedAriaLabelledBy = ariaLabelledByProp ?? ariaLabelledBy
    const resolvedAriaDescribedBy = ariaDescribedByProp ?? ariaDescribedBy
    const resolvedAriaDetails = ariaDetailsProp ?? ariaDetails

    return (
      <ModalOverlay className={overlayStyles} style={customOverlayStyles}>
        <AdobeModal
          {...rest}
          className={modalStyles}
          style={customStyles}
          ref={forwardedRef}
          isDismissable={isDismissable}
          isKeyboardDismissDisabled={isKeyboardDismissDisabled}
          data-testid={dataTestID ?? "alert-dialog"}
        >
          <div className={topRibbonStyles}></div>
          <Dialog
            role="alertdialog"
            aria-label={resolvedAriaLabel}
            aria-labelledby={resolvedAriaLabelledBy}
            aria-describedby={resolvedAriaDescribedBy}
            aria-details={resolvedAriaDetails}
            className={dialogStyles}
            style={customDialogStyles}
          >
            {({ close: closeModal }) => (
              <>
                <div className={iconCircleStyles}>{AlertIcon}</div>
                <Header data-testid="dialog-header" className={headerStyles}>
                  {titleText}
                </Header>
                <Text data-testid="dialog-body">{bodyText}</Text>
                {children}
                <div className={buttonRowStyles}>
                  {showCancelAction ? (
                    <Button
                      order="primary"
                      aria-label={resolvedLabels.cancelActionButtonAriaLabel}
                      onPress={() => {
                        cancelAction?.()
                        closeModal()
                      }}
                      transparent
                      raised={false}
                    >
                      <Text fontWeight="bold" color={alertColor} customStyles={{ textDecoration: "underline" }}>
                        {resolvedLabels.cancelActionButton}
                      </Text>
                    </Button>
                  ) : undefined}
                  <Button
                    order="primary"
                    aria-label={resolvedLabels.confirmActionButtonAriaLabel}
                    raised={false}
                    color={alertColor}
                    onPress={() => {
                      confirmAction?.()
                      closeModal()
                    }}
                  >
                    <Text fontWeight="bold" color="var(--aui-control-selected-foreground)">
                      {resolvedLabels.confirmActionButton}
                    </Text>
                  </Button>
                </div>
              </>
            )}
          </Dialog>
        </AdobeModal>
      </ModalOverlay>
    )
  },
)

AlertDialog.displayName = "AlertDialog"

export default AlertDialog
