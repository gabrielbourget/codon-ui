export type TNativeSharedElementWindow = Readonly<{
  windowId: string
  scopeOwnerId: string
  epoch: number
  rootIdentity: string
}>
export type TNativeSharedElementSnapshot = Readonly<{
  owner: symbol
  window: TNativeSharedElementWindow
  rectangle: readonly number[]
  translates: boolean
  values: Readonly<Record<string, unknown>>
  consumed: () => void
}>

export const createNativeSharedElementScope = () => {
  let pending: TNativeSharedElementSnapshot | undefined
  return {
    store: (snapshot: TNativeSharedElementSnapshot) => {
      if (pending && pending.owner !== snapshot.owner) pending.consumed()
      pending = snapshot
    },
    peek: () => pending,
    withdraw: (owner: symbol) => {
      if (pending?.owner === owner) pending = undefined
    },
    take: (window: TNativeSharedElementWindow) => {
      const previous = pending
      pending = undefined
      if (!previous) return undefined
      previous.consumed()
      if (
        previous.window.windowId !== window.windowId ||
        previous.window.scopeOwnerId !== window.scopeOwnerId ||
        previous.window.epoch !== window.epoch ||
        previous.window.rootIdentity !== window.rootIdentity
      )
        return undefined
      return previous
    },
    clear: () => {
      pending = undefined
    },
  }
}
export type TNativeSharedElementScope = ReturnType<typeof createNativeSharedElementScope>
