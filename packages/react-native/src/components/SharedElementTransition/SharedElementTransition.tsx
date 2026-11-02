import { createContext, useLayoutEffect, useState, type ReactNode } from "react"

import { createNativeSharedElementScope, type TNativeSharedElementScope } from "./scope"

export const NativeSharedElementTransitionContext = createContext<TNativeSharedElementScope | null>(null)
export type TNativeSharedElementTransitionProps = { children?: ReactNode }

export const SharedElementTransition = ({ children }: TNativeSharedElementTransitionProps) => {
  const [scope] = useState(createNativeSharedElementScope)
  useLayoutEffect(() => () => scope.clear(), [scope])
  return (
    <NativeSharedElementTransitionContext.Provider value={scope}>
      {children}
    </NativeSharedElementTransitionContext.Provider>
  )
}
