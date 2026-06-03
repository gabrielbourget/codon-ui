"use client"

import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react"
import { Button, Tag as AdobeTagHeadless } from "react-aria-components"

import styles from "./AdobeTagStyles.module.css"
import { type TTagProps, calibrateComponent } from "./helpers"

const AdobeTag: ForwardRefExoticComponent<TTagProps & RefAttributes<HTMLDivElement>> = forwardRef<
  HTMLDivElement,
  TTagProps
>((props, forwardedRef) => {
  // Consume wrapper-only props so `...rest` stays aligned with React Aria's Tag contract.
  const {
    "data-testid": dataTestID,
    children,
    className,
    closeIcon: closeIcon__props,
    color,
    customClassName,
    customStyles: customStyles__props,
    enableFocusStyle,
    geometry,
    height,
    offsetFocusRing,
    order,
    raised,
    style,
    transparent,
    width,
    ...rest
  } = props
  const { closeIcon, tagStyles, tagStyle } = calibrateComponent(props)

  return (
    <AdobeTagHeadless
      {...rest}
      className={tagStyles}
      style={tagStyle}
      ref={forwardedRef}
      data-testid={dataTestID ?? "tag"}
    >
      {(tagRenderProps) => (
        <>
          {typeof children === "function" ? children(tagRenderProps) : children}
          {!tagRenderProps.allowsRemoving ? undefined : (
            <Button slot="remove" className={styles.tag__removeButton} data-testid="tag-remove-button">
              {closeIcon}
            </Button>
          )}
        </>
      )}
    </AdobeTagHeadless>
  )
})

export default AdobeTag
