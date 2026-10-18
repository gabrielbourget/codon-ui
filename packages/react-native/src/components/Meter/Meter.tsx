import { forwardRef } from "react"

import { RangeIndicator } from "../RangeIndicator/RangeIndicator"

import type { TNativeMeterProps, TNativeMeterRef } from "./types"

export const Meter = forwardRef<TNativeMeterRef, TNativeMeterProps>((props, ref) => (
  <RangeIndicator component="Meter" indicatorProps={props} ref={ref} />
))
Meter.displayName = "Meter"
