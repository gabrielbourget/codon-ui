import type { NativeFormActionStatus } from "../input/specs/CUIFocusViewNativeComponent"
import type { NativeFormCommitData } from "../input/specs/CUIFormRootNativeComponent"
import FormRuntime from "../input/specs/NativeCUIFormDocument"

import type { TNativeFieldDescriptor, TNativeFormDescriptor } from "./model"

export type TNativeFormFieldFocusRequest = Readonly<{
  formMount: NativeFormCommitData | null
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
  focus = FormRuntime?.focusField?.bind(FormRuntime),
): Promise<TNativeFormFieldFocusOutcome> => {
  const { field, mount } = scope
  if (
    !focus ||
    !scope.formMount ||
    (scope.origin === "native" && !scope.actionLease) ||
    !mount.active ||
    !mount.complete ||
    !mount.attached ||
    !mount.metadataOnly ||
    mount.ownerId !== field.ownerId ||
    mount.descriptorId !== field.descriptorId ||
    mount.descriptorRevision !== field.descriptorRevision ||
    mount.target !== field.metadataTarget ||
    mount.originalTarget !== field.target
  )
    return denied
  try {
    const value = JSON.parse(await focus(JSON.stringify(scope)))
    if (
      value?.descriptorId !== field.descriptorId ||
      value.descriptorRevision !== field.descriptorRevision ||
      value.target !== field.target ||
      typeof value.requested !== "boolean" ||
      typeof value.current !== "boolean" ||
      !value.mount ||
      Object.keys(value.mount).length !== Object.keys(mount).length ||
      Object.entries(mount).some(([key, expected]) => value.mount[key] !== expected)
    )
      return denied
    return Object.freeze({ requested: value.requested, current: value.current })
  } catch {
    return denied
  }
}
