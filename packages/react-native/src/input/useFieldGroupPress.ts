import { useInsertionEffect, useRef, useState } from "react"

import {
  isNativeFieldInputCurrent,
  moveNativeFieldFocus,
  nativeFieldInputPacket,
  receiveNativeFieldPointer,
  type TNativeFieldInputScope,
  type TNativeFieldPointerEvent,
  type TNativeFieldPointerPhase,
} from "./fieldInput"

type TOptions = Readonly<{
  scope: TNativeFieldInputScope | null
  onPointerDown?: (event: TNativeFieldPointerEvent) => void
  onPointerUp?: (event: TNativeFieldPointerEvent) => void
  onPointerCancel?: (event: TNativeFieldPointerEvent) => void
  onClick?: (event: TNativeFieldPointerEvent) => void
}>
// Pinned source identities and license: ../date/entry/UPSTREAM.json.
type TContact = {
  target: number
  root: object
  pointerId: number
  pointerType: string
  windowId: string
  surfaceId: number
  moduleLease: string
}
const callbacks = {
  "pointer-start": "onPointerDown",
  "pointer-end": "onPointerUp",
  "pointer-cancel": "onPointerCancel",
  "pointer-click": "onClick",
} as const

// The canonical field's two Group hosts share one usePress state. Native SDK
// click eligibility and outside-stream termination remain separate prerequisites.
export class NativeFieldGroupPress {
  #contact: TContact | null = null
  constructor(private readonly current: () => TOptions) {}
  retire = () => {
    this.#contact = null
  }
  receive = (event: TNativeFieldPointerEvent, target: number, phase: TNativeFieldPointerPhase) => {
    const { scope } = this.current()
    if (!scope || !scope.current()) {
      this.retire()
      return false
    }
    try {
      return receiveNativeFieldPointer(scope, event, phase, {
        target,
        group: true,
        run: () => {
          const packet = nativeFieldInputPacket(event),
            data = event.nativeEvent,
            group = packet.groups.find((entry) => entry.target === target)!
          const contact = this.#contact
          if (
            contact &&
            (contact.moduleLease !== packet.moduleLease ||
              contact.windowId !== packet.identity.windowId ||
              contact.surfaceId !== packet.identity.surfaceId ||
              (contact.target === target && contact.root !== event.currentTarget))
          )
            this.retire()
          if (phase === "pointer-start" && data.button === 0) {
            const starting = !this.#contact
            if (starting)
              this.#contact = {
                target,
                root: event.currentTarget,
                pointerId: data.pointerId,
                pointerType: data.pointerType,
                windowId: packet.identity.windowId,
                surfaceId: packet.identity.surfaceId,
                moduleLease: packet.moduleLease,
              }
            else this.#contact!.pointerType = data.pointerType
            if (starting && data.isPrimary && data.pointerType === "mouse")
              moveNativeFieldFocus(scope, event, { groupTarget: group.scopeTarget, kind: "press" })
            event.stopPropagation()
          } else if (phase === "pointer-click" && data.button === 0) {
            const contact = this.#contact
            this.retire()
            if (contact && data.isPrimary && (contact.pointerType === "touch" || contact.pointerType === "pen"))
              moveNativeFieldFocus(scope, event, { groupTarget: group.scopeTarget, kind: "press" })
            event.stopPropagation()
          } else if (phase === "pointer-cancel") this.retire()
          else if (phase === "pointer-end") {
            const contact = this.#contact
            void Promise.resolve().then(() => {
              if (this.#contact !== contact || !contact || data.pointerId !== contact.pointerId) return
              if (
                !scope.current() ||
                (!event.isPropagationStopped() && !packet.groups.some((entry) => entry.target === contact.target))
              )
                this.retire()
            })
          }
          if (isNativeFieldInputCurrent(scope, event)) this.current()[callbacks[phase]]?.(event)
          else this.retire()
        },
      })
    } catch (error) {
      this.retire()
      throw error
    }
  }
}

export const useNativeFieldGroupPress = (options: TOptions) => {
  const current = useRef(options)
  const [press] = useState(() => new NativeFieldGroupPress(() => current.current))
  useInsertionEffect(() => {
    current.current = options
    if (!options.scope?.current()) press.retire()
  })
  useInsertionEffect(() => press.retire, [press])
  return press.receive
}
