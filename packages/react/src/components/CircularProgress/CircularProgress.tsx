"use client"

import { forwardRef, useMemo } from "react"
import { ProgressBar as AdobeProgressBar } from "react-aria-components"

import { VIEWBOX_CENTER_X, VIEWBOX_CENTER_Y } from "../../tokens/svg"

import {
  type TCircularProgressProps,
  VIEWBOX_HEIGHT,
  VIEWBOX_HEIGHT_HALF,
  VIEWBOX_WIDTH,
  calibrateComponent,
  computePathRatio,
  computePathRadius,
} from "./helpers"
import Path from "./Path/Path"

const CircularProgress = forwardRef<HTMLDivElement, TCircularProgressProps>((props, forwardedRef) => {
  const {
    "data-testid": dataTestID,
    backgroundPadding,
    circleRatio = 1,
    strokeWidth = 6,
    counterClockwise,
    backgroundColor,
    className,
    customBackgroundStyles: customBackgroundStyles__props,
    customPathStyles: customPathStyles__props,
    customStyles: customStyles__props,
    customSVGStyles,
    customTextStyles,
    customTrackStyles: customTrackStyles__props,
    height,
    order,
    pathColor,
    strokeLineCap,
    style,
    text,
    trackColor,
    width,
    ...rest
  } = props
  const {
    circularProgressStyles,
    circularProgressStyle,
    svgStyles,
    pathStyles,
    trackStyles,
    textStyles,
    backgroundStyles,
    customBackgroundStyles,
    customPathStyles,
    customTrackStyles,
  } = calibrateComponent(props)

  const pathRadius = useMemo(() => computePathRadius(props), [props])
  const pathRatio = useMemo(() => computePathRatio(props), [props])

  return (
    <AdobeProgressBar
      {...rest}
      className={circularProgressStyles}
      style={circularProgressStyle}
      data-testid={dataTestID ?? "circular-progress"}
      ref={forwardedRef}
    >
      {() => (
        <svg
          className={svgStyles}
          style={customSVGStyles}
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          data-testid="circular-progress-svg-el"
        >
          {backgroundColor ? (
            <circle
              data-testid="circular-progress-circle"
              className={backgroundStyles}
              style={{ ...customBackgroundStyles }}
              cx={VIEWBOX_CENTER_X}
              cy={VIEWBOX_CENTER_Y}
              r={VIEWBOX_HEIGHT_HALF}
            />
          ) : null}
          <Path
            data-testid="circular-progress-track"
            className={trackStyles}
            style={{ ...customTrackStyles }}
            counterClockwise={counterClockwise}
            dashRatio={circleRatio}
            pathRadius={pathRadius}
            strokeWidth={strokeWidth}
          />
          <Path
            data-testid="circular-progress-path"
            className={pathStyles}
            style={{ ...customPathStyles }}
            counterClockwise={counterClockwise}
            dashRatio={pathRatio * circleRatio}
            pathRadius={pathRadius}
            strokeWidth={strokeWidth}
          />
          {text ? (
            <text
              className={textStyles}
              style={customTextStyles}
              x={VIEWBOX_CENTER_X}
              y={VIEWBOX_CENTER_Y}
              data-testid="circular-progress-text"
            >
              {text}
            </text>
          ) : null}
        </svg>
      )}
    </AdobeProgressBar>
  )
})

CircularProgress.displayName = "CircularProgress"

export default CircularProgress
