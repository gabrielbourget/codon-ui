import type { NativeFormActionStatus } from "../input/specs/CUIFocusViewNativeComponent"

const positive = (value: number) => Number.isSafeInteger(value) && value > 0
export const NATIVE_FORM_ACTION_LEASE_KEYS = [
  "ownerId",
  "descriptorRevision",
  "viewOwnerId",
  "target",
  "surfaceId",
  "windowId",
  "epoch",
  "sequence",
  "scopeOwnerId",
  "scopeEpoch",
  "attached",
  "active",
  "enabled",
] as const

export class NativeFormActionLease {
  readonly scope: Readonly<Pick<NativeFormActionStatus, "ownerId" | "descriptorRevision" | "target">>
  readonly #original: WeakSet<object>
  #closed = false
  #epoch = 0
  #sequence = 0
  #last: NativeFormActionStatus | null = null
  #lease: NativeFormActionStatus | null = null
  constructor(
    scope: Readonly<Pick<NativeFormActionStatus, "ownerId" | "descriptorRevision" | "target">>,
    original: object,
    readonly current: () => object | null,
  ) {
    if (!scope.ownerId || !scope.descriptorRevision || !positive(scope.target) || scope.target > 2147483647)
      throw new Error("native-form-action-original-target-required")
    this.scope = Object.freeze({ ...scope })
    this.#original = new WeakSet([original])
  }

  getSnapshot = () => {
    const original = !this.#closed && this.current()
    if (!original || !this.#original.has(original)) {
      this.retire()
      return null
    }
    return this.#lease
  }
  receive = (packet: NativeFormActionStatus) => {
    if (this.#closed || !packet || typeof packet !== "object" || Array.isArray(packet)) return false
    const original = this.current()
    if (!original || !this.#original.has(original)) {
      this.retire()
      return false
    }
    if (
      packet.ownerId !== this.scope.ownerId ||
      packet.descriptorRevision !== this.scope.descriptorRevision ||
      packet.target !== this.scope.target ||
      !positive(packet.target) ||
      packet.target > 2147483647 ||
      typeof packet.viewOwnerId !== "string" ||
      !packet.viewOwnerId ||
      typeof packet.windowId !== "string" ||
      !Number.isSafeInteger(packet.surfaceId) ||
      packet.surfaceId < -1 ||
      !positive(packet.epoch) ||
      !positive(packet.sequence) ||
      typeof packet.scopeOwnerId !== "string" ||
      !Number.isSafeInteger(packet.scopeEpoch) ||
      packet.scopeEpoch < 0 ||
      (packet.scopeOwnerId ? !positive(packet.scopeEpoch) : packet.scopeEpoch !== 0) ||
      typeof packet.attached !== "boolean" ||
      typeof packet.active !== "boolean" ||
      typeof packet.enabled !== "boolean" ||
      packet.epoch < this.#epoch ||
      packet.sequence <= this.#sequence ||
      (packet.epoch === this.#epoch &&
        this.#last &&
        ["viewOwnerId", "windowId", "scopeOwnerId", "scopeEpoch", "surfaceId"].some(
          (key) => packet[key as keyof NativeFormActionStatus] !== this.#last![key as keyof NativeFormActionStatus],
        )) ||
      (packet.active && (!packet.attached || !packet.windowId || packet.surfaceId <= 0))
    )
      return false
    this.#epoch = packet.epoch
    this.#sequence = packet.sequence
    const owned = Object.freeze(
      Object.fromEntries(NATIVE_FORM_ACTION_LEASE_KEYS.map((key) => [key, packet[key]])),
    ) as NativeFormActionStatus
    this.#last = owned
    this.#lease = owned.attached && owned.active && owned.enabled ? owned : null
    return true
  }
  retire = () => {
    this.#closed = true
    this.#lease = null
  }
}
