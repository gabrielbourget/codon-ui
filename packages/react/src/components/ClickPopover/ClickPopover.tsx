import { forwardRef, type FC, type ForwardedRef, type PropsWithChildren } from "react"
import { Popover as AdobePopover, Dialog, OverlayArrow } from "react-aria-components"

import { calibrateComponent, type TClickPopoverProps } from "./helpers"

const ClickPopover: FC<PropsWithChildren<TClickPopoverProps>> = forwardRef(
  (props, forwardedRef: ForwardedRef<HTMLDivElement>) => {
    const {
      "data-testid": dataTestID,
      children,
      childIsDialog = true,
      className,
      color,
      customClassName,
      customDialogClassName,
      customDialogStyles,
      customOverlayArrowStyles: customOverlayArrowStyles__props,
      customStyles: customStyles__props,
      geometry,
      height,
      order,
      raised,
      showOverlayArrow = false,
      style,
      width,
      ...rest
    } = props

    const { clickPopoverStyles, overlayArrowStyles, dialogStyles, customStyles, customOverlayArrowStyles } =
      calibrateComponent(props)

    return (
      <AdobePopover
        {...rest}
        className={clickPopoverStyles}
        style={{ ...customStyles }}
        ref={forwardedRef}
        data-testid={dataTestID ?? "click-popover"}
      >
        {showOverlayArrow ? (
          <OverlayArrow
            className={overlayArrowStyles}
            style={{ ...customOverlayArrowStyles }}
            data-testid="click-popover-overlay-arrow"
          >
            <svg width={10} height={10} viewBox="0 0 10 10">
              <path d="M0 0 L5 5 L10 0" />
            </svg>
          </OverlayArrow>
        ) : undefined}
        {childIsDialog ? (
          <Dialog className={dialogStyles} style={{ ...customDialogStyles }} data-testid="click-popover-dialog">
            {children}
          </Dialog>
        ) : (
          <>{children}</>
        )}
      </AdobePopover>
    )
  },
)

export default ClickPopover
