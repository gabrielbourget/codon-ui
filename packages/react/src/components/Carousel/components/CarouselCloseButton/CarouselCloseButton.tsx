import classNames from "classnames"
import { forwardRef, type ForwardRefExoticComponent, type PropsWithChildren, type RefAttributes } from "react"

import Button from "../../../Button/Button"
import { DEFAULT_CAROUSEL_LABELS } from "../../helpers"

import type { TCarouselCloseButtonProps } from "./helpers"
import { calibrateComponent, defaultButtonProps } from "./helpers"

const CarouselCloseButton: ForwardRefExoticComponent<
  PropsWithChildren<TCarouselCloseButtonProps> & RefAttributes<HTMLButtonElement>
> = forwardRef<HTMLButtonElement, PropsWithChildren<TCarouselCloseButtonProps>>((props, ref) => {
  const { children, className, customClassName, customStyles, customButtonProps, labels, ...rest } = props
  const {
    className: defaultButtonNativeClassName,
    customClassName: defaultButtonClassName,
    customStyles: defaultButtonStyles,
    ...resolvedDefaultButtonProps
  } = defaultButtonProps
  const {
    className: customButtonNativeClassName,
    customClassName: customButtonClassName,
    customStyles: customButtonStyles,
    ...resolvedCustomButtonProps
  } = customButtonProps ?? {}
  const { defaultButtonContent } = calibrateComponent(props)

  return (
    <Button
      ref={ref}
      aria-label={labels?.closeButtonAriaLabel ?? DEFAULT_CAROUSEL_LABELS.controls.closeButtonAriaLabel}
      customClassName={classNames(
        defaultButtonClassName,
        defaultButtonNativeClassName,
        customButtonClassName,
        customButtonNativeClassName,
        customClassName,
        className,
      )}
      customStyles={{ ...defaultButtonStyles, ...customStyles, ...customButtonStyles }}
      {...resolvedDefaultButtonProps}
      {...rest}
      {...resolvedCustomButtonProps}
    >
      {children ?? defaultButtonContent}
    </Button>
  )
})

export default CarouselCloseButton
