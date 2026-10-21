import type { ComponentProps } from "react"

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
  "ownerId" | "descriptorId" | "descriptorRevision" | "formTarget" | "formId"
>
type TFieldProps = Pick<
  ComponentProps<typeof Field>,
  "ownerId" | "descriptorId" | "descriptorRevision" | "editorTarget" | "hasFormAssociation" | "formId"
>

export const NativeFormMetadata = (props: TFormProps) => <Form {...props} {...metadataProps} />
export const NativeFieldMetadata = (props: TFieldProps) => <Field {...props} {...metadataProps} />
