import type { NativeSyntheticEvent, View } from "react-native"

import type { TNativeFieldInputScope } from "./fieldInput"
import type { NativeFormCommitData } from "./specs/CUIFormRootNativeComponent"

export type TNativeFieldInputPlan = Readonly<{
  bindingId: string
  bindingRevision: string
  outer: View
  outerTarget: number
  input: View
  inputTarget: number
  originalTarget: number
}>
export type TNativeFieldInputMetadata = Readonly<{
  binding: (ownerId: string) => string
  commit: (mount: NativeFormCommitData) => void
  record?: (event: NativeSyntheticEvent<Readonly<{ record: string }>>) => void
}>
type TModule = TNativeFieldInputScope["native"]
type TDocumentModule = Readonly<{
  bindFieldInput: (request: string) => Promise<string>
  unbindFieldInput: (request: string) => Promise<boolean>
}>
type TReceipt = Readonly<{ requestId: string; ownerToken: string; metadataTarget: number }>
let requests = 0

// This session owns only a committed field's two original roots and binding
// lifetime. The immutable native document owns every descendant and selection.
export class NativeFieldInputSession {
  #plan: TNativeFieldInputPlan | null = null
  #bound: TReceipt | null = null
  #pending: object | null = null
  #failed: TNativeFieldInputPlan | null = null
  #closed = false
  #lease: string
  #error = ""
  #mountKey = ""
  #version = 0
  #listeners = new Set<() => void>()
  #notificationPending = false
  constructor(
    private readonly native: TModule,
    private readonly document: TDocumentModule,
  ) {
    this.#lease = native.getLease()
    if (!this.#lease) throw new Error("field-input-session-module-unavailable")
  }
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }
  version = () => this.#version
  status = () =>
    Object.freeze({
      ready: !!this.#bound && !this.#closed && this.native.getLease() === this.#lease,
      pending: !!this.#pending,
      error: this.#error,
    })
  #changed = () => {
    this.#version++
    if (this.#notificationPending) return
    this.#notificationPending = true
    // Authority changes immediately; render observers run after the commit
    // that may have synchronously retired the old scope.
    void Promise.resolve().then(() => {
      this.#notificationPending = false
      for (const listener of this.#listeners) listener()
    })
  }
  #failure = (error: unknown) => {
    if (!this.#error) this.#error = error instanceof Error ? error.message : String(error)
    this.#changed()
  }
  #release = (receipt: TReceipt) => {
    try {
      void this.document
        .unbindFieldInput(JSON.stringify({ metadataTarget: receipt.metadataTarget, ownerToken: receipt.ownerToken }))
        .catch(this.#failure)
    } catch (error) {
      this.#failure(error)
    }
  }
  #install = (request: string): Promise<string> => {
    try {
      return this.document.bindFieldInput(request)
    } catch (error) {
      return Promise.reject(error)
    }
  }
  #withdraw = () => {
    this.#pending = null
    if (this.#bound) this.#release(this.#bound)
    this.#bound = null
    this.#mountKey = ""
  }
  configure = (plan: TNativeFieldInputPlan | null) => {
    if (this.#closed || this.#plan === plan) return
    if (
      plan &&
      (!plan.bindingId ||
        !plan.bindingRevision ||
        plan.outer === plan.input ||
        plan.outerTarget === plan.inputTarget ||
        [plan.outerTarget, plan.inputTarget, plan.originalTarget].some(
          (value) => !Number.isSafeInteger(value) || value <= 0 || value > 2147483647,
        ))
    )
      throw new Error("field-input-plan-invalid")
    const previous = this.#plan
    const retainOriginalBinding =
      this.#bound &&
      previous &&
      plan &&
      previous.bindingId === plan.bindingId &&
      previous.outer === plan.outer &&
      previous.input === plan.input &&
      previous.outerTarget === plan.outerTarget &&
      previous.inputTarget === plan.inputTarget &&
      previous.originalTarget === plan.originalTarget &&
      this.native.getLease() === this.#lease
    if (!retainOriginalBinding) this.#withdraw()
    this.#plan = plan
    this.#failed = null
    this.#changed()
  }
  scope = (plan: TNativeFieldInputPlan): TNativeFieldInputScope =>
    Object.freeze({
      bindingId: plan.bindingId,
      bindingRevision: plan.bindingRevision,
      native: this.native,
      current: () => !this.#closed && this.#plan === plan && !!this.#bound && this.native.getLease() === this.#lease,
    })
  metadataFor = (plan: TNativeFieldInputPlan | null): TNativeFieldInputMetadata => ({
    binding: (ownerId) => {
      return !plan || this.#closed
        ? ""
        : JSON.stringify({
            version: 1,
            ownerId,
            bindingId: plan.bindingId,
            bindingRevision: plan.bindingRevision,
            moduleLease: this.#lease,
            outerTarget: plan.outerTarget,
            inputTarget: plan.inputTarget,
          })
    },
    commit: (mount) => {
      if (this.#closed || !plan || this.#plan !== plan) return
      if (
        !mount.active ||
        !mount.attached ||
        !mount.complete ||
        !mount.metadataOnly ||
        mount.error ||
        mount.originalTarget !== plan.originalTarget ||
        this.native.getLease() !== this.#lease
      ) {
        this.#withdraw()
        this.#changed()
        return
      }
      const mountKey = JSON.stringify([
        mount.ownerId,
        mount.target,
        mount.originalTarget,
        mount.surfaceId,
        mount.windowId,
      ])
      if (this.#mountKey && this.#mountKey !== mountKey) this.#withdraw()
      if (this.#bound?.metadataTarget === mount.target || this.#pending || this.#failed === plan) return
      this.#withdraw()
      this.#mountKey = mountKey
      const pending = {},
        requestId = `${plan.bindingId}:input:${++requests}`
      this.#pending = pending
      const fieldGroupBinding = this.metadataFor(plan).binding(mount.ownerId)
      this.#changed()
      void this.#install(JSON.stringify({ requestId, mount, fieldGroupBinding }))
        .then((encoded) => {
          const receipt = JSON.parse(encoded) as TReceipt
          if (
            !receipt ||
            typeof receipt !== "object" ||
            Array.isArray(receipt) ||
            Object.keys(receipt).length !== 3 ||
            receipt.requestId !== requestId ||
            typeof receipt.ownerToken !== "string" ||
            !receipt.ownerToken ||
            receipt.metadataTarget !== mount.target
          )
            throw new Error("field-input-binding-response-invalid")
          if (
            this.#closed ||
            this.#pending !== pending ||
            this.#plan !== plan ||
            this.#mountKey !== mountKey ||
            this.native.getLease() !== this.#lease
          ) {
            this.#release(receipt)
            return
          }
          this.#pending = null
          this.#bound = Object.freeze(receipt)
          this.#changed()
        })
        .catch((error: unknown) => {
          if (this.#pending === pending) {
            this.#pending = null
            this.#failed = plan
            this.#failure(error)
          }
        })
    },
  })
  retire = () => {
    if (this.#closed) return
    this.#closed = true
    this.#withdraw()
    this.#plan = null
    this.#changed()
  }
}
