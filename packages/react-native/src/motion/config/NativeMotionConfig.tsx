// Native adapter of pinned MotionConfig; see UPSTREAM.json and ../animation/LICENSE.framer-motion.md.
import { createContext, useContext, useMemo, useState } from "react"
import type { ReactNode } from "react"

import { resolveTransition } from "../animation/resolve-transition"
import type { TNativeMotionTransition } from "../animation/types"

export const NATIVE_REDUCED_MOTION_MODES = ["always", "never", "user"] as const
export type TNativeReducedMotionMode = (typeof NATIVE_REDUCED_MOTION_MODES)[number]
export type TNativeMotionPoint = { x: number; y: number }
export type TNativeMotionTransformPoint = (point: TNativeMotionPoint) => TNativeMotionPoint
export type TNativeMotionConfig = {
  transformPagePoint?: TNativeMotionTransformPoint
  isStatic?: boolean
  transition?: TNativeMotionTransition
  reducedMotion?: TNativeReducedMotionMode
  skipAnimations?: boolean
}
export type TNativeMotionConfigProps = TNativeMotionConfig & { children?: ReactNode }

export const NativeMotionConfigContext = createContext<TNativeMotionConfig>({
  transformPagePoint: (point) => point,
  isStatic: false,
  reducedMotion: "never",
})

export const NativeMotionConfig = ({ children, ...authored }: TNativeMotionConfigProps) => {
  const parent = useContext(NativeMotionConfigContext)
  const config = { ...parent, ...authored }
  config.transition = resolveTransition(config.transition, parent.transition)
  // Static mode is a mounted lifetime, so a prop update cannot change hook ownership.
  const [isStatic] = useState(() => config.isStatic)
  config.isStatic = isStatic
  const value = useMemo(
    () => config,
    [JSON.stringify(config.transition), config.transformPagePoint, config.reducedMotion, config.skipAnimations],
  )
  return <NativeMotionConfigContext.Provider value={value}>{children}</NativeMotionConfigContext.Provider>
}

export const useNativeMotionConfig = () => useContext(NativeMotionConfigContext)
