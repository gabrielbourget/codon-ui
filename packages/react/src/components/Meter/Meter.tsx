"use client"

import { motion } from "motion/react"
import { forwardRef } from "react"
import { Meter as AdobeMeter } from "react-aria-components"

import type { TMeterProps } from "./helpers"
import { calibrateComponent, METER_ORIENTATION__HORIZONTAL, METER_ORIENTATION__VERTICAL } from "./helpers"

const Meter = forwardRef<HTMLDivElement, TMeterProps>((props, forwardedRef) => {
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
    orientation = METER_ORIENTATION__HORIZONTAL,
    raised,
    style,
    trackColor,
    trackGeometry,
    width,
    ...rest
  } = props

  const { meterStyles, meterStyle, barStyles, trackStyles, computedCustomBarStyles, computedCustomTrackStyles } =
    calibrateComponent(props)

  return (
    <AdobeMeter
      {...rest}
      className={meterStyles}
      style={meterStyle}
      ref={forwardedRef}
      data-testid={dataTestID ?? "meter"}
    >
      {({ percentage }) => {
        const isVertical = orientation === METER_ORIENTATION__VERTICAL

        return (
          <div style={{ ...computedCustomTrackStyles }} className={trackStyles} data-testid="meter-track">
            <motion.div
              className={barStyles}
              style={{ ...computedCustomBarStyles }}
              initial={isVertical ? { height: 0 } : { width: 0 }}
              animate={isVertical ? { height: `${percentage}%` } : { width: `${percentage}%` }}
              transition={{ ease: "easeInOut", duration: 0.25 }}
              data-testid="meter-bar"
            />
          </div>
        )
      }}
    </AdobeMeter>
  )
})

Meter.displayName = "Meter"

export default Meter
