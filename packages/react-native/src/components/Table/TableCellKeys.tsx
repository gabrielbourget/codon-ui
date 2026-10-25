import type { RefObject } from "react"
import type { View } from "react-native"

import type { TNativeCollectionNode } from "../../collection/snapshot"
import { nativeKeyTokens } from "../../input/keyScope"
import { NativeTargetKeyPolicy as TableKeyPolicy } from "../../input/NativeTargetKeyPolicy"

import { useNativeTable } from "./context"

export { NativeTargetKeyPolicy as TableKeyPolicy } from "../../input/NativeTargetKeyPolicy"

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
