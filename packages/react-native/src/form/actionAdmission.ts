import type { NativeFormActionStatus } from "../input/specs/CUIFocusViewNativeComponent"

import { NATIVE_FORM_ACTION_LEASE_KEYS } from "./actionLease"
import { decodeNativeFormDocument, type TNativeFormDocument, type TNativeFormDescriptor } from "./document"
import { readNativeFormDocument } from "./runtime"

export const admitNativeFormAction = async (
  lease: NativeFormActionStatus,
  document: TNativeFormDocument,
  form: TNativeFormDescriptor,
  read = readNativeFormDocument,
) => {
  const request = {
    target: lease.target,
    requestId: `${document.requestId}:admission`,
    surfaceId: document.surfaceId,
    actionAdmission: { lease, form, documentId: document.documentId, revision: document.revision },
  }
  const encoded = await read(request)
  const current = decodeNativeFormDocument(encoded, request)
  if (
    current.documentId !== document.documentId ||
    current.revision !== document.revision ||
    JSON.stringify(current.forms) !== JSON.stringify(document.forms) ||
    JSON.stringify(current.fields) !== JSON.stringify(document.fields) ||
    JSON.stringify(current.nodes) !== JSON.stringify(document.nodes)
  )
    return false
  const packet = (JSON.parse(encoded) as { actionAdmission?: unknown }).actionAdmission
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) return false
  const value = packet as Record<string, unknown>
  if (
    value.accepted !== true ||
    value.documentId !== document.documentId ||
    value.revision !== document.revision ||
    value.formDescriptorId !== form.descriptorId ||
    value.formDescriptorRevision !== form.descriptorRevision ||
    !value.lease ||
    typeof value.lease !== "object" ||
    Array.isArray(value.lease)
  )
    return false
  const accepted = value.lease as Record<string, unknown>
  return (
    Object.keys(accepted).length === NATIVE_FORM_ACTION_LEASE_KEYS.length &&
    NATIVE_FORM_ACTION_LEASE_KEYS.every((key) => accepted[key] === lease[key])
  )
}
