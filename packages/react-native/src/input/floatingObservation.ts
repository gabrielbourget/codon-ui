import type { NativeFloatingObservation } from "./specs/CUIKeyboardScopeNativeComponent"

export type TNativeFloatingObservationTarget = Readonly<{
  id: string
  targetTag: number
  descriptionTag: number
  descriptionLabel: string
}>
export const createNativeFloatingObservations = () => {
  const entries = new Map<
    string,
    { target: TNativeFloatingObservationTarget; receive: (data: NativeFloatingObservation) => void }
  >()
  const listeners = new Set<() => void>()
  let serial = 0
  let revision = 0
  let disposed = false
  const changed = () => {
    revision++
    for (const listener of listeners) listener()
  }
  return {
    snapshot: () => revision,
    targets: () => [...entries.values()].map(({ target }) => target),
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    register: (
      targetTag: number,
      receive: (data: NativeFloatingObservation) => void,
      descriptionTag = 0,
      descriptionLabel = "Description",
    ) => {
      if (disposed || !Number.isSafeInteger(targetTag) || targetTag <= 0) return undefined
      const id = `floating-${++serial}`
      entries.set(id, { target: { id, targetTag, descriptionTag, descriptionLabel }, receive })
      changed()
      return () => {
        if (entries.delete(id)) changed()
      }
    },
    dispatch: (data: NativeFloatingObservation) => {
      const entry = entries.get(data.id)
      if (disposed || entry?.target.targetTag !== data.targetTag) return false
      if (
        ![data.x, data.y, data.width, data.height, data.scrollRevision, data.revision].every(Number.isFinite) ||
        data.width < 0 ||
        data.height < 0 ||
        data.scrollRevision < 0 ||
        data.revision < 0
      )
        return false
      entry.receive(data)
      return true
    },
    dispose: () => {
      disposed = true
      entries.clear()
      listeners.clear()
    },
  }
}
export type TNativeFloatingObservations = ReturnType<typeof createNativeFloatingObservations>
