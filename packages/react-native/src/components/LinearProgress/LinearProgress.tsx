import { forwardRef } from "react"

import { RangeIndicator } from "../RangeIndicator/RangeIndicator"

import type { TNativeLinearProgressProps, TNativeLinearProgressRef } from "./types"

export const LinearProgress = forwardRef<TNativeLinearProgressRef, TNativeLinearProgressProps>((props, ref) => (
  <RangeIndicator component="LinearProgress" indicatorProps={props} ref={ref} />
))
LinearProgress.displayName = "LinearProgress"
