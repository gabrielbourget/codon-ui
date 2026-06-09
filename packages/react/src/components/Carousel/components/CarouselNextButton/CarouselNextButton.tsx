import classNames from "classnames"
import { forwardRef, type ForwardRefExoticComponent, type PropsWithChildren, type RefAttributes } from "react"

import Button from "../../../Button/Button"
import { useCarouselContext } from "../../helpers"

import { calibrateComponent, defaultButtonProps, type TCarouselNextButtonProps } from "./helpers"

const CarouselNextButton: ForwardRefExoticComponent<
  PropsWithChildren<TCarouselNextButtonProps> & RefAttributes<HTMLButtonElement>
> = forwardRef<HTMLButtonElement, PropsWithChildren<TCarouselNextButtonProps>>((props, ref) => {
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
  const { canScrollNext, scrollNext, labels: carouselLabels } = useCarouselContext()
  const { defaultButtonContent } = calibrateComponent(props)

  return (
    <Button
      ref={ref}
      onPress={scrollNext}
      isDisabled={!canScrollNext}
      aria-label={labels?.nextItemButtonAriaLabel ?? carouselLabels.controls.nextItemButtonAriaLabel}
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

export default CarouselNextButton
