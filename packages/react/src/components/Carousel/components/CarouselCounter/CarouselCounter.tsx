import classNames from "classnames"
import type { FC } from "react"

import Counter from "../../../Counter/Counter"
import Text from "../../../Text/Text"
import { useCarouselContext } from "../../helpers"

import styles from "./CarouselCounterStyles.module.css"
import type { TCarouselCounterProps } from "./helpers"

const CarouselCounter: FC<TCarouselCounterProps> = (props) => {
  const {
    className,
    counterText,
    labels,
    customCounterProps,
    customTextProps,
    customCounterClassName,
    customCounterTextClassName,
    customTextClassName,
    customClassName,
    customCounterStyles,
    customTextStyles,
    customStyles,
    style,
  } = props
  const { selectedIndex, itemCount, labels: carouselLabels } = useCarouselContext()
  const resolvedCounterText = counterText ?? labels?.counterText ?? carouselLabels.counter.counterText
  const resolvedAriaLabel = labels?.ariaLabel ?? carouselLabels.counter.ariaLabel
  const counterWrapperStyles = { ...customStyles, ...style }
  const counterTextClassName = classNames(customTextClassName, customCounterTextClassName)

  return (
    <div
      key="carousel-counter"
      data-testid="carousel-counter"
      className={classNames(styles.carouselCounter, customClassName, className)}
      style={counterWrapperStyles}
    >
      <Counter
        aria-label={resolvedAriaLabel}
        value={selectedIndex + 1}
        maxValue={itemCount}
        showMaxValue
        customClassName={customCounterClassName}
        customStyles={customCounterStyles}
        {...customCounterProps}
      >
        {resolvedCounterText ? (
          <Text customClassName={counterTextClassName} customStyles={customTextStyles} {...customTextProps}>
            {resolvedCounterText}
          </Text>
        ) : null}
      </Counter>
    </div>
  )
}

export default CarouselCounter
