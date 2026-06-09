"use client"

import { motion } from "motion/react"
import { forwardRef } from "react"
import { ProgressBar as AdobeProgressBar } from "react-aria-components"

import type { TLinearProgressProps } from "./helpers"
import {
  calibrateComponent,
  LINEAR_PROGRESS_ORIENTATION__HORIZONTAL,
  LINEAR_PROGRESS_ORIENTATION__VERTICAL,
} from "./helpers"

const LinearProgress = forwardRef<HTMLDivElement, TLinearProgressProps>((props, forwardedRef) => {
  const {
    "data-testid": dataTestID,
    barColor,
    barGeometry,
    className,
    customBarStyles: customBarStyles__props,
    customStyles: customStyles__props,
    customTrackStyles: customTrackStyles__props,
    direction,
    height,
    order,
    orientation = LINEAR_PROGRESS_ORIENTATION__HORIZONTAL,
    raised,
    style,
    trackColor,
    trackGeometry,
    width,
    ...rest
  } = props

  const { linearProgressStyles, linearProgressStyle, barStyles, trackStyles, customBarStyles, customTrackStyles } =
    calibrateComponent(props)

  return (
    <AdobeProgressBar
      {...rest}
      className={linearProgressStyles}
      style={linearProgressStyle}
      data-testid={dataTestID ?? "linear-progress"}
      ref={forwardedRef}
    >
      {({ percentage }) => {
        const resolvedPercentage = percentage ?? 0
        const isVertical = orientation === LINEAR_PROGRESS_ORIENTATION__VERTICAL

        return (
          <div style={{ ...customTrackStyles }} className={trackStyles} data-testid="linear-progress-track">
            <motion.div
              className={barStyles}
              style={{ ...customBarStyles }}
              data-testid="linear-progress-bar"
              initial={isVertical ? { height: 0 } : { width: 0 }}
              animate={isVertical ? { height: `${resolvedPercentage}%` } : { width: `${resolvedPercentage}%` }}
              transition={{ ease: "easeInOut", duration: 0.25 }}
            />
          </div>
        )
      }}
    </AdobeProgressBar>
  )
})

LinearProgress.displayName = "LinearProgress"

export default LinearProgress
