import type { ComponentProps, ComponentRef, Ref } from "react"

import Field from "../input/specs/CUIFieldBindingNativeComponent"
import Form from "../input/specs/CUIFormRootNativeComponent"

const metadataProps = {
  collapsable: false,
  collapsableChildren: false,
  accessible: false,
  focusable: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
  pointerEvents: "none",
  style: { position: "absolute", width: 0, height: 0, opacity: 0 },
} as const

type TFormProps = Pick<
  ComponentProps<typeof Form>,
  "ownerId" | "descriptorId" | "descriptorRevision" | "formTarget" | "formId" | "onNativeFormCommit"
> & { metadataRef?: Ref<ComponentRef<typeof Form>> }
type TFieldProps = Pick<
  ComponentProps<typeof Field>,
  | "ownerId"
  | "descriptorId"
  | "descriptorRevision"
  | "editorTarget"
  | "hasFormAssociation"
  | "formId"
  | "semanticBinding"
  | "onNativeFormCommit"
> & { metadataRef?: Ref<ComponentRef<typeof Field>> }

export const NativeFormMetadata = ({ metadataRef, ...props }: TFormProps) => (
  <Form ref={metadataRef} {...props} {...metadataProps} />
)
export const NativeFieldMetadata = ({ metadataRef, ...props }: TFieldProps) => (
  <Field ref={metadataRef} {...props} {...metadataProps} />
)
