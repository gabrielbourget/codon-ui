import type { TextInput, View } from "react-native"

import type { TNativeFieldDescriptor, TNativeFormDescriptor } from "./model"
import type { NativeFormMountReceipt } from "./mount"
import type { TNativeFormEntry, TNativeFormOrigin, TNativeFormProps, TNativeFormValidation } from "./types"

export type TNativeFormBinding = Readonly<{
  descriptor: TNativeFormDescriptor
  fieldRevision: number
  fieldOrder: readonly string[]
  original: View
  mount: () => NativeFormMountReceipt | null
  current: () => View | null
  props: () => Pick<TNativeFormProps, "validationBehavior" | "onSubmit" | "onReset">
}>
export type TNativeFormFieldData = Readonly<{
  entries: readonly TNativeFormEntry[]
  isDisabled: boolean
  isReadOnly: boolean
  validationBehavior: "native" | "aria"
  validation: TNativeFormValidation
}>
export type TNativeFormFieldBinding = Readonly<{
  descriptor: TNativeFieldDescriptor
  fieldId?: string
  formOwnerId: string | null
  fieldIndex?: number
  data: TNativeFormFieldData
  editor: () => TextInput | View | null
  mount: () => NativeFormMountReceipt | null
  isFocusObserved: () => boolean
  commitValidation: () => void
  reset: (origin: TNativeFormOrigin) => void
}>

export const nativeFormRevision = (
  ownerId: string,
  target: number,
  fieldRevision: number,
  fieldOrder: readonly string[] = [],
) => `${ownerId}:form:${target}:fields:${fieldRevision}:order:${JSON.stringify(fieldOrder)}`

// Explicit React ownership and declared field order own membership. Native
// mount receipts remain independent authority for actual original-host actions.
export class NativeFormRegistry {
  readonly forms = new Map<string, TNativeFormBinding>()
  readonly fields = new Map<string, TNativeFormFieldBinding>()
  readonly #listeners = new Set<() => void>()
  #revision = 0
  #notificationQueued = false

  getRevision = () => this.#revision
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }
  #publish = () => {
    this.#revision++
    // Field ownership changes in insertion effects, including retained Activity
    // trees. Notify React after that commit, never from an insertion effect.
    if (this.#notificationQueued) return
    this.#notificationQueued = true
    void Promise.resolve().then(() => {
      this.#notificationQueued = false
      for (const listener of this.#listeners) listener()
    })
  }

  resolveForm = (formId: string | undefined, ownerId: string | null) => {
    const matches = [...this.forms.values()].filter((form) =>
      formId === undefined ? form.descriptor.ownerId === ownerId : !!formId && form.descriptor.formId === formId,
    )
    if (matches.length !== 1) throw new Error("form-owner-unavailable-or-ambiguous")
    return matches[0]
  }

  fieldsFor = (form: TNativeFormBinding) => {
    const order = form.fieldOrder
    if (order.some((id) => !id) || new Set(order).size !== order.length) throw new Error("form-field-order-invalid")
    const fields = [...this.fields.values()].filter((field) => {
      const descriptor = field.descriptor
      if (!descriptor.hasFormAssociation) return field.formOwnerId === form.descriptor.ownerId
      if (!descriptor.formId || descriptor.formId !== form.descriptor.formId) return false
      return this.resolveForm(descriptor.formId, null) === form
    })
    if (fields.some((field) => !field.fieldId || !order.includes(field.fieldId)))
      throw new Error("form-field-not-declared")
    return order.flatMap((id) => {
      const members = fields.filter((field) => field.fieldId === id)
      if (!members.length) throw new Error("form-field-registration-incomplete")
      if (members.length === 1 && members[0].fieldIndex === undefined) return members
      const sorted = members.sort((left, right) => (left.fieldIndex ?? -1) - (right.fieldIndex ?? -1))
      if (sorted.some((field, index) => field.fieldIndex !== index))
        throw new Error("form-field-registration-ambiguous")
      return sorted
    })
  }

  commitForm = (binding: TNativeFormBinding) => {
    if (
      binding.descriptor.descriptorRevision !==
      nativeFormRevision(
        binding.descriptor.ownerId,
        binding.descriptor.target,
        binding.fieldRevision,
        binding.fieldOrder,
      )
    )
      throw new Error("native-form-commit-barrier-mismatch")
    const key = binding.descriptor.descriptorId
    const previous = this.forms.get(key)
    if (previous && previous.descriptor.ownerId !== binding.descriptor.ownerId)
      throw new Error("duplicate-native-form-owner")
    this.forms.set(key, binding)
    return () => {
      if (this.forms.get(key) === binding) this.forms.delete(key)
    }
  }
  commitField = (binding: TNativeFormFieldBinding) => {
    const key = binding.descriptor.descriptorId
    const previous = this.fields.get(key)
    if (previous && previous.descriptor.ownerId !== binding.descriptor.ownerId)
      throw new Error("duplicate-native-field-owner")
    const validation = binding.data.validation
    const entry: TNativeFormFieldBinding = Object.freeze({
      ...binding,
      descriptor: Object.freeze({ ...binding.descriptor }),
      data: Object.freeze({
        ...binding.data,
        entries: Object.freeze(binding.data.entries.map(([name, value]) => Object.freeze([name, value] as const))),
        validation: Object.freeze({
          ...validation,
          validationDetails: Object.freeze({ ...validation.validationDetails }),
          validationErrors: Object.freeze([...validation.validationErrors]),
        }),
      }),
    })
    this.fields.set(key, entry)
    this.#publish()
    return () => {
      if (this.fields.get(key) === entry) {
        this.fields.delete(key)
        this.#publish()
      }
    }
  }
}
export const nativeFormRegistry = new NativeFormRegistry()
