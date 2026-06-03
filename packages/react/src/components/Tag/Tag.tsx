"use client"

import type { FC, PropsWithChildren } from "react"

import { type TTagProps, calibrateComponent, isPressable } from "./helpers"

const Tag: FC<PropsWithChildren<TTagProps>> = (props) => {
  const { tagStyles, tagStyle } = calibrateComponent(props)

  // -> Interactive Tag
  if (isPressable(props)) {
    const {
      "aria-label": ariaLabel,
      "aria-pressed": ariaPressed,
      activeBorder,
      activeColor,
      backgroundColorTransition,
      children,
      className,
      customClassName,
      customStyles: customStyles__props,
      focusOutline,
      geometry,
      height,
      hoverCursor,
      id,
      inactiveBorder,
      inactiveColor,
      isDisabled,
      isPressed,
      onPress,
      outlineOffset,
      pressable,
      raised,
      raisedOnHover,
      style,
      width,
      ...rest
    } = props

    return (
      <button
        {...rest}
        id={id === undefined ? undefined : String(id)}
        type="button"
        className={tagStyles}
        style={tagStyle}
        onClick={() => onPress(id)}
        aria-label={ariaLabel}
        aria-pressed={ariaPressed ?? isPressed}
        disabled={isDisabled}
        data-disabled={isDisabled ? "true" : undefined}
        data-testid="tag"
      >
        {children}
      </button>
    )
  }

  // -> Static Tag
  const {
    "aria-label": ariaLabel,
    "aria-live": ariaLive = "off",
    backgroundColorTransition,
    border,
    children,
    className,
    color,
    customClassName,
    customStyles: customStyles__props,
    focusOutline,
    geometry,
    height,
    hoverCursor,
    id,
    outlineOffset,
    pressable,
    raised,
    raisedOnHover,
    role = "status",
    style,
    width,
    ...rest
  } = props

  return (
    <span
      {...rest}
      id={id === undefined ? undefined : String(id)}
      role={role}
      aria-live={ariaLive}
      className={tagStyles}
      style={tagStyle}
      aria-label={ariaLabel}
      data-testid="tag"
    >
      {children}
    </span>
  )
}

export default Tag
