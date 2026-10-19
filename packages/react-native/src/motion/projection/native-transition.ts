import type { Transition } from "./types"

export const getValueTransition = (transition: Transition | undefined, key: string): Transition =>
  (transition?.[key] || transition?.default || transition || {}) as Transition
