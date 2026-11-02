import { useContext, useInsertionEffect, useLayoutEffect, useRef } from "react"
import type { TextInput } from "react-native"

import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeAdmittedPress } from "../../input/nativePressCycle"
import type { TNativePressEvent } from "../../input/types"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import type { useNumberInputState } from "../NumberInput/state"

type TStepperPressOwner = {
  lifetimeKey: string
  originalEditor: () => TextInput | null
}
type TStepperPressCycle = {
  direction: -1 | 1
  event: TNativePressEvent
  owner: string
  editor: TextInput | null
  windowId: string
  epoch: number
  admission?: TNativeAdmittedPress
  requested: boolean
  releaseAllowed: boolean
  ended: boolean
  cancelled: boolean
  consumed: boolean
  timer?: ReturnType<typeof setTimeout>
}

export const useStepperRepeat = (
  numeric: ReturnType<typeof useNumberInputState>,
  blocked: boolean,
  owner: TStepperPressOwner,
) => {
  const scope = useNativeKeyScope()
  const floatingScope = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const latest = useRef({ numeric, blocked, owner, floatingScope, windowActive })
  useInsertionEffect(() => {
    latest.current = { numeric, blocked, owner, floatingScope, windowActive }
  })
  const hold = useRef<TStepperPressCycle | null>(null)
  const previousValue = useRef(numeric.value)
  const canAct = (direction: -1 | 1) => {
    const current = latest.current
    return (
      !current.blocked &&
      current.floatingScope?.canAct() !== false &&
      current.windowActive?.() !== false &&
      scope?.isWindowActive() !== false &&
      (direction === 1 ? current.numeric.canIncrement : current.numeric.canDecrement)
    )
  }
  const owns = (cycle: TStepperPressCycle) => {
    const session = scope?.acknowledgedSession()
    return (
      latest.current.owner.lifetimeKey === cycle.owner &&
      latest.current.owner.originalEditor() === cycle.editor &&
      session?.windowId === cycle.windowId &&
      session?.epoch === cycle.epoch
    )
  }
  const end = () => {
    const cycle = hold.current
    if (cycle) {
      clearTimeout(cycle.timer)
      cycle.timer = undefined
      cycle.ended = true
    }
    latest.current.numeric.pressEnd()
  }
  const retire = () => {
    if (hold.current) {
      hold.current.cancelled = true
      hold.current.releaseAllowed = false
    }
    end()
  }
  useLayoutEffect(() => {
    const cycle = hold.current
    if (
      cycle &&
      !cycle.consumed &&
      (!owns(cycle) || !canAct(cycle.direction) || (!cycle.requested && previousValue.current !== numeric.value))
    )
      retire()
    previousValue.current = numeric.value
  })
  useLayoutEffect(
    () =>
      scope?.subscribe(() => {
        const cycle = hold.current
        if (cycle && (!owns(cycle) || !scope.isNativeReady() || !canAct(cycle.direction))) retire()
      }),
    [scope],
  )
  useLayoutEffect(() => retire, [])
  return {
    canAct: (direction: -1 | 1) => canAct(direction) && scope?.isNativeReady() === true,
    prepare: (direction: -1 | 1, event: TNativePressEvent) => {
      retire()
      const session = scope?.acknowledgedSession()
      hold.current = {
        direction,
        event,
        owner: latest.current.owner.lifetimeKey,
        editor: latest.current.owner.originalEditor(),
        windowId: session?.windowId ?? "",
        epoch: session?.epoch ?? 0,
        requested: false,
        releaseAllowed: false,
        ended: false,
        cancelled: !canAct(direction),
        consumed: false,
      }
      latest.current.numeric.pressStart()
    },
    start: (direction: -1 | 1, event: TNativePressEvent, admission: TNativeAdmittedPress) => {
      const cycle = hold.current
      if (
        !cycle ||
        cycle.direction !== direction ||
        cycle.event !== event ||
        cycle.cancelled ||
        !owns(cycle) ||
        !canAct(direction) ||
        scope?.isNativeReady() !== true ||
        !admission.isCurrent()
      )
        return
      cycle.admission = admission
      const tick = () => {
        if (
          hold.current !== cycle ||
          cycle.ended ||
          cycle.cancelled ||
          !owns(cycle) ||
          !canAct(direction) ||
          !admission.isCurrent()
        ) {
          retire()
          return
        }
        const first = !cycle.requested
        cycle.requested = true
        latest.current.numeric.step(direction, first)
        if (hold.current === cycle && !cycle.ended && !cycle.cancelled) cycle.timer = setTimeout(tick, 60)
      }
      if (admission.cohort === "mouse" || admission.cohort === "pen") {
        cycle.requested = true
        latest.current.numeric.step(direction, true)
        if (!cycle.ended && !cycle.cancelled) cycle.timer = setTimeout(tick, 400)
      } else cycle.timer = setTimeout(tick, 600)
    },
    up: (direction: -1 | 1) => {
      const cycle = hold.current
      if (!cycle || cycle.direction !== direction) return
      if (cycle.cancelled || !owns(cycle) || !canAct(direction) || cycle.admission?.isCurrent() === false) {
        retire()
        return
      }
      cycle.releaseAllowed = true
      end()
    },
    end,
    release: (direction: -1 | 1) => {
      const cycle = hold.current
      end()
      if (!canAct(direction)) return
      if (cycle) {
        if (cycle.direction !== direction || cycle.cancelled || cycle.consumed || !owns(cycle)) return
        cycle.consumed = true
        if (cycle.requested || (cycle.admission && !cycle.releaseAllowed)) return
      }
      latest.current.numeric.step(direction, true)
    },
  }
}
