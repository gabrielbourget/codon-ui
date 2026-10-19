import { createContext, useCallback, useContext, useEffect, useId } from "react"
import type { RefObject } from "react"
import type { View } from "react-native"

export type TNativePopFrame = {
  width: number
  height: number
  left: number
  top: number
  right: number
  bottom: number
  direction: "ltr" | "rtl"
}
export type TNativePopRoot = {
  read: (root?: RefObject<View | null>) => TNativePopFrame
  freeze: (frame: TNativePopFrame, anchorX: "left" | "right", anchorY: "top" | "bottom") => () => void
}
export type TNativePresence = {
  id: string
  initial?: false
  isPresent: boolean
  custom?: unknown
  register: (id: string | number) => () => void
  onExitComplete: (id: string | number) => void
}
export const NativePresenceContext = createContext<TNativePresence | null>(null)
export const NativePopRootContext = createContext<((root: TNativePopRoot) => () => void) | null>(null)
export const useNativePresence = (subscribe = true): [boolean, (() => void)?] => {
  const presence = useContext(NativePresenceContext),
    id = useId()
  useEffect(() => (subscribe ? presence?.register(id) : undefined), [subscribe, presence?.register, id])
  const remove = useCallback(() => {
    if (subscribe) presence?.onExitComplete(id)
  }, [subscribe, presence?.onExitComplete, id])
  return presence?.isPresent === false ? [false, remove] : [true]
}
export const useNativeIsPresent = () => useContext(NativePresenceContext)?.isPresent ?? true
export const useNativePresenceData = () => useContext(NativePresenceContext)?.custom
