import type { NativeFormActionStatus } from "../input/specs/CUIFocusViewNativeComponent"
import type { NativeFormCommitData } from "../input/specs/CUIFormRootNativeComponent"
import FormDocument from "../input/specs/NativeCUIFormDocument"

import {
  decodeNativeFormDocument,
  fieldsInNativeForm,
  type TNativeFieldDescriptor,
  type TNativeFormDescriptor,
  type TNativeFormDocument,
} from "./document"

export type TNativeFormFieldFocusRequest = Readonly<{
  document: TNativeFormDocument
  form: TNativeFormDescriptor
  field: TNativeFieldDescriptor
  mount: NativeFormCommitData
  origin: "native" | "programmatic"
  actionLease?: NativeFormActionStatus | null
}>
export type TNativeFormFieldFocusOutcome = Readonly<{ requested: boolean; current: boolean }>
const denied: TNativeFormFieldFocusOutcome = Object.freeze({ requested: false, current: false })

export const requestNativeFormFieldFocus = async (
  scope: TNativeFormFieldFocusRequest,
  focus = FormDocument?.focusField?.bind(FormDocument),
): Promise<TNativeFormFieldFocusOutcome> => {
  if (!focus || (scope.origin === "native" && !scope.actionLease)) return denied
  const { document, form, field, mount, origin } = scope
  const sameDescriptor = (left: object, right: object) =>
    Object.keys(left).length === Object.keys(right).length &&
    Object.entries(left).every(([key, value]) => (right as Record<string, unknown>)[key] === value)
  if (
    !mount.active ||
    !mount.complete ||
    !mount.attached ||
    !mount.metadataOnly ||
    mount.ownerId !== field.ownerId ||
    mount.descriptorId !== field.descriptorId ||
    mount.descriptorRevision !== field.descriptorRevision ||
    mount.target !== field.metadataTarget ||
    mount.originalTarget !== field.target ||
    mount.surfaceId !== document.surfaceId ||
    !document.forms.some((candidate) => sameDescriptor(candidate, form)) ||
    !document.fields.some((candidate) => sameDescriptor(candidate, field))
  )
    return denied
  try {
    if (!fieldsInNativeForm(document, form).some((candidate) => sameDescriptor(candidate, field))) return denied
  } catch {
    return denied
  }
  const request = {
    target: document.target,
    surfaceId: document.surfaceId,
    requestId: `${document.requestId}:focus`,
    documentId: document.documentId,
    revision: document.revision,
    form,
    field,
    mount,
    origin,
    ...(origin === "native"
      ? {
          actionAdmission: {
            lease: scope.actionLease,
            form,
            documentId: document.documentId,
            revision: document.revision,
          },
        }
      : {}),
  }
  try {
    const encoded = await focus(JSON.stringify(request))
    const current = decodeNativeFormDocument(encoded, request)
    const result = (JSON.parse(encoded) as { focus?: unknown }).focus
    if (
      current.documentId !== document.documentId ||
      current.revision !== document.revision ||
      JSON.stringify(current.nodes) !== JSON.stringify(document.nodes) ||
      JSON.stringify(current.forms) !== JSON.stringify(document.forms) ||
      JSON.stringify(current.fields) !== JSON.stringify(document.fields) ||
      !result ||
      typeof result !== "object" ||
      Array.isArray(result)
    )
      return denied
    const value = result as Record<string, unknown>
    if (
      value.descriptorId !== field.descriptorId ||
      value.descriptorRevision !== field.descriptorRevision ||
      value.target !== field.target ||
      typeof value.requested !== "boolean" ||
      typeof value.current !== "boolean" ||
      !value.mount ||
      typeof value.mount !== "object" ||
      Array.isArray(value.mount) ||
      Object.keys(value.mount).length !== Object.keys(mount).length ||
      Object.entries(mount).some(([key, expected]) => (value.mount as Record<string, unknown>)[key] !== expected)
    )
      return denied
    return Object.freeze({ requested: value.requested, current: value.current })
  } catch {
    return denied
  }
}
