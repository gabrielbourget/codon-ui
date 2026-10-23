import { createContext } from "react"

import type { TNativeKeyboardEvent } from "./types"

const PHASES = ["down", "up", "cancel"] as const
const FOCUS_ACTIONS = ["first", "next", "previous", "physical-left", "physical-right", "press"] as const
export type TNativeFieldFocusAction = Readonly<{ groupTarget: number; kind: (typeof FOCUS_ACTIONS)[number] }>
export type TNativeFieldInputIdentity = Readonly<{
  ownerId: string
  bindingId: string
  bindingRevision: string
  metadataTarget: number
  outerTarget: number
  inputTarget: number
  surfaceId: number
  target: number
  documentId: string
  documentRevision: string
  windowId: string
  mountRevision: string
  outerInstance: string
  inputInstance: string
  nativeInstance: string
  editorInstance: string
  epoch: number
}>
export type TNativeFieldInputGroup = Readonly<{
  target: number
  bindingId: string
  bindingRevision: string
  scopeTarget: number
}>
export type TNativeFieldInputPacket = Readonly<{
  moduleLease: string
  token: number
  eventId: number
  phase: (typeof PHASES)[number]
  identity: TNativeFieldInputIdentity
  groups: readonly TNativeFieldInputGroup[]
}>
export type TNativeFieldKeyEvent = TNativeKeyboardEvent & { nativeEvent: Readonly<{ fieldDispatch: string }> }
export type TNativeFieldFocusResult = Readonly<{
  requested: boolean
  observed: boolean
  current: boolean
  target: number
  nativeInstance: string
  editorInstance: string
  error: string
}>
type TModule = Readonly<{
  getLease: () => string
  acceptsField: (request: string) => boolean
  settleField: (request: string) => boolean
  moveFieldFocus: (request: string) => string
}>
export type TNativeFieldInputScope = Readonly<{
  bindingId: string
  bindingRevision: string
  current: () => boolean
  native: TModule
}>
export const NativeFieldInputContext = createContext<TNativeFieldInputScope | null>(null)

const invalid = (): never => {
  throw new Error("invalid-native-field-input-packet")
}
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : invalid()
const text = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : invalid())
const integer = (value: unknown, tag = false) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 && (!tag || value <= 2147483647)
    ? value
    : invalid()
const boolean = (value: unknown) => (typeof value === "boolean" ? value : invalid())

export const decodeNativeFieldInputPacket = (encoded: string): TNativeFieldInputPacket => {
  const value = object(JSON.parse(encoded)),
    raw = object(value.identity)
  if (
    Object.keys(value).length !== 6 ||
    Object.keys(raw).length !== 17 ||
    !PHASES.includes(value.phase as never) ||
    !Array.isArray(value.groups) ||
    !value.groups.length
  )
    invalid()
  const identity = Object.freeze({
    ownerId: text(raw.ownerId),
    bindingId: text(raw.bindingId),
    bindingRevision: text(raw.bindingRevision),
    metadataTarget: integer(raw.metadataTarget, true),
    outerTarget: integer(raw.outerTarget, true),
    inputTarget: integer(raw.inputTarget, true),
    surfaceId: integer(raw.surfaceId, true),
    target: integer(raw.target, true),
    documentId: text(raw.documentId),
    documentRevision: text(raw.documentRevision),
    windowId: text(raw.windowId),
    mountRevision: text(raw.mountRevision),
    outerInstance: text(raw.outerInstance),
    inputInstance: text(raw.inputInstance),
    nativeInstance: text(raw.nativeInstance),
    editorInstance: text(raw.editorInstance),
    epoch: integer(raw.epoch),
  })
  if (identity.outerTarget === identity.inputTarget || !/^(0|[1-9][0-9]*)$/.test(identity.documentRevision)) invalid()
  const targets = new Set<number>()
  const groups = (value.groups as unknown[]).map((entry) => {
    const group = object(entry)
    if (Object.keys(group).length !== 4) invalid()
    const target = integer(group.target, true)
    if (targets.has(target)) invalid()
    targets.add(target)
    return Object.freeze({
      target,
      bindingId: text(group.bindingId),
      bindingRevision: text(group.bindingRevision),
      scopeTarget: integer(group.scopeTarget, true),
    })
  })
  if (
    !groups.some(
      (group) =>
        group.bindingId === identity.bindingId &&
        group.bindingRevision === identity.bindingRevision &&
        group.target === identity.outerTarget,
    )
  )
    return invalid()
  return Object.freeze({
    moduleLease: text(value.moduleLease),
    token: integer(value.token),
    eventId: integer(value.eventId),
    phase: value.phase as TNativeFieldInputPacket["phase"],
    identity,
    groups: Object.freeze(groups),
  })
}
const request = (packet: TNativeFieldInputPacket) => ({
  token: packet.token,
  identity: packet.identity,
  eventId: packet.eventId,
  phase: packet.phase,
})
const packets = new WeakMap<object, TNativeFieldInputPacket>()
const settled = new WeakSet<object>()
const packetFor = (event: TNativeFieldKeyEvent) => {
  let packet = packets.get(event)
  if (!packet) {
    packet = decodeNativeFieldInputPacket(event.nativeEvent.fieldDispatch)
    if (
      packet.identity.target !== event.nativeEvent.target ||
      (packet.phase === "cancel"
        ? event.nativeEvent.phase !== "up" || !event.nativeEvent.cancelled
        : packet.phase !== event.nativeEvent.phase || event.nativeEvent.cancelled)
    )
      invalid()
    packets.set(event, packet)
  }
  return packet
}
const admitted = (scope: TNativeFieldInputScope, packet: TNativeFieldInputPacket) =>
  scope.current() &&
  scope.native.getLease() === packet.moduleLease &&
  packet.groups.some(
    (group) => group.bindingId === scope.bindingId && group.bindingRevision === scope.bindingRevision,
  ) &&
  scope.native.acceptsField(JSON.stringify(request(packet)))
