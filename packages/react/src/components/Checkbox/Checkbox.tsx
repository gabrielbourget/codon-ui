"use client"

import React, { forwardRef, type ReactNode } from "react"
import { Checkbox as AdobeCheckbox, type CheckboxRenderProps } from "react-aria-components"

import { calibrateComponent, type TCheckboxProps } from "./helpers"

type TCheckboxChildrenRenderProps = CheckboxRenderProps & {
  defaultChildren: ReactNode | undefined
}

const Checkbox = forwardRef<HTMLLabelElement, TCheckboxProps>((props, forwardedRef) => {
  const {
    children,
    isReadOnly,
    isDisabled,
    isIndeterminate,
    showIcon = true,
    className,
    style,
    height,
    width,
    geometry,
    color,
    raised,
    order,
    enableFocusStyle,
    offsetFocusRing,
    customStyles,
    "data-testid": dataTestID,
    ...rest
  } = props

  const { checkboxStyles, checkboxStyle, shapeStyles, shapeStyle, svgStyles } = calibrateComponent(props)

  return (
    <AdobeCheckbox
      {...rest}
      isDisabled={isDisabled}
      isReadOnly={isReadOnly}
      // -> Only explicitly pass isIndeterminate when the caller provides it.
      // -> Passing isIndeterminate={undefined} would override RAC's slot-context
      //    indeterminate state (e.g., the "Select All" checkbox in a Table header),
      //    preventing [data-indeterminate] from being set on partial selection.
      {...(isIndeterminate !== undefined && { isIndeterminate })}
      ref={forwardedRef}
      className={checkboxStyles}
      style={checkboxStyle}
      data-testid={dataTestID ?? "checkbox"}
    >
      {(checkboxRenderProps) => {
        const renderedChildren =
          typeof children === "function"
            ? children({ ...checkboxRenderProps, defaultChildren: undefined } as TCheckboxChildrenRenderProps)
            : children

        return (
          <React.Fragment>
            <div className={shapeStyles} style={shapeStyle} data-testid="checkbox-shape">
              <svg className={svgStyles} viewBox="0 0 18 18" aria-hidden="true">
                {checkboxRenderProps.isIndeterminate ? (
                  <rect
                    data-icon="line"
                    x={2}
                    y={7.5}
                    width={14}
                    height={3}
                    fill="var(--checkbox-selected-foreground, var(--cui-control-selected-foreground))"
                  />
                ) : // <polyline points="1 9 7 14 15 4" />
                showIcon ? (
                  <path
                    data-icon="check"
                    d="M4 12.6111L8.92308 17.5L20 6.5"
                    strokeWidth="2"
                    strokeLinecap="butt"
                    strokeLinejoin="round"
                  ></path>
                ) : undefined}
              </svg>
            </div>
            {renderedChildren}
          </React.Fragment>
        )
      }}
    </AdobeCheckbox>
  )
})

Checkbox.displayName = "Checkbox"

export default Checkbox
