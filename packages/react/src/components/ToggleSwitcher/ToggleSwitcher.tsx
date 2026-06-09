"use client"

import classNames from "classnames"
import { LayoutGroup, motion } from "motion/react"
import { forwardRef, useId, useState } from "react"

import { DEFAULT_MICROANIMATION_DURATION } from "../../tokens/motion"

import { calibrateComponent, type TToggleSwitcherProps } from "./helpers"

const ToggleSwitcher = forwardRef<HTMLDivElement, TToggleSwitcherProps>((props, forwardedRef) => {
  const {
    "data-testid": dataTestID,
    items,
    selectedKey,
    defaultSelectedKey,
    onSelectionChange,
    isDisabled,
    isReadOnly,
    height,
    width,
    color,
    geometry,
    order,
    raised,
    enableFocusStyle,
    offsetFocusRing,
    uppercase,
    fontSize,
    optionFontWeight,
    selectedOptionFontWeight,
    customStyles: customStyles__props,
    customOptionStyles: customOptionStyles__props,
    customSelectedOptionStyles: customSelectedOptionStyles__props,
    className,
    customClassName,
    customOptionClassName,
    customSelectedOptionClassName,
    role = "group",
    style,
    ...rest
  } = props
  const firstEnabledItem = items.find((item) => !item.disabled)
  const [uncontrolledSelectedKey, setUncontrolledSelectedKey] = useState(
    defaultSelectedKey ?? firstEnabledItem?.id ?? "",
  )
  const currentSelectedKey = selectedKey ?? uncontrolledSelectedKey
  const resolvedIsDisabled = isDisabled
  const resolvedIsReadOnly = isReadOnly

  const {
    toggleSwitcherStyles,
    optionStyles,
    selectedOptionStyles,
    customStyles,
    customOptionStyles,
    customSelectedOptionStyles,
    selectedOptionLabelStyles,
    selectedOptionSurfaceStyles,
  } = calibrateComponent(props)
  const selectedSurfaceLayoutID = `${useId().replace(/:/g, "")}-toggle-switcher-selected-surface`

  const onOptionPress = (key: string, optionDisabled?: boolean) => {
    if (resolvedIsDisabled || resolvedIsReadOnly || optionDisabled || key === currentSelectedKey) return

    if (selectedKey === undefined) {
      setUncontrolledSelectedKey(key)
    }

    onSelectionChange?.(key)
  }

  return (
    <LayoutGroup id={selectedSurfaceLayoutID}>
      <div
        ref={forwardedRef}
        role={role}
        data-testid={dataTestID ?? "toggle-switcher"}
        data-disabled={resolvedIsDisabled ? "true" : undefined}
        data-readonly={resolvedIsReadOnly ? "true" : undefined}
        className={toggleSwitcherStyles}
        style={customStyles}
        {...rest}
      >
        {items.map((item) => {
          const selected = item.id === currentSelectedKey
          const optionDisabled = resolvedIsDisabled || item.disabled

          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              disabled={optionDisabled}
              data-selected={selected ? "true" : undefined}
              data-testid="toggle-switcher-option"
              className={classNames(optionStyles, selected ? selectedOptionStyles : undefined)}
              style={{
                ...customOptionStyles,
                ...(selected ? customSelectedOptionStyles : undefined),
              }}
              onClick={() => onOptionPress(item.id, item.disabled)}
            >
              {selected ? (
                <motion.span
                  aria-hidden="true"
                  className={selectedOptionSurfaceStyles}
                  data-testid="toggle-switcher-selected-surface"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  layout="position"
                  layoutId="selected-surface"
                  transition={{
                    duration: DEFAULT_MICROANIMATION_DURATION,
                    ease: "easeInOut",
                    layout: { duration: DEFAULT_MICROANIMATION_DURATION, ease: "easeInOut" },
                  }}
                />
              ) : null}
              <span className={selectedOptionLabelStyles} data-testid="toggle-switcher-option-label">
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
})

ToggleSwitcher.displayName = "ToggleSwitcher"

export default ToggleSwitcher
