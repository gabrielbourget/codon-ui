export const createNativeBackdropLifetime = () => {
  let generation = 0
  let current: object | null = null
  let version = 0
  let observed = ""
  const listeners = new Set<() => void>()
  return {
    issue: (ownerId: string, valid: () => boolean) => {
      const identity = {}
      const observation = version
      return {
        identity,
        ownerId,
        generation: ++generation,
        isCurrent: () => current === identity && observation === version && valid(),
      }
    },
    commit: (identity: object) => {
      current = identity
    },
    retire: () => {
      current = null
    },
    stage: (signature: string) => {
      observed = signature
    },
    observe: (signature: string) => {
      if (signature === observed) return
      observed = signature
      current = null
      version++
      for (const listener of [...listeners]) listener()
    },
    snapshot: () => version,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
