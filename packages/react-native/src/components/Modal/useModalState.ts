import { useRef, useState } from "react"

import type { TNativeModalProps } from "./types"

export const useModalState = (props: TNativeModalProps, componentName = "Modal") => {
  const controlled = props.isOpen !== undefined
  const initialMode = useRef(controlled)
  const [local, setLocal] = useState(() => props.defaultOpen ?? false)
  if (controlled !== initialMode.current)
    throw new TypeError(`${componentName}: changing controlled/uncontrolled ownership is unsupported`)
  const open = controlled ? props.isOpen! : local
  const request = (next: boolean) => {
    if (next === open) return
    if (!controlled) setLocal(next)
    props.onOpenChange?.(next)
  }
  return { open, request }
}
