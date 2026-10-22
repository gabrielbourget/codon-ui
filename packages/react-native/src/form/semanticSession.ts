import type { NativeFormCommitData } from "../input/specs/CUIFormRootNativeComponent"
import FormDocument from "../input/specs/NativeCUIFormDocument"

import type { NativeFormMountReceipt } from "./mount"

type TRuntime = Readonly<{
  bindField: (request: string) => Promise<string>
  unbindField: (request: string) => Promise<boolean>
}>
type TAttempt = Readonly<{ mount: NativeFormCommitData; frame: string; key: string; epoch: string }>
type TWatch = Readonly<{ metadataTarget: number; ownerToken: string; epoch: string }>
let nextBindingRequest = 0
const nativeRuntime: TRuntime = {
  bindField: (request) =>
    FormDocument?.bindField?.(request) ?? Promise.reject(new Error("native-field-binding-unavailable")),
  unbindField: (request) => FormDocument?.unbindField?.(request) ?? Promise.resolve(false),
}

// A returned token owns a native watch, not proof that SDK metadata or an
// accessibility-focus request was delivered. Native inspection proves those.
export class NativeFieldSemanticSession {
  #closed = false
  #pending = false
  #latest: TAttempt | null = null
  #lastAttempt = ""
  #watch: TWatch | null = null
  constructor(
    readonly receipt: NativeFormMountReceipt,
    readonly runtime: TRuntime = nativeRuntime,
  ) {}

  #release = () => {
    const watch = this.#watch
    this.#watch = null
    if (watch)
      void Promise.resolve()
        .then(() =>
          this.runtime.unbindField(
            JSON.stringify({ metadataTarget: watch.metadataTarget, ownerToken: watch.ownerToken }),
          ),
        )
        .catch(() => {})
  }
  retire = () => {
    if (this.#closed) return
    this.#closed = true
    this.#latest = null
    this.#release()
  }
  observe = (frame: string) => {
    if (this.#closed) return
    const mount = this.receipt.getSnapshot()
    if (!mount?.active || !frame) {
      this.#latest = null
      this.#release()
      return
    }
    const epoch = JSON.stringify([mount.windowId, mount.epoch])
    this.#latest = { mount, frame, epoch, key: JSON.stringify([epoch, mount.sequence, frame]) }
    if (this.#watch?.epoch === epoch) return
    this.#release()
    this.#pump()
  }
  #pump = () => {
    if (this.#closed || this.#pending || !this.#latest || this.#latest.key === this.#lastAttempt) return
    const attempt = this.#latest
    this.#lastAttempt = attempt.key
    this.#pending = true
    const requestId = `${this.receipt.scope.descriptorRevision}:semantics:${++nextBindingRequest}`
    const request = { requestId, mount: attempt.mount, semanticBinding: attempt.frame }
    void Promise.resolve()
      .then(() => {
        const mount = this.receipt.getSnapshot()
        if (
          this.#closed ||
          !mount?.active ||
          mount.epoch !== attempt.mount.epoch ||
          mount.windowId !== attempt.mount.windowId
        )
          throw new Error("native-field-binding-owner-retired")
        return this.runtime.bindField(JSON.stringify(request))
      })
      .then((encoded) => {
        const result = JSON.parse(encoded) as Record<string, unknown>
        if (
          !result ||
          Array.isArray(result) ||
          result.requestId !== requestId ||
          result.metadataTarget !== this.receipt.scope.target ||
          typeof result.ownerToken !== "string" ||
          !result.ownerToken
        )
          throw new Error("native-field-binding-response-invalid")
        const token: TWatch = {
          metadataTarget: this.receipt.scope.target,
          ownerToken: result.ownerToken,
          epoch: attempt.epoch,
        }
        const mount = this.receipt.getSnapshot()
        if (
          !this.#closed &&
          this.#latest &&
          mount?.active &&
          JSON.stringify([mount.windowId, mount.epoch]) === attempt.epoch
        )
          this.#watch = token
        else
          void Promise.resolve()
            .then(() =>
              this.runtime.unbindField(
                JSON.stringify({ metadataTarget: token.metadataTarget, ownerToken: token.ownerToken }),
              ),
            )
            .catch(() => {})
      })
      .catch(() => {
        // Only a genuinely new native acknowledgment may start another attempt.
      })
      .finally(() => {
        this.#pending = false
        if (this.#closed || !this.#latest || this.#watch?.epoch === this.#latest.epoch) return
        this.#release()
        this.#pump()
      })
  }
}
