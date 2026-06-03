import { forwardRef } from "react"

import CircularProgress from "../CircularProgress/CircularProgress"
import Text from "../Text/Text"

import type { TCounterProps } from "./helpers"
import { calibrateComponent } from "./helpers"

const Counter = forwardRef<HTMLDivElement, TCounterProps>((props, forwardedRef) => {
  const {
    "aria-describedby": ariaDescribedByProp,
    "aria-details": ariaDetailsProp,
    "aria-label": ariaLabelProp,
    "aria-labelledby": ariaLabelledByProp,
    "data-testid": dataTestID,
    value,
    showMaxValue,
    maxValue,
    showProgressIndicator,
    children,
    ariaLabel,
    ariaLabelledBy,
    ariaDescribedBy,
    ariaDetails,
    className,
    customProgressIndicatorStyles: customProgressIndicatorStyles__props,
    customTextStyles: customTextStyles__props,
    customStyles: customStyles__props,
    customClassName: customClassName__props,
    color,
    errorOrDangerPercentageThreshold,
    height,
    style,
    warningPercentageThreshold,
    width,
    ...rest
  } = props

  const { counterStyles, textRowStyles, counterStyle, customProgressIndicatorStyles, customTextStyles, statusColor } =
    calibrateComponent(props)
  const resolvedAriaLabel = ariaLabelProp ?? ariaLabel
  const resolvedAriaLabelledBy = ariaLabelledByProp ?? ariaLabelledBy
  const resolvedAriaDescribedBy = ariaDescribedByProp ?? ariaDescribedBy
  const resolvedAriaDetails = ariaDetailsProp ?? ariaDetails

  return (
    <div
      {...rest}
      ref={forwardedRef}
      className={counterStyles}
      style={counterStyle}
      data-testid={dataTestID ?? "counter"}
      aria-label={resolvedAriaLabel}
      aria-labelledby={resolvedAriaLabelledBy}
      aria-describedby={resolvedAriaDescribedBy}
      aria-details={resolvedAriaDetails}
    >
      {showProgressIndicator && maxValue ? (
        <CircularProgress
          height={12}
          width={12}
          value={(Number(value) / Number(maxValue)) * 100}
          pathColor={statusColor}
          customStyles={{ ...customProgressIndicatorStyles }}
          data-progressindicator
          aria-label={resolvedAriaLabel ? `${resolvedAriaLabel} Progress` : "Progress"}
          aria-labelledby={resolvedAriaLabelledBy}
        />
      ) : undefined}
      <div className={textRowStyles}>
        <Text data-countervalue customStyles={customTextStyles}>
          {value}
        </Text>
        {showMaxValue && maxValue ? (
          <Text data-maxvalue customStyles={customTextStyles}>{`/${maxValue}`}</Text>
        ) : undefined}
      </div>
      {children}
    </div>
  )
})

Counter.displayName = "Counter"

export default Counter
