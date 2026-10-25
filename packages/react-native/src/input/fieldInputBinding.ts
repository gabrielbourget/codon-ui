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
  receive: (event: NativeSyntheticEvent<Readonly<{ record: string }>>) => void
  record?: (event: NativeSyntheticEvent<Readonly<{ record: string }>>) => void
}>
type TModule = TNativeFieldInputScope["native"]
type TDocumentModule = Readonly<{
  bindFieldInput: (request: string) => Promise<string>
  unbindFieldInput: (request: string) => Promise<boolean>
}>
type TBindingStatus = Readonly<{
  kind: "binding-status"
  requestId: string
  ownerToken: string
  metadataTarget: number
  ownerId: string
  moduleLease: string
  bindingId: string
  bindingRevision: string
  generation: number
  ready: boolean
  error: string
}>
type TReceipt = Readonly<{ requestId: string; ownerToken: string; metadataTarget: number; status: TBindingStatus }>
type TPending = { requestId: string; mount: NativeFormCommitData; statuses: Map<string, TBindingStatus> }
const bindingStatus = (value: unknown): value is TBindingStatus => {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 11) return false
  const status = value as TBindingStatus
  return (
    status.kind === "binding-status" &&
    [
      status.requestId,
      status.ownerToken,
      status.ownerId,
      status.moduleLease,
      status.bindingId,
      status.bindingRevision,
    ].every((item) => typeof item === "string" && item.length > 0) &&
    Number.isSafeInteger(status.metadataTarget) &&
    status.metadataTarget > 0 &&
    Number.isSafeInteger(status.generation) &&
    status.generation >= 0 &&
    typeof status.ready === "boolean" &&
    (!status.ready || status.generation > 0) &&
    typeof status.error === "string" &&
    (!status.ready || status.error === "")
  )
}
let requests = 0

// This session owns only a committed field's two original roots and binding
// lifetime. The immutable native document owns every descendant and selection.
export class NativeFieldInputSession {
  #plan: TNativeFieldInputPlan | null = null
  #bound: TReceipt | null = null
  #pending: TPending | null = null
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
  #ready = () =>
    !!this.#bound &&
    !this.#closed &&
    this.native.getLease() === this.#lease &&
    this.#bound.status.ready &&
    this.#bound.status.bindingId === this.#plan?.bindingId &&
    this.#bound.status.bindingRevision === this.#plan?.bindingRevision
  status = () =>
    Object.freeze({
      ready: this.#ready(),
      pending:
        !!this.#pending || (!!this.#bound && !this.#ready() && !this.#closed && this.native.getLease() === this.#lease),
      error: this.#bound?.status.error ?? this.#error,
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
      current: () => this.#plan === plan && this.#ready(),
    })
  metadataFor = (plan: TNativeFieldInputPlan | null): TNativeFieldInputMetadata => ({
    receive: (event) => {
      if (this.#closed || !plan || this.#plan !== plan || this.native.getLease() !== this.#lease) return
      let status: unknown
      try {
        status = JSON.parse(event.nativeEvent.record)
      } catch {
        return
      }
      if (
        !bindingStatus(status) ||
        status.moduleLease !== this.#lease ||
        status.bindingId !== plan.bindingId ||
        status.bindingRevision !== plan.bindingRevision
      )
        return
      const receipt = this.#bound
      if (receipt) {
        if (
          status.requestId !== receipt.requestId ||
          status.ownerToken !== receipt.ownerToken ||
          status.metadataTarget !== receipt.metadataTarget ||
          status.ownerId !== receipt.status.ownerId ||
          status.generation <= receipt.status.generation
        )
          return
        this.#bound = Object.freeze({ ...receipt, status: Object.freeze(status) })
        this.#changed()
      } else if (
        this.#pending?.requestId === status.requestId &&
        this.#pending.mount.target === status.metadataTarget &&
        this.#pending.mount.ownerId === status.ownerId
      ) {
        const previous = this.#pending.statuses.get(status.ownerToken)
        if (!previous || status.generation > previous.generation)
          this.#pending.statuses.set(status.ownerToken, Object.freeze(status))
      }
    },
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
      const requestId = `${plan.bindingId}:input:${++requests}`,
        pending: TPending = { requestId, mount, statuses: new Map() }
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
            Object.keys(receipt).length !== 4 ||
            receipt.requestId !== requestId ||
            typeof receipt.ownerToken !== "string" ||
            !receipt.ownerToken ||
            receipt.metadataTarget !== mount.target
          )
            throw new Error("field-input-binding-response-invalid")
          if (
            !bindingStatus(receipt.status) ||
            receipt.status.requestId !== requestId ||
            receipt.status.ownerToken !== receipt.ownerToken ||
            receipt.status.metadataTarget !== mount.target ||
            receipt.status.ownerId !== mount.ownerId ||
            receipt.status.moduleLease !== this.#lease ||
            receipt.status.bindingId !== plan.bindingId ||
            receipt.status.bindingRevision !== plan.bindingRevision
          ) {
            this.#release(receipt)
            throw new Error("field-input-binding-response-invalid")
          }
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
          const observed = pending.statuses.get(receipt.ownerToken)
          this.#pending = null
          this.#bound = Object.freeze({
            ...receipt,
            status:
              observed && observed.generation > receipt.status.generation ? observed : Object.freeze(receipt.status),
          })
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
