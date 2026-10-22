import type { NativeFormCommitData } from "../input/specs/CUIFormRootNativeComponent"

export type TNativeFormMountScope = Readonly<
  Pick<NativeFormCommitData, "ownerId" | "descriptorId" | "descriptorRevision" | "target" | "originalTarget">
>
type TTargets = Readonly<{
  metadata: object
  original: object
  current: () => Readonly<{ metadata: object | null; original: object | null }>
}>
const positive = (value: number) => Number.isSafeInteger(value) && value > 0

// A mount acknowledgment identifies original current objects. It is neither
// committed document order nor permission to submit, reset or move focus.
export class NativeFormMountReceipt {
  readonly scope: TNativeFormMountScope
  readonly #metadata: WeakSet<object>
  readonly #original: WeakSet<object>
  readonly #targets: TTargets["current"]
  #closed = false
  #epoch = 0
  #sequence = 0
  #window = ""
  #active = false
  #receipt: NativeFormCommitData | null = null

  constructor(scope: TNativeFormMountScope, targets: TTargets) {
    if (
      !scope.ownerId ||
      !scope.descriptorId ||
      !scope.descriptorRevision ||
      !positive(scope.target) ||
      !positive(scope.originalTarget)
    )
      throw new Error("original-native-form-targets-required")
    this.scope = Object.freeze({ ...scope })
    this.#metadata = new WeakSet([targets.metadata])
    this.#original = new WeakSet([targets.original])
    this.#targets = targets.current
  }

  #current = () => {
    if (this.#closed) return false
    const { metadata, original } = this.#targets()
    if (!metadata || !original || !this.#metadata.has(metadata) || !this.#original.has(original)) {
      this.retire()
      return false
    }
    return true
  }

  getSnapshot = () => (this.#current() ? this.#receipt : null)
  retire = () => {
    this.#closed = true
    this.#receipt = null
  }

  receive = (packet: NativeFormCommitData): boolean => {
    if (!this.#current() || !packet || typeof packet !== "object" || Array.isArray(packet)) return false
    const scope = this.scope
    if (
      packet.ownerId !== scope.ownerId ||
      packet.descriptorId !== scope.descriptorId ||
      packet.descriptorRevision !== scope.descriptorRevision ||
      packet.target !== scope.target ||
      packet.originalTarget !== scope.originalTarget ||
      !positive(packet.epoch) ||
      !positive(packet.sequence) ||
      !Number.isSafeInteger(packet.surfaceId) ||
      packet.surfaceId < -1 ||
      typeof packet.windowId !== "string" ||
      !packet.mountRevision ||
      typeof packet.mountRevision !== "string" ||
      typeof packet.originalClass !== "string" ||
      typeof packet.error !== "string" ||
      typeof packet.attached !== "boolean" ||
      typeof packet.active !== "boolean" ||
      (packet.active && !packet.complete) ||
      typeof packet.complete !== "boolean" ||
      typeof packet.metadataOnly !== "boolean" ||
      packet.epoch < this.#epoch ||
      packet.sequence <= this.#sequence ||
      (packet.epoch === this.#epoch && packet.windowId !== this.#window) ||
      (packet.epoch === this.#epoch && packet.active !== this.#active) ||
      (packet.complete &&
        (!packet.attached ||
          !packet.metadataOnly ||
          packet.error !== "" ||
          !packet.windowId ||
          !packet.originalClass ||
          packet.surfaceId <= 0))
    )
      return false
    this.#epoch = packet.epoch
    this.#sequence = packet.sequence
    this.#window = packet.windowId
    this.#active = packet.active
    this.#receipt = packet.complete ? Object.freeze({ ...packet }) : null
    return true
  }
}
