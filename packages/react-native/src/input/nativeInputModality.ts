import { useSyncExternalStore } from "react"

import type { TNativeKeyScope } from "./keyScope"
import { observeAcceptedNativeWindowPointer } from "./nativeWindowPointers"
import type { NativeInputModalityData } from "./specs/CUIKeyboardScopeNativeComponent"

export type TNativeInputModalityWitness = Readonly<{
  origin: "keyboard" | "pointer" | "virtual"
  source: "native-input-modality" | "window-pointer"
  windowId: string
  epoch: number
  revision: number
}>

const createWitness = (scope: TNativeKeyScope) => {
  const listeners = new Set<() => void>()
  let current: TNativeInputModalityWitness | null = null
  let session = scope.acknowledgedSession()
  let revision = 0
  let owners = 0
  let queued = false
  let releasePointer: (() => void) | undefined
  let releaseScope: (() => void) | undefined
  const notify = () => {
    if (queued) return
    queued = true
    void Promise.resolve().then(() => {
      queued = false
      for (const listener of [...listeners]) listener()
    })
  }
  const sync = () => {
    const next = scope.acknowledgedSession()
    if (next.windowId !== session.windowId || next.epoch !== session.epoch || scope.isWindowActive() !== true) {
      session = next
      if (current) {
        current = null
        notify()
      }
    }
  }
  const publish = (origin: TNativeInputModalityWitness["origin"], source: TNativeInputModalityWitness["source"]) => {
    sync()
    if (!owners || !session.windowId || scope.isWindowActive() !== true) return
    // A single local acceptance order joins independent native producers without comparing their counters.
    current = Object.freeze({ origin, source, ...session, revision: ++revision })
    notify()
  }
  const recordAcceptedInput = (data: NativeInputModalityData) => {
    sync()
    if (
      scope.lastInput() !== data ||
      data.ownerId !== scope.ownerId ||
      data.windowId !== session.windowId ||
      data.epoch !== session.epoch
    )
      return
    publish(data.origin, "native-input-modality")
  }
  return {
    getSnapshot: () => {
      const next = scope.acknowledgedSession()
      return owners &&
        scope.isWindowActive() === true &&
        next.windowId === session.windowId &&
        next.epoch === session.epoch
        ? current
        : null
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    recordAcceptedInput,
    attach: () => {
      if (++owners === 1) {
        sync()
        releaseScope = scope.subscribe(sync)
        releasePointer = observeAcceptedNativeWindowPointer((data) => {
          sync()
          if (data.phase === "activation" && data.pointerType === "virtual" && data.windowId === session.windowId)
            publish("virtual", "window-pointer")
        })
        const input = scope.lastInput()
        if (input) recordAcceptedInput(input)
      }
      let released = false
      return () => {
        if (released) return
        released = true
        if (--owners) return
        releasePointer?.()
        releaseScope?.()
        releasePointer = undefined
        releaseScope = undefined
        current = null
        notify()
      }
    },
  }
}

const witnesses = new WeakMap<TNativeKeyScope, ReturnType<typeof createWitness>>()
const witnessFor = (scope: TNativeKeyScope) => {
  let witness = witnesses.get(scope)
  if (!witness) {
    witness = createWitness(scope)
    witnesses.set(scope, witness)
  }
  return witness
}

export const attachNativeInputModalityWitness = (scope: TNativeKeyScope) => witnessFor(scope).attach()
export const recordAcceptedNativeInputModality = (scope: TNativeKeyScope, data: NativeInputModalityData) =>
  witnessFor(scope).recordAcceptedInput(data)

const emptySubscribe = () => () => {}
const emptySnapshot = () => null
export const useNativeInputModalityWitness = (scope: TNativeKeyScope | null): TNativeInputModalityWitness | null => {
  const witness = scope ? witnessFor(scope) : null
  return useSyncExternalStore(
    witness?.subscribe ?? emptySubscribe,
    witness?.getSnapshot ?? emptySnapshot,
    emptySnapshot,
  )
}
