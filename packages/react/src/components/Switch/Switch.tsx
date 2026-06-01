"use client"

import { forwardRef, useState } from "react"
import { Switch as AdobeSwitch } from "react-aria-components"

import { calibrateComponent, type TSwitchProps } from "./helpers"
import styles from "./SwitchStyles.module.css"

const Switch = forwardRef<HTMLLabelElement, TSwitchProps>((props, forwardedRef) => {
  const {
    children,
    isDisabled,
    isReadOnly,
    leftContent,
    rightContent,
    isSelected,
    defaultSelected,
    onChange,
    className,
    style,
    height,
    width,
    trackColor,
    indicatorColor,
    invertColorsOnToggle,
    showBorder,
    geometry,
    order,
    raised,
    enableFocusStyle,
    offsetFocusRing,
    iconOn,
    iconOff,
    showOnOffIcons,
    customStyles,
    customTrackStyles,
    customIndicatorStyles,
    "data-testid": dataTestID,
    ...rest
  } = props
  const [uncontrolledSelected, setUncontrolledSelected] = useState(defaultSelected ?? false)
  const selected = isSelected ?? uncontrolledSelected

  const onSelectedChange = (nextSelected: boolean) => {
    if (isSelected === undefined) {
      setUncontrolledSelected(nextSelected)
    }

    onChange?.(nextSelected)
  }

  const {
    switchStyles,
    switchStyle,
    trackStyles,
    indicatorStyles,
    customTrackStyles: trackStyle,
    customIndicatorStyles: indicatorStyle,
    shouldRenderOnOffIconSlots,
    computedIconOn,
    computedIconOff,
  } = calibrateComponent(props)

  return (
    <AdobeSwitch
      {...rest}
      isSelected={selected}
      onChange={onSelectedChange}
      isDisabled={isDisabled}
      isReadOnly={isReadOnly}
      ref={forwardedRef}
      className={switchStyles}
      style={switchStyle}
      data-testid={dataTestID ?? "switch"}
    >
      {leftContent}
      <div className={trackStyles} style={trackStyle} data-testid="switch-track">
        {shouldRenderOnOffIconSlots ? (
          <>
            <span className={styles["_switch__iconSlot--on"]} data-testid="switch-icon-on" aria-hidden="true">
              {computedIconOn}
            </span>
            <span className={styles["_switch__iconSlot--off"]} data-testid="switch-icon-off" aria-hidden="true">
              {computedIconOff}
            </span>
          </>
        ) : null}
        <div className={indicatorStyles} style={indicatorStyle} data-testid="switch-indicator"></div>
      </div>
      {rightContent}
    </AdobeSwitch>
  )
})

Switch.displayName = "Switch"

export default Switch
