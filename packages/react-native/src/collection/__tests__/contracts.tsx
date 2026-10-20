import { createRef } from "react"
import { View } from "react-native"

import { NativeCollectionAdmission } from "../admission"
import { NativeCollection, NativeCollectionBuilder, createNativeCollectionLeaf } from "../CollectionBuilder"
import { NativeCollectionMetadataNode, NativeCollectionMetadataRoot } from "../NativeCollectionMetadata"

const common = { ownerId: "owner", rootId: "root" }
type TValue = { id: number; title: string }
const Item = createNativeCollectionLeaf<TValue, { id?: number; title: string }, View>("item", (props, ref, node) => {
  const original: TValue | null = node.value
  void original
  return <View ref={ref} accessibilityLabel={props.title} />
})
export const typedAuthoring = (
  <NativeCollectionBuilder<TValue>
    content={
      <NativeCollection items={[{ id: 0, title: "Zero" }]}>{(item) => <Item title={item.title} />}</NativeCollection>
    }
  >
    {(collection, receipt) => <View accessibilityLabel={collection.getTextValue(0)} nativeID={receipt.status} />}
  </NativeCollectionBuilder>
)
// @ts-expect-error Item-object cache ownership does not accept primitive data items.
export const primitiveItems = <NativeCollection items={[1, 2]} />
// @ts-expect-error Visible item refs keep their declared native View receiver type.
export const invalidVisibleRef = <Item title="Item" ref={createRef<{ foreign: true }>()} />
// @ts-expect-error Construction stays private until the complete renderer/state/family contracts are ready.
export type TUnpublishedCollection = typeof import("../../index").NativeCollection

export const metadata = (
  <NativeCollectionMetadataRoot
    {...common}
    rootRevision="root:1"
    onNativeCollectionCommit={(event) => {
      void event.nativeEvent.hierarchy
    }}
  >
    <NativeCollectionMetadataNode {...common} descriptorId="node" descriptorRevision="node:1" />
  </NativeCollectionMetadataRoot>
)

// @ts-expect-error Metadata refs never replace the visible caller ref.
export const callerRef = <NativeCollectionMetadataRoot {...common} rootRevision="root:1" ref={createRef<View>()} />
export const callerStyle = (
  // @ts-expect-error Metadata geometry/visibility cannot be overridden by a caller.
  <NativeCollectionMetadataNode {...common} descriptorId="node" descriptorRevision="node:1" style={{ width: 80 }} />
)
export const callerSelection = (
  // @ts-expect-error Business selection is not copied into the native metadata protocol.
  <NativeCollectionMetadataRoot {...common} rootRevision="root:1" selectedKeys={new Set(["a"])} />
)
// @ts-expect-error A descriptor's committed revision is required independently from its stable identity.
export const missingRevision = <NativeCollectionMetadataNode {...common} descriptorId="node" />

const admission = new NativeCollectionAdmission<object>({ ...common, rootRevision: "root:1", target: 20 })
const receipt = admission.getSnapshot()
// @ts-expect-error Receipt matching alone never exposes a business-action authorization API.
admission.admitAction("a")
// @ts-expect-error A published admission record is immutable.
receipt.status = "confirmed"
if (receipt.collection) {
  const node = receipt.collection.getItem("a")
  if (node) {
    // @ts-expect-error Metadata host targets are never part of a renderer-facing node.
    void node.metadataTarget
    // @ts-expect-error Private descriptor identities stay in the owned admission sidecar.
    void node.descriptorId
    // @ts-expect-error Native collection links are immutable.
    node.nextKey = "b"
  }
}
