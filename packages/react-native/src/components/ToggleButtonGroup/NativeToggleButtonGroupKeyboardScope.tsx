import type { ReactNode, RefObject } from "react"
import type { View } from "react-native"

import { useNativeToggleGroupKeyboardListeners } from "../../input/NativeKeyboardScope"
import type { TNativeToolbarCallbacks, TNativeToolbarListenerProps } from "../../input/nativeToolbarKeyboard"

export type TNativeToggleButtonGroupKeyboardScopeProps = TNativeToolbarCallbacks & {
  containerRef: RefObject<View | null>
  children: (listenerProps: TNativeToolbarListenerProps) => ReactNode
}

export const NativeToggleButtonGroupKeyboardScope = ({
  children,
  ...options
}: TNativeToggleButtonGroupKeyboardScopeProps) => {
  const { listenerProps } = useNativeToggleGroupKeyboardListeners(options)
  return children(listenerProps)
}
