import { useCallback, useInsertionEffect, useRef, useState } from "react"

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
  const controlled = options.isOpen !== undefined
  const ownership = useRef(controlled)
  if (controlled !== ownership.current)
    throw new TypeError("NativeTooltipTrigger: changing controlled/uncontrolled ownership is unsupported")
  for (const value of [options.delay, options.closeDelay])
    if (value !== undefined && !Number.isFinite(value)) throw new TypeError("Tooltip delays must be finite")
  const [local, setLocal] = useState(() => options.defaultOpen ?? false)
  const isOpen = options.isOpen ?? local
  const current = useRef({ ...options, isOpen, controlled })
  current.current = { ...options, isOpen, controlled }
  const lease = useRef<ReturnType<typeof tooltipTiming.register> | null>(null)
  useInsertionEffect(() => {
    const registration = tooltipTiming.register(() => ({
      isOpen: current.current.isOpen,
      delay: current.current.delay,
      closeDelay: current.current.closeDelay,
      request: (next) => {
        const latest = current.current
        if (!latest.controlled) setLocal(next)
        latest.onOpenChange?.(next)
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
  return { isOpen, open, close }
}
