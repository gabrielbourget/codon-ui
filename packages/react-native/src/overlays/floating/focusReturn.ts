import type { RefObject } from "react"
import type { TextInput, View } from "react-native"

import { focusNativeTarget } from "../../input/focus"
import type { TNativeKeyScope } from "../../input/keyScope"

import type { TNativeFloatingLayerRegistry } from "./registry"

type TTarget = RefObject<View | TextInput | null>
export const createNativeFloatingFocusReturns = (options: {
  layers: TNativeFloatingLayerRegistry
  live: () => boolean
  windowActive: () => boolean
}) => {
  type TEntry = {
    owner: string
    parent: string | null
    input: TNativeKeyScope
    session: string
    target: TTarget
    frame: ReturnType<typeof requestAnimationFrame> | null
    release: () => void
  }
  const pending = new Map<string, TEntry>()
  let disposed = false
  const session = (input: TNativeKeyScope) => JSON.stringify(input.acknowledgedSession())
  const retire = (entry: TEntry) => {
    if (pending.get(entry.owner) !== entry) return
    pending.delete(entry.owner)
    if (entry.frame !== null) cancelAnimationFrame(entry.frame)
    entry.release()
  }
  const eligible = (entry: TEntry) =>
    !disposed &&
    options.live() &&
    options.windowActive() &&
    entry.input.isWindowActive() !== false &&
    session(entry.input) === entry.session
  const check = (entry: TEntry) => {
    if (pending.get(entry.owner) !== entry) return
    const stack = options.layers.presentationOrder()
    if (!eligible(entry)) {
      retire(entry)
      return
    }
    if (stack.includes(entry.owner)) return
    if (!options.layers.canRestore(entry.parent)) {
      retire(entry)
      return
    }
    if (!entry.input.isNativeReady() || entry.frame !== null) return
    entry.frame = requestAnimationFrame(() => {
      entry.frame = null
      if (pending.get(entry.owner) !== entry) return
      const canReturn = eligible(entry) && options.layers.canRestore(entry.parent)
      if (canReturn && !entry.input.isNativeReady()) return
      retire(entry)
      if (canReturn) focusNativeTarget(entry.target.current)
    })
  }
  return {
    cancel: (owner: string) => {
      const entry = pending.get(owner)
      if (entry) retire(entry)
    },
    request: (owner: string, parent: string | null, input: TNativeKeyScope | null, target: TTarget) => {
      const previous = pending.get(owner)
      if (previous) retire(previous)
      if (
        disposed ||
        !input?.acknowledgedSession().windowId ||
        !options.live() ||
        !options.windowActive() ||
        input.isWindowActive() === false
      )
        return undefined
      const entry: TEntry = {
        owner,
        parent,
        input,
        session: session(input),
        target,
        frame: null,
        release: () => undefined,
      }
      pending.set(owner, entry)
      const releaseLayer = options.layers.subscribe(() => check(entry)),
        releaseInput = input.subscribe(() => check(entry))
      entry.release = () => {
        releaseLayer()
        releaseInput()
      }
      check(entry)
      return {
        updateTarget: (next: TTarget) => {
          if (pending.get(owner) === entry) entry.target = next
        },
      }
    },
    dispose: () => {
      disposed = true
      for (const entry of [...pending.values()]) retire(entry)
    },
  }
}
