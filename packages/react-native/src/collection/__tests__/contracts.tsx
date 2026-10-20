import { createRef } from "react"
import type { View } from "react-native"

import { NativeCollectionMetadataNode, NativeCollectionMetadataRoot } from "../NativeCollectionMetadata"

const common = { ownerId: "owner", rootId: "root" }

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
