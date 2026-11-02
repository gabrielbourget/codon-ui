import { createRef } from "react"
import { View } from "react-native"

import { NativeCollectionBuilder, createNativeCollectionLeaf } from "../CollectionBuilder"
import { createNativeCollectionSnapshot, type TNativeCollectionItem } from "../snapshot"

type TValue = { id: number; title: string }
const Item = createNativeCollectionLeaf<TValue, { title: string }, View>("item", (props, ref, node) => {
  const original: TValue | null = node.value
  void original
  return <View ref={ref} accessibilityLabel={props.title} />
})
const items: readonly TNativeCollectionItem<TValue>[] = [
  {
    key: 0,
    type: "item",
    value: { id: 0, title: "Zero" },
    textValue: "Zero",
    rendered: "Zero",
    props: {},
    render: () => <Item title="Zero" />,
  },
]
export const typedModel = (
  <NativeCollectionBuilder items={items}>
    {(collection) => <View accessibilityLabel={collection.getTextValue(0)} />}
  </NativeCollectionBuilder>
)
export const implicitAuthoring = (
  // @ts-expect-error Explicit authoring requires a complete ordered model.
  <NativeCollectionBuilder content={<Item title="Implicit" />}>{() => null}</NativeCollectionBuilder>
)
// @ts-expect-error Stable keys are required and are never generated from opaque JSX.
export const missingKey: TNativeCollectionItem<TValue> = {
  type: "item",
  value: null,
  textValue: "Missing",
  rendered: null,
  props: {},
}
// @ts-expect-error Visible item refs keep their declared native View receiver type.
export const invalidVisibleRef = <Item title="Item" ref={createRef<{ foreign: true }>()} />
const node = createNativeCollectionSnapshot(items).getItem(0)!
// @ts-expect-error Native hidden targets are not exposed on logical nodes.
void node.metadataTarget
// @ts-expect-error Logical links are immutable.
node.nextKey = "replacement"
// @ts-expect-error Explicit authoring is an immutable input.
items.push(items[0])
