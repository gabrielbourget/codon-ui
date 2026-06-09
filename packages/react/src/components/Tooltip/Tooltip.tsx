"use client"

import {
  forwardRef,
  type ForwardRefExoticComponent,
  type PropsWithChildren,
  type PropsWithoutRef,
  type RefAttributes,
} from "react"
import { OverlayArrow, Tooltip as AdobeTooltip } from "react-aria-components"

import { calibrateComponent, type TTooltipProps } from "./helpers"

type TTooltipComponent = ForwardRefExoticComponent<
  PropsWithoutRef<PropsWithChildren<TTooltipProps>> & RefAttributes<HTMLDivElement>
>

const Tooltip: TTooltipComponent = forwardRef<HTMLDivElement, PropsWithChildren<TTooltipProps>>(
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
      showOverlayArrow = true,
      style,
      width,
      ...rest
    } = props

    const { tooltipStyles, overlayArrowStyles, customStyles, customOverlayArrowStyles } = calibrateComponent(props)

    return (
      <AdobeTooltip
        {...rest}
        ref={forwardedRef}
        className={tooltipStyles}
        style={{ ...customStyles }}
        data-testid={dataTestID ?? "tooltip"}
      >
        {showOverlayArrow ? (
          <OverlayArrow className={overlayArrowStyles} style={{ ...customOverlayArrowStyles }}>
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

Tooltip.displayName = "Tooltip"

export default Tooltip
