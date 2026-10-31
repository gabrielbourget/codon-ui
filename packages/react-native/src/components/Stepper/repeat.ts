import { useLayoutEffect, useRef } from "react"

import type { useNumberInputState } from "../NumberInput/state"

export const useStepperRepeat = (numeric: ReturnType<typeof useNumberInputState>, blocked: boolean) => {
  const configuration = numeric.configurationKey
  const latest = useRef({ numeric, blocked })
  latest.current = { numeric, blocked }
  const hold = useRef<{ direction?: -1 | 1; repeated: boolean; timer?: ReturnType<typeof setTimeout> }>({
    repeated: false,
  })
  const previous = useRef({ configuration, value: numeric.value })
  const stop = () => {
    clearTimeout(hold.current.timer)
    hold.current.timer = undefined
    hold.current.direction = undefined
    latest.current.numeric.pressEnd()
  }
  useLayoutEffect(() => {
    const direction = hold.current.direction
    if (
      direction !== undefined &&
      (blocked ||
        previous.current.configuration !== configuration ||
        (!hold.current.repeated && previous.current.value !== numeric.value) ||
        !(direction === 1 ? numeric.canIncrement : numeric.canDecrement))
    ) {
      hold.current.repeated = true
      stop()
    }
    previous.current = { configuration, value: numeric.value }
  })
  useLayoutEffect(() => stop, [])
  return {
    start: (direction: -1 | 1) => {
      stop()
      if (latest.current.blocked) return
      hold.current = { direction, repeated: false }
      numeric.pressStart()
      const tick = () => {
        const current = latest.current
        if (
          hold.current.direction !== direction ||
          current.blocked ||
          !(direction === 1 ? current.numeric.canIncrement : current.numeric.canDecrement)
        )
          return
        const first = !hold.current.repeated
        hold.current.repeated = true
        current.numeric.step(direction, first)
        if (hold.current.direction === direction) hold.current.timer = setTimeout(tick, 60)
      }
      hold.current.timer = setTimeout(tick, 600)
    },
    stop,
    release: (direction: -1 | 1) => {
      stop()
      if (!hold.current.repeated) latest.current.numeric.step(direction, true)
    },
  }
}