export const isNativeFieldInputCurrent = (scope: TNativeFieldInputScope, event: TNativeFieldKeyEvent) =>
  !settled.has(event) && admitted(scope, packetFor(event))

export const moveNativeFieldFocus = (
  scope: TNativeFieldInputScope,
  event: TNativeFieldKeyEvent,
  action: TNativeFieldFocusAction,
): TNativeFieldFocusResult | null => {
  const packet = packetFor(event)
  if (
    !admitted(scope, packet) ||
    settled.has(event) ||
    packet.phase === "cancel" ||
    !FOCUS_ACTIONS.includes(action.kind) ||
    !packet.groups.some(
      (group) =>
        group.scopeTarget === action.groupTarget &&
        group.bindingId === scope.bindingId &&
        group.bindingRevision === scope.bindingRevision,
    )
  )
    return null
  const result = object(JSON.parse(scope.native.moveFieldFocus(JSON.stringify({ ...request(packet), action }))))
  const target =
    typeof result.target === "number" &&
    Number.isSafeInteger(result.target) &&
    result.target >= 0 &&
    result.target <= 2147483647
      ? result.target
      : invalid()
  const requested = boolean(result.requested),
    observed = boolean(result.observed),
    current = boolean(result.current),
    nativeInstance = typeof result.nativeInstance === "string" ? result.nativeInstance : invalid(),
    editorInstance = typeof result.editorInstance === "string" ? result.editorInstance : invalid(),
    error = typeof result.error === "string" ? result.error : invalid()
  if (
    typeof result.nativeInstance !== "string" ||
    typeof result.editorInstance !== "string" ||
    typeof result.error !== "string" ||
    (observed && (target === 0 || !result.nativeInstance || !result.editorInstance)) ||
    (requested && !observed && !error)
  )
    invalid()
  return Object.freeze({
    requested,
    observed,
    current,
    target,
    nativeInstance,
    editorInstance,
    error,
  })
}

// React performs the original bubbling. This receiver never enumerates child
// callbacks, changes event methods, clones events or infers focus completion.
export const receiveNativeFieldKey = (
  scope: TNativeFieldInputScope,
  event: TNativeFieldKeyEvent,
  receiver: Readonly<{ target: number; group: boolean; run: () => void }>,
) => {
  const packet = packetFor(event)
  if (
    settled.has(event) ||
    !admitted(scope, packet) ||
    (receiver.group &&
      !packet.groups.some(
        (group) =>
          group.target === receiver.target &&
          group.bindingId === scope.bindingId &&
          group.bindingRevision === scope.bindingRevision,
      ))
  )
    return false
  event.persist()
  let failed = true
  try {
    receiver.run()
    failed = false
  } finally {
    if (failed || event.isPropagationStopped() || receiver.target === packet.groups.at(-1)!.target) {
      settled.add(event)
      const current = !failed && admitted(scope, packet)
      scope.native.settleField(
        JSON.stringify({
          ...request(packet),
          current,
          preventDefault:
            current && packet.phase !== "cancel" && (event.defaultPrevented || event.isDefaultPrevented()),
          focus: null,
        }),
      )
    }
  }
  return true
}

export const nativeFieldGroupKeyHandler =
  (
    scope: TNativeFieldInputScope,
    props: Readonly<{
      direction: "ltr" | "rtl"
      onKeyDown?: (event: TNativeKeyboardEvent) => void
      onKeyUp?: (event: TNativeKeyboardEvent) => void
    }>,
  ) =>
  (event: TNativeFieldKeyEvent, target: number) =>
    receiveNativeFieldKey(scope, event, {
      target,
      group: true,
      run: () => {
        const data = event.nativeEvent
        if (data.phase === "down" && !data.cancelled && (data.key === "ArrowLeft" || data.key === "ArrowRight")) {
          event.preventDefault()
          event.stopPropagation()
          const group = packetFor(event).groups.find((candidate) => candidate.target === target)!
          moveNativeFieldFocus(scope, event, {
            groupTarget: group.scopeTarget,
            kind:
              props.direction === "rtl"
                ? data.key === "ArrowLeft"
                  ? "physical-left"
                  : "physical-right"
                : data.key === "ArrowLeft"
                  ? "previous"
                  : "next",
          })
        }
        if (isNativeFieldInputCurrent(scope, event)) {
          const callback = data.phase === "down" ? props.onKeyDown : props.onKeyUp
          callback?.(event)
        }
      },
    })
