import { useContext, type ReactNode, type RefAttributes } from "react"
import type { View } from "react-native"

import { createNativeCollectionBranch, createNativeCollectionLeaf } from "../../collection/CollectionBuilder"
import { NativeCollectionRendererContext } from "../../collection/renderer"
import { NativeFocusHost } from "../../input/NativeFocusView"
import type { TNativeFocusViewProps } from "../../input/types"
import { getNativeButtonContent } from "../Button/content"

import { NativeComboBoxStateContext } from "./collectionContext"

type TSectionProps<T extends object> = Omit<TNativeFocusViewProps, "id" | "children"> & {
  id?: string | number
  value?: T
  items?: Iterable<T>
  children?: ReactNode | ((item: T) => ReactNode)
  dependencies?: readonly unknown[]
}
const Section = createNativeCollectionBranch<object, TSectionProps<object>, View>("section", (props, ref, node) => {
  const state = useContext(NativeComboBoxStateContext)
  const { CollectionBranch } = useContext(NativeCollectionRendererContext)
  if (!state) throw new Error("ComboBoxSection requires a native collection ComboBox")
  const { id: _id, value: _value, items: _items, children: _children, dependencies: _dependencies, ...native } = props
  return (
    <NativeFocusHost {...native} ref={ref} accessible={false} focusable={false} role="group">
      <CollectionBranch collection={state.collection} parent={node} />
    </NativeFocusHost>
  )
})
export const NativeComboBoxSection = Section as <T extends object>(
  props: TSectionProps<T> & RefAttributes<View>,
) => ReactNode
export const NativeComboBoxHeader = createNativeCollectionLeaf<unknown, TNativeFocusViewProps, View>(
  "header",
  (props, ref, _node) => (
    <NativeFocusHost {...props} ref={ref} role="heading" accessible={false} focusable={false}>
      {getNativeButtonContent(props.children)}
    </NativeFocusHost>
  ),
)
