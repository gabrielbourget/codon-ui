"use client"

import { forwardRef } from "react"
import { Slider as AdobeSlider, SliderOutput, SliderThumb, SliderTrack } from "react-aria-components"

import Text from "../Text/Text"

import { calibrateComponent, type TSliderProps } from "./helpers"

const Slider = forwardRef<HTMLDivElement, TSliderProps>((props, forwardedRef) => {
  const {
    "aria-labelledby": ariaLabelledBy,
    "data-testid": dataTestID,
    children: _children,
    className,
    customLabelStyles,
    customOutputFormatter,
    customOutputStyles,
    customStyles: customStyles__props,
    customThumbStyles: customThumbStyles__props,
    customTrackStyles: _customTrackStyles__props,
    enableFocusStyle,
    geometry,
    height,
    isDisabled,
    label,
    labelID,
    maxWidth,
    offsetFocusRing,
    order,
    raised,
    style,
    thumbAriaLabels,
    thumbColor,
    thumbNames,
    trackColor,
    width,
    ...rest
  } = props

  const { sliderStyles, sliderStyle, outputStyles, trackStyles, thumbStyles, customTrackStyles, customThumbStyles } =
    calibrateComponent(props)

  return (
    <AdobeSlider
      {...rest}
      isDisabled={isDisabled}
      aria-labelledby={labelID ?? ariaLabelledBy}
      ref={forwardedRef}
      className={sliderStyles}
      style={sliderStyle}
      data-testid={dataTestID ?? "slider"}
    >
      <Text
        elementType="label"
        variant="b11"
        customStyles={Object.assign({ gridArea: "label" }, { ...customLabelStyles })}
        id={labelID ? labelID : undefined}
        data-sliderlabel
        data-testid="slider-label"
      >
        {label}
      </Text>
      <SliderOutput className={outputStyles} style={customOutputStyles} data-slideroutput data-testid="slider-output">
        {({ state }) => {
          return customOutputFormatter
            ? customOutputFormatter(state.values)
            : state.values.map((_, i) => state.getThumbValueLabel(i)).join(" – ")
        }}
      </SliderOutput>
      <SliderTrack className={trackStyles} style={customTrackStyles} data-testid="slider-track">
        {({ state }) =>
          state.values.map((_, i) => (
            <SliderThumb
              data-testid={`slider-thumb-${i + 1}`}
              className={thumbStyles}
              style={{ ...customThumbStyles }}
              key={i}
              index={i}
              aria-label={thumbAriaLabels?.[i] || `Slider Thumb ${i + 1}`}
              name={thumbNames ? thumbNames[i] : undefined}
            />
          ))
        }
      </SliderTrack>
    </AdobeSlider>
  )
})

Slider.displayName = "Slider"

export default Slider
