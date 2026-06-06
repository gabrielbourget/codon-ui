"use client"

import {
  forwardRef,
  type ForwardRefExoticComponent,
  type KeyboardEvent,
  type MouseEvent,
  type RefAttributes,
} from "react"

import { calibrateComponent, type TLinkProps } from "./helpers"

const Link: ForwardRefExoticComponent<TLinkProps & RefAttributes<HTMLAnchorElement>> = forwardRef<
  HTMLAnchorElement,
  TLinkProps
>((props, forwardedRef) => {
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
    color,
    customClassName,
    customStyles: customStyles__props,
    enableFocusStyle,
    href,
    isDisabled = false,
    offsetFocusRing,
    onContextMenu,
    onClick,
    onKeyDown,
    order,
    referrerPolicy = "no-referrer",
    rel = "noopener noreferrer nofollow",
    style,
    tabIndex,
    target = "_self",
    textDecoration,
    children,
    ...rest
  } = props

  const { linkStyles, customStyles } = calibrateComponent(props)
  const resolvedIsDisabled = isDisabled

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (resolvedIsDisabled) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    onClick?.(e)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLAnchorElement>) => {
    if (resolvedIsDisabled && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault()
      e.stopPropagation()
    }

    onKeyDown?.(e)
  }

  const handleContextMenu = (e: MouseEvent<HTMLAnchorElement>) => {
    if (resolvedIsDisabled) {
      e.preventDefault()
      return
    }

    onContextMenu?.(e)
  }

  return (
    <a
      {...rest}
      href={href}
      target={target}
      ref={forwardedRef}
      rel={rel}
      referrerPolicy={referrerPolicy}
      className={linkStyles}
      style={customStyles}
      aria-label={ariaLabel ?? ariaLabelAlias}
      aria-labelledby={ariaLabelledBy ?? ariaLabelledByAlias}
      aria-describedby={ariaDescribedBy ?? ariaDescribedByAlias}
      aria-details={ariaDetails ?? ariaDetailsAlias}
      aria-disabled={resolvedIsDisabled || undefined}
      data-disabled={resolvedIsDisabled ? "true" : undefined}
      tabIndex={resolvedIsDisabled ? -1 : tabIndex}
      draggable={resolvedIsDisabled ? false : rest.draggable}
      data-testid={dataTestID ?? "link"}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
    >
      {children}
    </a>
  )
})

Link.displayName = "Link"

export default Link
