import type { ComponentProps, ComponentRef, Ref } from "react"

import Node from "../input/specs/CUICollectionNodeNativeComponent"
import Root from "../input/specs/CUICollectionRootNativeComponent"

const metadataStyle = { position: "absolute", width: 0, height: 0, opacity: 0 } as const
const metadataProps = {
  collapsable: false,
  collapsableChildren: false,
  accessible: false,
  focusable: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
  pointerEvents: "none",
  style: metadataStyle,
} as const
export type TNativeMetadataRootRef = ComponentRef<typeof Root>

type TRootProps = Pick<
  ComponentProps<typeof Root>,
  | "ownerId"
  | "rootId"
  | "rootRevision"
  | "children"
  | "inspectionRequest"
  | "onNativeCollectionCommit"
  | "onNativeCollectionInspection"
> & { metadataRef?: Ref<TNativeMetadataRootRef> }
type TNodeProps = Pick<
  ComponentProps<typeof Node>,
  "ownerId" | "rootId" | "descriptorId" | "descriptorRevision" | "children"
>

// Only metadata descriptors enter this tree. Visible receivers and caller refs belong to the materialized renderer.
export const NativeCollectionMetadataRoot = ({ metadataRef, ...props }: TRootProps) => (
  <Root ref={metadataRef} {...props} {...metadataProps} />
)
export const NativeCollectionMetadataNode = (props: TNodeProps) => <Node {...props} {...metadataProps} />
