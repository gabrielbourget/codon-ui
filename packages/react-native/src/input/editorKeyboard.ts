import type { NativeSyntheticEvent, TextInput } from "react-native"

export const NATIVE_EDITOR_KEY_PHASES = ["down", "up", "cancel"] as const
export type TNativeEditorKeyPhase = (typeof NATIVE_EDITOR_KEY_PHASES)[number]
export type TNativeEditorKeyboardIdentity = Readonly<{
  ownerId: string
  bindingId: string
  bindingRevision: string
  target: number
  windowId: string
  epoch: number
}>
export type TNativeEditorKeyData = TNativeEditorKeyboardIdentity &
  Readonly<{
    eventId: number
    phase: TNativeEditorKeyPhase
    key: string
    code: string
    nativeCode: number
    location: number
    repeat: boolean
    cancelled: boolean
    isComposing: boolean
    shiftKey: boolean
    altKey: boolean
    ctrlKey: boolean
    metaKey: boolean
    capsLock: boolean
    nativeModifierData: string
    timestamp: number
  }>
export type TNativeEditorKeyEvent = NativeSyntheticEvent<TNativeEditorKeyData>
export type TNativeEditorKeyboardStatus = TNativeEditorKeyboardIdentity &
  Readonly<{
    sequence: number
    ready: boolean
    windowActive: boolean
  }>
export type TNativeEditorKeyboardAcknowledgement = TNativeEditorKeyboardIdentity &
  Readonly<{
    eventId: number
    phase: TNativeEditorKeyPhase
    current: boolean
    preventDefault: boolean
  }>
export type TNativeEditorKeyboardCallbacks = Readonly<{
  owned?: (event: TNativeEditorKeyEvent, editor: TextInput) => void
  onKeyDown?: (event: TNativeEditorKeyEvent, editor: TextInput) => void
  onKeyUp?: (event: TNativeEditorKeyEvent, editor: TextInput) => void
  onKeyCancel?: (event: TNativeEditorKeyEvent, editor: TextInput) => void
}>
const IDENTITY_FIELDS = ["ownerId", "bindingId", "bindingRevision", "target", "windowId", "epoch"] as const

// Models only the JS half of a live native dispatch. A successful acknowledgement is not an SDK default verdict.
export class NativeEditorKeyboardLease {
  readonly #identity: TNativeEditorKeyboardIdentity
  readonly #original: TextInput
  readonly #current: () => TextInput | null
  readonly #callbacks: () => TNativeEditorKeyboardCallbacks
  readonly #acknowledge: (request: TNativeEditorKeyboardAcknowledgement) => boolean
  #live = true
  #ready = false
  #statusSequence = 0
  #eventId = 0

  constructor(options: {
    identity: TNativeEditorKeyboardIdentity
    original: TextInput
    current: () => TextInput | null
    callbacks: () => TNativeEditorKeyboardCallbacks
    acknowledge: (request: TNativeEditorKeyboardAcknowledgement) => boolean
  }) {
    const identity = options.identity
    if (
      ![identity.ownerId, identity.bindingId, identity.bindingRevision, identity.windowId].every(
        (value) => typeof value === "string" && value.length > 0,
      ) ||
      !Number.isSafeInteger(identity.target) ||
      identity.target <= 0 ||
      identity.target > 2147483647 ||
      !Number.isSafeInteger(identity.epoch) ||
      identity.epoch <= 0
    )
      throw new Error("Native editor keyboard binding identity is invalid")
    this.#identity = Object.freeze({ ...options.identity })
    this.#original = options.original
    this.#current = options.current
    this.#callbacks = options.callbacks
    this.#acknowledge = options.acknowledge
  }
  #matches = (value: TNativeEditorKeyboardIdentity) =>
    IDENTITY_FIELDS.every((field) => value[field] === this.#identity[field])
  #isCurrent = () => this.#live && this.#ready && this.#current() === this.#original

  acceptStatus = (status: TNativeEditorKeyboardStatus) => {
    if (
      !this.#live ||
      !this.#matches(status) ||
      !Number.isSafeInteger(status.sequence) ||
      status.sequence <= this.#statusSequence
    )
      return false
    this.#statusSequence = status.sequence
    this.#ready = status.ready && status.windowActive
    return this.#isCurrent()
  }

  receive = (event: TNativeEditorKeyEvent) => {
    const data = event.nativeEvent
    if (
      !this.#isCurrent() ||
      !this.#matches(data) ||
      !Number.isSafeInteger(data.eventId) ||
      data.eventId <= this.#eventId ||
      !NATIVE_EDITOR_KEY_PHASES.includes(data.phase) ||
      data.cancelled !== (data.phase === "cancel") ||
      !Number.isFinite(data.timestamp) ||
      data.timestamp < 0
    )
      return "rejected" as const
    this.#eventId = data.eventId
    event.persist()
    let acknowledged = false
    try {
      const callbacks = this.#callbacks()
      callbacks.owned?.(event, this.#original)
      if (this.#isCurrent()) {
        if (data.phase === "down") callbacks.onKeyDown?.(event, this.#original)
        else if (data.phase === "up") callbacks.onKeyUp?.(event, this.#original)
        else callbacks.onKeyCancel?.(event, this.#original)
      }
    } finally {
      const current = this.#isCurrent()
      acknowledged = this.#acknowledge({
        ...this.#identity,
        eventId: data.eventId,
        phase: data.phase,
        current,
        preventDefault: current && data.phase !== "cancel" && (event.defaultPrevented || event.isDefaultPrevented()),
      })
    }
    return this.#isCurrent()
      ? acknowledged
        ? ("acknowledged" as const)
        : ("unacknowledged" as const)
      : ("retired" as const)
  }

  retire = () => {
    this.#live = false
    this.#ready = false
  }
}
