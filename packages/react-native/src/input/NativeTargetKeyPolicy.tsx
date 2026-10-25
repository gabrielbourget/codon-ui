import { useLayoutEffect, useState, type RefObject } from "react"
import { findNodeHandle, type View } from "react-native"

import type { TNativeKeyPolicy } from "./keyScope"
import { useNativeKeyPolicy, useNativeKeyScope } from "./NativeKeyboardScope"

type TPolicyProps = Omit<TNativeKeyPolicy, "targetTag"> & { target: RefObject<View | null> }
const Bindings = ({ target, ...policy }: TPolicyProps) => {
  const [tag, setTag] = useState(0)
  useLayoutEffect(() => setTag(target.current ? (findNodeHandle(target.current) ?? 0) : 0))
  useNativeKeyPolicy({
    targetTag: tag,
    ...policy,
    isEnabled: tag > 0 && policy.isEnabled,
  })
  return null
}
export const NativeTargetKeyPolicy = (props: TPolicyProps) => (useNativeKeyScope() ? <Bindings {...props} /> : null)
