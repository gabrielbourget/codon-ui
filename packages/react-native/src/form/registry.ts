import type { TextInput, View } from "react-native"

import type { TNativeFieldDescriptor, TNativeFormDescriptor } from "./document"
import type { NativeFormMountReceipt } from "./mount"
import type { TNativeFormEntry, TNativeFormOrigin, TNativeFormProps, TNativeFormValidation } from "./types"

export type TNativeFormBinding = Readonly<{
  descriptor: Omit<TNativeFormDescriptor, "position">
  fieldRevision: number
  original: View
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
  descriptor: Omit<TNativeFieldDescriptor, "position">
  data: TNativeFormFieldData
  editor: () => TextInput | null
  mount: () => NativeFormMountReceipt | null
  isFocusObserved: () => boolean
  commitValidation: () => void
  reset: (origin: TNativeFormOrigin) => void
}>

export const nativeFormRevision = (ownerId: string, target: number, fieldRevision: number) =>
  `${ownerId}:form:${target}:fields:${fieldRevision}`

// Membership/order comes exclusively from the native document. This registry
// keeps committed state and a barrier for native metadata catching up to React.
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

  commitForm = (binding: TNativeFormBinding) => {
    if (
      binding.descriptor.descriptorRevision !==
      nativeFormRevision(binding.descriptor.ownerId, binding.descriptor.target, binding.fieldRevision)
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
