import { useInsertionEffect, useRef, useState } from "react"

import type { TNativeModalProps } from "./types"

export const useModalState = (props: TNativeModalProps, componentName = "Modal") => {
  const controlled = props.isOpen !== undefined
  const initialMode = useRef(controlled)
  const [local, setLocal] = useState(() => props.defaultOpen ?? false)
  const latestLocal = useRef(local)
  useInsertionEffect(() => {
    latestLocal.current = local
  }, [local])
  if (controlled !== initialMode.current)
    throw new TypeError(`${componentName}: changing controlled/uncontrolled ownership is unsupported`)
  const open = controlled ? props.isOpen! : local
  const getOpen = () => (controlled ? props.isOpen! : latestLocal.current)
  const request = (next: boolean) => {
    if (next === getOpen()) return
    if (!controlled) {
      latestLocal.current = next
      setLocal(next)
    }
    props.onOpenChange?.(next)
  }
  return { open, request, getOpen }
}
