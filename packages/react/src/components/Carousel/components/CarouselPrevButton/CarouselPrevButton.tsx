import classNames from "classnames"
import { forwardRef, type ForwardRefExoticComponent, type PropsWithChildren, type RefAttributes } from "react"

import Button from "../../../Button/Button"
import { useCarouselContext } from "../../helpers"

import CarouselDefaultPrevIcon from "./DefaultPrevIcon"
import { defaultButtonProps, type TCarouselPrevButtonProps } from "./helpers"

const CarouselPrevButton: ForwardRefExoticComponent<
  PropsWithChildren<TCarouselPrevButtonProps> & RefAttributes<HTMLButtonElement>
> = forwardRef<HTMLButtonElement, PropsWithChildren<TCarouselPrevButtonProps>>((props, ref) => {
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
  const { canScrollPrev, scrollPrev, labels: carouselLabels } = useCarouselContext()

  return (
    <Button
      ref={ref}
      onPress={scrollPrev}
      isDisabled={!canScrollPrev}
      aria-label={labels?.previousItemButtonAriaLabel ?? carouselLabels.controls.previousItemButtonAriaLabel}
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
      {children ?? <CarouselDefaultPrevIcon size={20} />}
    </Button>
  )
})

export default CarouselPrevButton
