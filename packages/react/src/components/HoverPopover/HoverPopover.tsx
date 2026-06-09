"use client"

import {
  forwardRef,
  type ForwardRefExoticComponent,
  type PropsWithChildren,
  type PropsWithoutRef,
  type RefAttributes,
} from "react"
import { OverlayArrow, Tooltip as AdobeTooltip } from "react-aria-components"

import { calibrateComponent, type THoverPopoverProps } from "./helpers"

type THoverPopoverComponent = ForwardRefExoticComponent<
  PropsWithoutRef<PropsWithChildren<THoverPopoverProps>> & RefAttributes<HTMLDivElement>
>

const HoverPopover: THoverPopoverComponent = forwardRef<HTMLDivElement, PropsWithChildren<THoverPopoverProps>>(
  (props, forwardedRef) => {
    const {
      "data-testid": dataTestID,
      children,
      className,
      color,
      customClassName,
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
    const { hoverPopoverStyles, overlayArrowStyles, customStyles, customOverlayArrowStyles } = calibrateComponent(props)

    return (
      <AdobeTooltip
        {...rest}
        className={hoverPopoverStyles}
        style={{ ...customStyles }}
        ref={forwardedRef}
        data-testid={dataTestID ?? "hover-popover"}
      >
        {showOverlayArrow ? (
          <OverlayArrow
            className={overlayArrowStyles}
            style={{ ...customOverlayArrowStyles }}
            data-testid="hover-popover-overlay-arrow"
          >
            <svg width={10} height={10} viewBox="0 0 10 10">
              <path d="M0 0 L5 5 L10 0" />
            </svg>
          </OverlayArrow>
        ) : undefined}
        {children}
      </AdobeTooltip>
    )
  },
)

HoverPopover.displayName = "HoverPopover"

export default HoverPopover
