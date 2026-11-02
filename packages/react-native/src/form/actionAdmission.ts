import type { NativeFormActionStatus } from "../input/specs/CUIFocusViewNativeComponent"
import FormRuntime from "../input/specs/NativeCUIFormDocument"

import type { TNativeFormBinding, TNativeFormFieldBinding } from "./registry"

// Main integrates admitForm into the owned codegen spec. Missing native support fails closed.
type TRuntime = { admitForm?: (request: string) => Promise<string> }
let nextAdmission = 0
export const admitNativeFormAction = async (
  form: TNativeFormBinding,
  fields: readonly TNativeFormFieldBinding[],
  actionLease?: NativeFormActionStatus | null,
  admit = (FormRuntime as TRuntime | null)?.admitForm?.bind(FormRuntime),
) => {
  if (!admit) return false
  const requestId = `form-model:${++nextAdmission}`
  const request = {
    requestId,
    form: form.descriptor,
    formMount: form.mount()?.getSnapshot(),
    fields: fields.map((field) => ({ field: field.descriptor, mount: field.mount()?.getSnapshot() })),
    ...(actionLease ? { actionLease } : {}),
  }
  if (!request.formMount) return false
  if (request.fields.some((field) => !field.mount)) return false
  try {
    const value = JSON.parse(await admit(JSON.stringify(request)))
    return (
      value?.accepted === true &&
      value.requestId === requestId &&
      value.formRevision === form.descriptor.descriptorRevision
    )
  } catch {
    return false
  }
}
