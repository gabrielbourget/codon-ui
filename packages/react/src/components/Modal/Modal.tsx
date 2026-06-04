import classNames from "classnames"
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
import textStyles from "../Text/TextStyles.module.css"

import { calibrateComponent, type TModalProps } from "./helpers"

type TModalComponent = ForwardRefExoticComponent<
  PropsWithoutRef<PropsWithChildren<TModalProps>> & RefAttributes<HTMLDivElement>
>

// -> Starter primitive for app-specific modal compositions. AlertDialog is intentionally out of this source slice.
const Modal: TModalComponent = forwardRef<HTMLDivElement, PropsWithChildren<TModalProps>>((props, forwardedRef) => {
  const {
    "aria-describedby": ariaDescribedByProp,
    "aria-details": ariaDetailsProp,
    "aria-label": ariaLabelProp,
    "aria-labelledby": ariaLabelledByProp,
    "data-testid": dataTestID,
    isDismissable = true,
    isKeyboardDismissDisabled = false,
    children,
    className,
    closeButtonText = "Close Modal",
    color,
    customClassName,
    customDialogClassName,
    customDialogStyles,
    customOverlayClassName,
    customOverlayStyles,
    customStyles: customStyles__props,
    dialogRole = "dialog",
    geometry,
    height,
    order,
    overlayBlur,
    raised,
    style,
    titleText = "Modal Title",
    width,
    ariaDescribedBy,
    ariaDetails,
    ariaLabel,
    ariaLabelledBy,
    ...rest
  } = props

  const { overlayStyles, modalStyles, dialogStyles, customStyles, color_white } = calibrateComponent(props)
  const resolvedAriaLabel = ariaLabelProp ?? ariaLabel
  const resolvedAriaLabelledBy = ariaLabelledByProp ?? ariaLabelledBy
  const resolvedAriaDescribedBy = ariaDescribedByProp ?? ariaDescribedBy
  const resolvedAriaDetails = ariaDetailsProp ?? ariaDetails

  return (
    <ModalOverlay className={overlayStyles} style={customOverlayStyles} data-testid="modal-overlay">
      <AdobeModal
        {...rest}
        className={modalStyles}
        style={{ ...customStyles }}
        ref={forwardedRef}
        isDismissable={isDismissable}
        isKeyboardDismissDisabled={isKeyboardDismissDisabled}
        data-testid={dataTestID ?? "modal"}
      >
        <Dialog
          role={dialogRole}
          aria-label={resolvedAriaLabel}
          aria-labelledby={resolvedAriaLabelledBy}
          aria-describedby={resolvedAriaDescribedBy}
          aria-details={resolvedAriaDetails}
          className={dialogStyles}
          style={Object.assign({ height: 150, width: 200 }, { ...customDialogStyles })}
        >
          {({ close: closeModal }) =>
            children ?? (
              <>
                <Header className={classNames(textStyles["b8"], textStyles["fw-bold"])}>{titleText}</Header>
                <Text>Placeholder text</Text>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    alignItems: "flex-end",
                  }}
                >
                  <Button order="primary" onPress={closeModal}>
                    <Text variant="b11" color={color_white}>
                      {closeButtonText}
                    </Text>
                  </Button>
                </div>
              </>
            )
          }
        </Dialog>
      </AdobeModal>
    </ModalOverlay>
  )
})

Modal.displayName = "Modal"

export default Modal
