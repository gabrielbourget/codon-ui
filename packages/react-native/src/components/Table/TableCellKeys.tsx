import { useLayoutEffect, useState, type RefObject } from "react"
import { findNodeHandle, type View } from "react-native"

import type { TNativeCollectionNode } from "../../collection/snapshot"
import { nativeKeyTokens } from "../../input/keyScope"
import type { TNativeKeyPolicy } from "../../input/keyScope"
import { useNativeKeyPolicy, useNativeKeyScope } from "../../input/NativeKeyboardScope"

import { useNativeTable } from "./context"

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
export const TableKeyPolicy = (props: TPolicyProps) => (useNativeKeyScope() ? <Bindings {...props} /> : null)

type TProps = { node: TNativeCollectionNode<object>; target: RefObject<View | null>; binding: string }
export const TableCellKeys = ({ node, target, binding }: TProps) => {
  const table = useNativeTable()
  return (
    <TableKeyPolicy
      target={target}
      lifetimeKey={binding}
      tokens={[...table.keyboard.keysFor(node.key), ...["ArrowLeft", "ArrowRight"].flatMap(nativeKeyTokens)]}
      isEnabled={!!binding}
      excludeEditable={false}
      excludeComposing
      canAct={table.keyboard.canAct}
      onKey={(event) => table.keyboard.onKeyDown(event, node.key)}
    />
  )
}
