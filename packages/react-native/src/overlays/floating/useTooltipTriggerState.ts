import { useCallback, useInsertionEffect, useRef } from "react"

import { useOverlayTriggerState } from "../../components/ComboBox/state/useOverlayTriggerState"

import { useNativeFloatingHost } from "./NativeFloatingLayerHost"

type TOptions = {
  isOpen?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  delay?: number
  closeDelay?: number
}

export const useNativeTooltipTriggerState = (options: TOptions = {}) => {
  const { tooltipTiming } = useNativeFloatingHost()
  const state = useOverlayTriggerState(options)
  for (const value of [options.delay, options.closeDelay])
    if (value !== undefined && !Number.isFinite(value)) throw new TypeError("Tooltip delays must be finite")
  const current = useRef({ ...options, state })
  current.current = { ...options, state }
  const lease = useRef<ReturnType<typeof tooltipTiming.register> | null>(null)
  useInsertionEffect(() => {
    const registration = tooltipTiming.register(() => ({
      isOpen: current.current.state.isOpen,
      delay: current.current.delay,
      closeDelay: current.current.closeDelay,
      request: (next) => {
        current.current.state.setOpen(next)
      },
    }))
    lease.current = registration
    return () => {
      registration.unregister()
      if (lease.current === registration) lease.current = null
    }
  }, [tooltipTiming])
  const open = useCallback((immediate = false, eligible?: () => boolean) => {
    lease.current?.open(immediate, eligible)
  }, [])
  const close = useCallback((immediate = false, eligible?: () => boolean) => {
    lease.current?.close(immediate, eligible)
  }, [])
  return { isOpen: state.isOpen, open, close }
}
