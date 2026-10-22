import type { NativeSyntheticEvent } from "react-native"

import type { NativeFocusWithinData } from "./specs/CUIFocusViewNativeComponent"

export type TNativeFocusWithinEvent = NativeSyntheticEvent<NativeFocusWithinData>
type TScope = Readonly<{ ownerId: string; windowId?: string; epoch?: number; active: boolean }>
type TOptions = Readonly<{
  ownerId: string
  target: () => number | null
  scope: () => TScope
  changed: (binding: string) => void
  receive: (event: TNativeFocusWithinEvent) => void
  retire: () => void
}>
let serial = 0
const integer = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value)
export const readNativeFocusWithin = (value: unknown): Readonly<NativeFocusWithinData> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  for (const key of ["ownerId", "bindingId", "windowId", "scopeOwnerId", "origin"])
    if (typeof data[key] !== "string") return null
  for (const key of ["target", "surfaceId", "scopeEpoch", "sequence", "focusedTarget"])
    if (!integer(data[key])) return null
  for (const key of ["attached", "active", "within", "textInputFocused"])
    if (typeof data[key] !== "boolean") return null
  if (
    !data.ownerId ||
    !data.bindingId ||
    (data.target as number) <= 0 ||
    (data.sequence as number) <= 0 ||
    (data.scopeEpoch as number) < 0 ||
    (data.focusedTarget as number) < 0 ||
    typeof data.observedAt !== "number" ||
    !Number.isFinite(data.observedAt) ||
    data.observedAt < 0 ||
    (data.active && (!data.attached || !data.windowId || (data.surfaceId as number) <= 0)) ||
    (data.within && (!data.active || (data.focusedTarget as number) <= 0)) ||
    (data.textInputFocused && !data.within)
  )
    return null
  return Object.freeze(
    Object.fromEntries(
      [
        "ownerId",
        "bindingId",
        "target",
        "surfaceId",
        "windowId",
        "scopeOwnerId",
        "scopeEpoch",
        "sequence",
        "attached",
        "active",
        "within",
        "focusedTarget",
        "textInputFocused",
        "origin",
        "observedAt",
      ].map((key) => [key, data[key]]),
    ),
  ) as Readonly<NativeFocusWithinData>
}

// Each ref attachment and physical scope owns a distinct read-only observation binding.
export class NativeFocusWithinSession {
  #attached = false
  #binding = ""
  #stamp = ""
  #sequence = 0
  constructor(readonly options: TOptions) {}
  attach = () => {
    this.#attached = true
    this.#stamp = ""
    this.refreshScope()
  }
  detach = () => {
    this.#attached = false
    this.#stamp = ""
    this.#sequence = 0
    if (this.#binding) {
      this.#binding = ""
      this.options.changed("")
      this.options.retire()
    }
  }
  refreshScope = () => {
    const scope = this.options.scope(),
      target = this.options.target()
    const stamp = JSON.stringify([target, scope.ownerId, scope.windowId, scope.epoch, scope.active])
    const eligible = this.#attached && !!target && target > 0 && scope.active && (!scope.ownerId || !!scope.windowId)
    if (stamp === this.#stamp && (eligible ? !!this.#binding : !this.#binding)) return
    this.#stamp = stamp
    this.#sequence = 0
    if (this.#binding) this.options.retire()
    this.#binding = eligible ? `${this.options.ownerId}:within:${++serial}` : ""
    this.options.changed(this.#binding)
  }
  receive = (event: TNativeFocusWithinEvent) => {
    if (!this.#attached || !this.#binding) return false
    this.refreshScope()
    const data = readNativeFocusWithin(event.nativeEvent),
      scope = this.options.scope()
    if (
      !this.#binding ||
      !data ||
      data.ownerId !== this.options.ownerId ||
      data.bindingId !== this.#binding ||
      data.target !== this.options.target() ||
      data.sequence <= this.#sequence
    )
      return false
    this.#sequence = data.sequence
    if (
      data.active &&
      (!scope.active ||
        (scope.ownerId &&
          (data.scopeOwnerId !== scope.ownerId || data.windowId !== scope.windowId || data.scopeEpoch !== scope.epoch)))
    ) {
      this.options.retire()
      return false
    }
    this.options.receive(event)
    return true
  }
}
